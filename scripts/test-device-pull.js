/**
 * KERNN BIOMETRIC DEVICE PULL & DIAGNOSTIC HARNESS
 * Actively pulls live attendance records and user profiles from Secureye S-FB3K.
 * 
 * Usage:
 *   node scripts/test-device-pull.js [IP] [PORT] [MACHINE_ID] [--date YYYY-MM-DD] [--sync]
 * 
 * Examples:
 *   node scripts/test-device-pull.js 192.168.29.83 5005 1
 *   node scripts/test-device-pull.js 192.168.29.83 5005 1 --date 2026-08-28
 *   node scripts/test-device-pull.js 192.168.29.83 5005 1 --sync
 */

const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const http = require('http');

const args = process.argv.slice(2);
let targetIp = '192.168.29.83';
let targetPort = 5005;
let machineId = 1;
let filterDate = null;
let autoSync = false;

// Parse CLI arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date' && args[i + 1]) {
    filterDate = args[i + 1];
    i++;
  } else if (args[i] === '--sync') {
    autoSync = true;
  } else if (i === 0 && !args[i].startsWith('--')) {
    targetIp = args[i];
  } else if (i === 1 && !args[i].startsWith('--')) {
    targetPort = parseInt(args[i], 10);
  } else if (i === 2 && !args[i].startsWith('--')) {
    machineId = parseInt(args[i], 10);
  }
}

console.log('='.repeat(75));
console.log('  🔍 KERNN HARDWARE PULL ENGINE & DIAGNOSTIC TOOL');
console.log(`  OS: ${os.type()} ${os.arch()} | Target: ${targetIp}:${targetPort} (ID: ${machineId})`);
if (filterDate) console.log(`  Date Filter Active: ${filterDate}`);
console.log('='.repeat(75));

async function pullFromDevice(ip, port, mId) {
  const driverPath = path.join(process.cwd(), 'scripts', 'sfb3k_driver.exe');
  console.log(`\n📡 Connecting to Secureye terminal at ${ip}:${port} and pulling data...`);

  return new Promise((resolve, reject) => {
    execFile(driverPath, [ip, String(port), String(mId)], { timeout: 15000, maxBuffer: 25 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`Driver connection error: ${err.message}`));
      }

      const jsonStart = stdout.indexOf('___JSON_DATA_START___');
      const jsonEnd = stdout.indexOf('___JSON_DATA_END___');

      if (jsonStart === -1 || jsonEnd === -1) {
        return reject(new Error(`Could not parse JSON output from driver:\n${stdout}`));
      }

      try {
        const rawJson = stdout.substring(jsonStart + '___JSON_DATA_START___'.length, jsonEnd).trim();
        const data = JSON.parse(rawJson);
        resolve(data);
      } catch (parseErr) {
        reject(new Error(`JSON Parse error: ${parseErr.message}`));
      }
    });
  });
}

function decodeVerifyMode(mode) {
  if ([436, 30, 692, 4, 15, 20, 50, 51, 808].includes(mode)) return 'Face Recognition';
  if ([1, 407, 101, 102].includes(mode)) return 'Fingerprint Sensor';
  if ([1175, 2].includes(mode)) return 'Password / Keypad PIN';
  if ([408, 3].includes(mode)) return 'RFID Smart Card';
  return `Verify Mode (${mode})`;
}

async function syncToCloud(punches, serialNumber) {
  console.log(`\n☁️  Syncing ${punches.length} records to local/cloud API (/api/devices/sync/push)...`);

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      deviceId: serialNumber || 'SFB3K_MAIN',
      deviceIp: targetIp,
      punches: punches.map((p) => ({
        userId: p.userId,
        name: p.employeeName,
        timestamp: p.timestamp,
        verifyMode: p.verifyMode,
      })),
    });

    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/devices/sync/push',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 8000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ success: res.statusCode === 200, raw: body });
          }
        });
      }
    );

    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(payload);
    req.end();
  });
}

async function main() {
  try {
    const data = await pullFromDevice(targetIp, targetPort, machineId);

    console.log(`\n✅ PULL SUCCESSFUL!`);
    console.log(`   • Terminal Serial Number: ${data.serialNumber}`);
    console.log(`   • Registered Users Count : ${data.users.length}`);
    console.log(`   • Total Raw Logs In Device: ${data.logs.length}`);

    // Map user names
    const userMap = {};
    data.users.forEach((u) => { userMap[u.userId] = u.name; });

    console.log('\n👥 REGISTERED BIOMETRIC PROFILES:');
    console.table(
      data.users.map((u) => ({
        'User ID': u.userId,
        'Full Name': u.name,
        Privilege: u.privilege === 1 ? 'Manager / Admin' : 'Standard User',
        Status: u.enabled ? 'Active' : 'Disabled',
      }))
    );

    // Apply date filter if specified
    let displayLogs = data.logs.map((l) => ({
      ...l,
      employeeName: userMap[l.userId] || `User ${l.userId}`,
    }));

    if (filterDate) {
      displayLogs = displayLogs.filter((l) => l.timestamp.startsWith(filterDate));
      console.log(`\n📅 ATTENDANCE LOGS FOR DATE: [${filterDate}] (${displayLogs.length} punches found):`);
    } else {
      console.log(`\n📋 RECENT ATTENDANCE PUNCHES (Last 20 records):`);
      displayLogs = displayLogs.slice(-20);
    }

    if (displayLogs.length === 0) {
      console.log(`   No punch logs found for date ${filterDate}.`);
    } else {
      console.table(
        displayLogs.map((l, idx) => ({
          '#': idx + 1,
          'User ID': l.userId,
          'Staff Name': l.employeeName,
          'Punch Timestamp': l.timestamp,
          'Verification Mode': decodeVerifyMode(l.verifyMode),
        }))
      );
    }

    // Auto-sync if flag was passed
    if (autoSync) {
      const syncResult = await syncToCloud(data.logs.map(l => ({ ...l, employeeName: userMap[l.userId] })), data.serialNumber);
      console.log('\n🚀 Cloud Sync Response:');
      console.log(syncResult);
    } else {
      console.log(`\n💡 TIP: To automatically push these pulled punches into your database / dashboard, run:`);
      console.log(`   node scripts/test-device-pull.js ${targetIp} ${targetPort} ${machineId} --sync`);
    }

  } catch (err) {
    console.error(`\n❌ PULL FAILED: ${err.message}`);
  }
}

main();
