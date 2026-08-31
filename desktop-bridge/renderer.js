/**
 * KERNN SYNC BRIDGE — Renderer Process
 *
 * Passkey: AES-GCM credential encrypted with a machine-specific key, stored
 *          in localStorage. Completely self-contained — no server call needed
 *          to verify the passkey; we decrypt the saved credentials and re-login.
 *
 * Pull → Review → Push flow:
 *   1. Pull records from device via TCP (pullAttendanceLogs)
 *   2. Filter by date chip or date input
 *   3. Push only the *filtered* set to the cloud
 */

// ─── IIFE: Run synchronously before DOM ready to clear all stale state ────────
(function immediateCleanup() {
  try {
    // Remove all legacy passkey keys from previous app versions
    ['ksynbr_passkey_cred', 'ksynbr_pk_v1', '_authError'].forEach(k => {
      localStorage.removeItem(k);
    });
  } catch (_) {}

  // Force-hide authError div immediately if it already has content from
  // Chromium's session restore (which can replay stale DOM state)
  try {
    const el = document.getElementById('authError');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  } catch (_) {}
})();

'use strict';

const { DevicePuller } = require('./device-puller');

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  session:          null,
  cloudUrl:         'https://kernn-hrms-internal.vercel.app',
  deviceIp:         '192.168.29.83',
  devicePort:       5005,
  machineId:        1,

  pullMode:         'ALL',
  rangeFrom:        null,
  rangeTo:          null,

  allPunches:       [],
  filteredPunches:  [],
  allUsers:         [],
  allAudit:         [],
};

// ─── Tiny DOM helper ──────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts.includes(' ') ? ts.replace(' ','T')+'Z' : ts);
    if (isNaN(d)) return ts;
    return d.toLocaleString('en-IN', { hour12: true });
  } catch { return ts; }
}

// ─── Lucide Icons ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  initApp();
});

function reIcons() { if (window.lucide) lucide.createIcons(); }

// ─── Terminal Logger ──────────────────────────────────────────────────────────
const TERM_PREFIX = { ok:'[OK]', err:'[ERR]', warn:'[WARN]', sock:'[SOCK]', info:'[INFO]' };
const TERM_CLASS  = { ok:'tc-ok', err:'tc-err', warn:'tc-warn', sock:'tc-sock', info:'tc-time' };

function log(type, msg) {
  const tb = $('termBody');
  if (!tb) return;
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  const line = document.createElement('div');
  line.className = 'term-line';
  line.innerHTML = `<span class="tc-time">${ts}</span> <span class="${TERM_CLASS[type]||''}">${TERM_PREFIX[type]||''}</span> ${escHtml(msg)}`;
  tb.appendChild(line);
  tb.scrollTop = tb.scrollHeight;
}

$('btnClearTerm')?.addEventListener('click', () => { $('termBody').innerHTML = ''; });

// ─── Top status badge ─────────────────────────────────────────────────────────
function setStatus(text, ok = true) {
  const txt = $('topStatusText');
  const dot = $('topStatus')?.querySelector('.tb-dot');
  if (txt) txt.textContent = text;
  if (dot) {
    dot.style.background  = ok ? '#10b981' : '#f59e0b';
    dot.style.boxShadow   = ok ? '0 0 8px #10b981' : '0 0 8px #f59e0b';
  }
}

// ─── Passkey — AES-GCM, machine-specific key ──────────────────────────────────
const PK_LS_KEY = 'ksynbr_pk_v2';

/** Derive a 256-bit key from a machine-specific salt using PBKDF2 */
async function deriveMachineKey() {
  const enc = new TextEncoder();
  const salt = [
    navigator.userAgent,
    process.env.COMPUTERNAME || process.env.HOSTNAME || 'local',
    process.env.USERDOMAIN  || process.env.USER || 'device',
    'kernn-sync-bridge-v1',
  ].join('|');

  const keyMat = await crypto.subtle.importKey('raw', enc.encode('kernn-bridge-master'), 'PBKDF2', false, ['deriveKey']);
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
  const plain = JSON.stringify({ mobile, password, cloudUrl });
  const cipher = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, enc.encode(plain));
  return {
    iv:  Array.from(iv),
    ct:  Array.from(new Uint8Array(cipher)),
  };
}

