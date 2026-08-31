/**
 * KERNN SYNC BRIDGE — Renderer Process v4
 *
 * Root-cause fix: API returns error as { code, message } object.
 * data.error passed directly to `new Error()` → "[object Object]".
 * Now correctly extracts error.message from all API response shapes.
 *
 * Pull → Review → Push flow:
 *   1. Pull from device TCP socket (pullAttendanceLogs)
 *   2. Filter by date chip / range picker (client-side)
 *   3. Push ONLY the filtered set to cloud
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
  allPunches:      [],
  filteredPunches: [],
  allUsers:        [],
  allAudit:        [],
};

// ─── DOM helpers ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts.includes(' ') ? ts.replace(' ','T')+'Z' : ts);
    if (isNaN(d)) return ts;
    return d.toLocaleString('en-IN', { hour12: true });
  } catch { return ts; }
}

/**
 * Safely extract a human-readable error string from ANYTHING:
 * - standard Error object
 * - API { code, message } object
 * - { error: { code, message } } envelope
 * - plain string
 */
function extractErrorMessage(val) {
  if (!val) return 'An unexpected error occurred';
  if (typeof val === 'string') return val;
  if (val instanceof Error) return val.message;
  // API error object: { code, message }
  if (typeof val === 'object') {
    if (typeof val.message === 'string') return val.message;
    if (typeof val.error === 'string')   return val.error;
    if (typeof val.error === 'object' && val.error?.message) return val.error.message;
    try { return JSON.stringify(val); } catch { return String(val); }
  }
  return String(val);
}

// ─── Lucide icons ─────────────────────────────────────────────────────────────
function reIcons() { if (window.lucide) lucide.createIcons(); }
window.addEventListener('DOMContentLoaded', () => {
  reIcons();
  initApp();
});

// ─── Terminal logger ──────────────────────────────────────────────────────────
const TERM_PREFIX = { ok:'[OK]', err:'[ERR]', warn:'[WARN]', sock:'[SOCK]', info:'[INFO]' };
const TERM_CLASS  = { ok:'tc-ok', err:'tc-err', warn:'tc-warn', sock:'tc-sock', info:'tc-time' };

function log(type, msg) {
  const tb = $('termBody');
  if (!tb) return;
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  const line = document.createElement('div');
  line.className = 'term-line';
  line.innerHTML = `<span class="tc-time">${ts}</span> <span class="${TERM_CLASS[type]||''}">${TERM_PREFIX[type]||''}</span> ${escHtml(String(msg))}`;
  tb.appendChild(line);
  tb.scrollTop = tb.scrollHeight;
}

// ─── Auth error display ──────────────────────────────────────────────────────
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

// ─── Top status badge ─────────────────────────────────────────────────────────
function setStatus(text, ok = true) {
  const txt = $('topStatusText');
  const dot = $('topStatus')?.querySelector('.tb-dot');
  if (txt) txt.textContent = text;
  if (dot) {
    dot.style.background = ok ? '#10b981' : '#f59e0b';
    dot.style.boxShadow  = ok ? '0 0 8px #10b981' : '0 0 8px #f59e0b';
  }
}

// ─── Passkey — AES-GCM, machine-specific key ─────────────────────────────────
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
    if (stat) stat.innerHTML = `Passkey registered for <strong style="color:var(--text-1)">${escHtml(pk.mobile)}</strong>.<br>Quick Sign-In is available on this machine.`;
  } else {
    if (btn)  btn.style.display  = 'none';
    if (div)  div.style.display  = 'none';
    if (stat) stat.textContent = 'No passkey saved on this device.';
  }
}

// ─── Passkey modal ────────────────────────────────────────────────────────────
let _pendingMobile = '', _pendingPw = '', _pendingCloud = '';

function showPasskeyModal() {
  const modal = $('passkeyModal');
  if (modal) { modal.classList.add('visible'); reIcons(); }
}

