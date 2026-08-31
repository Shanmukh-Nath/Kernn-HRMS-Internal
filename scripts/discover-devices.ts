import { getLocalNetworkInterfaces, scanSubnet } from '../server/secureye/scanner';

async function runDiscoveryCli() {
  console.log('================================================================');
  console.log('🔍 Secureye S-FB3K & Biometric LAN Network Scanner');
  console.log('================================================================\n');

  const interfaces = getLocalNetworkInterfaces();

  if (interfaces.length === 0) {
    console.log('❌ No active IPv4 network interfaces found on this computer.');
    process.exit(1);
  }

  console.log('🌐 Detected Local Network Interfaces:');
  interfaces.forEach((iface, idx) => {
    console.log(`   [${idx + 1}] ${iface.name.padEnd(15)} : IP ${iface.ip.padEnd(15)} (Subnet: ${iface.subnetPrefix}.0/24)`);
  });

  // Target the first non-virtual interface or user argument
  const customSubnet = process.argv[2];
  let targetPrefix: string;
  if (customSubnet) {
    const parts = customSubnet.split('.');
    targetPrefix = parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : customSubnet;
  } else {
    // Prefer Wi-Fi or Ethernet over virtual bridges
    const preferred = interfaces.find(i => !i.name.toLowerCase().includes('vgate') && !i.name.toLowerCase().includes('virtual')) || interfaces[0];
    targetPrefix = preferred.subnetPrefix;
  }

  console.log(`\n🚀 Scanning subnet ${targetPrefix}.1 to ${targetPrefix}.254 for active devices...`);
  console.log('   (Probing common biometric ports: 80, 5005, 7005, 8080, 4370, 8000, 9000)...\n');

  const startTime = Date.now();
  let foundCount = 0;

  const devices = await scanSubnet(targetPrefix, 1, 254, undefined, (device) => {
    foundCount++;
    const typeLabel =
      device.deviceType === 'CONFIRMED_BIOMETRIC'
        ? '🌟 [CONFIRMED SECUREYE/BIOMETRIC]'
        : device.deviceType === 'CANDIDATE_BIOMETRIC'
        ? '🏷️  [POTENTIAL BIOMETRIC DEVICE]'
        : '🖥️  [ACTIVE HOST]';

    console.log(
      `   ${typeLabel.padEnd(35)} -> ${device.ip.padEnd(16)} (Ports: ${device.openPorts.join(', ').padEnd(12)} | Latency: ${device.latencyMs}ms)`
    );
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n================================================================');
  console.log(`🏁 Scan Complete in ${duration}s. Found ${devices.length} responsive device(s).\n`);

  if (devices.length === 0) {
    console.log('⚠️ No responsive devices found on this subnet.');
    console.log('Tips:');
    console.log('  1. Ensure the S-FB3K device is powered on and connected to the same Wi-Fi / LAN switch.');
    console.log('  2. On the terminal, check Menu -> Comm -> Network -> IP Address.');
  } else {
    console.log('Suggested Next Step:');
    const best = devices[0];
    console.log(`Connect to device in app or test with:`);
    console.log(`  npm run device:test -- --ip ${best.ip} --port ${best.primaryPort}\n`);
  }
}

runDiscoveryCli();