async function decryptCredential(stored) {
  const key = await deriveMachineKey();
  const iv  = new Uint8Array(stored.iv);
  const ct  = new Uint8Array(stored.ct);
  const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(plain));
}

function getPasskeyStored() {
  try { return JSON.parse(localStorage.getItem(PK_LS_KEY) || 'null'); }
  catch { return null; }
}
function clearPasskey() { localStorage.removeItem(PK_LS_KEY); }

function refreshPasskeyUI() {
  const pk  = getPasskeyStored();
  const btn = $('btnPasskeyLogin');
  const div = $('authDivider');
  const stat= $('passkeyStatus');

  if (pk?.mobile) {
    if (btn)  btn.style.display  = 'flex';
    if (div)  div.style.display  = 'block';
    if (stat) stat.innerHTML = `Device passkey registered for <strong style="color:var(--text-1)">${escHtml(pk.mobile)}</strong>.<br>Quick Sign-In is available on this machine.`;
  } else {
    if (btn)  btn.style.display  = 'none';
    if (div)  div.style.display  = 'none';
    if (stat) stat.textContent = 'No passkey saved on this device.';
  }
}

// ─── Passkey Registration Modal ───────────────────────────────────────────────
let _pendingMobile = '', _pendingPw = '', _pendingCloud = '';

function showPasskeyModal() {
  $('passkeyModal').classList.add('visible');
  reIcons();
}

$('btnPasskeySkip')?.addEventListener('click', () => {
  $('passkeyModal').classList.remove('visible');
  openDashboard();
});

$('btnPasskeySave')?.addEventListener('click', async () => {
  try {
    const enc = await encryptCredential(_pendingMobile, _pendingPw, _pendingCloud);
    localStorage.setItem(PK_LS_KEY, JSON.stringify({ mobile: _pendingMobile, ...enc }));
    log('ok', `Device passkey saved for ${_pendingMobile}. Quick Sign-In is now available.`);
  } catch (e) {
    log('err', 'Failed to save passkey: ' + e.message);
  }
  _pendingPw = '';
  $('passkeyModal').classList.remove('visible');
  openDashboard();
});

$('btnRegisterPasskeySettings')?.addEventListener('click', showPasskeyModal);

$('btnClearPasskeySettings')?.addEventListener('click', () => {
  clearPasskey();
  refreshPasskeyUI();
  log('warn', 'Device passkey removed.');
});

// ─── Auth: Password Login ─────────────────────────────────────────────────────
$('serverSelect')?.addEventListener('change', () => {
  const v = $('serverSelect').value;
  const cust = $('serverCustom');
  if (v === 'custom') { cust.style.display = 'block'; }
  else { cust.style.display = 'none'; state.cloudUrl = v; $('cloudLabel').textContent = v; }
});

// Eye toggle
$('btnEye')?.addEventListener('click', () => {
  const inp  = $('loginPassword');
  const icon = $('eyeIcon');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  icon.setAttribute('data-lucide', show ? 'eye-off' : 'eye');
  reIcons();
});

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

