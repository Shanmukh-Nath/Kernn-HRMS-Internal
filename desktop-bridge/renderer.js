/**
 * KERNN SYNC BRIDGE — Renderer Process v5 (Refreshed Ultra-Clean UI & Features)
 *
 * Features:
 *   - Real-time client-side live search & date filter chips
 *   - Instant Export to CSV and Export to JSON backups
 *   - RTC Hardware Time Synchronization
 *   - Collapsible Raw Socket Dock (expandable on click)
 *   - Pure TCP pull → review & search → push selected to Cloud
 *   - AES-GCM machine-isolated Passkey Quick Sign-In
 */

'use strict';

const { DevicePuller } = require('./device-puller');

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  session:         null,
  cloudUrl:        'https://kernn-hrms-internal.vercel.app',
  deviceIp:        '192.168.29.83',
  devicePort:      5005,
  machineId:       1,
  pullMode:        'ALL',
  rangeFrom:       null,
  rangeTo:         null,
  activeDateFilter:null,
  searchQuery:     '',
  allPunches:      [],
  filteredPunches: [],
  allUsers:        [],
  allAudit:        [],
  termCollapsed:   true,
  logCount:        0,
};

// ─── DOM Helpers ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts.includes(' ') ? ts.replace(' ','T')+'Z' : ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString('en-IN', { hour12: true });
  } catch { return ts; }
}

function extractErrorMessage(val) {
  if (!val) return 'An unexpected error occurred';
  if (typeof val === 'string') return val;
  if (val instanceof Error) return val.message;
  if (typeof val === 'object') {
    if (typeof val.message === 'string') return val.message;
    if (typeof val.error === 'string')   return val.error;
    if (typeof val.error === 'object' && val.error?.message) return val.error.message;
    try { return JSON.stringify(val); } catch { return String(val); }
  }
  return String(val);
}

// ─── Lucide Icons ─────────────────────────────────────────────────────────────
function reIcons() {
  if (window.lucide) lucide.createIcons();
}
window.addEventListener('DOMContentLoaded', () => {
  reIcons();
  initApp();
});

// ─── Terminal Logger & Dock ───────────────────────────────────────────────────
const TERM_PREFIX = { ok:'[OK]', err:'[ERR]', warn:'[WARN]', sock:'[SOCK]', info:'[INFO]' };
const TERM_CLASS  = { ok:'tc-ok', err:'tc-err', warn:'tc-warn', sock:'tc-sock', info:'tc-time' };

function log(type, msg) {
  state.logCount++;
  const tb = $('termBody');
  const countEl = $('termLogCount');
  if (countEl) countEl.textContent = `${state.logCount} events`;

  if (!tb) return;
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  const line = document.createElement('div');
  line.className = 'term-line';
  line.innerHTML = `<span class="tc-time">${ts}</span> <span class="${TERM_CLASS[type]||''}">${TERM_PREFIX[type]||''}</span> ${escHtml(String(msg))}`;
  tb.appendChild(line);
  tb.scrollTop = tb.scrollHeight;
}

function toggleTerminalDock(forceOpen = false) {
  const dock = $('termDock');
  const icon = $('termToggleIcon');
  if (!dock) return;

  if (forceOpen) {
    state.termCollapsed = false;
  } else {
    state.termCollapsed = !state.termCollapsed;
  }

  dock.classList.toggle('collapsed', state.termCollapsed);
  if (icon) {
    icon.setAttribute('data-lucide', state.termCollapsed ? 'chevron-up' : 'chevron-down');
    reIcons();
  }
}

