import net from 'net';
import dgram from 'dgram';
import { handleIncomingDevicePacket } from '../server/secureye/handlers';
import { protocolCapture } from '../server/secureye/protocol-capture';

const DEVICE_IP = '192.168.29.83';
const PORTS_TO_LISTEN = [5005, 7005, 8080, 4370, 8000, 9000, 7788];

console.log('================================================================');
console.log('🛰️ S-FB3K Multi-Port Raw Wire Packet Sniffer & Capturer');
console.log(`🎯 Filtering Traffic from Device : ${DEVICE_IP}`);
console.log(`👂 Listening on All Interfaces   : Ports ${PORTS_TO_LISTEN.join(', ')}`);
console.log('================================================================\n');

function parseHttpHeaders(headerStr: string): { method: string; path: string; headers: Record<string, string> } {
  const lines = headerStr.split('\r\n');
  const requestLine = lines[0] || '';
  const parts = requestLine.split(' ');
  const method = parts[0] || 'POST';
  const path = parts[1] || '/';

  const headers: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx > -1) {
      const key = line.substring(0, colonIdx).trim().toLowerCase();
      const val = line.substring(colonIdx + 1).trim();
      headers[key] = val;
    }
  }

  return { method, path, headers };
}

// Start TCP listeners on all ports
PORTS_TO_LISTEN.forEach((port) => {
  const server = net.createServer((socket) => {
    const clientIp = socket.remoteAddress?.replace('::ffff:', '') || '127.0.0.1';
    const clientPort = socket.remotePort;

    console.log(`\n⚡ [INBOUND CONNECTION] ${new Date().toLocaleTimeString()} on Port :${port}`);
    console.log(`   Source: ${clientIp}:${clientPort}`);

    let rawBuffer = Buffer.alloc(0);

    socket.on('data', async (chunk) => {
      rawBuffer = Buffer.concat([rawBuffer, chunk]);

      console.log(`\n📦 [RAW PACKET RECEIVED] ${rawBuffer.length} bytes from ${clientIp}:${clientPort} on Port :${port}`);
      console.log(`   Hex Dump (First 64 bytes): ${rawBuffer.subarray(0, 64).toString('hex')}`);
      
      const rawText = rawBuffer.toString('utf8');
      console.log(`   ASCII Dump:\n${rawText.substring(0, 400)}`);

      // Check if it's an HTTP request
      if (rawText.startsWith('POST ') || rawText.startsWith('GET ')) {
        const headerEndIdx = rawBuffer.indexOf('\r\n\r\n');
        if (headerEndIdx !== -1) {
          const headerStr = rawBuffer.subarray(0, headerEndIdx).toString('utf8');
          const bodyBytes = rawBuffer.subarray(headerEndIdx + 4);
          const { method, path, headers } = parseHttpHeaders(headerStr);

          console.log(`\n   🔍 Parsed HTTP Request: ${method} ${path}`);
          console.log(`   Headers: ${JSON.stringify(headers, null, 2)}`);
          if (bodyBytes.length > 0) {
            console.log(`   Body (${bodyBytes.length} bytes): ${bodyBytes.subarray(0, 200).toString('utf8')}`);
          }

          try {
            const result = await handleIncomingDevicePacket(headers, bodyBytes, clientIp);
            
            // Build raw HTTP response
            let respStr = `HTTP/1.1 ${result.statusCode} OK\r\nConnection: close\r\n`;
            for (const [k, v] of Object.entries(result.headers)) {
              respStr += `${k}: ${v}\r\n`;
            }
            respStr += `Content-Length: ${result.body.length}\r\n\r\n`;

            socket.write(respStr);
            if (result.body.length > 0) {
              socket.write(result.body);
            }
            console.log(`   ✅ Sent HTTP response with status ${result.statusCode} (response_code: OK)`);
          } catch (err) {
            console.error('   ❌ Error processing packet:', err);
            socket.write('HTTP/1.1 200 OK\r\nresponse_code: OK\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
          }
        }
      } else {
        // Raw binary packet - acknowledge with OK
        console.log('   ℹ️ Raw binary packet without HTTP wrapper.');
        socket.write(Buffer.from([0x55, 0xAA, 0xAA, 0x55, 0x00, 0x00, 0x00, 0x00]));
      }
    });

    socket.on('error', (err) => {
      console.log(`   Socket error on port :${port}:`, err.message);
    });

    socket.on('close', () => {
      console.log(`   Socket closed with ${clientIp}:${clientPort}`);
    });
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`   ⚠️ Port ${port} is already in use by another process.`);
    } else {
      console.error(`   Error on port ${port}:`, err.message);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`   ✅ Listening on 0.0.0.0:${port}`);
  });
});

// Also start UDP listener on 4370 & 5005
const udpPorts = [4370, 5005];
udpPorts.forEach((uPort) => {
  try {
    const udp = dgram.createSocket('udp4');
    udp.on('message', (msg, rinfo) => {
      console.log(`\n📡 [UDP PACKET] ${msg.length} bytes from ${rinfo.address}:${rinfo.port} on UDP:${uPort}`);
      console.log(`   Hex: ${msg.toString('hex')}`);
      console.log(`   ASCII: ${msg.toString('utf8')}`);
    });
    udp.on('error', (err: any) => {
      if (err.code !== 'EADDRINUSE') {
        console.log(`   UDP ${uPort} error:`, err.message);
      }
    });
    udp.bind(uPort, '0.0.0.0');
  } catch {}
});

console.log('\n👉 Prober is live and listening. Punch on the S-FB3K terminal now to capture all outbound traffic!');