async function doPasswordLogin(mobile, password, cloudUrl, askPasskey = false) {
  const btn = $('btnLogin');
  if (btn) btn.disabled = true;
  setLoading(btn, 'Authenticating…');

  try {
    const res  = await fetch(`${cloudUrl}/api/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mobile, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) throw new Error(data.error || data.message || 'Login failed');

    state.session = {
      token:  data.token,
      mobile,
      name:   data.user?.name  || data.name  || mobile,
      role:   data.user?.role  || data.role  || 'ADMIN',
    };
    state.cloudUrl = cloudUrl;

    log('ok', `Authenticated as ${state.session.name} (${state.session.role})`);
    hideAuthError();

    if (askPasskey && !getPasskeyStored()) {
      // Store pending credentials for modal
      _pendingMobile = mobile;
      _pendingPw     = password;
      _pendingCloud  = cloudUrl;
      showPasskeyModal();
    } else {
      openDashboard();
    }
  } catch (err) {
    showAuthError(err.message);
    log('err', 'Login failed: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; resetLoginBtn(btn); }
  }
}

function setLoading(btn, msg) {
  if (!btn) return;
  btn.innerHTML = `<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> ${msg}`;
}
function resetLoginBtn(btn) {
  if (!btn) return;
  btn.innerHTML = `<i data-lucide="log-in" style="width:14px;height:14px"></i> Sign In to Gateway`;
  reIcons();
}

function showAuthError(msg) {
  const el = $('authError');
  if (!el) return;
  // Safely convert any thrown value to a readable string
  const text = msg instanceof Error ? msg.message
    : typeof msg === 'object' && msg !== null ? (msg.message || JSON.stringify(msg))
    : String(msg || 'An unexpected error occurred');
  el.textContent = text;
  el.style.display = 'block';
}
function hideAuthError() {
  const el = $('authError');
  if (el) el.style.display = 'none';
}

// ─── Auth: Passkey Quick Login ────────────────────────────────────────────────
$('btnPasskeyLogin')?.addEventListener('click', async () => {
  const stored = getPasskeyStored();
  if (!stored) return;

  const btn = $('btnPasskeyLogin');
  btn.disabled = true;
  setLoading(btn, 'Unlocking with passkey…');

  try {
    const cred = await decryptCredential(stored);
    // Re-authenticate with saved credentials
    await doPasswordLogin(cred.mobile, cred.password, cred.cloudUrl || state.cloudUrl, false);
    log('ok', `Quick Sign-In via device passkey for ${cred.mobile}`);
  } catch (err) {
    showAuthError('Passkey unlock failed. The credential may be corrupted — sign in with your password. ' + err.message);
    log('err', 'Passkey error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="fingerprint" style="width:15px;height:15px"></i> Quick Sign In with Saved Passkey`;
    reIcons();
  }
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
function openDashboard() {
  $('authView').style.display = 'none';
  $('dashboardView').classList.add('visible');

  const s = state.session;
  $('sidebarName').textContent = s.name || s.mobile;
  $('sidebarRole').textContent = s.role || 'ADMIN';
  $('sidebarAva').textContent  = (s.name || s.mobile)[0].toUpperCase();
  $('platformLabel').textContent =
    process.platform === 'darwin' ? 'macOS' :
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

$('btnLogout')?.addEventListener('click', () => {
  state.session = null;
  state.allPunches = []; state.filteredPunches = [];
  $('dashboardView').classList.remove('visible');
  $('authView').style.display = 'flex';
  resetStats();
  log('info', 'Session ended.');
});

// ─── Sidebar Navigation ───────────────────────────────────────────────────────
document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    const pane = $(item.dataset.tab);
    if (pane) { pane.classList.add('active'); reIcons(); }
  });
});

// ─── Deck Tabs ────────────────────────────────────────────────────────────────
document.querySelectorAll('.deck-tab[data-deck]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.deck-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.deck-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const pane = $(tab.dataset.deck);
    if (pane) pane.classList.add('active');
  });
});

// ─── Pull Drawer ──────────────────────────────────────────────────────────────
let pullDrawerOpen = false;

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

window.closeDrawer = () => {
  $('pullDrawer').style.display = 'none';
  pullDrawerOpen = false;
  $('pullBtnText').textContent = 'Pull From Hardware';
};

window.selectMode = (mode) => {
  state.pullMode = mode;
  document.querySelectorAll('.mode-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.mode === mode);
  });
  $('rangeRow').style.display = mode === 'RANGE' ? 'grid' : 'none';
};

document.querySelectorAll('.mode-pill').forEach(p => {
  p.addEventListener('click', () => selectMode(p.dataset.mode || 'ALL'));
});

