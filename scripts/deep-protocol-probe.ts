import net from 'net';
import http from 'http';
import { getArpTable, getLocalNetworkInterfaces } from '../server/secureye/scanner';

async function runDeepProbe() {
  console.log('================================================================');
  console.log('🔬 S-FB3K Deep Protocol & Hardware Prober');
  console.log('================================================================\n');

  const arp = await getArpTable();
  console.log('Active ARP Table entries:');
  for (const [ip, mac] of arp) {
    console.log(`   ${ip.padEnd(16)} -> ${mac}`);
  }

  // Potential candidate IPs on LAN
  const targetIps = ['192.168.29.83', '192.168.29.69', '192.168.29.60', '192.168.29.155', '192.168.29.235', '172.30.242.155'];

  // Test TCP open ports on each target
  const ports = [5005, 80, 7005, 8080, 4370];
  const activeTargets: { ip: string; port: number }[] = [];

  console.log('\n[1/3] Testing TCP connectivity across candidate IPs...');
  for (const ip of targetIps) {
    for (const port of ports) {
      const isOpen = await testTcp(ip, port, 400);
      if (isOpen) {
        console.log(`   ✅ OPEN: ${ip}:${port}`);
        activeTargets.push({ ip, port });
      }
    }
  }

  if (activeTargets.length === 0) {
    console.log('   ❌ No candidate IPs responded on standard biometric ports.');
  }

  // Test Dialect 1: FKWeb / HTTP length-prefixed JSON on active ports
  console.log('\n[2/3] Probing FKWeb / Realand JSON dialects...');
  for (const target of activeTargets) {
    console.log(`\n--- Probing ${target.ip}:${target.port} ---`);
    await probeFkWebJson(target.ip, target.port, 'GET_USER_ID_LIST', { cmd_id: 'GET_USER_ID_LIST' });
    await probeFkWebJson(target.ip, target.port, 'GET_USER_INFO', { cmd_id: 'GET_USER_INFO', user_id: 1 });
    await probeFkWebJson(target.ip, target.port, 'GET_ENROLL_DATA', { cmd_id: 'GET_ENROLL_DATA', backup_num: 13 });
    await probeFkWebJson(target.ip, target.port, 'GET_DEVICE_STATUS', { cmd_id: 'GET_DEVICE_STATUS' });
    
    // Dialect 2: Realand Binary Protocol (55 AA Sync)
    await probeRealandBinary(target.ip, target.port);
    
    // Dialect 3: ZK UDP/TCP
    await probeZkBinary(target.ip, target.port);
  }

  console.log('\n================================================================');
  console.log('🏁 Probe finished.');
}

function testTcp(ip: string, port: number, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(timeoutMs);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => { s.destroy(); resolve(false); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.connect(port, ip);
  });
}

function probeFkWebJson(ip: string, port: number, name: string, payload: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(2500);

    const jsonStr = JSON.stringify(payload);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(jsonStr.length, 0);
    const body = Buffer.concat([lenBuf, Buffer.from(jsonStr, 'utf8'), Buffer.from([0])]);

    const req =
      `POST /device/cmd HTTP/1.1\r\n` +
      `Host: ${ip}:${port}\r\n` +
      `request_code: receive_cmd\r\n` +
      `dev_id: 1\r\n` +
      `trans_id: 101\r\n` +
      `Content-Length: ${body.length}\r\n` +
      `Connection: close\r\n\r\n`;

    let data = Buffer.alloc(0);
    s.on('data', (chunk) => { data = Buffer.concat([data, chunk]); });
    s.on('end', () => {
      console.log(`   [FKWeb JSON] ${name} Response (${data.length} bytes):`);
      if (data.length > 0) {
        console.log(`   Raw: ${data.toString('utf8').substring(0, 400)}`);
      }
      resolve();
    });
    s.on('error', (err) => {
      console.log(`   [FKWeb JSON] ${name} Error: ${err.message}`);
      resolve();
    });
    s.on('timeout', () => {
      console.log(`   [FKWeb JSON] ${name} Timeout (device did not reply to inbound POST)`);
      s.destroy();
      resolve();
    });

    s.connect(port, ip, () => {
      s.write(req);
      s.write(body);
    });
  });
}

function probeRealandBinary(ip: string, port: number): Promise<void> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(2000);

    // Realand FK623 / FK635 / S-FB3K binary packet:
    // Header 0x55 0xAA 0xAA 0x55 + cmd 0x01 (connect) + devId 1
    const pkt = Buffer.from([0x55, 0xAA, 0xAA, 0x55, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00]);

    let data = Buffer.alloc(0);
    s.on('data', (chunk) => { data = Buffer.concat([data, chunk]); });
    s.on('end', () => {
      console.log(`   [Realand Binary 55AA] Response (${data.length} bytes): ${data.toString('hex')}`);
      resolve();
    });
    s.on('error', (err) => {
      console.log(`   [Realand Binary 55AA] Error: ${err.message}`);
      resolve();
    });
    s.on('timeout', () => {
      console.log(`   [Realand Binary 55AA] Timeout`);
      s.destroy();
      resolve();
    });

    s.connect(port, ip, () => {
      s.write(pkt);
    });
  });
}

function probeZkBinary(ip: string, port: number): Promise<void> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(2000);

    // ZK connect command: 0x50 0x50 0x82 0x7D ...
    const zkConnect = Buffer.from([0x50, 0x50, 0x82, 0x7D, 0x08, 0x00, 0x00, 0x00, 0xE8, 0x03, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00]);

    let data = Buffer.alloc(0);
    s.on('data', (chunk) => { data = Buffer.concat([data, chunk]); });
    s.on('end', () => {
      console.log(`   [ZK Binary] Response (${data.length} bytes): ${data.toString('hex')}`);
      resolve();
    });
    s.on('error', (err) => {
      console.log(`   [ZK Binary] Error: ${err.message}`);
      resolve();
    });
    s.on('timeout', () => {
      console.log(`   [ZK Binary] Timeout`);
      s.destroy();
      resolve();
    });

    s.connect(port, ip, () => {
      s.write(zkConnect);
    });
  });
}

runDeepProbe();