// ─── Event listeners (all inside DOMContentLoaded via initApp) ────────────────
// NOTE: We bind everything inside initApp() to guarantee the DOM exists.
// Module-level event binding was the root cause of silent failures.

// ─── Auth: password login ─────────────────────────────────────────────────────
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
  setStatus('Gateway Connected');
  log('ok', `Dashboard ready — ${s.name}`);
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
  log('ok', `Active device switched to ${ip}:${state.devicePort}`);
  document.querySelector('.nav-item[data-tab="tab-sync"]')?.click();
};

// ─── Date Chips ──────────────────────────────────────────────────────────────
function uniqueDates(punches) {
  return [...new Set(punches.map(p => p.timestamp?.slice(0,10)).filter(Boolean))].sort();
}

function buildDateChips() {
  const row = $('datePillsRow');
  row.innerHTML = '';
  const dates = uniqueDates(state.allPunches);
  if (!dates.length) return;
  const mkChip = (label, value) => {
    const c = document.createElement('button');
    c.className    = 'date-chip';
    c.textContent  = label;
    c.dataset.date = value || '';
    c.addEventListener('click', () => applyDateFilter(value || null, c));
    return c;
  };
  const allChip = mkChip('All', null);
  allChip.classList.add('active');
  row.appendChild(allChip);
  dates.forEach(d => row.appendChild(mkChip(d, d)));
}

function applyDateFilter(dateStr, chipEl) {
  document.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
  if (chipEl) chipEl.classList.add('active');
  else $('datePillsRow')?.querySelector('.date-chip')?.classList.add('active');

  state.filteredPunches = dateStr
    ? state.allPunches.filter(p => p.timestamp?.slice(0,10) === dateStr)
    : [...state.allPunches];

  renderPunchesHub(state.filteredPunches);
  renderPunchesFull(state.filteredPunches);
  updatePushMeta();
}

// ─── Render helpers ──────────────────────────────────────────────────────────
function verifyBadge(mode) {
  const m = String(mode || '').toLowerCase();
  if (m.includes('face'))   return `<span class="badge badge-violet">Face</span>`;
  if (m.includes('finger')) return `<span class="badge badge-blue">Fingerprint</span>`;
  if (m.includes('pin') || m.includes('password')) return `<span class="badge badge-amber">PIN</span>`;
  if (m.includes('rfid') || m.includes('card'))    return `<span class="badge badge-green">RFID</span>`;
  return `<span class="badge badge-dim">${escHtml(mode||'—')}</span>`;
}

function punchRows(punches) {
  return punches.map((p, i) => `
    <tr>
      <td class="mono text-dim">${i+1}</td>
      <td class="mono text-cyan">${escHtml(p.userId)}</td>
      <td>${escHtml(p.name || '—')}</td>
      <td class="mono" style="font-size:11px">${escHtml(fmtDate(p.timestamp))}</td>
      <td>${verifyBadge(p.verifyType || p.verifyMode)}</td>
    </tr>
  `).join('');
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
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">No records match this filter.</td></tr>';
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
  const panel = $('pushPanelFull');
  const shown = $('shownCountFull');
  const btn   = $('btnPushFull');

  if (!punches.length) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">No records for this filter.</td></tr>';
    if (panel) panel.style.display = 'none';
    return;
  }
  if (tbody) tbody.innerHTML = punchRows(punches);
  if (panel) panel.style.display = 'flex';
  if (shown) shown.textContent   = punches.length;
  if (btn)   btn.disabled        = false;
  reIcons();
}

function updatePushMeta() {
  const n  = state.filteredPunches.length;
  const pc = $('pushCountDesc');
  if (pc) pc.textContent = `${n} record${n!==1?'s':''}`;
  const bt = $('btnPushCloud');
  if (bt) bt.disabled = n === 0;
}