// ─── Execute Pull from Hardware ────────────────────────────────────────────────
$('btnExecutePull')?.addEventListener('click', async () => {
  const btn = $('btnExecutePull');
  if (btn.disabled) return;

  // Validate date range
  if (state.pullMode === 'RANGE') {
    const f = $('rangeFrom').value, t = $('rangeTo').value;
    if (!f || !t) { log('warn', 'Select both From and To dates for Range mode.'); return; }
    state.rangeFrom = f; state.rangeTo = t;
  }

  closeDrawer();
  btn.disabled = true;
  setStatus('Connecting to hardware…', false);
  log('sock', `TCP dial → ${state.deviceIp}:${state.devicePort} | mode: ${state.pullMode}`);

  const puller = new DevicePuller({
    ip:        state.deviceIp,
    port:      state.devicePort,
    machineId: state.machineId,
    cloudUrl:  state.cloudUrl,
    authToken: state.session?.token || '',
  });

  try {
    // 1. Ping
    const ping = await puller.pingDevice(3000);
    const pingTxt = ping.reachable ? `${ping.latencyMs}ms` : 'Unreachable';
    $('statPing').textContent    = pingTxt;
    $('teleLatency').textContent = pingTxt;
    if (!ping.reachable) throw new Error(`Device unreachable — ${ping.error}`);
    log('ok', `Device responded in ${ping.latencyMs}ms`);
    setStatus('Pulling from EEPROM…', false);

    // 2. Pull attendance logs via TCP
    const result = await puller.pullAttendanceLogs(15000);

    if (!result.success && !result.logs?.length) {
      throw new Error(result.error || 'Pull failed — no data returned');
    }

    let punches = result.logs || [];

    log('ok', `Raw pull: ${punches.length} records from EEPROM (SN: ${result.serialNumber || '—'})`);

    // 3. Apply date filter on client side
    if (state.pullMode === 'TODAY') {
      const today = new Date().toISOString().slice(0,10);
      punches = punches.filter(p => p.timestamp?.slice(0,10) === today);
      log('info', `Today filter applied → ${punches.length} records`);
    } else if (state.pullMode === 'RANGE') {
      const from = new Date(state.rangeFrom).getTime();
      const to   = new Date(state.rangeTo).getTime() + 86399999;
      punches = punches.filter(p => {
        const t = new Date(p.timestamp?.replace(' ','T')+'Z').getTime();
        return t >= from && t <= to;
      });
      log('info', `Range filter (${state.rangeFrom} → ${state.rangeTo}) → ${punches.length} records`);
    } else {
      // ALL — find missing dates to show in logs
      const missInfo = getMissingDateInfo(punches);
      if (missInfo.missing > 0) {
        log('warn', `${missInfo.missing} calendar day(s) of gap data detected. Showing all available records.`);
      }
    }

    state.allPunches  = punches;
    state.allUsers    = [];  // Device puller doesn't support user enumeration in current version
    state.allAudit    = [];

    buildDateChips();
    applyDateFilter(null);

    // Update stats
    const uniq = uniqueDates(punches);
    $('statPunches').textContent = punches.length;
    $('statDays').textContent    = uniq.length;
    $('navBadgePunches').textContent = punches.length;
    $('navBadgeUsers').textContent   = '—';
    $('dkBadgeUsers').textContent    = '—';
    $('dkBadgeAudit').textContent    = '—';

    $('btnPushCloud').disabled = punches.length === 0;
    setStatus(`Pulled ${punches.length} records — review and push`);
    log('ok', `Pull complete — ${punches.length} filtered records across ${uniq.length} date(s).`);

  } catch (err) {
    log('err', err.message);
    setStatus('Pull failed', false);
  } finally {
    btn.disabled = false;
  }
});

function getMissingDateInfo(punches) {
  if (!punches.length) return { missing: 0 };
  const dates = uniqueDates(punches).map(d => new Date(d).getTime());
  dates.sort((a,b) => a-b);
  const min = dates[0], max = dates[dates.length-1];
  const expected = Math.round((max - min) / 86400000) + 1;
  return { missing: expected - dates.length };
}

// ─── Date Chips ───────────────────────────────────────────────────────────────
function uniqueDates(punches) {
  return [...new Set(punches.map(p => p.timestamp?.slice(0,10)).filter(Boolean))].sort();
}

