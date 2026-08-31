import { prisma } from '../../lib/prisma';
import { attendanceEventBus } from '../../lib/events';
import {
  AttendanceEventType,
  DeviceStatusData,
  NormalizedAttendanceEvent,
  RealtimeEnrollPayload,
  RealtimeGlogPayload,
  VerificationType,
} from './types';
import {
  decodeAttendanceEventType,
  decodeVerificationType,
  extractJsonFromBuffer,
  normalizeRealtimeGlog,
  parseDeviceTimestamp,
  parseFKHttpHeaders,
} from './parser';
import { createProtocolResponseHeaders, formatCommandBody } from './serializer';
import { deviceCommandQueue } from './command-queue';
import { protocolCapture } from './protocol-capture';

export interface ProtocolProcessingResult {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer;
  handledEvent?: NormalizedAttendanceEvent;
}

/**
 * Main dispatcher for all incoming device requests from Secureye S-FB3K / FKWeb terminals.
 */
export async function handleIncomingDevicePacket(
  rawHeaders: Record<string, string | string[] | undefined>,
  rawBuffer: Buffer,
  clientIp = '127.0.0.1'
): Promise<ProtocolProcessingResult> {
  const startTime = Date.now();
  const parsedHeaders = parseFKHttpHeaders(rawHeaders);
  const requestCode = parsedHeaders.requestCode || 'UNKNOWN';
  const rawDevId = parsedHeaders.devId || 'DEFAULT_DEV';
  const transId = parsedHeaders.transId;

  let parsedBodyResult: { json: Record<string, unknown>; binaryTail?: Buffer } | null = null;
  try {
    parsedBodyResult = extractJsonFromBuffer(rawBuffer);
  } catch (err) {
    // Some heartbeat or simple requests have no JSON body
  }

  const jsonPayload = parsedBodyResult?.json || {};

  // Record capture log
  const captureItem = protocolCapture.capture({
    direction: 'INCOMING',
    sourceIp: clientIp,
    requestCode,
    cmdId: parsedHeaders.cmdId,
    devId: rawDevId,
    transId,
    headers: Object.fromEntries(
      Object.entries(rawHeaders).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v || ''])
    ),
    bodySize: rawBuffer.length,
    bodyPreview: rawBuffer.length > 0 ? rawBuffer.subarray(0, 200).toString('utf8') : undefined,
    rawPayload: jsonPayload,
    status: 'SUCCESS',
    durationMs: Date.now() - startTime,
  });

  // High-visibility terminal wire log
  console.log(`\n======================================================`);
  console.log(`📡 [DEVICE INBOUND WIRE] ${new Date().toLocaleTimeString()} from ${clientIp}`);
  console.log(`   Action / Request Code : ${requestCode} (DevID: ${rawDevId}, TransID: ${transId || 'N/A'})`);
  console.log(`   Headers               : ${JSON.stringify(rawHeaders)}`);
  if (rawBuffer.length > 0) {
    console.log(`   Raw Wire Payload (${rawBuffer.length} bytes):`);
    console.log(`   ${JSON.stringify(jsonPayload)}`);
  }
  console.log(`======================================================\n`);

  // Emit to live debug UI
  try {
    attendanceEventBus?.emitWirePacket?.(captureItem);
  } catch (err) {
    // Non-fatal
  }

  // Ensure device exists or update lastSeenAt
  const device = await ensureDeviceRegistered(rawDevId, clientIp);

  let result: ProtocolProcessingResult;

  switch (requestCode) {
    case 'realtime_glog': {
      result = await handleRealtimeGlog(device.id, rawDevId, jsonPayload as unknown as RealtimeGlogPayload, transId);
      break;
    }

    case 'realtime_enroll_data': {
      result = await handleRealtimeEnroll(device.id, rawDevId, jsonPayload as unknown as RealtimeEnrollPayload, transId);
      break;
    }

    case 'receive_cmd': {
      result = await handleReceiveCmd(device.id, rawDevId, transId);
      break;
    }

    case 'send_cmd_result': {
      result = await handleSendCmdResult(device.id, rawDevId, parsedHeaders.cmdId, transId, jsonPayload);
      break;
    }

    default: {
      // Default fallback response to acknowledge packet safely
      result = {
        statusCode: 200,
        headers: createProtocolResponseHeaders({ responseCode: 'OK', transId, devId: rawDevId }),
        body: Buffer.alloc(0),
      };
      break;
    }
  }

  // Record database request log asynchronously
  prisma.deviceRequestLog
    .create({
      data: {
        deviceId: device.id,
        requestCode,
        transactionId: transId,
        requestHeaders: JSON.stringify(rawHeaders),
        requestBody: rawBuffer.length > 0 ? rawBuffer.subarray(0, 500).toString('utf8') : null,
        responseStatus: result.statusCode,
        responseBody: `Headers: ${JSON.stringify(result.headers)} (Length: ${result.body.length})`,
        durationMs: Date.now() - startTime,
      },
    })
    .catch(() => {});

  return result;
}

/**
 * Handles real-time attendance punch packets.
 */
