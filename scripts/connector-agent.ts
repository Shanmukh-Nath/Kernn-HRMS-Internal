import http from 'http';
import { handleIncomingDevicePacket } from '../server/secureye/handlers';
import { SecureyeDeviceClient } from '../server/secureye/client';
import { prisma } from '../lib/prisma';
import { deviceCommandQueue } from '../server/secureye/command-queue';

const PORT = parseInt(process.env.CONNECTOR_PORT || '5005', 10);
const CLOUD_API_URL = process.env.CONNECTOR_API_URL;
const CLOUD_API_KEY = process.env.CONNECTOR_API_KEY;

console.log('================================================================');
console.log('🚀 Secureye S-FB3K Standalone Connector Agent (Real-Time Sniffer)');
console.log(`📡 Local Device Listener Port : ${PORT}`);
console.log(`🌐 Target Database            : Connected to Prisma SQLite`);
console.log('================================================================\n');

/**
 * Lightweight HTTP server listening for direct incoming S-FB3K device packets on LAN.
 */
const server = http.createServer(async (req, res) => {
  const clientIp = req.socket.remoteAddress?.replace('::ffff:', '') || '127.0.0.1';
  const chunks: Buffer[] = [];

  console.log(`\n🔔 [CONNECTOR HIT] Incoming connection from ${clientIp} -> ${req.method} ${req.url}`);
  console.log(`   Headers: ${JSON.stringify(req.headers)}`);

  req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

  req.on('end', async () => {
    const rawBuffer = Buffer.concat(chunks);
    if (rawBuffer.length > 0) {
      console.log(`   Raw Wire Body (${rawBuffer.length} bytes):`);
      console.log(`   Preview: ${rawBuffer.subarray(0, 300).toString('utf8')}`);
    }

    try {
      const result = await handleIncomingDevicePacket(req.headers, rawBuffer, clientIp);

      // Write protocol response headers & body
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);

      console.log(`   ✅ Responded with status ${result.statusCode} (response_code: OK)`);

      // If in Cloud Agent mode, forward normalized punch event to Cloud REST API
      if (CLOUD_API_URL && result.handledEvent) {
        forwardToCloud(result.handledEvent);
      }
    } catch (err: unknown) {
      console.error('Error handling device packet in connector:', err);
      res.writeHead(200, {
        'response_code': 'OK',
        'Connection': 'close',
        'Content-Type': 'application/octet-stream',
      });
      res.end(Buffer.alloc(0));
    }
  });

  req.on('error', (err) => {
    console.error('Connector socket error:', err);
  });
});

async function forwardToCloud(event: unknown) {
  if (!CLOUD_API_URL) return;
  try {
    const res = await fetch(`${CLOUD_API_URL}/api/attendance/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUD_API_KEY || ''}`,
      },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      console.warn(`Cloud forwarding returned status ${res.status}`);
    }
  } catch (err) {
    console.error('Failed to forward event to cloud:', err);
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ S-FB3K Connector Agent listening on 0.0.0.0:${PORT}\n`);
  console.log('👉 Point terminal to Host IP: 192.168.29.108 and Host Port: 5005 (or 3000)');
  console.log('👉 Press ESC on the terminal keypad to return to the clock home screen.');
});