function buildDateChips() {
  const row   = $('datePillsRow');
  row.innerHTML = '';
  const dates = uniqueDates(state.allPunches);
  if (!dates.length) return;

  const mkChip = (label, value) => {
    const c = document.createElement('button');
    c.className   = 'date-chip';
    c.textContent = label;
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
  else {
    const allChip = $('datePillsRow')?.querySelector('.date-chip');
    if (allChip) allChip.classList.add('active');
  }

  state.filteredPunches = dateStr
    ? state.allPunches.filter(p => p.timestamp?.slice(0,10) === dateStr)
    : [...state.allPunches];

  renderPunches(state.filteredPunches, 'tbPunches', 'pushPanel', 'shownCount', 'totalCount', 'btnPushNow');
  renderPunchesFull(state.filteredPunches);
  updatePushMeta();
}

// ─── Render Helpers ───────────────────────────────────────────────────────────
function renderPunches(punches, tbodyId, panelId, shownId, totalId, pushBtnId) {
  const tbody  = $(tbodyId);
  const panel  = $(panelId);
  const shown  = $(shownId);
  const total  = $(totalId);
  const pushBt = $(pushBtnId);

  $('dkBadgePunches').textContent = punches.length;

  if (!punches.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">No records match this filter. Try a different date.</td></tr>';
    if (panel) panel.style.display = 'none';
    return;
  }

  tbody.innerHTML = punches.map((p, i) => `
    <tr>
      <td class="mono text-dim">${i+1}</td>
      <td class="mono text-cyan">${escHtml(p.userId)}</td>
      <td>${escHtml(p.name || '—')}</td>
      <td class="mono" style="font-size:11px">${escHtml(fmtDate(p.timestamp))}</td>
      <td>${verifyBadge(p.verifyType || p.verifyMode)}</td>
    </tr>
  `).join('');

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
    tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">No records. Pull data from Sync Hub first.</td></tr>';
    if (panel) panel.style.display = 'none';
    return;
  }
  tbody.innerHTML = punches.map((p, i) => `
    <tr>
      <td class="mono text-dim">${i+1}</td>
      <td class="mono text-cyan">${escHtml(p.userId)}</td>
      <td>${escHtml(p.name || '—')}</td>
      <td class="mono" style="font-size:11px">${escHtml(fmtDate(p.timestamp))}</td>
      <td>${verifyBadge(p.verifyType || p.verifyMode)}</td>
    </tr>
  `).join('');
  if (panel) panel.style.display = 'flex';
  if (shown) shown.textContent   = punches.length;
  if (btn)   btn.disabled        = false;
  reIcons();
}

function verifyBadge(mode) {
  const m = String(mode || '').toLowerCase();
  if (m.includes('face'))   return `<span class="badge badge-violet">Face</span>`;
  if (m.includes('finger')) return `<span class="badge badge-blue">Fingerprint</span>`;
  if (m.includes('pin') || m.includes('password')) return `<span class="badge badge-amber">PIN</span>`;
  if (m.includes('rfid') || m.includes('card'))    return `<span class="badge badge-green">RFID</span>`;
  return `<span class="badge badge-dim">${escHtml(mode||'—')}</span>`;
}

function updatePushMeta() {
  const n = state.filteredPunches.length;
  const pc = $('pushCountDesc');
  if (pc) pc.textContent = `${n} record${n!==1?'s':''}`;
  const bt = $('btnPushCloud');
  if (bt) bt.disabled = n === 0;
}

function resetStats() {
  ['statPunches','statDays','statPing','teleLatency'].forEach(id => {
    const el = $(id); if (el) el.textContent = id === 'statPunches' || id === 'statDays' ? '0' : '—';
  });
  ['navBadgePunches','navBadgeUsers','dkBadgePunches','dkBadgeUsers','dkBadgeAudit'].forEach(id => {
    const el = $(id); if (el) el.textContent = '0';
  });
  $('tbPunches').innerHTML = '<tr><td colspan="5" class="tbl-empty">Pull records from hardware to preview attendance logs here.</td></tr>';
  const pp = $('pushPanel'); if (pp) pp.style.display = 'none';
  const dr = $('datePillsRow'); if (dr) dr.innerHTML = '';
  const pc = $('pushCountDesc'); if (pc) pc.textContent = '0 records';
  const bt = $('btnPushCloud'); if (bt) bt.disabled = true;
}

// ─── Execute Push ─────────────────────────────────────────────────────────────
async function executePush(records, btn) {
  if (!records?.length) { log('warn', 'Nothing to push — check your date filter.'); return; }
  if (!state.session?.token) { log('err', 'Not authenticated.'); return; }

  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = `<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Uploading ${records.length} records…`;

  setStatus(`Pushing ${records.length} records…`, false);
  log('sock', `Cloud upload: ${records.length} punch records → ${state.cloudUrl}`);

  // Use DevicePuller's pushToCloud with our auth token baked into the instance
  const puller = new DevicePuller({
    ip:        state.deviceIp,
    port:      state.devicePort,
    machineId: state.machineId,
    cloudUrl:  state.cloudUrl,
    authToken: state.session.token,
  });

  try {
    const res = await puller.pushToCloud(records, '102023050002456');
    if (res.success === false && res.error) throw new Error(res.error);
    const ins = res.inserted ?? res.count ?? records.length;
    const dup = res.duplicates ?? res.skipped ?? 0;
    log('ok', `Push complete — ${ins} inserted, ${dup} duplicates skipped.`);
    setStatus(`Pushed ${ins} records`, true);
  } catch (err) {
    log('err', 'Push failed: ' + err.message);
    setStatus('Push failed', false);
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
    reIcons();
  }
}

