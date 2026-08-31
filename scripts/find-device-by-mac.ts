import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';
import dgram from 'dgram';

const execAsync = promisify(exec);

const TARGET_MAC = '00:23:79:B9:7A:65';

async function findBiometricByMac() {
  console.log('================================================================');
  console.log(`🎯 Searching for Biometric Device MAC: ${TARGET_MAC}`);
  console.log('================================================================\n');

  // Sweep 192.168.29.x with UDP broadcast packets to force ARP resolution
  const udp = dgram.createSocket('udp4');
  udp.bind(() => {
    udp.setBroadcast(true);
    for (let i = 1; i <= 254; i++) {
      udp.send(Buffer.from('PING'), 5005, `192.168.29.${i}`);
    }
  });

  await new Promise(r => setTimeout(r, 1000));

  const { stdout } = await execAsync('arp -a');
  console.log('Current ARP Table entries:\n' + stdout);

  const lines = stdout.split('\n');
  let foundIp: string | null = null;

  for (const line of lines) {
    const clean = line.replace(/-/g, ':').toUpperCase();
    if (clean.includes('00:23:79') || clean.includes('00-23-79')) {
      const match = line.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
      if (match) {
        foundIp = match[1];
        console.log(`\n🌟 MATCH FOUND: Terminal with MAC ${TARGET_MAC} is at IP: ${foundIp}`);
      }
    }
  }

  if (!foundIp) {
    console.log(`\n⚠️ MAC ${TARGET_MAC} is currently NOT visible in the ARP table.`);
    console.log('This means:');
    console.log('1. The S-FB3K Wi-Fi is currently disconnected from the router, OR');
    console.log('2. The S-FB3K is in a different subnet (e.g. 192.168.1.x) or Ethernet cable is unplugged.');
  }

  process.exit(0);
}

findBiometricByMac();