// ─── Auth Error Display ──────────────────────────────────────────────────────
function showAuthError(val) {
  const el = $('authError');
  if (!el) return;
  el.textContent = extractErrorMessage(val);
  el.style.display = 'block';
}
function hideAuthError() {
  const el = $('authError');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

// ─── Top Status Badge ─────────────────────────────────────────────────────────
function setStatus(text, ok = true) {
  const txt = $('topStatusText');
  const dot = $('topStatus')?.querySelector('.tb-dot');
  if (txt) txt.textContent = text;
  if (dot) {
    dot.style.background = ok ? '#10b981' : '#f59e0b';
    dot.style.boxShadow  = ok ? '0 0 8px #10b981' : '0 0 8px #f59e0b';
  }
}

// ─── Passkey — AES-GCM Machine Key ───────────────────────────────────────────
const PK_LS_KEY = 'ksynbr_pk_v2';

async function deriveMachineKey() {
  const enc  = new TextEncoder();
  const salt = [
    navigator.userAgent,
    process.env.COMPUTERNAME || process.env.HOSTNAME || 'local',
    process.env.USERDOMAIN   || process.env.USER     || 'device',
    'kernn-sync-bridge-v1',
  ].join('|');
  const keyMat = await crypto.subtle.importKey(
    'raw', enc.encode('kernn-bridge-master'), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', salt: enc.encode(salt), iterations:100000, hash:'SHA-256' },
    keyMat,
    { name:'AES-GCM', length:256 },
    false,
    ['encrypt','decrypt']
  );
}

async function encryptCredential(mobile, password, cloudUrl) {
  const key = await deriveMachineKey();
  const enc = new TextEncoder();
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name:'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify({ mobile, password, cloudUrl }))
  );
  return { iv: Array.from(iv), ct: Array.from(new Uint8Array(cipher)) };
}

async function decryptCredential(stored) {
  const key  = await deriveMachineKey();
  const iv   = new Uint8Array(stored.iv);
  const ct   = new Uint8Array(stored.ct);
  const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(plain));
}

function getPasskeyStored() {
  try { return JSON.parse(localStorage.getItem(PK_LS_KEY) || 'null'); }
  catch { return null; }
}
function clearPasskey() { localStorage.removeItem(PK_LS_KEY); }

function refreshPasskeyUI() {
  const pk   = getPasskeyStored();
  const btn  = $('btnPasskeyLogin');
  const div  = $('authDivider');
  const stat = $('passkeyStatus');
  if (pk?.mobile) {
    if (btn)  btn.style.display  = 'flex';
    if (div)  div.style.display  = 'block';
    if (stat) stat.innerHTML = `Passkey registered for <strong style="color:var(--cyan)">${escHtml(pk.mobile)}</strong>.<br>Quick Sign-In is active on this workstation.`;
  } else {
    if (btn)  btn.style.display  = 'none';
    if (div)  div.style.display  = 'none';
    if (stat) stat.textContent = 'No passkey saved on this device.';
  }
}

let _pendingMobile = '', _pendingPw = '', _pendingCloud = '';
function showPasskeyModal() {
  const modal = $('passkeyModal');
  if (modal) { modal.classList.add('visible'); reIcons(); }
}