function resetStats() {
  ['statPunches','statDays'].forEach(id => { const e=$( id); if(e) e.textContent='0'; });
  ['statPing','teleLatency'].forEach(id => { const e=$(id); if(e) e.textContent='—'; });
  ['navBadgePunches','navBadgeUsers','dkBadgePunches','dkBadgeUsers','dkBadgeAudit']
    .forEach(id => { const e=$(id); if(e) e.textContent='0'; });
  const tb = $('tbPunches');
  if (tb) tb.innerHTML = '<tr><td colspan="5" class="tbl-empty">Pull records from hardware to preview attendance logs here.</td></tr>';
  const pp = $('pushPanel'); if(pp) pp.style.display='none';
  const dr = $('datePillsRow'); if(dr) dr.innerHTML='';
  const pc = $('pushCountDesc'); if(pc) pc.textContent='0 records';
  const bt = $('btnPushCloud'); if(bt) bt.disabled=true;
}

// ─── Execute push ─────────────────────────────────────────────────────────────
async function executePush(records, btn) {
  if (!records?.length) { log('warn', 'Nothing to push — check your date filter.'); return; }
  if (!state.session?.token) { log('err', 'Not authenticated.'); return; }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = `<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Uploading ${records.length}…`;
  setStatus(`Pushing ${records.length} records…`, false);
  log('sock', `Cloud upload: ${records.length} records → ${state.cloudUrl}`);

  const puller = new DevicePuller({
    ip: state.deviceIp, port: state.devicePort,
    machineId: state.machineId, cloudUrl: state.cloudUrl,
    authToken: state.session.token,
  });

  try {
    const res = await puller.pushToCloud(records, '102023050002456');
    if (res.success === false && res.error) throw new Error(extractErrorMessage(res.error));
    const ins = res.inserted ?? res.count ?? records.length;
    const dup = res.duplicates ?? res.skipped ?? 0;
    log('ok', `Push complete — ${ins} inserted, ${dup} duplicates skipped.`);
    setStatus(`Pushed ${ins} records`);
  } catch (err) {
    log('err', 'Push failed: ' + extractErrorMessage(err));
    setStatus('Push failed', false);
  } finally {
    btn.disabled = false; btn.innerHTML = orig; reIcons();
  }
}