async function handleRealtimeGlog(
  deviceDbId: string,
  hardwareDevId: string,
  payload: RealtimeGlogPayload,
  transId?: number
): Promise<ProtocolProcessingResult> {
  const normalized = normalizeRealtimeGlog(payload, deviceDbId, transId);
  const userIdStr = normalized.deviceUserId;

  // Find or create local Employee record
  let employee = await prisma.employee.findUnique({
    where: {
      deviceId_deviceUserId: {
        deviceId: deviceDbId,
        deviceUserId: userIdStr,
      },
    },
  });

  if (!employee) {
    employee = await prisma.employee.create({
      data: {
        deviceId: deviceDbId,
        deviceUserId: userIdStr,
        name: `Employee ${userIdStr}`,
        employeeCode: `EMP-${userIdStr}`,
        status: 'ACTIVE',
      },
    });
  }

  normalized.employeeCode = employee.employeeCode || undefined;
  normalized.employeeName = employee.name;

  // Deduplication logic: (deviceId, deviceUserId, timestamp, eventType)
  try {
    await prisma.attendanceEvent.upsert({
      where: {
        deviceId_deviceUserId_timestamp_eventType: {
          deviceId: deviceDbId,
          deviceUserId: userIdStr,
          timestamp: normalized.timestamp,
          eventType: normalized.eventType,
        },
      },
      update: {
        verificationType: normalized.verificationType,
        source: 'REALTIME',
        rawPayload: JSON.stringify(payload),
      },
      create: {
        deviceId: deviceDbId,
        employeeId: employee.id,
        deviceUserId: userIdStr,
        timestamp: normalized.timestamp,
        eventType: normalized.eventType,
        verificationType: normalized.verificationType,
        source: 'REALTIME',
        transactionId: transId,
        rawPayload: JSON.stringify(payload),
      },
    });

    // Update device log count and lastSyncAt
    await prisma.device.update({
      where: { id: deviceDbId },
      data: {
        lastSeenAt: new Date(),
        lastSyncAt: new Date(),
        status: 'ONLINE',
        logCount: { increment: 1 },
      },
    });

    // Broadcast event to real-time subscribers
    attendanceEventBus.emitPunch(normalized);
  } catch (err) {
    console.error('Error saving attendance punch:', err);
  }

  return {
    statusCode: 200,
    headers: createProtocolResponseHeaders({ responseCode: 'OK', transId, devId: hardwareDevId }),
    body: Buffer.alloc(0),
    handledEvent: normalized,
  };
}

/**
 * Handles real-time enrollment packets.
 */
async function handleRealtimeEnroll(
  deviceDbId: string,
  hardwareDevId: string,
  payload: RealtimeEnrollPayload,
  transId?: number
): Promise<ProtocolProcessingResult> {
  const userIdStr = String(payload.user_id || 'UNKNOWN');
  const userName = payload.user_name || `Employee ${userIdStr}`;

  await prisma.employee.upsert({
    where: {
      deviceId_deviceUserId: {
        deviceId: deviceDbId,
        deviceUserId: userIdStr,
      },
    },
    update: {
      name: userName,
      cardNumber: payload.card_number || undefined,
      privilege: payload.privilege || 0,
      fingerprintEnabled: Boolean(payload.fp_data),
      faceEnabled: Boolean(payload.face_data),
      updatedAt: new Date(),
    },
    create: {
      deviceId: deviceDbId,
      deviceUserId: userIdStr,
      employeeCode: `EMP-${userIdStr}`,
      name: userName,
      cardNumber: payload.card_number || undefined,
      privilege: payload.privilege || 0,
      fingerprintEnabled: Boolean(payload.fp_data),
      faceEnabled: Boolean(payload.face_data),
      status: 'ACTIVE',
    },
  });

  return {
    statusCode: 200,
    headers: createProtocolResponseHeaders({ responseCode: 'OK', transId, devId: hardwareDevId }),
    body: Buffer.alloc(0),
  };
}

/**
 * Handles device polling heartbeat (receive_cmd).
 */
async function handleReceiveCmd(
  deviceDbId: string,
  hardwareDevId: string,
  transId?: number
): Promise<ProtocolProcessingResult> {
  // Update device presence
  await prisma.device.update({
    where: { id: deviceDbId },
    data: {
      lastSeenAt: new Date(),
      status: 'ONLINE',
      lastError: null,
    },
  });

  // Check if any command is queued for this device
  let queuedCmd = deviceCommandQueue.popNext(hardwareDevId);

  // If no command queued and user count is 0, auto-queue GET_USER_ID_LIST
  if (!queuedCmd) {
    const empCount = await prisma.employee.count({ where: { deviceId: deviceDbId } });
    if (empCount === 0) {
      queuedCmd = {
        id: `auto_${Date.now()}`,
        deviceId: hardwareDevId,
        cmdId: 'GET_USER_ID_LIST',
        transId: 101,
        parameters: {},
        createdAt: new Date(),
        status: 'PENDING',
      };
    }
  }

  if (queuedCmd) {
    const cmdBody = formatCommandBody(queuedCmd.parameters);
    return {
      statusCode: 200,
      headers: createProtocolResponseHeaders({
        responseCode: 'OK',
        cmdId: queuedCmd.cmdId,
        transId: queuedCmd.transId,
        devId: hardwareDevId,
        bodyLength: cmdBody.length,
      }),
      body: cmdBody,
    };
  }

  // Standard empty acknowledgement
  return {
    statusCode: 200,
    headers: createProtocolResponseHeaders({ responseCode: 'OK', transId, devId: hardwareDevId }),
    body: Buffer.alloc(0),
  };
}

