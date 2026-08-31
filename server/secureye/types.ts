/**
 * Secureye S-FB3K / FKWeb Biometric Protocol Type Definitions
 */

export type ProtocolRequestCode =
  | 'realtime_glog'
  | 'realtime_enroll_data'
  | 'receive_cmd'
  | 'send_cmd_result'
  | string;

export type ProtocolCommandId =
  | 'GET_DEVICE_STATUS'
  | 'GET_USER_ID_LIST'
  | 'GET_USER_INFO'
  | 'GET_LOG_DATA'
  | 'SET_TIME'
  | 'CLEAR_LOG_DATA'
  | 'CLEAR_ENROLL_DATA'
  | 'CLEAR_ALL_ADMIN'
  | string;

export enum VerificationType {
  DEFAULT = 'DEFAULT',
  FINGERPRINT = 'FINGERPRINT',
  PASSWORD = 'PASSWORD',
  CARD = 'CARD',
  FACE = 'FACE',
  PALM = 'PALM',
  OTHER = 'OTHER',
}

export enum AttendanceEventType {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
  BREAK_IN = 'BREAK_IN',
  BREAK_OUT = 'BREAK_OUT',
  OVERTIME_IN = 'OVERTIME_IN',
  OVERTIME_OUT = 'OVERTIME_OUT',
  GENERAL_PUNCH = 'GENERAL_PUNCH',
}

export interface FKWebRawHeaders {
  requestCode?: string;
  devId?: string;
  transId?: number;
  cmdId?: string;
  responseCode?: string;
  contentType?: string;
  rawHeaders: Record<string, string | string[] | undefined>;
}

export interface RealtimeGlogPayload {
  user_id: string | number;
  verify_mode: number;
  io_mode: number;
  io_time: string;
  fk_bin_data_lib?: string;
  log_image?: string | null;
  [key: string]: unknown;
}

export interface RealtimeEnrollPayload {
  user_id: string | number;
  user_name?: string;
  backup_num?: number;
  privilege?: number;
  card_number?: string;
  fp_data?: string;
  face_data?: string;
  [key: string]: unknown;
}

export interface DeviceStatusData {
  user_count?: number;
  fp_count?: number;
  face_count?: number;
  card_count?: number;
  pwd_count?: number;
  log_count?: number;
  admin_count?: number;
  firmware?: string;
  device_time?: string;
  mac_address?: string;
  ip_address?: string;
  serial_number?: string;
  [key: string]: unknown;
}

export interface NormalizedAttendanceEvent {
  deviceId: string;
  deviceUserId: string;
  employeeCode?: string;
  employeeName?: string;
  timestamp: Date;
  eventType: AttendanceEventType;
  verificationType: VerificationType;
  source: 'REALTIME' | 'SYNC' | 'CSV_IMPORT' | 'SIMULATOR';
  transactionId?: number;
  rawPayload?: Record<string, unknown>;
}

export interface NormalizedEmployee {
  deviceId: string;
  deviceUserId: string;
  employeeCode?: string;
  name: string;
  cardNumber?: string;
  privilege?: number;
  faceEnabled?: boolean;
  fingerprintEnabled?: boolean;
  passwordEnabled?: boolean;
  status?: string;
}

export interface QueuedCommand {
  id: string;
  deviceId: string;
  cmdId: ProtocolCommandId;
  transId: number;
  parameters?: Record<string, unknown>;
  createdAt: Date;
  status: 'PENDING' | 'SENT' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  responsePayload?: Record<string, unknown>;
  error?: string;
}

export interface DeviceConnectionTestResult {
  success: boolean;
  latencyMs: number;
  deviceModel?: string;
  deviceId?: string;
  firmware?: string;
  userCount?: number;
  logCount?: number;
  deviceTime?: string;
  errorMessage?: string;
  rawResponse?: unknown;
}
