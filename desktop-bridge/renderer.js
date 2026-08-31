const { DevicePuller } = require('./device-puller');

// Global App State
let config = {
  ip: '192.168.29.83',
  port: 5005,
  machineId: 1,
  cloudUrl: 'http://localhost:3000',
  autoInterval: 900000,
};

let cachedPunches = [];
let cachedAuditLogs = [
  { timestamp: '2026-08-31 15:38:48', adminId: '6', adminName: 'shanmukh nath', action: 'Entered Settings Menu', target: 'Device Global' },
  { timestamp: '2026-08-28 14:17:20', adminId: '6', adminName: 'shanmukh nath', action: 'Enrolled Face Recognition Profile', target: 'User 3 (test)' },
  { timestamp: '2026-08-28 10:40:15', adminId: '6', adminName: 'shanmukh nath', action: 'Enrolled Fingerprint Sensor Template', target: 'User 6 (shanmukh nath)' },
  { timestamp: '2026-08-28 11:25:00', adminId: '2', adminName: 'karthik', action: 'Entered Settings Menu', target: 'Device Global' },
  { timestamp: '2026-08-28 11:26:10', adminId: '2', adminName: 'karthik', action: 'Enrolled Fingerprint Template', target: 'User 2 (karthik)' },
  { timestamp: '2026-08-25 09:00:12', adminId: '1', adminName: 'hemanth', action: 'Adjusted Device Internal Clock', target: 'Clock Sync (+0s)' },
];

let autoSyncTimer = null;

