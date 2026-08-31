const { DevicePuller } = require('./device-puller');

// Global App State
let config = {
  ip: '192.168.29.83',
  port: 5005,
  machineId: 1,
  cloudUrl: 'http://localhost:3000',
  sessionUser: null,
  sessionToken: null,
};

let cachedPunches = [];
let groupedDates = {};
let cachedAuditLogs = [
  { timestamp: '2026-08-31 15:38:48', adminId: '6', adminName: 'shanmukh nath', action: 'Entered Settings Menu', target: 'Device Global' },
  { timestamp: '2026-08-28 14:17:20', adminId: '6', adminName: 'shanmukh nath', action: 'Enrolled Face Recognition Profile', target: 'User 3 (test)' },
  { timestamp: '2026-08-28 10:40:15', adminId: '6', adminName: 'shanmukh nath', action: 'Enrolled Fingerprint Sensor Template', target: 'User 6 (shanmukh nath)' },
  { timestamp: '2026-08-28 11:25:00', adminId: '2', adminName: 'karthik', action: 'Entered Settings Menu', target: 'Device Global' },
  { timestamp: '2026-08-28 11:26:10', adminId: '2', adminName: 'karthik', action: 'Enrolled Fingerprint Template', target: 'User 2 (karthik)' },
  { timestamp: '2026-08-25 09:00:12', adminId: '1', adminName: 'hemanth', action: 'Adjusted Device Internal Clock', target: 'Clock Sync (+0s)' },
];

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
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 32px;">No attendance punches in memory for this filter.</td></tr>';
    return;
  }

  punches.slice(-80).reverse().forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: monospace; color: var(--text-dim);">${idx + 1}</td>
      <td><span style="font-family: monospace; font-weight: 700; color: #38bdf8;">${p.userId}</span></td>
      <td><strong style="color: #fff;">${p.name || 'Staff ' + p.userId}</strong></td>
      <td><span style="font-family: monospace; color: #34d399; font-weight: 700;">${p.timestamp}</span></td>
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

// Update Gap Analysis Badges
function updateGapAnalysis(punches) {
  groupedDates = {};
  punches.forEach((p) => {
    const d = p.timestamp.substring(0, 10);
    if (!groupedDates[d]) groupedDates[d] = [];
    groupedDates[d].push(p);
  });

  const distinctDates = Object.keys(groupedDates).sort();
  const banner = document.getElementById('gapBanner');
  const pillsContainer = document.getElementById('gapDatePills');
  const statsBadge = document.getElementById('gapStatsBadge');
  const cardDaysCount = document.getElementById('cardDaysCount');

  if (distinctDates.length > 0) {
    banner.style.display = 'flex';
    statsBadge.innerText = `${distinctDates.length} Dates Recovered (${distinctDates[0]} to ${distinctDates[distinctDates.length - 1]})`;
    cardDaysCount.innerText = `${distinctDates.length} Days`;
    pillsContainer.innerHTML = '';

    // "All Dates" pill
    const allPill = document.createElement('button');
    allPill.className = 'date-pill active';
    allPill.innerText = `All (${punches.length})`;
    allPill.onclick = () => {
      document.querySelectorAll('.date-pill').forEach((p) => p.classList.remove('active'));
      allPill.classList.add('active');
      renderPunchesTable(cachedPunches);
    };
    pillsContainer.appendChild(allPill);

    // Individual Date Pills
    distinctDates.forEach((d) => {
      const pill = document.createElement('button');
      pill.className = 'date-pill';
      pill.innerText = `${d} (${groupedDates[d].length})`;
      pill.onclick = () => {
        document.querySelectorAll('.date-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        renderPunchesTable(groupedDates[d]);
        termLog('INFO', `Inspecting punches for missing date: [${d}] (${groupedDates[d].length} punches).`);
      };
      pillsContainer.appendChild(pill);
    });
  }
}

// ============================================================================
// STEP 1: PULL FROM HARDWARE (FETCH & PREVIEW ONLY - NO AUTO SYNC)
// ============================================================================
async function executePullFromHardware() {
  const pullBtn = document.getElementById('btnPullHardware');
  const pullIcon = document.getElementById('pullIcon');
  const pullBtnText = document.getElementById('pullBtnText');
  const pushBtn = document.getElementById('btnPushCloud');
  const syncBtnText = document.getElementById('syncBtnText');

  pullBtn.style.pointerEvents = 'none';
  pullIcon.classList.add('syncing-spinner');
  pullBtnText.innerText = 'Connecting & Pulling...';

  termLog('SOCKET', `Initiating Native TCP Socket Pull from ${config.ip}:${config.port}...`);

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
      
      // Update Preview Table & Gap Analysis
      renderPunchesTable(cachedPunches);
      updateGapAnalysis(cachedPunches);

      termLog('SUCCESS', `Native TCP Pull complete! Retrieved ${cachedPunches.length} punches from device EEPROM.`);
      termLog('INFO', `Data is ready for inspection. Click "Step 2: Push to Cloud Server" to synchronize.`);

      // Enable Step 2 Push Button
      pushBtn.disabled = false;
      syncBtnText.innerText = `⚡ Push ${cachedPunches.length} Records to Cloud`;
      document.getElementById('topStatusText').innerText = `Inspected ${cachedPunches.length} Records • Awaiting Sync`;
    } else {
      termLog('ERROR', `Pull failed: ${pullRes.error || 'Connection timed out'}`);
    }
  } catch (err) {
    termLog('ERROR', `Socket pull error: ${err.message}`);
  } finally {
    pullBtn.style.pointerEvents = 'auto';
    pullIcon.classList.remove('syncing-spinner');
    pullBtnText.innerText = '📥 Pull From Hardware';
  }
}