// ─── App Init — ALL event listeners live here so DOM is guaranteed ────────────
function initApp() {
  // 1. Clear ALL stale state from previous sessions
  ['ksynbr_passkey_cred', 'ksynbr_pk_v1', '_authError'].forEach(k => {
    try { localStorage.removeItem(k); } catch(_) {}
  });
  hideAuthError(); // Always start clean

  // 2. Passkey UI
  refreshPasskeyUI();

  // 3. Default date range
  const today = new Date().toISOString().slice(0,10);
  const week  = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
  const rf = $('rangeFrom'); if (rf) rf.value = week;
  const rt = $('rangeTo');   if (rt) rt.value = today;

  // 4. ── Passkey modal buttons ───────────────────────────────────────────────
  $('btnPasskeySkip')?.addEventListener('click', () => {
    $('passkeyModal').classList.remove('visible');
    openDashboard();
  });

  $('btnPasskeySave')?.addEventListener('click', async () => {
    try {
      const enc = await encryptCredential(_pendingMobile, _pendingPw, _pendingCloud);
      localStorage.setItem(PK_LS_KEY, JSON.stringify({ mobile: _pendingMobile, ...enc }));
      log('ok', `Passkey saved for ${_pendingMobile}. Quick Sign-In available.`);
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

  // 5. ── Server select & eye toggle ─────────────────────────────────────────
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
    const inp  = $('loginPassword');
    const icon = $('eyeIcon');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    if (icon) icon.setAttribute('data-lucide', show ? 'eye-off' : 'eye');
    reIcons();
  });

  // 6. ── Login form ──────────────────────────────────────────────────────────
  $('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mobile   = $('loginMobile').value.trim();
    const password = $('loginPassword').value;
    let   cloudUrl = $('serverSelect').value === 'custom'
      ? $('serverCustom').value.trim()
      : $('serverSelect').value;
    if (!cloudUrl) cloudUrl = 'https://kernn-hrms-internal.vercel.app';
    state.cloudUrl = cloudUrl;
    if (!mobile || !password) { showAuthError('Please fill in all fields.'); return; }
    await doPasswordLogin(mobile, password, cloudUrl, $('chkRemember').checked);
  });

  // 7. ── Passkey quick login ─────────────────────────────────────────────────
  $('btnPasskeyLogin')?.addEventListener('click', async () => {
    const stored = getPasskeyStored();
    if (!stored) return;
    const btn = $('btnPasskeyLogin');
    btn.disabled = true;
    btn.innerHTML = '<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Unlocking…';
    try {
      const cred = await decryptCredential(stored);
      await doPasswordLogin(cred.mobile, cred.password, cred.cloudUrl || state.cloudUrl, false);
    } catch (err) {
      showAuthError('Passkey unlock failed — sign in with your password. ' + extractErrorMessage(err));
      log('err', 'Passkey error: ' + extractErrorMessage(err));
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="fingerprint" style="width:15px;height:15px"></i> Quick Sign In with Saved Passkey';
      reIcons();
    }
  });

  // 8. ── Logout ──────────────────────────────────────────────────────────────
  $('btnLogout')?.addEventListener('click', () => {
    state.session = null;
    state.allPunches = []; state.filteredPunches = [];
    $('dashboardView').classList.remove('visible');
    $('authView').style.display = 'flex';
    resetStats();
    hideAuthError();
    log('info', 'Session ended.');
  });

  // 9. ── Sidebar nav ─────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const pane = $(item.dataset.tab);
      if (pane) { pane.classList.add('active'); reIcons(); }
    });
  });

  // 10. ── Deck tabs ──────────────────────────────────────────────────────────
  document.querySelectorAll('.deck-tab[data-deck]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.deck-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.deck-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const pane = $(tab.dataset.deck);
      if (pane) pane.classList.add('active');
    });
  });

  // 11. ── Pull drawer ────────────────────────────────────────────────────────
  $('btnOpenDrawer')?.addEventListener('click', () => {
    pullDrawerOpen = !pullDrawerOpen;
    if (pullDrawerOpen) {
      $('pullDrawer').style.display = 'block';
      $('pullBtnText').textContent  = 'Collapse Options';
      reIcons();
    } else {
      closeDrawer();
    }
  });

  document.querySelectorAll('.mode-pill').forEach(p => {
    p.addEventListener('click', () => selectMode(p.dataset.mode || 'ALL'));
  });

  // 12. ── Execute Pull ───────────────────────────────────────────────────────
  $('btnExecutePull')?.addEventListener('click', async () => {
    const btn = $('btnExecutePull');
    if (btn.disabled) return;

    if (state.pullMode === 'RANGE') {
      state.rangeFrom = $('rangeFrom').value;
      state.rangeTo   = $('rangeTo').value;
      if (!state.rangeFrom || !state.rangeTo) { log('warn', 'Select From and To dates.'); return; }
    }

    closeDrawer();
    btn.disabled = true;
    setStatus('Connecting to hardware…', false);
    log('sock', `TCP dial → ${state.deviceIp}:${state.devicePort} | mode: ${state.pullMode}`);

    const puller = new DevicePuller({
      ip: state.deviceIp, port: state.devicePort,
      machineId: state.machineId, cloudUrl: state.cloudUrl,
      authToken: state.session?.token || '',
    });

    try {
      const ping = await puller.pingDevice(3000);
      const pingTxt = ping.reachable ? `${ping.latencyMs}ms` : 'Unreachable';
      if ($('statPing'))    $('statPing').textContent    = pingTxt;
      if ($('teleLatency')) $('teleLatency').textContent = pingTxt;
      if (!ping.reachable) throw new Error(`Device unreachable — ${ping.error}`);
      log('ok', `Device responded in ${ping.latencyMs}ms`);
      setStatus('Pulling from EEPROM…', false);

      const result = await puller.pullAttendanceLogs(15000);
      if (!result.success && !result.logs?.length) throw new Error(result.error || 'No data returned');

      let punches = result.logs || [];
      log('ok', `Raw pull: ${punches.length} records`);

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
      applyDateFilter(null);

      const uniq = uniqueDates(punches);
      if ($('statPunches')) $('statPunches').textContent = punches.length;
      if ($('statDays'))    $('statDays').textContent    = uniq.length;
      if ($('navBadgePunches')) $('navBadgePunches').textContent = punches.length;
      if ($('btnPushCloud')) $('btnPushCloud').disabled = punches.length === 0;

      setStatus(`Pulled ${punches.length} records — review and push`);
      log('ok', `Pull done — ${punches.length} records, ${uniq.length} date(s)`);
    } catch (err) {
      log('err', extractErrorMessage(err));
      setStatus('Pull failed', false);
    } finally {
      btn.disabled = false;
    }
  });

  // 13. ── Push buttons ───────────────────────────────────────────────────────
  $('btnPushCloud')?.addEventListener('click', () => executePush(state.filteredPunches, $('btnPushCloud')));
  $('btnPushNow')?.addEventListener('click',   () => executePush(state.filteredPunches, $('btnPushNow')));
  $('btnPushFull')?.addEventListener('click',  () => executePush(state.filteredPunches, $('btnPushFull')));

  // 14. ── Attendance tab filter ──────────────────────────────────────────────
  $('btnFilterPunches')?.addEventListener('click', () => {
    const d = $('punchDateFilter').value;
    if (!d) return;
    state.filteredPunches = state.allPunches.filter(p => p.timestamp?.slice(0,10) === d);
    renderPunchesFull(state.filteredPunches);
    updatePushMeta();
  });
  $('btnClearFilter')?.addEventListener('click', () => {
    $('punchDateFilter').value = '';
    state.filteredPunches = [...state.allPunches];
    renderPunchesFull(state.filteredPunches);
    updatePushMeta();
  });

  // 15. ── Settings ───────────────────────────────────────────────────────────
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
    log('ok', `Settings saved — ${state.deviceIp}:${state.devicePort} | ${state.cloudUrl}`);
    setStatus('Settings saved');
  });

  // 16. ── Terminal clear ────────────────────────────────────────────────────
  $('btnClearTerm')?.addEventListener('click', () => {
    const tb = $('termBody');
    if (tb) tb.innerHTML = '';
  });

  // 17. ── Network scanner ────────────────────────────────────────────────────
  $('btnStartScan')?.addEventListener('click', async () => {
    const btn   = $('btnStartScan');
    const tbody = $('tbScanner');
    const card  = $('scanResultsCard');
    btn.disabled = true;
    btn.innerHTML = '<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Scanning…';
    if (card)  card.style.display  = 'block';
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">Scanning 192.168.29.x:5005…</td></tr>';
    log('sock', 'LAN sweep started on port 5005');

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
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">No devices found on 192.168.29.x:5005</td></tr>';
      log('warn', 'Sweep complete — no devices found.');
      return;
    }
    log('ok', `Sweep done — ${found.length} device(s) found`);
    if (tbody) tbody.innerHTML = found.map(d => `
      <tr>
        <td class="mono text-cyan">${d.ip}</td>
        <td class="mono">5005</td>
        <td><span class="badge badge-blue">TCP/Binary</span></td>
        <td class="mono text-violet">${d.latency}ms</td>
        <td>
          <button onclick="useDevice('${d.ip}')"
            style="padding:4px 12px;background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.3);
                   border-radius:6px;color:var(--cyan);font-size:11px;font-weight:700;cursor:pointer">
            Use This
          </button>
        </td>
      </tr>
    `).join('');
  });

  log('info', `Kernn Sync Bridge ready — ${process.platform} / Electron ${process.versions.electron}`);
}