/**
 * Handles results of commands executed by the terminal.
 */
async function handleSendCmdResult(
  deviceDbId: string,
  hardwareDevId: string,
  cmdId?: string,
  transId?: number,
  payload: Record<string, unknown> = {}
): Promise<ProtocolProcessingResult> {
  const actualCmdId = (payload.cmd_id as string) || cmdId || 'UNKNOWN';
  const effectiveTransId = (payload.trans_id as number) || transId || 0;

  // Resolve pending command promise in memory
  deviceCommandQueue.resolveResult(hardwareDevId, effectiveTransId, payload);

  // Process data based on command type
  if (actualCmdId === 'GET_DEVICE_STATUS') {
    const statusData = (payload.data || payload) as DeviceStatusData;
    await prisma.device.update({
      where: { id: deviceDbId },
      data: {
        firmware: (statusData.firmware as string) || undefined,
        userCount: typeof statusData.user_count === 'number' ? statusData.user_count : undefined,
        logCount: typeof statusData.log_count === 'number' ? statusData.log_count : undefined,
        lastSeenAt: new Date(),
        status: 'ONLINE',
      },
    });
  } else if (actualCmdId === 'GET_USER_ID_LIST' || actualCmdId === 'GET_USER_INFO') {
    const rawUsers = (payload.users || payload.data || payload.user_id_list || payload.id_list || payload.user_list || []) as Array<unknown>;
    if (Array.isArray(rawUsers)) {
      for (const u of rawUsers) {
        const uId = typeof u === 'string' || typeof u === 'number'
          ? String(u)
          : String((u as any)?.user_id || (u as any)?.id || (u as any)?.pin || (u as any)?.userId || '');

        if (uId && uId !== 'undefined' && uId !== 'null') {
          const uName = typeof u === 'object' && u ? String((u as any).name || (u as any).user_name || `Employee ${uId}`) : `Employee ${uId}`;
          const uCard = typeof u === 'object' && u ? ((u as any).card_number || (u as any).cardNumber || undefined) : undefined;

          await prisma.employee.upsert({
            where: {
              deviceId_deviceUserId: {
                deviceId: deviceDbId,
                deviceUserId: uId,
              },
            },
            update: {
              name: uName,
              cardNumber: uCard,
            },
            create: {
              deviceId: deviceDbId,
              deviceUserId: uId,
              employeeCode: `EMP-${uId}`,
              name: uName,
              cardNumber: uCard,
              status: 'ACTIVE',
            },
          });
        }
      }
    }
  } else if (actualCmdId === 'GET_LOG_DATA') {
    const logs = (payload.logs || payload.data || []) as Array<RealtimeGlogPayload>;
    if (Array.isArray(logs)) {
      for (const log of logs) {
        const normalized = normalizeRealtimeGlog(log, deviceDbId);
        await prisma.attendanceEvent.upsert({
          where: {
            deviceId_deviceUserId_timestamp_eventType: {
              deviceId: deviceDbId,
              deviceUserId: normalized.deviceUserId,
              timestamp: normalized.timestamp,
              eventType: normalized.eventType,
            },
          },
          update: {},
          create: {
            deviceId: deviceDbId,
            deviceUserId: normalized.deviceUserId,
            timestamp: normalized.timestamp,
            eventType: normalized.eventType,
            verificationType: normalized.verificationType,
            source: 'SYNC',
            rawPayload: JSON.stringify(log),
          },
        });
      }
    }
  }

  return {
    statusCode: 200,
    headers: createProtocolResponseHeaders({ responseCode: 'OK', transId, devId: hardwareDevId }),
    body: Buffer.alloc(0),
  };
}

/**
 * Ensures a device record exists in the database by hardware ID or IP.
 */
async function ensureDeviceRegistered(hardwareDevId: string, clientIp: string) {
  let device = await prisma.device.findUnique({
    where: { deviceId: hardwareDevId },
  });

  if (!device) {
    device = await prisma.device.findFirst({
      where: { ipAddress: clientIp },
    });
  }

  if (!device) {
    device = await prisma.device.create({
      data: {
        name: `Secureye S-FB3K (${hardwareDevId})`,
        deviceId: hardwareDevId,
        ipAddress: clientIp,
        port: 80,
        protocol: 'Secureye/FKWeb',
        status: 'ONLINE',
        lastSeenAt: new Date(),
      },
    });
  } else {
    device = await prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        status: 'ONLINE',
      },
    });
  }

  return device;
}