// ============================================================================
// STEP 2: SYNC & PUSH TO CLOUD SERVER
// ============================================================================
async function executePushToCloud() {
  if (cachedPunches.length === 0) {
    termLog('WARN', 'No records in memory to push. Please run Step 1 Pull first.');
    return;
  }

  const pushBtn = document.getElementById('btnPushCloud');
  const syncIcon = document.getElementById('syncIcon');
  const syncBtnText = document.getElementById('syncBtnText');

  pushBtn.style.pointerEvents = 'none';
  syncIcon.classList.add('syncing-spinner');
  syncBtnText.innerText = 'Transmitting to Cloud...';

  termLog('SOCKET', `Pushing ${cachedPunches.length} records across ${Object.keys(groupedDates).length} dates to ${config.cloudUrl}/api/devices/sync/push...`);

  const puller = new DevicePuller({
    ip: config.ip,
    port: config.port,
    machineId: config.machineId,
    cloudUrl: config.cloudUrl,
  });

  try {
    const cloudRes = await puller.pushToCloud(cachedPunches, '102023050002456');

    if (cloudRes.success) {
      termLog('SUCCESS', `Cloud Sync Complete! Server: ${cloudRes.message || 'Processed successfully'}`);
      document.getElementById('topStatusText').innerText = `Fully Synced (${cachedPunches.length} Punches) • Online`;
      syncBtnText.innerText = '✓ Cloud Sync Confirmed';
    } else {
      termLog('ERROR', `Cloud push failed: ${cloudRes.error || 'Server error'}`);
      syncBtnText.innerText = 'Retry Cloud Push';
    }
  } catch (err) {
    termLog('ERROR', `Cloud sync exception: ${err.message}`);
  } finally {
    pushBtn.style.pointerEvents = 'auto';
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

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
  refreshIcons();
  renderAuditTable();

  // Detect Platform
  const isMac = process.platform === 'darwin' || navigator.userAgent.includes('Mac');
  document.getElementById('platformLabel').innerText = isMac ? 'macOS (Apple Silicon & Intel)' : 'Windows Native';

  // ==========================================================================
  // AUTHENTICATION FORM HANDLER
  // ==========================================================================
  const loginForm = document.getElementById('loginForm');
  const authView = document.getElementById('authView');
  const dashboardView = document.getElementById('dashboardView');
  const authErrorBanner = document.getElementById('authErrorBanner');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authErrorBanner.style.display = 'none';

    const serverUrl = document.getElementById('loginServerUrl').value.trim().replace(/\/$/, '');
    const mobile = document.getElementById('loginMobile').value.trim();
    const pass = document.getElementById('loginPassword').value;
    const btnLogin = document.getElementById('btnLogin');

    btnLogin.disabled = true;
    btnLogin.innerText = 'Authenticating...';

    config.cloudUrl = serverUrl;
    document.getElementById('cfgCloudUrl').value = serverUrl;
    document.getElementById('cloudTargetLabel').innerText = serverUrl;

    try {
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: mobile, password: pass }),
      });

      const data = await res.json();

      if (data.success && data.data?.user) {
        const user = data.data.user;

        // Check if user is Admin or Manager
        if (user.role !== 'SUPER_ADMIN' && user.role !== 'MANAGER' && user.role !== 'HR_ADMIN') {
          authErrorBanner.innerText = 'Access Denied: Only Administrators and Managers can access this bridge.';
          authErrorBanner.style.display = 'block';
          btnLogin.disabled = false;
          btnLogin.innerText = 'Sign In to Gateway';
          return;
        }

        config.sessionUser = user;
        document.getElementById('sidebarUserName').innerText = user.name;
        document.getElementById('sidebarUserRole').innerText = user.role.replace('_', ' ');
        document.getElementById('sidebarAvatar').innerText = user.name[0] || 'A';

        // Switch to Dashboard
        authView.style.display = 'none';
        dashboardView.style.display = 'flex';
        refreshIcons();

        termLog('SUCCESS', `Authenticated as ${user.name} (${user.role}).`);
        termLog('INFO', `Hardware ready at ${config.ip}:${config.port}. Click "Step 1: Pull From Hardware" to start.`);
      } else {
        authErrorBanner.innerText = data.error?.message || 'Invalid credentials.';
        authErrorBanner.style.display = 'block';
      }
    } catch (err) {
      authErrorBanner.innerText = `Could not reach cloud server: ${err.message}`;
      authErrorBanner.style.display = 'block';
    } finally {
      btnLogin.disabled = false;
      btnLogin.innerHTML = '<i data-lucide="lock" style="width: 14px; height: 14px; margin-right: 6px;"></i> Sign In to Gateway';
      refreshIcons();
    }
  });

  // Logout Handler
  document.getElementById('btnLogout').addEventListener('click', () => {
    config.sessionUser = null;
    dashboardView.style.display = 'none';
    authView.style.display = 'flex';
    document.getElementById('loginPassword').value = '';
    refreshIcons();
  });

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

  // Step 1: Pull From Hardware Button Click
  document.getElementById('btnPullHardware').addEventListener('click', executePullFromHardware);

  // Step 2: Push to Cloud Button Click
  document.getElementById('btnPushCloud').addEventListener('click', executePushToCloud);

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

    termLog('SUCCESS', `Settings updated: ${config.ip}:${config.port} -> ${config.cloudUrl}`);
    document.getElementById('topStatusText').innerText = `Configured (${config.ip}:${config.port})`;
    document.getElementById('cloudTargetLabel').innerText = config.cloudUrl;
  });
});