$('btnPushCloud')?.addEventListener('click', () => executePush(state.filteredPunches, $('btnPushCloud')));
$('btnPushNow')?.addEventListener('click',   () => executePush(state.filteredPunches, $('btnPushNow')));
$('btnPushFull')?.addEventListener('click',  () => executePush(state.filteredPunches, $('btnPushFull')));

// ─── Attendance Tab Date Filter ───────────────────────────────────────────────
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

// ─── Settings ─────────────────────────────────────────────────────────────────
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

// ─── Network Scanner ──────────────────────────────────────────────────────────
$('btnStartScan')?.addEventListener('click', async () => {
  const btn = $('btnStartScan');
  btn.disabled = true;
  setLoading(btn, 'Scanning subnet…');

  $('scanResultsCard').style.display = 'block';
  const tbody = $('tbScanner');
  tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">Scanning 192.168.x.x:5005 — please wait…</td></tr>';
  log('sock', 'LAN sweep started — port 5005 on 192.168.29.x (timeout 400ms/host)');

  const net  = require('net');
  const found = [];
  const tasks = [];
  const base  = '192.168.29';

  for (let i = 1; i <= 254; i++) {
    const ip = `${base}.${i}`;
    tasks.push(new Promise(resolve => {
      const t0   = Date.now();
      const sock = new net.Socket();
      sock.setTimeout(400);
      sock.on('connect', () => { sock.destroy(); found.push({ ip, latency: Date.now()-t0 }); resolve(); });
      sock.on('timeout', () => { sock.destroy(); resolve(); });
      sock.on('error',   () => { sock.destroy(); resolve(); });
      sock.connect(5005, ip);
    }));
  }

  await Promise.all(tasks);
  btn.disabled = false;
  btn.innerHTML = `<i data-lucide="search" style="width:14px;height:14px"></i> Start Network Sweep`;
  reIcons();

  if (!found.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">No devices found on 192.168.29.x:5005. Try adjusting your subnet in Settings.</td></tr>';
    log('warn', 'LAN sweep complete — no devices found.');
    return;
  }

  log('ok', `Sweep done — ${found.length} device(s) found`);
  tbody.innerHTML = found.map(d => `
    <tr>
      <td class="mono text-cyan">${d.ip}</td>
      <td class="mono">5005</td>
      <td><span class="badge badge-blue">TCP/Binary</span></td>
      <td class="mono text-violet">${d.latency}ms</td>
      <td>
        <button
          onclick="useDevice('${d.ip}')"
          style="padding:4px 12px;background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.3);
                 border-radius:6px;color:var(--cyan);font-size:11px;font-weight:700;cursor:pointer;transition:all 0.2s"
        >Use This</button>
      </td>
    </tr>
  `).join('');
});

window.useDevice = (ip) => {
  state.deviceIp = ip;
  $('cfgIp').value = ip;
  updateCloudLabels();
  log('ok', `Active device switched to ${ip}:${state.devicePort}`);
  document.querySelector('.nav-item[data-tab="tab-sync"]')?.click();
};

// ─── App Init ─────────────────────────────────────────────────────────────────
function initApp() {
  // Purge stale passkey keys from previous app versions
  localStorage.removeItem('ksynbr_passkey_cred');  // v1 key
  localStorage.removeItem('ksynbr_pk_v1');          // any other old keys

  // Always start with a clean auth error state
  const errEl = $('authError');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

  refreshPasskeyUI();

  // Default dates for range picker
  const today = new Date().toISOString().slice(0,10);
  const week  = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
  const rf = $('rangeFrom'); if (rf) rf.value = week;
  const rt = $('rangeTo');   if (rt) rt.value = today;

  log('info', `Kernn Sync Bridge ready — ${process.platform} / Electron ${process.versions.electron}`);
}
