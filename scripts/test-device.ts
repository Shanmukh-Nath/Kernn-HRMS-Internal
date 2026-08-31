import { SecureyeDeviceClient } from '../server/secureye/client';

function parseArgs() {
  const args = process.argv.slice(2);
  let ip = '192.168.1.100';
  let port = 80;
  let deviceId = 'SFB3K_DEVICE';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ip' && args[i + 1]) {
      ip = args[i + 1];
      i++;
    } else if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--id' && args[i + 1]) {
      deviceId = args[i + 1];
      i++;
    }
  }

  return { ip, port, deviceId };
}

async function runDeviceDiagnostic() {
  const { ip, port, deviceId } = parseArgs();

  console.log('================================================================');
  console.log('🔍 Secureye S-FB3K Physical Device Diagnostic Tool');
  console.log(`🎯 Target Device : ${ip}:${port} (ID: ${deviceId})`);
  console.log('================================================================\n');

  const client = new SecureyeDeviceClient({
    ipAddress: ip,
    port,
    deviceId,
    timeoutMs: 5000,
  });

  // Step 1: TCP Socket Reachability
  process.stdout.write('[1/5] Testing TCP socket connectivity... ');
  const tcpResult = await client.testTcpSocket(3000);
  if (!tcpResult.reachable) {
    console.log('❌ FAILED');
    console.log(`\n🚨 Error: Unable to open TCP connection to ${ip}:${port} within 3000ms.`);
    console.log('Possible Causes:');
    console.log('  1. Device is powered off or unplugged from the local network switch.');
    console.log('  2. Device IP address is incorrect or in a different subnet.');
    console.log('  3. Device port is not 80 (check Network -> Server/Comm settings on terminal).');
    console.log('  4. Firewall / VLAN isolation is blocking TCP traffic between host and device.');
    process.exit(1);
  }
  console.log(`✅ OK (${tcpResult.latencyMs}ms)`);

  // Step 2: HTTP Protocol Probe & Identification
  process.stdout.write('[2/5] Probing FKWeb protocol handshake... ');
  const connTest = await client.testConnection();
  if (!connTest.success) {
    console.log('⚠️ PARTIAL');
    console.log(`   Notice: ${connTest.errorMessage}`);
  } else {
    console.log(`✅ OK (Latency: ${connTest.latencyMs}ms)`);
  }

  // Step 3: GET_DEVICE_STATUS
  process.stdout.write('[3/5] Querying device status (GET_DEVICE_STATUS)... ');
  try {
    const status = await client.executeCommand('GET_DEVICE_STATUS', {}, 4000);
    const data = (status.data || status) as Record<string, unknown>;
    console.log('✅ OK');
    console.log(`   • Model    : ${connTest.deviceModel || 'Secureye S-FB3K'}`);
    console.log(`   • Serial   : ${data.serial_number || data.dev_id || deviceId}`);
    console.log(`   • Firmware : ${data.firmware || 'N/A'}`);
    console.log(`   • Users    : ${data.user_count ?? 'N/A'}`);
    console.log(`   • Logs     : ${data.log_count ?? 'N/A'}`);
    console.log(`   • Dev Time : ${data.device_time || 'N/A'}`);
  } catch {
    console.log('⚠️ [UNSUPPORTED / PUSH-ONLY]');
    console.log('   (Device may operate in server-initiated polling mode only)');
  }

  // Step 4: GET_USER_ID_LIST
  process.stdout.write('[4/5] Testing user list retrieval (GET_USER_ID_LIST)... ');
  try {
    const usersRes = await client.executeCommand('GET_USER_ID_LIST', {}, 4000);
    const users = (usersRes.users || usersRes.data || []) as unknown[];
    console.log(`✅ OK (Found ${users.length} enrolled users)`);
  } catch {
    console.log('⚠️ [UNSUPPORTED / PUSH-ONLY]');
  }

  // Step 5: GET_LOG_DATA
  process.stdout.write('[5/5] Testing log retrieval (GET_LOG_DATA)... ');
  try {
    const logsRes = await client.executeCommand('GET_LOG_DATA', {}, 4000);
    const logs = (logsRes.logs || logsRes.data || []) as unknown[];
    console.log(`✅ OK (Retrieved ${logs.length} log records)`);
  } catch {
    console.log('⚠️ [UNSUPPORTED / PUSH-ONLY]');
  }

  console.log('\n================================================================');
  console.log('🏁 Diagnostic Finished.');
  console.log('If device is configured for Push-to-Server mode:');
  console.log(`Set the server IP on the biometric terminal to this computer's LAN IP.`);
  console.log('================================================================\n');
}

runDeviceDiagnostic();
