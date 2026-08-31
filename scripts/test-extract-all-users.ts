import net from 'net';
import http from 'http';

const TARGET_IP = '192.168.29.83';
const TARGET_PORT = 5005;

console.log('================================================================');
console.log(`🚀 S-FB3K Universal User Extractor Probe on ${TARGET_IP}:${TARGET_PORT}`);
console.log('================================================================\n');

async function testRawTcpJson(cmd: Record<string, unknown>, label: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(3000);

    const jsonStr = JSON.stringify(cmd);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(jsonStr.length, 0);
    const packet = Buffer.concat([lenBuf, Buffer.from(jsonStr, 'utf8'), Buffer.from([0])]);

    let response = Buffer.alloc(0);

    s.on('connect', () => {
      s.write(packet);
    });

    s.on('data', (chunk) => {
      response = Buffer.concat([response, chunk]);
    });

    s.on('end', () => {
      resolve(response);
    });

    s.on('error', (err) => {
      resolve(null);
    });

    s.on('timeout', () => {
      s.destroy();
      resolve(response.length > 0 ? response : null);
    });

    s.connect(TARGET_PORT, TARGET_IP);
  });
}

async function testHttpJson(cmd: Record<string, unknown>, path: string, headers: Record<string, string>): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(3000);

    const jsonStr = JSON.stringify(cmd);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(jsonStr.length, 0);
    const body = Buffer.concat([lenBuf, Buffer.from(jsonStr, 'utf8'), Buffer.from([0])]);

    let reqHeaderStr = `POST ${path} HTTP/1.1\r\nHost: ${TARGET_IP}:${TARGET_PORT}\r\nContent-Length: ${body.length}\r\nConnection: close\r\n`;
    for (const [k, v] of Object.entries(headers)) {
      reqHeaderStr += `${k}: ${v}\r\n`;
    }
    reqHeaderStr += '\r\n';

    let response = Buffer.alloc(0);

    s.on('connect', () => {
      s.write(reqHeaderStr);
      s.write(body);
    });

    s.on('data', (chunk) => {
      response = Buffer.concat([response, chunk]);
    });

    s.on('end', () => {
      resolve(response);
    });

    s.on('error', () => {
      resolve(null);
    });

    s.on('timeout', () => {
      s.destroy();
      resolve(response.length > 0 ? response : null);
    });

    s.connect(TARGET_PORT, TARGET_IP);
  });
}

async function run() {
  console.log('[1/4] Probing Raw TCP Socket without HTTP wrapping...');
  const commandsToTest = [
    { cmd_id: 'GET_USER_ID_LIST' },
    { cmd_id: 'GET_USER_INFO', user_id: 1 },
    { cmd_id: 'GET_USER_INFO', user_id: '1' },
    { cmd_id: 'GET_ALL_USER_INFO' },
    { cmd_id: 'GET_ENROLL_DATA', backup_num: 13 },
    { cmd: 'get_user_id_list' },
    { command: 'get_user_list' },
    { action: 'get_users' },
  ];

  for (const cmd of commandsToTest) {
    const res = await testRawTcpJson(cmd, JSON.stringify(cmd));
    if (res && res.length > 0) {
      console.log(`   🌟 RAW TCP Response for ${JSON.stringify(cmd)}: (${res.length} bytes)`);
      console.log(`   ASCII: ${res.toString('utf8').substring(0, 300)}`);
      console.log(`   HEX:   ${res.toString('hex').substring(0, 100)}`);
    } else {
      console.log(`   - Raw TCP ${JSON.stringify(cmd)}: (no reply)`);
    }
  }

  console.log('\n[2/4] Probing HTTP paths with FKWeb headers...');
  const paths = ['/device/cmd', '/api/device/secureye', '/hdata.aspx', '/', '/iclock/cdata', '/fkdata'];
  for (const path of paths) {
    const res = await testHttpJson(
      { cmd_id: 'GET_USER_ID_LIST' },
      path,
      { 'request_code': 'receive_cmd', 'dev_id': '1', 'trans_id': '1' }
    );
    if (res && res.length > 0) {
      console.log(`   🌟 HTTP POST ${path} Response: (${res.length} bytes)`);
      console.log(`   ${res.toString('utf8').substring(0, 300)}`);
    } else {
      console.log(`   - HTTP POST ${path}: (no reply)`);
    }
  }

  console.log('\n[3/4] Testing Binary Realand Handshake (FK635 / S-FB3K)...');
  // Binary commands
  const binaryProbes = [
    { name: 'Realand Connect (0x55 0xAA)', buf: Buffer.from([0x55, 0xAA, 0xAA, 0x55, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00]) },
    { name: 'Realand GetUserInfo (0x03)', buf: Buffer.from([0x55, 0xAA, 0xAA, 0x55, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00]) },
    { name: 'Realand GetUserIdList (0x08)', buf: Buffer.from([0x55, 0xAA, 0xAA, 0x55, 0x08, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09, 0x00]) },
  ];

  for (const bp of binaryProbes) {
    const s = new net.Socket();
    s.setTimeout(2000);
    let resp = Buffer.alloc(0);
    const got = await new Promise<Buffer | null>((resolve) => {
      s.on('connect', () => { s.write(bp.buf); });
      s.on('data', chunk => { resp = Buffer.concat([resp, chunk]); });
      s.on('end', () => resolve(resp));
      s.on('error', () => resolve(null));
      s.on('timeout', () => { s.destroy(); resolve(resp.length > 0 ? resp : null); });
      s.connect(TARGET_PORT, TARGET_IP);
    });
    if (got && got.length > 0) {
      console.log(`   🌟 ${bp.name} Response: ${got.toString('hex')}`);
    } else {
      console.log(`   - ${bp.name}: (no reply)`);
    }
  }

  process.exit(0);
}

run();