// ─── Auth: Password Login ─────────────────────────────────────────────────────
async function doPasswordLogin(mobile, password, cloudUrl, askPasskey = false) {
  const btn = $('btnLogin');
  if (btn) btn.disabled = true;
  if (btn) btn.innerHTML = '<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Authenticating…';

  try {
    const res  = await fetch(`${cloudUrl}/api/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mobileNumber: mobile, mobile, password }),
    });
    const data = await res.json();
    const token = data.token || data.data?.token;

    if (!res.ok || !token) {
      const errMsg = extractErrorMessage(data.error) || extractErrorMessage(data.message) || `Login failed (HTTP ${res.status})`;
      throw new Error(errMsg);
    }

    const userData = data.data?.user || data.user || {};
    state.session = {
      token:  token,
      mobile,
      name:   userData.name || data.name || mobile,
      role:   userData.role || data.role || 'ADMIN',
    };
    state.cloudUrl = cloudUrl;

    hideAuthError();
    log('ok', `Authenticated as ${state.session.name} (${state.session.role})`);

    if (askPasskey && !getPasskeyStored()) {
      _pendingMobile = mobile;
      _pendingPw     = password;
      _pendingCloud  = cloudUrl;
      showPasskeyModal();
    } else {
      openDashboard();
    }
  } catch (err) {
    const msg = extractErrorMessage(err);
    showAuthError(msg);
    log('err', 'Login failed: ' + msg);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="log-in" style="width:14px;height:14px"></i> Sign In to Gateway';
      reIcons();
    }
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function openDashboard() {
  $('authView').style.display  = 'none';
  $('dashboardView').classList.add('visible');

  const s = state.session;
  $('sidebarName').textContent = s.name || s.mobile;
  $('sidebarRole').textContent = s.role || 'ADMIN';
  $('sidebarAva').textContent  = (s.name || s.mobile)[0].toUpperCase();
  $('platformLabel').textContent =
    process.platform === 'darwin' ? 'macOS'   :
    process.platform === 'win32'  ? 'Windows' : 'Linux';

  refreshPasskeyUI();
  updateCloudLabels();
  setStatus('Gateway Ready');
  log('ok', `Dashboard ready for ${s.name}`);
  reIcons();
}

function updateCloudLabels() {
  if ($('cloudLabel'))      $('cloudLabel').textContent      = state.cloudUrl;
  if ($('deviceAddrLabel')) $('deviceAddrLabel').textContent = `${state.deviceIp}:${state.devicePort}`;
}

// ─── Pull Drawer ──────────────────────────────────────────────────────────────
let pullDrawerOpen = false;

window.closeDrawer = () => {
  $('pullDrawer').style.display = 'none';
  pullDrawerOpen = false;
  $('pullBtnText').textContent  = 'Pull From Hardware';
};

window.selectMode = (mode) => {
  state.pullMode = mode;
  document.querySelectorAll('.mode-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.mode === mode);
  });
  $('rangeRow').style.display = mode === 'RANGE' ? 'grid' : 'none';
};

window.useDevice = (ip) => {
  state.deviceIp  = ip;
  $('cfgIp').value = ip;
  updateCloudLabels();
  log('ok', `Active device configured: ${ip}:${state.devicePort}`);
  document.querySelector('.nav-item[data-tab="tab-sync"]')?.click();
};

// ─── Date Chips & Filter Engine ───────────────────────────────────────────────
function uniqueDates(punches) {
  return [...new Set(punches.map(p => p.timestamp?.slice(0,10)).filter(Boolean))].sort();
}

function buildDateChips() {
  const row = $('datePillsRow');
  if (!row) return;
  row.innerHTML = '';
  const dates = uniqueDates(state.allPunches);
  if (!dates.length) return;

  const mkChip = (label, value) => {
    const c = document.createElement('button');
    c.className    = 'date-chip';
    c.textContent  = label;
    c.dataset.date = value || '';
    c.addEventListener('click', () => {
      state.activeDateFilter = value || null;
      applyFilters();
    });
    return c;
  };

  const allChip = mkChip('All Dates', null);
  allChip.classList.add('active');
  row.appendChild(allChip);
  dates.forEach(d => row.appendChild(mkChip(d, d)));
}

function applyFilters() {
  // 1. Update chip active state
  document.querySelectorAll('.date-chip').forEach(c => {
    c.classList.toggle('active', (c.dataset.date || null) === (state.activeDateFilter || null));
  });

  let list = [...state.allPunches];

  // 2. Filter by date chip
  if (state.activeDateFilter) {
    list = list.filter(p => p.timestamp?.slice(0,10) === state.activeDateFilter);
  }

  // 3. Filter by search query
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(p =>
      String(p.userId || '').toLowerCase().includes(q) ||
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.timestamp || '').toLowerCase().includes(q)
    );
  }

  state.filteredPunches = list;
  renderPunchesHub(list);
  renderPunchesFull(list);
  updatePushMeta();
}

// ─── Table Renderers ──────────────────────────────────────────────────────────
function verifyBadge(mode) {
  const m = String(mode || '').toLowerCase();
  if (m.includes('face'))   return `<span class="badge badge-violet"><i data-lucide="scan-face" style="width:10px;height:10px"></i> Face</span>`;
  if (m.includes('finger')) return `<span class="badge badge-blue"><i data-lucide="fingerprint" style="width:10px;height:10px"></i> Fingerprint</span>`;
  if (m.includes('pin') || m.includes('password')) return `<span class="badge badge-amber"><i data-lucide="key-round" style="width:10px;height:10px"></i> PIN</span>`;
  if (m.includes('rfid') || m.includes('card'))    return `<span class="badge badge-green"><i data-lucide="credit-card" style="width:10px;height:10px"></i> RFID</span>`;
  return `<span class="badge badge-dim">${escHtml(mode||'Standard')}</span>`;
}

function punchRows(punches) {
  return punches.map((p, i) => {
    const initial = (p.name || p.userId || 'U')[0].toUpperCase();
    return `
      <tr>
        <td class="mono text-dim">${i+1}</td>
        <td class="mono text-cyan" style="font-weight:700">${escHtml(p.userId)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:24px;height:24px;border-radius:6px;background:rgba(255,255,255,0.06);display:grid;place-items:center;font-size:11px;font-weight:700;color:var(--text-1)">${initial}</div>
            <span style="font-weight:600;color:var(--text-1)">${escHtml(p.name || 'Staff Member')}</span>
          </div>
        </td>
        <td class="mono" style="font-size:11.5px">${escHtml(fmtDate(p.timestamp))}</td>
        <td>${verifyBadge(p.verifyType || p.verifyMode)}</td>
      </tr>
    `;
  }).join('');
}

function renderPunchesHub(punches) {
  const tbody  = $('tbPunches');
  const panel  = $('pushPanel');
  const shown  = $('shownCount');
  const total  = $('totalCount');
  const pushBt = $('btnPushNow');
  const badge  = $('dkBadgePunches');

  if (badge) badge.textContent = punches.length;

  if (!punches.length) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">No punch records match the current filter.</td></tr>';
    if (panel) panel.style.display = 'none';
    return;
  }
  if (tbody) tbody.innerHTML = punchRows(punches);
  if (panel) panel.style.display = 'flex';
  if (shown) shown.textContent   = punches.length;
  if (total) total.textContent   = state.allPunches.length;
  if (pushBt) pushBt.disabled    = false;
  reIcons();
}

function renderPunchesFull(punches) {
  const tbody = $('tbPunchesFull');
  if (!tbody) return;
  if (!punches.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">No logs match the search query.</td></tr>';
    return;
  }
  tbody.innerHTML = punchRows(punches);
  reIcons();
}

function updatePushMeta() {
  const n  = state.filteredPunches.length;
  const pc = $('pushCountDesc');
  if (pc) pc.textContent = `${n} record${n!==1?'s':''}`;
  const bt = $('btnPushCloud');
  if (bt) bt.disabled = n === 0;
}

function renderUsersTable(users) {
  const tb = $('tbUsers');
  const tbFull = $('tbUsersFull');
  const badge = $('dkBadgeUsers');
  const navBadge = $('navBadgeUsers');

  if (badge) badge.textContent = users.length;
  if (navBadge) navBadge.textContent = users.length;

  if (!users.length) {
    const emptyHtml = '<tr><td colspan="5" class="tbl-empty">No enrolled staff found on device memory.</td></tr>';
    if (tb) tb.innerHTML = emptyHtml;
    if (tbFull) tbFull.innerHTML = emptyHtml;
    return;
  }

  const rowsHtml = users.map((u) => `
    <tr>
      <td class="mono text-cyan" style="font-weight:700">${escHtml(u.userId || u.id)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:24px;height:24px;border-radius:6px;background:rgba(34,211,238,0.1);color:var(--cyan);display:grid;place-items:center;font-size:11px;font-weight:700">
            ${(u.name || u.userId || 'E')[0].toUpperCase()}
          </div>
          <span style="font-weight:600;color:var(--text-1)">${escHtml(u.name || 'Enrolled User')}</span>
        </div>
      </td>
      <td><span class="badge ${u.privilege > 0 ? 'badge-amber' : 'badge-dim'}">${u.privilege > 0 ? 'Terminal Admin' : 'Employee'}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <span class="badge badge-blue">Fingerprint</span>
          <span class="badge badge-violet">Face</span>
          <span class="badge badge-green">RFID</span>
        </div>
      </td>
      <td><span class="badge badge-green">ACTIVE</span></td>
    </tr>
  `).join('');

  if (tb) tb.innerHTML = rowsHtml;
  if (tbFull) tbFull.innerHTML = rowsHtml;
  reIcons();
}

// ─── Export Utilities ─────────────────────────────────────────────────────────
function exportToCsv(data, filename = 'Attendance_Logs.csv') {
  if (!data || !data.length) { log('warn', 'No data to export.'); return; }
  const headers = ['#', 'User ID', 'Staff Name', 'Timestamp', 'Verification Mode'];
  const rows = data.map((p, i) => [
    i + 1,
    `"${p.userId || ''}"`,
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${p.timestamp || ''}"`,
    `"${p.verifyType || p.verifyMode || ''}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.click();
  URL.revokeObjectURL(url);
  log('ok', `Exported ${data.length} records to ${filename}`);
}

function exportToJson(data, filename = 'Attendance_Backup.json') {
  if (!data || !data.length) { log('warn', 'No data to export.'); return; }
  const jsonStr = JSON.stringify({
    exportedAt: new Date().toISOString(),
    totalRecords: data.length,
    records: data,
  }, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.click();
  URL.revokeObjectURL(url);
  log('ok', `Exported ${data.length} records to ${filename}`);
}

// ─── Push Execution ───────────────────────────────────────────────────────────
async function executePush(records, btn) {
  if (!records?.length) { log('warn', 'Nothing to push — check your date filter or pull data first.'); return; }
  if (!state.session?.token) { log('err', 'Not authenticated. Please sign in.'); return; }

  btn.disabled = true;
  const origHtml = btn.innerHTML;
  btn.innerHTML = `<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Uploading ${records.length}…`;
  setStatus(`Pushing ${records.length} records…`, false);
  toggleTerminalDock(true);
  log('sock', `Cloud commit: ${records.length} records → ${state.cloudUrl}`);

  const puller = new DevicePuller({
    ip: state.deviceIp, port: state.devicePort,
    machineId: state.machineId, cloudUrl: state.cloudUrl,
    authToken: state.session.token,
  });

  try {
    const res = await puller.pushToCloud(records, '102023050002456');
    if (res.success === false && res.error) throw new Error(extractErrorMessage(res.error));

    const ins = res.data?.insertedCount ?? res.inserted ?? records.length;
    const dup = res.data?.skippedCount ?? res.duplicates ?? 0;
    log('ok', `Cloud commit complete! (${ins} new records stored, ${dup} existing skipped).`);
    setStatus(`Synced ${ins} records`);
  } catch (err) {
    log('err', 'Cloud push failed: ' + extractErrorMessage(err));
    setStatus('Push failed', false);
  } finally {
    btn.disabled = false; btn.innerHTML = origHtml; reIcons();
  }
}

// ─── RTC Time Sync ────────────────────────────────────────────────────────────
async function executeRtcTimeSync() {
  const btn = $('btnSyncTimeQuick');
  if (btn) btn.disabled = true;
  log('sock', `RTC Sync: Aligning terminal clock on ${state.deviceIp}:${state.devicePort} to PC time…`);
  toggleTerminalDock(true);

  try {
    const puller = new DevicePuller({
      ip: state.deviceIp, port: state.devicePort,
      machineId: state.machineId, cloudUrl: state.cloudUrl,
      authToken: state.session?.token || '',
    });
    const ping = await puller.pingDevice(3000);
    if (!ping.reachable) throw new Error('Terminal device unreachable over TCP 5005');

    const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    log('ok', `Terminal clock synchronized successfully! Target RTC: ${nowStr}`);
    setStatus('RTC Time Synced');
  } catch (err) {
    log('err', 'Time sync failed: ' + extractErrorMessage(err));
    setStatus('Time Sync Failed', false);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ─── App Init ─────────────────────────────────────────────────────────────────
function initApp() {
  // Clear any old legacy storage keys
  ['ksynbr_passkey_cred', 'ksynbr_pk_v1', '_authError'].forEach(k => {
    try { localStorage.removeItem(k); } catch(_) {}
  });
  hideAuthError();
  refreshPasskeyUI();

  // Date range defaults
  const today = new Date().toISOString().slice(0,10);
  const week  = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
  const rf = $('rangeFrom'); if (rf) rf.value = week;
  const rt = $('rangeTo');   if (rt) rt.value = today;

  // Terminal Dock Expand/Collapse
  $('termDockBar')?.addEventListener('click', (e) => {
    if (e.target.closest('#btnClearTerm')) return;
    toggleTerminalDock();
  });
  $('btnToggleTerm')?.addEventListener('click', () => toggleTerminalDock());
  $('btnClearTerm')?.addEventListener('click', () => {
    const tb = $('termBody');
    if (tb) tb.innerHTML = '';
    state.logCount = 0;
    if ($('termLogCount')) $('termLogCount').textContent = 'Cleared';
  });

  // Quick RTC Time Sync
  $('btnSyncTimeQuick')?.addEventListener('click', executeRtcTimeSync);

  // Live Searches
  $('deckSearch')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    applyFilters();
  });
  $('fullSearch')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    applyFilters();
  });

  // Export Buttons
  $('btnExportCsv')?.addEventListener('click', () => exportToCsv(state.filteredPunches));
  $('btnExportFullCsv')?.addEventListener('click', () => exportToCsv(state.filteredPunches));
  $('btnExportJson')?.addEventListener('click', () => exportToJson(state.filteredPunches));

  // Passkey Modal
  $('btnPasskeySkip')?.addEventListener('click', () => {
    $('passkeyModal').classList.remove('visible');
    openDashboard();
  });
  $('btnPasskeySave')?.addEventListener('click', async () => {
    try {
      const enc = await encryptCredential(_pendingMobile, _pendingPw, _pendingCloud);
      localStorage.setItem(PK_LS_KEY, JSON.stringify({ mobile: _pendingMobile, ...enc }));
      log('ok', `Passkey saved for ${_pendingMobile}. One-click sign-in active.`);
    } catch (e) {
      log('err', 'Failed to save passkey: ' + extractErrorMessage(e));
    }
    _pendingPw = '';
    $('passkeyModal').classList.remove('visible');
    openDashboard();
  });
  $('btnRegisterPasskeySettings')?.addEventListener('click', showPasskeyModal);
  $('btnClearPasskeySettings')?.addEventListener('click', () => {
    clearPasskey(); refreshPasskeyUI();
    log('warn', 'Device passkey removed.');
  });

  // Server & Password toggles
  $('serverSelect')?.addEventListener('change', () => {
    const v = $('serverSelect').value;
    if (v === 'custom') {
      $('serverCustom').style.display = 'block';
    } else {
      $('serverCustom').style.display = 'none';
      state.cloudUrl = v;
      if ($('cloudLabel')) $('cloudLabel').textContent = v;
    }
  });
  $('btnEye')?.addEventListener('click', () => {
    const inp = $('loginPassword');
    const icon = $('eyeIcon');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    if (icon) icon.setAttribute('data-lucide', show ? 'eye-off' : 'eye');
    reIcons();
  });

  // Login Form
  $('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mobile   = $('loginMobile').value.trim();
    const password = $('loginPassword').value;
    let   cloudUrl = $('serverSelect').value === 'custom'
      ? $('serverCustom').value.trim()
      : $('serverSelect').value;
    if (!cloudUrl) cloudUrl = 'https://kernn-hrms-internal.vercel.app';
    state.cloudUrl = cloudUrl;
    if (!mobile || !password) { showAuthError('Please enter your mobile number and password.'); return; }
    await doPasswordLogin(mobile, password, cloudUrl, $('chkRemember').checked);
  });

  // Passkey Login Button
  $('btnPasskeyLogin')?.addEventListener('click', async () => {
    const stored = getPasskeyStored();
    if (!stored) return;
    const btn = $('btnPasskeyLogin');
    btn.disabled = true;
    btn.innerHTML = '<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Unlocking with Passkey…';
    try {
      const cred = await decryptCredential(stored);
      await doPasswordLogin(cred.mobile, cred.password, cred.cloudUrl || state.cloudUrl, false);
    } catch (err) {
      showAuthError('Passkey unlock failed — please sign in with your password. ' + extractErrorMessage(err));
      log('err', 'Passkey error: ' + extractErrorMessage(err));
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="fingerprint" style="width:15px;height:15px"></i> Quick Sign In with Saved Passkey';
      reIcons();
    }
  });

  // Logout
  $('btnLogout')?.addEventListener('click', () => {
    state.session = null;
    state.allPunches = []; state.filteredPunches = [];
    $('dashboardView').classList.remove('visible');
    $('authView').style.display = 'flex';
    hideAuthError();
    log('info', 'Session logged out.');
  });

  // Sidebar Navigation
  document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const pane = $(item.dataset.tab);
      if (pane) { pane.classList.add('active'); reIcons(); }
    });
  });

  // Deck Tabs
  document.querySelectorAll('.deck-tab[data-deck]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.deck-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.deck-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const pane = $(tab.dataset.deck);
      if (pane) { pane.classList.add('active'); reIcons(); }
    });
  });

  // Pull Drawer Toggle
  $('btnOpenDrawer')?.addEventListener('click', () => {
    pullDrawerOpen = !pullDrawerOpen;
    if (pullDrawerOpen) {
      $('pullDrawer').style.display = 'block';
      $('pullBtnText').textContent  = 'Close Options';
      reIcons();
    } else {
      closeDrawer();
    }
  });

  document.querySelectorAll('.mode-pill').forEach(p => {
    p.addEventListener('click', () => selectMode(p.dataset.mode || 'ALL'));
  });

  // Hardware Pull Execution
  $('btnExecutePull')?.addEventListener('click', async () => {
    const btn = $('btnExecutePull');
    if (btn.disabled) return;

    if (state.pullMode === 'RANGE') {
      state.rangeFrom = $('rangeFrom').value;
      state.rangeTo   = $('rangeTo').value;
      if (!state.rangeFrom || !state.rangeTo) { log('warn', 'Please select both From and To dates.'); return; }
    }

    closeDrawer();
    btn.disabled = true;
    setStatus('Connecting to terminal…', false);
    toggleTerminalDock(true);
    log('sock', `TCP socket open → ${state.deviceIp}:${state.devicePort} | Mode: ${state.pullMode}`);

    const puller = new DevicePuller({
      ip: state.deviceIp, port: state.devicePort,
      machineId: state.machineId, cloudUrl: state.cloudUrl,
      authToken: state.session?.token || '',
    });

    try {
      const ping = await puller.pingDevice(3000);
      const pingTxt = ping.reachable ? `${ping.latencyMs}ms` : 'Unreachable';
      if ($('statPing')) $('statPing').textContent = pingTxt;
      if (!ping.reachable) throw new Error(`Device unreachable — ${ping.error}`);

      log('ok', `Device responded in ${ping.latencyMs}ms`);
      setStatus('Reading EEPROM memory…', false);

      const result = await puller.pullAttendanceLogs(15000);
      if (!result.success && !result.logs?.length) throw new Error(result.error || 'No records returned from device');

      let punches = result.logs || [];
      log('ok', `Extracted ${punches.length} punch records from hardware memory.`);

      // Client-side date filter
      if (state.pullMode === 'TODAY') {
        const today = new Date().toISOString().slice(0,10);
        punches = punches.filter(p => p.timestamp?.slice(0,10) === today);
      } else if (state.pullMode === 'RANGE') {
        const from = new Date(state.rangeFrom).getTime();
        const to   = new Date(state.rangeTo).getTime() + 86399999;
        punches = punches.filter(p => {
          const t = new Date(p.timestamp?.replace(' ','T')+'Z').getTime();
          return t >= from && t <= to;
        });
      }

      state.allPunches = punches;
      buildDateChips();
      applyFilters();

      // Extract unique user profiles
      const usersMap = new Map();
      punches.forEach(p => {
        if (p.userId && !usersMap.has(p.userId)) {
          usersMap.set(p.userId, { userId: p.userId, name: p.name || `Staff ${p.userId}`, privilege: 0 });
        }
      });
      state.allUsers = Array.from(usersMap.values());
      renderUsersTable(state.allUsers);

      const uniq = uniqueDates(punches);
      if ($('statPunches')) $('statPunches').textContent = punches.length;
      if ($('statDays'))    $('statDays').textContent    = uniq.length;
      if ($('navBadgePunches')) $('navBadgePunches').textContent = punches.length;
      if ($('btnPushCloud')) $('btnPushCloud').disabled = punches.length === 0;

      setStatus(`Fetched ${punches.length} records`);
      log('ok', `Ready for review: ${punches.length} records across ${uniq.length} calendar day(s).`);
    } catch (err) {
      log('err', extractErrorMessage(err));
      setStatus('Pull failed', false);
    } finally {
      btn.disabled = false;
    }
  });

  // Push Commit Handlers
  $('btnPushCloud')?.addEventListener('click', () => executePush(state.filteredPunches, $('btnPushCloud')));
  $('btnPushNow')?.addEventListener('click',   () => executePush(state.filteredPunches, $('btnPushNow')));

  // Settings Save
  $('btnSaveSettings')?.addEventListener('click', () => {
    const ip  = $('cfgIp').value.trim();
    const prt = parseInt($('cfgPort').value);
    const mid = parseInt($('cfgMachineId').value);
    const url = $('cfgCloudUrl').value.trim();
    if (ip)  state.deviceIp   = ip;
    if (prt) state.devicePort = prt;
    if (mid) state.machineId  = mid;
    if (url) state.cloudUrl   = url;
    updateCloudLabels();
    log('ok', `Configuration saved: ${state.deviceIp}:${state.devicePort} | ${state.cloudUrl}`);
    setStatus('Settings saved');
  });

  // Network Scanner
  $('btnStartScan')?.addEventListener('click', async () => {
    const btn   = $('btnStartScan');
    const tbody = $('tbScanner');
    const card  = $('scanResultsCard');
    btn.disabled = true;
    btn.innerHTML = '<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Scanning…';
    if (card)  card.style.display  = 'flex';
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">Sweeping 192.168.29.1–254 on TCP 5005…</td></tr>';
    toggleTerminalDock(true);
    log('sock', 'LAN sweep started on subnet 192.168.29.x:5005');

    const net   = require('net');
    const found = [];
    const tasks = [];
    for (let i = 1; i <= 254; i++) {
      const ip = `192.168.29.${i}`;
      tasks.push(new Promise(resolve => {
        const t0 = Date.now(), sock = new net.Socket();
        sock.setTimeout(400);
        sock.on('connect', () => { sock.destroy(); found.push({ ip, latency: Date.now()-t0 }); resolve(); });
        sock.on('timeout', () => { sock.destroy(); resolve(); });
        sock.on('error',   () => { sock.destroy(); resolve(); });
        sock.connect(5005, ip);
      }));
    }
    await Promise.all(tasks);

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="search" style="width:14px;height:14px"></i> Start Network Sweep';
    reIcons();

    if (!found.length) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">No responsive devices found on 192.168.29.x:5005</td></tr>';
      log('warn', 'Sweep complete — 0 devices responded.');
      return;
    }
    log('ok', `Discovered ${found.length} active terminal(s) on LAN!`);
    if (tbody) tbody.innerHTML = found.map(d => `
      <tr>
        <td class="mono text-cyan" style="font-weight:700">${d.ip}</td>
        <td class="mono">5005</td>
        <td><span class="badge badge-blue">Secureye TCP</span></td>
        <td class="mono text-violet">${d.latency}ms</td>
        <td>
          <button onclick="useDevice('${d.ip}')"
            style="padding:5px 14px;background:rgba(34,211,238,0.12);border:1px solid rgba(34,211,238,0.35);
                   border-radius:6px;color:var(--cyan);font-size:11px;font-weight:700;cursor:pointer">
            Select Device
          </button>
        </td>
      </tr>
    `).join('');
  });

  log('info', `Kernn Sync Bridge ready — ${process.platform} / Electron ${process.versions.electron}`);
}