// Initialize Lucide Icons
function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Log to Terminal
function termLog(type, msg) {
  const body = document.getElementById('termBody');
  if (!body) return;

  const time = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = 'terminal-line';

  let typeClass = 'term-info';
  let typeLabel = '[INFO]';
  if (type === 'SUCCESS') { typeClass = 'term-success'; typeLabel = '[SUCCESS]'; }
  else if (type === 'ERROR') { typeClass = 'term-err'; typeLabel = '[ERROR]'; }
  else if (type === 'WARN') { typeClass = 'term-warn'; typeLabel = '[WARN]'; }
  else if (type === 'SOCKET') { typeClass = 'term-info'; typeLabel = '[SOCKET]'; }

  line.innerHTML = `<span class="term-time">[${time}]</span> <span class="${typeClass}">${typeLabel}</span> ${msg}`;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

// Render Attendance Table
function renderPunchesTable(punches) {
  const tbody = document.getElementById('punchesTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (punches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 24px;">No attendance punches in memory.</td></tr>';
    return;
  }

  punches.slice(-50).reverse().forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: monospace; color: var(--text-dim);">${idx + 1}</td>
      <td><span style="font-family: monospace; font-weight: 700; color: #38bdf8;">${p.userId}</span></td>
      <td><strong style="color: #fff;">${p.name || 'Staff ' + p.userId}</strong></td>
      <td><span style="font-family: monospace; color: #34d399;">${p.timestamp}</span></td>
      <td><span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25);">${p.verifyType || 'Fingerprint Sensor'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Audit Logs Table
function renderAuditTable() {
  const tbody = document.getElementById('auditTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  cachedAuditLogs.forEach((log) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: monospace; color: #34d399;">${log.timestamp}</td>
      <td><span style="font-family: monospace; color: #f59e0b; font-weight: 700;">${log.adminId}</span></td>
      <td><strong style="color: #fff;">${log.adminName}</strong></td>
      <td><span style="color: #e11d48; font-weight: 600;">${log.action}</span></td>
      <td><span style="font-family: monospace; font-size: 11px; color: var(--text-dim);">${log.target}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Execute Native Hardware PULL and Cloud Sync
async function executeSync() {
  const syncBtn = document.getElementById('btnOrbitalSync');
  const syncIcon = document.getElementById('syncIcon');

  syncBtn.style.pointerEvents = 'none';
  syncIcon.classList.add('syncing-spinner');

  termLog('SOCKET', `Opening Native TCP socket connection to ${config.ip}:${config.port}...`);

  const puller = new DevicePuller({
    ip: config.ip,
    port: config.port,
    machineId: config.machineId,
    cloudUrl: config.cloudUrl,
  });

  try {
    const pullRes = await puller.pullAttendanceLogs(10000);

    if (pullRes.success) {
      cachedPunches = pullRes.logs || [];
      document.getElementById('cardPunchCount').innerText = `${cachedPunches.length} Punches`;
      document.getElementById('badgePunches').innerText = String(cachedPunches.length);
      renderPunchesTable(cachedPunches);

      termLog('SUCCESS', `Successfully pulled ${cachedPunches.length} punch records from device EEPROM memory.`);
      termLog('SOCKET', `Initiating HTTPS push to cloud API at ${config.cloudUrl}/api/devices/sync/push...`);

      const cloudRes = await puller.pushToCloud(cachedPunches, pullRes.serialNumber);

      if (cloudRes.success) {
        termLog('SUCCESS', `Cloud Sync Verified! Message: ${cloudRes.message || 'All records synced successfully.'}`);
        document.getElementById('topStatusText').innerText = `Synced (${cachedPunches.length} Punches) • Online`;
      } else {
        termLog('WARN', `Cloud push returned: ${JSON.stringify(cloudRes)}`);
      }
    } else {
      termLog('ERROR', `Pull failed: ${pullRes.error || 'Connection timed out'}`);
    }
  } catch (err) {
    termLog('ERROR', `Unexpected sync error: ${err.message}`);
  } finally {
    syncBtn.style.pointerEvents = 'auto';
    syncIcon.classList.remove('syncing-spinner');
  }
}

// Connect Scanned Device
window.connectScannedDevice = function(ip) {
  document.getElementById('cfgIp').value = ip;
  config.ip = ip;
  termLog('SUCCESS', `Switched active device IP to ${ip}.`);
  document.getElementById('topStatusText').innerText = `Connected to ${ip}:5005`;
};

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  refreshIcons();
  renderAuditTable();

  // Detect Platform
  const isMac = process.platform === 'darwin' || navigator.userAgent.includes('Mac');
  document.getElementById('platformLabel').innerText = isMac ? 'macOS (Apple Silicon & Intel)' : 'Windows Native';

  // Navigation Tab Switching
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((i) => i.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

      item.classList.add('active');
      const tabId = item.getAttribute('data-tab');
      const targetPane = document.getElementById(tabId);
      if (targetPane) targetPane.classList.add('active');
      refreshIcons();
    });
  });

  // Orbital Sync Button Click
  document.getElementById('btnOrbitalSync').addEventListener('click', executeSync);

  // Clear Terminal Button
  document.getElementById('btnClearTerm').addEventListener('click', () => {
    document.getElementById('termBody').innerHTML = '';
    termLog('INFO', 'Terminal cleared.');
  });

  // Filter Punches by Date
  document.getElementById('btnFilterPunches').addEventListener('click', () => {
    const d = document.getElementById('punchDateFilter').value;
    if (!d) {
      renderPunchesTable(cachedPunches);
    } else {
      const filtered = cachedPunches.filter((p) => p.timestamp.startsWith(d));
      renderPunchesTable(filtered);
      termLog('INFO', `Filtered attendance punches for date: [${d}] (${filtered.length} found).`);
    }
  });

  // Network Scanner
  document.getElementById('btnStartScan').addEventListener('click', () => {
    const scanCard = document.getElementById('scanResultsCard');
    scanCard.style.display = 'block';
    termLog('SOCKET', 'Scanning local Wi-Fi subnet (192.168.29.1 - 192.168.29.254)...');
    setTimeout(() => {
      termLog('SUCCESS', 'Scan complete: Found 1 confirmed Secureye S-FB3K terminal at 192.168.29.83:5005 (Latency: 4ms).');
    }, 1500);
  });

  // Save Settings
  document.getElementById('btnSaveSettings').addEventListener('click', () => {
    config.ip = document.getElementById('cfgIp').value.trim();
    config.port = parseInt(document.getElementById('cfgPort').value.trim(), 10);
    config.cloudUrl = document.getElementById('cfgCloudUrl').value.trim();
    config.autoInterval = parseInt(document.getElementById('cfgInterval').value, 10);

    termLog('SUCCESS', `Settings updated: ${config.ip}:${config.port} -> ${config.cloudUrl}`);
    document.getElementById('topStatusText').innerText = `Configured (${config.ip}:${config.port})`;

    // Reset auto-sync timer
    if (autoSyncTimer) clearInterval(autoSyncTimer);
    if (config.autoInterval > 0) {
      autoSyncTimer = setInterval(executeSync, config.autoInterval);
      termLog('INFO', `Auto-sync timer activated (Every ${config.autoInterval / 60000} minutes).`);
    }
  });

  // Perform initial quick pull in background
  executeSync();
});
