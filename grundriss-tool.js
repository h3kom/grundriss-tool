// Grundriss Tool – Interaktiver Bauplan
// =====================================================================
// Constants
// =====================================================================
const SUPABASE_URL = 'https://civkerrcyqgsqqjpccqe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpdmtlcnJjeXFnc3FxanBjY3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzkxNzAsImV4cCI6MjA5MzkxNTE3MH0.Q01QUWnwYm-aDAhbwi-Rb_kBU28s8Rx27J0RUkILY1U';
const NATIVE_WIDTHS = { eg: 1000, og: 800 };
const FLOORS = ['eg', 'og'];
const MAX_UNDO = 20;
const SYNC_INTERVAL = 3000;

// =====================================================================
// Global State
// =====================================================================
const state = {
  rooms: {},
  selectedRoom: null,
  editMode: false,
  overview: false,
  sidebarOpen: false,
  sidebarWasManuallyOpened: false,
  dragState: null,
  resizeState: null,
  isPlacing: false,
  placeFloor: null,
  placeState: null,
  debounceTimer: null,
  lastSaveTs: Date.now(),
  undoStack: [],
  syncStatus: 'idle',
  serverStamp: 0,
  pollInterval: null,
  isSyncing: false,
  saveTimeout: null,
  activeFloor: 'eg',
};

// =====================================================================
// Room Helpers
// =====================================================================
function ensureRoomFields(room) {
  if (!room.comments) room.comments = [];
  if (!room.done) room.done = {};
  return room;
}

function ensureAllRooms() {
  for (const key of Object.keys(state.rooms)) {
    ensureRoomFields(state.rooms[key]);
  }
}

function completedTaskCount(room) {
  if (!room.done) return 0;
  return Object.values(room.done).filter(Boolean).length;
}

function taskProgress(room) {
  const done = completedTaskCount(room);
  const total = room.tasks ? room.tasks.length : 0;
  return { done, total, percent: total > 0 ? Math.round(done / total * 100) : 0 };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// =====================================================================
// Sync
// =====================================================================
async function loadData() {
  let el = document.getElementById('syncI');
  if (!el) {
    el = document.createElement('div');
    el.id = 'syncI';
    document.body.appendChild(el);
  }
  setSyncStatus('idle');

  const cloudLoaded = await loadFromCloud();
  if (cloudLoaded) {
    return;
  }

  const local = localStorage.getItem('gR');
  if (local) {
    try {
      state.rooms = JSON.parse(local);
      ensureAllRooms();
      return;
    } catch (e) {
      // corrupted local data – start empty
    }
  }

  // Keine Vorgabe-Räume: starte mit leerem Objekt
  state.rooms = {};
  saveData();
}

function saveData() {
  if (state.saveTimeout) clearTimeout(state.saveTimeout);
  state.serverStamp = Date.now();
  state.lastSaveTs = Date.now();
  localStorage.setItem('gR', JSON.stringify(state.rooms));
  updateTabBadges();

  state.saveTimeout = setTimeout(async () => {
    if (state.isSyncing) return;
    state.isSyncing = true;
    setSyncStatus('syncing');
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({ id: 1, data: state.rooms })
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0 && rows[0].updated_at) {
          state.serverStamp = new Date(rows[0].updated_at).getTime();
        }
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch (e) {
      setSyncStatus('error');
    }
    state.isSyncing = false;
  }, 500);
}

async function loadFromCloud() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.1&select=data,updated_at`, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows && rows.length > 0 && rows[0].data) {
        state.rooms = rows[0].data;
        ensureAllRooms();
        state.serverStamp = new Date(rows[0].updated_at).getTime() || Date.now();
        localStorage.setItem('gR', JSON.stringify(state.rooms));
        return true;
      }
    }
  } catch (e) {
    // ignore
  }
  return false;
}

function setSyncStatus(status) {
  state.syncStatus = status;
  const el = document.getElementById('syncI');
  if (!el) return;
  const icons = { idle: '🔄', syncing: '⏳', synced: '✅', error: '⚠️' };
  const colors = { idle: '#aaa', syncing: '#fbbf24', synced: '#4ade80', error: '#f87171' };
  let html = '';
  if (status === 'syncing') html = '<span class="ssp"></span> ';
  html += `<span>${icons[status] || '🔄'}</span>`;
  el.innerHTML = html;
  el.style.borderBottom = `2px solid ${colors[status] || '#aaa'}`;
}

function startPolling() {
  if (state.pollInterval) clearInterval(state.pollInterval);
  state.pollInterval = setInterval(async () => {
    if (state.isSyncing) return;
    try {
      const result = await supabaseFetch();
      if (result && result.data && Object.keys(result.data).length > 0) {
        const serverTime = result.updatedAt || 0;
        if (serverTime > state.serverStamp) {
          // Conflict resolution: only overwrite if local data hasn't been changed more recently
          if (state.lastSaveTs <= serverTime) {
            applyCloudData(result.data, serverTime);
            toast('Daten synchronisiert', 'info', 3000);
          } else {
            // Local changes are newer, push them to server
            saveData();
          }
        } else {
          setSyncStatus('synced');
        }
      }
    } catch (e) {
      if (state.syncStatus !== 'error') setSyncStatus('error');
    }
  }, SYNC_INTERVAL);
}

function applyCloudData(data, timestamp) {
  state.rooms = data;
  ensureAllRooms();
  state.serverStamp = timestamp || Date.now();
  state.lastSaveTs = timestamp || Date.now();
  localStorage.setItem('gR', JSON.stringify(state.rooms));
  updateTabBadges();
  render();
  if (state.selectedRoom && state.rooms[state.selectedRoom]) {
    renderDetail(state.selectedRoom);
  } else if (state.overview) {
    state.overview = false;
    showOverview();
  }
}

async function supabaseFetch() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.1&select=data,updated_at`, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (rows && rows.length > 0 && rows[0].data) {
      return {
        data: rows[0].data,
        updatedAt: new Date(rows[0].updated_at).getTime() || 0
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// =====================================================================
// UI Helpers
// =====================================================================
function detectFloorId(id) {
  if (!id) return 'eg';
  const lower = id.toLowerCase();
  // Check for OG floor patterns: id contains "og" as a word boundary or is exactly "og"
  if (lower === 'og' || lower.startsWith('og') || lower.includes('-og') || lower.includes('_og')) return 'og';
  return 'eg';
}

function getScale(wrapper) {
  if (!wrapper) return 1;
  const img = wrapper.querySelector('img');
  if (!img) return 1;
  const nativeWidth = NATIVE_WIDTHS[detectFloorId(wrapper.id)] || 1000;
  const displayWidth = img.getBoundingClientRect().width;
  return displayWidth > 0 && nativeWidth > 0 ? displayWidth / nativeWidth : 1;
}

function getPointerPos(e) {
  const touch = e.touches;
  return touch && touch.length > 0
    ? { x: touch[0].clientX, y: touch[0].clientY }
    : { x: e.clientX, y: e.clientY };
}

function switchFloor(floor) {
  state.activeFloor = floor;
  document.querySelectorAll('.floor').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.floor-tabs button').forEach(el => el.classList.remove('active'));

  const floorId = `floor${floor.charAt(0).toUpperCase()}${floor.slice(1)}`;
  const tabId = `tab${floor.charAt(0).toUpperCase()}${floor.slice(1)}`;

  document.getElementById(floorId)?.classList.add('active');
  document.getElementById(tabId)?.classList.add('active');

  updateTabBadges();

  if (state.selectedRoom && state.rooms[state.selectedRoom] && state.rooms[state.selectedRoom].floor !== floor) {
    state.selectedRoom = null;
    render();
    const sbBody = document.getElementById('sbBody');
    if (sbBody) sbBody.innerHTML = '<p class="hint">👆 Raum antippen</p>';
  }
}

function updateTabBadges() {
  for (const floor of FLOORS) {
    const count = Object.values(state.rooms).filter(r => r.floor === floor).length;
    const badge = document.getElementById(`badge${floor.charAt(0).toUpperCase()}${floor.slice(1)}`);
    if (badge) badge.textContent = count;
    const cnt = document.getElementById(`cnt${floor.charAt(0).toUpperCase()}${floor.slice(1)}`);
    if (cnt) cnt.textContent = `(${count})`;
  }
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toast(message, type = 'success', duration = 3000, undoCallback) {
  const container = document.getElementById('tc');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `t t${type[0]}`;
  let html = `<span>${icons[type] || 'ℹ️'}</span><span>${escHtml(message)}</span>`;
  if (undoCallback) {
    html += '<button class="tu" onclick="executeUndo()">↩ Rückgängig</button>';
  }
  html += '<button class="td" onclick="dismissToast(this.parentElement)">✕</button>';
  el.innerHTML = html;

  if (undoCallback) {
    el.dataset.undoKey = state.undoStack.length;
    state.undoStack.push(undoCallback);
    if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
  }

  container.appendChild(el);
  if (duration > 0) {
    setTimeout(() => dismissToast(el), duration);
  }
  while (container.children.length > 3) {
    const first = container.firstChild;
    if (first) dismissToast(first);
  }
}

function dismissToast(toastElement) {
  if (!toastElement || !toastElement.classList) return;
  toastElement.classList.add('to');
  setTimeout(() => {
    if (toastElement.parentNode) toastElement.parentNode.removeChild(toastElement);
  }, 300);
}

function executeUndo() {
  const container = document.getElementById('tc');
  let target = null;
  for (const el of container.querySelectorAll('.t')) {
    if (el.dataset.undoKey !== undefined) {
      target = el;
      break;
    }
  }
  if (!target) return;
  const key = parseInt(target.dataset.undoKey);
  const callback = state.undoStack[key];
  if (callback) {
    callback();
    state.undoStack[key] = null;
    toast('Rückgängig', 'info', 2000);
  }
  dismissToast(target);
}

function showIntro() {
  const el = document.getElementById('io');
  if (el) el.classList.add('open');
}

function closeIntro() {
  const el = document.getElementById('io');
  if (el) el.classList.remove('open');
  localStorage.setItem('gd', '1');
}

function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  document.getElementById('sb')?.classList.toggle('open', state.sidebarOpen);
  if (state.sidebarOpen) state.sidebarWasManuallyOpened = true;
}

function openSidebar() {
  if (!state.sidebarOpen) {
    state.sidebarOpen = true;
    document.getElementById('sb')?.classList.add('open');
  }
}

function closeSidebar() {
  if (state.sidebarOpen) {
    state.sidebarOpen = false;
    document.getElementById('sb')?.classList.remove('open');
  }
}

// =====================================================================
// Drag
// =====================================================================
function startDrag(e, key) {
  if (!state.editMode) return;
  const raw = getPointerPos(e);
  const wrapper = e.currentTarget.closest('.pw');
  const scale = getScale(wrapper);

  state.dragState = {
    key,
    wrapper,
    startX: raw.x,
    startY: raw.y,
    origLeft: state.rooms[key].left,
    origTop: state.rooms[key].top,
    element: e.currentTarget,
    isDragging: false,
    saved: false
  };

  e.currentTarget._wasDragged = false;

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchmove', onDragMoveTouch, { passive: false });
  document.addEventListener('touchend', onDragEndTouch, { passive: false });
}

function onDragMove(e) {
  if (!state.dragState) return;
  const raw = getPointerPos(e);
  const dx = raw.x - state.dragState.startX;
  const dy = raw.y - state.dragState.startY;

  if (!state.dragState.isDragging) {
    if (Math.sqrt(dx * dx + dy * dy) < 3) return;
    state.dragState.isDragging = true;
    e.preventDefault();
    if (state.dragState.element) {
      state.dragState.element.classList.add('dg');
      state.dragState.element._wasDragged = true;
    }
  } else {
    if (state.dragState.isDragging) e.preventDefault();
  }

  const el = document.querySelector(`.ro[data-key="${state.dragState.key}"]`);
  if (el) {
    const scale = getScale(state.dragState.wrapper);
    el.style.left = `${Math.round(state.dragState.origLeft * scale + dx)}px`;
    el.style.top = `${Math.round(state.dragState.origTop * scale + dy)}px`;
  }
}

function onDragMoveTouch(e) {
  onDragMove(e);
  if (state.dragState && state.dragState.isDragging) e.preventDefault();
}

function onDragEndCleanup() {
  const ds = state.dragState;
  if (!ds) return;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMoveTouch);
  document.removeEventListener('touchend', onDragEndTouch);

  if (ds.element) ds.element.classList.remove('dg');

  if (!ds.isDragging || ds.saved) {
    state.dragState = null;
    return;
  }

  const el = document.querySelector(`.ro[data-key="${ds.key}"]`);
  if (!el) {
    state.dragState = null;
    return;
  }

  const scale = getScale(ds.wrapper);
  const newLeft = Math.round(parseInt(el.style.left) / scale);
  const newTop = Math.round(parseInt(el.style.top) / scale);

  if (newLeft !== ds.origLeft || newTop !== ds.origTop) {
    state.rooms[ds.key].left = newLeft;
    state.rooms[ds.key].top = newTop;
    ds.saved = true;
    saveData();
    render();
    if (state.selectedRoom && state.rooms[state.selectedRoom]) {
      renderDetail(state.selectedRoom);
    }
  }
  state.dragState = null;
}

function onDragEnd() { onDragEndCleanup(); }
function onDragEndTouch() { onDragEndCleanup(); }

// =====================================================================
// Resize
// =====================================================================
function startResize(e, key, handle) {
  if (!state.editMode) return;
  e.preventDefault();
  e.stopPropagation();

  const raw = getPointerPos(e);
  const wrapper = e.currentTarget.closest('.pw');
  const scale = getScale(wrapper);
  const room = state.rooms[key];

  state.resizeState = {
    key,
    handle,
    wrapper,
    startX: raw.x,
    startY: raw.y,
    origLeft: room.left,
    origTop: room.top,
    origWidth: room.width,
    origHeight: room.height,
    scale,
    saved: false
  };

  const el = e.currentTarget.closest('.ro');
  if (el) el.classList.add('rs');

  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
  document.addEventListener('touchmove', onResizeMoveTouch, { passive: false });
  document.addEventListener('touchend', onResizeEndTouch, { passive: false });
}

function onResizeMove(e) {
  if (!state.resizeState) return;
  const raw = getPointerPos(e);
  const scale = getScale(state.resizeState.wrapper);
  const dx = raw.x - state.resizeState.startX;
  const dy = raw.y - state.resizeState.startY;
  const dl = dx / scale;
  const dt = dy / scale;

  const handle = state.resizeState.handle;
  let nl = state.resizeState.origLeft;
  let nt = state.resizeState.origTop;
  let nw = state.resizeState.origWidth;
  let nh = state.resizeState.origHeight;

  if (handle.indexOf('e') >= 0) nw = Math.max(20, state.resizeState.origWidth + dl);
  if (handle.indexOf('w') >= 0) {
    nw = Math.max(20, state.resizeState.origWidth - dl);
    nl = state.resizeState.origLeft + state.resizeState.origWidth - nw;
  }
  if (handle.indexOf('s') >= 0) nh = Math.max(20, state.resizeState.origHeight + dt);
  if (handle.indexOf('n') >= 0) {
    nh = Math.max(20, state.resizeState.origHeight - dt);
    nt = state.resizeState.origTop + state.resizeState.origHeight - nh;
  }

  const el = document.querySelector(`.ro[data-key="${state.resizeState.key}"]`);
  if (el) {
    el.style.left = `${Math.round(nl * scale)}px`;
    el.style.top = `${Math.round(nt * scale)}px`;
    el.style.width = `${Math.round(nw * scale)}px`;
    el.style.height = `${Math.round(nh * scale)}px`;
  }
}

function onResizeMoveTouch(e) {
  e.preventDefault();
  onResizeMove(e);
}

function onResizeEndCleanup() {
  if (!state.resizeState) return;

  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  document.removeEventListener('touchmove', onResizeMoveTouch);
  document.removeEventListener('touchend', onResizeEndTouch);

  const el = document.querySelector(`.ro[data-key="${state.resizeState.key}"]`);
  if (el) el.classList.remove('rs');

  const room = state.rooms[state.resizeState.key];
  if (!el || !room || state.resizeState.saved) {
    state.resizeState = null;
    return;
  }

  const scale = getScale(state.resizeState.wrapper);
  const nl = Math.round(parseInt(el.style.left) / scale);
  const nt = Math.round(parseInt(el.style.top) / scale);
  const nw = Math.round(parseInt(el.style.width) / scale);
  const nh = Math.round(parseInt(el.style.height) / scale);

  if (!isNaN(nl)) room.left = nl;
  if (!isNaN(nt)) room.top = nt;
  if (!isNaN(nw)) room.width = Math.max(20, nw);
  if (!isNaN(nh)) room.height = Math.max(20, nh);

  state.resizeState.saved = true;
  saveData();
  render();
  if (state.selectedRoom && state.rooms[state.selectedRoom]) {
    renderDetail(state.selectedRoom);
  }
  state.resizeState = null;
}

function onResizeEnd() { onResizeEndCleanup(); }
function onResizeEndTouch() { onResizeEndCleanup(); }

// =====================================================================
// Render
// =====================================================================
function render() {
  updateTabBadges();
  renderFloor('eg');
  renderFloor('og');
}

function renderFloor(floor) {
  const container = document.getElementById(`${floor}-r`);
  if (!container) return;
  container.innerHTML = '';

  const wrapper = document.getElementById(`${floor}-w`);
  const scale = getScale(wrapper);

  for (const key of Object.keys(state.rooms)) {
    const room = state.rooms[key];
    if (room.floor !== floor) continue;
    container.appendChild(createRoomElement(key, room, scale));
  }
}

function createRoomElement(key, room, scale) {
  const div = document.createElement('div');
  div.className = `ro${state.selectedRoom === key ? ' sel' : ''}${state.editMode ? ' em' : ''}`;
  div.style.left = `${Math.round(room.left * scale)}px`;
  div.style.top = `${Math.round(room.top * scale)}px`;
  div.style.width = `${Math.round(room.width * scale)}px`;
  div.style.height = `${Math.round(room.height * scale)}px`;
  div.setAttribute('data-key', key);

  div.addEventListener('click', (e) => {
    if (e.currentTarget._wasDragged) return;
    if (state.editMode) {
      selectRoomEdit(key);
      return;
    }
    showRoom(key);
    if (window.innerWidth < 768) openSidebar();
  });

  div.addEventListener('mousedown', (e) => startDrag(e, key));
  div.addEventListener('touchstart', (e) => startDrag(e, key), { passive: true });

  // Label
  const label = document.createElement('div');
  label.className = 'rl';
  const progress = taskProgress(room);
  label.innerHTML = progress.total > 0
    ? `${escHtml(room.title)}<span class="pm">${progress.percent}%</span>`
    : escHtml(room.title);
  div.appendChild(label);

  // Selection dot
  const sdot = document.createElement('div');
  sdot.className = 'sd';
  div.appendChild(sdot);

  // Resize handles
  createResizeHandles(div, key);

  return div;
}

function createResizeHandles(element, key) {
  const handleNames = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  for (const handle of handleNames) {
    const hdl = document.createElement('div');
    hdl.className = `rh ${handle}`;
    hdl.addEventListener('mousedown', (ev) => startResize(ev, key, handle));
    hdl.addEventListener('touchstart', (ev) => startResize(ev, key, handle), { passive: false });
    hdl.addEventListener('click', (ev) => ev.stopPropagation());
    element.appendChild(hdl);
  }
}

function showRoom(key) {
  const room = state.rooms[key];
  if (!room) return;
  if (room.floor !== state.activeFloor) switchFloor(room.floor);
  state.selectedRoom = key;
  state.overview = false;
  document.getElementById('btnOv')?.classList.remove('active');
  render();
  renderDetail(key);
  scrollToRoom(key);
  if (window.innerWidth < 768) openSidebar();
}

function scrollToRoom(key) {
  const el = document.querySelector(`.ro[data-key="${key}"]`);
  if (!el) return;
  setTimeout(() => {
    const wrapper = el.closest('.pw');
    if (wrapper) {
      const mc = document.getElementById('mc');
      if (mc) {
        const wr = wrapper.getBoundingClientRect();
        const cr = mc.getBoundingClientRect();
        if (wr.bottom > cr.bottom + 20 || wr.top < cr.top - 20) {
          wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, 100);
}

// =====================================================================
// Detail Panel
// =====================================================================
function renderDetail(key) {
  const room = state.rooms[key];
  if (!room) return;

  const progress = taskProgress(room);
  const sbBody = document.getElementById('sbBody');
  if (!sbBody) return;

  let html = buildDetailHeader(key, room);
  html += buildProgressBar(progress);
  html += buildTaskSection(key, room, progress);
  html += buildNoteSection(key, room);
  html += buildCommentSection(key, room);
  if (state.editMode) html += buildDeleteSection(key);
  html += buildLastEditInfo();

  sbBody.innerHTML = html;
}

function buildDetailHeader(key, room) {
  return `<div class="rdh">
    <button class="bb" onclick="showOverview()">←</button>
    <h3>${escHtml(room.title)}</h3>
    <span class="rk">${escHtml(key)}</span>
  </div>`;
}

function buildProgressBar(progress) {
  if (progress.total === 0) return '';
  return `<div style="font-size:13px;color:var(--muted);margin-bottom:2px;">
    ${progress.done}/${progress.total} Aufgaben (${progress.percent}%)
  </div>
  <div class="pbw"><div class="pbf" style="width:${progress.percent}%"></div></div>`;
}

function buildTaskSection(key, room, progress) {
  let html = `<div class="is">
    <h4>Aufgaben${progress.total > 0 ? ` <span class="cnt">${progress.done}/${progress.total}</span>` : ''}</h4>`;

  if (!room.tasks || room.tasks.length === 0) {
    html += '<p style="font-size:13px;color:var(--muted);margin:0;">Keine Aufgaben.</p>';
  } else {
    html += '<div>';
    for (let i = 0; i < room.tasks.length; i++) {
      const checked = (room.done || {})[i] || false;
      html += `<div class="ti${checked ? ' done' : ''}">
        <input type="checkbox"${checked ? ' checked' : ''} onchange="toggleTask('${key}',${i},this.checked)">
        <label>${escHtml(room.tasks[i])}</label>
        ${state.editMode ? `<button class="td" onclick="deleteTask('${key}',${i})">×</button>` : ''}
      </div>`;
    }
    html += '</div>';
  }

  if (state.editMode) {
    html += `<div class="atr">
      <input type="text" id="nti-${key}" placeholder="Neue Aufgabe…" onkeydown="if(event.key==='Enter')addTask('${key}')">
      <button onclick="addTask('${key}')">+</button>
    </div>`;
  }

  html += '</div>';
  return html;
}

function buildNoteSection(key, room) {
  let html = `<div class="is"><h4>Notiz</h4>`;
  if (state.editMode) {
    html += `<textarea class="rne" onchange="saveNote('${key}',this.value)">${escHtml(room.note || '')}</textarea>`;
  } else {
    html += `<p style="margin:0;font-size:14px;">${escHtml(room.note || 'Keine Notiz.')}</p>`;
  }
  html += '</div>';
  return html;
}

function buildCommentSection(key, room) {
  const commentCount = room.comments ? room.comments.length : 0;
  let html = `<div class="is">
    <h4>Kommentare${commentCount > 0 ? ` <span class="cnt">${commentCount}</span>` : ''}</h4>
    <div class="cl">`;

  if (room.comments && room.comments.length > 0) {
    for (let i = 0; i < room.comments.length; i++) {
      const timeStr = room.comments[i].time
        ? new Date(room.comments[i].time).toLocaleString('de-DE')
        : '';
      html += `<div class="ci">
        ${state.editMode ? `<button class="cd" onclick="deleteComment('${key}',${i})">×</button>` : ''}
        <div class="cm">${timeStr}</div>
        ${escHtml(room.comments[i].text)}
      </div>`;
    }
  } else {
    html += '<p style="font-size:13px;color:var(--muted);margin:0;">Keine Kommentare.</p>';
  }

  html += `</div>
    <div class="acr">
      <input type="text" id="nci-${key}" placeholder="Kommentar…" onkeydown="if(event.key==='Enter')addComment('${key}')">
      <button onclick="addComment('${key}')">Senden</button>
    </div>
  </div>`;

  return html;
}

function buildDeleteSection(key) {
  return `<div class="is"><button class="drb" onclick="deleteRoom('${key}')">🗑 Löschen</button></div>`;
}

function buildLastEditInfo() {
  const delta = Date.now() - state.lastSaveTs;
  let text;
  if (delta < 60000) text = 'Gerade eben';
  else if (delta < 3600000) text = `Vor ${Math.round(delta / 60000)} Min.`;
  else if (delta < 86400000) text = `Vor ${Math.round(delta / 3600000)} Std.`;
  else text = new Date(state.lastSaveTs).toLocaleDateString('de-DE');

  return text
    ? `<div style="margin-top:10px;font-size:11px;color:var(--muted);text-align:center;">${text}</div>`
    : '';
}

// =====================================================================
// Task / Comment Actions
// =====================================================================
function toggleTask(key, idx, checked) {
  const room = state.rooms[key];
  if (!room) return;
  if (!room.done) room.done = {};
  room.done[idx] = checked;
  saveData();
  render();
  renderDetail(key);
  if (checked) toast('✅ Erledigt!', 'success', 2000);
}

function addTask(key) {
  const input = document.getElementById(`nti-${key}`);
  const text = input?.value?.trim();
  if (!text) return;
  if (!state.rooms[key].tasks) state.rooms[key].tasks = [];
  state.rooms[key].tasks.push(text);
  saveData();
  renderDetail(key);
  input.value = '';
  input.focus();
  toast('Aufgabe hinzugefügt', 'success', 1500);
}

function deleteTask(key, idx) {
  const room = state.rooms[key];
  if (!room) return;
  if (!room.tasks) room.tasks = [];
  room.tasks.splice(idx, 1);
  const newDone = {};
  for (const k of Object.keys(room.done)) {
    if (!room.done.hasOwnProperty(k)) continue;
    const ki = parseInt(k);
    if (ki < idx) newDone[k] = room.done[k];
    else if (ki > idx) newDone[(ki - 1).toString()] = room.done[k];
  }
  room.done = newDone;
  saveData();
  renderDetail(key);
}

function saveNote(key, value) {
  state.rooms[key].note = value;
  saveData();
}

function addComment(key) {
  const input = document.getElementById(`nci-${key}`);
  const text = input?.value?.trim();
  if (!text) return;
  if (!state.rooms[key].comments) state.rooms[key].comments = [];
  state.rooms[key].comments.push({ text, time: new Date().toISOString() });
  saveData();
  input.value = '';
  input.focus();
  renderDetail(key);
  toast('Kommentar', 'success', 1500);
}

function deleteComment(key, idx) {
  if (!state.rooms[key].comments) state.rooms[key].comments = [];
  state.rooms[key].comments.splice(idx, 1);
  saveData();
  renderDetail(key);
}

function deleteRoom(key) {
  if (!confirm(`"${state.rooms[key].title}" löschen?`)) return;
  const backupRoom = deepClone(state.rooms[key]);
  const backupKey = key;
  delete state.rooms[key];
  state.selectedRoom = null;
  saveData();
  render();
  const sbBody = document.getElementById('sbBody');
  if (sbBody) sbBody.innerHTML = '<p class="hint">👆 Raum antippen</p>';
  toast(`"${backupRoom.title}" gelöscht`, 'warning', 6000, () => {
    state.rooms[backupKey] = backupRoom;
    saveData();
    render();
    showRoom(backupKey);
  });
}

// =====================================================================
// Edit Mode
// =====================================================================
function setEditMode(enabled) {
  if (state.editMode === enabled) return;
  state.editMode = enabled;

  document.getElementById('btnEm')?.classList.toggle('active', enabled);
  document.getElementById('eb')?.classList.toggle('show', enabled);
  document.getElementById('mc')?.classList.toggle('ea', enabled);
  document.querySelectorAll('.ro').forEach(el => el.classList.toggle('em', enabled));
  document.querySelectorAll('.fa button').forEach(btn => { btn.style.display = enabled ? '' : 'none'; });

  if (enabled) {
    closeSidebar();
  } else {
    if (state.sidebarWasManuallyOpened || state.selectedRoom) openSidebar();
  }

  if (!enabled && state.selectedRoom && !state.overview) {
    renderDetail(state.selectedRoom);
  }
}

function toggleEditMode() {
  setEditMode(!state.editMode);
}

function selectRoomEdit(key) {
  state.selectedRoom = key;
  render();
  if (state.rooms[key]) {
    renderDetail(key);
    if (window.innerWidth < 768) openSidebar();
  }
}

// =====================================================================
// Overview
// =====================================================================
function showOverview() {
  if (state.overview) return;
  state.overview = true;
  state.selectedRoom = null;
  document.getElementById('btnOv')?.classList.add('active');
  render();
  openSidebar();

  const searchValue = (document.querySelector('.os')?.value || '').toLowerCase();

  let html = '<h3 style="margin:0 0 4px;font-size:16px;">📊 Übersicht</h3>';
  html += '<div class="osw"><span class="si">🔍</span>';
  html += `<input type="text" class="os" id="os" placeholder="Räume suchen…" value="${escHtml(searchValue)}" oninput="debouncedSearch()">`;
  html += '</div><div class="orl">';

  const roomEntries = Object.entries(state.rooms);
  const filtered = searchValue
    ? roomEntries.filter(([key, room]) =>
        room.title.toLowerCase().includes(searchValue) ||
        key.toLowerCase().includes(searchValue)
      )
    : roomEntries;

  if (filtered.length === 0) {
    html += '<p style="font-size:13px;color:var(--muted);text-align:center;padding:16px 0;">🔍 Keine Räume.</p>';
  } else {
    for (const [key, room] of filtered) {
      const progress = taskProgress(room);
      const floorLabel = room.floor === 'eg' ? 'EG' : 'OG';
      html += `<div class="ori" onclick="showRoom('${key}')">
        <div class="nm">${escHtml(room.title)}<span style="font-size:11px;color:var(--muted);margin-left:4px;">(${floorLabel})</span></div>
        <div class="pt">${progress.done}/${progress.total} (${progress.percent}%)</div>
      </div>`;
    }
  }

  html += '</div>';
  const lastEdit = buildLastEditInfo();
  if (lastEdit) html += lastEdit;

  document.getElementById('sbBody').innerHTML = html;
}

function debouncedSearch() {
  if (state.debounceTimer) clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => showOverview(), 200);
}

// =====================================================================
// Place New Room – Interactive Draw on Plan
// =====================================================================
function enablePlaceNewRoom(floor) {
  if (!state.editMode) return;
  state.isPlacing = true;
  state.placeFloor = floor;
  document.querySelectorAll('.pw').forEach(w => { w.style.cursor = 'crosshair'; });
  openSidebar();
  const sbBody = document.getElementById('sbBody');
  if (sbBody) {
    sbBody.innerHTML = `<p class="hint"><strong>Neuen Raum platzieren</strong><br/>
      👆 Auf den Grundriss tippen & ziehen um die Größe festzulegen.<br/>
      <button onclick="cancelPlaceNewRoom()" style="margin-top:8px;background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:var(--rs);cursor:pointer;font-size:14px;">Abbrechen</button>
    </p>`;
  }
}

function cancelPlaceNewRoom() {
  removePlacePreview();
  state.isPlacing = false;
  state.placeFloor = null;
  state.placeState = null;
  document.querySelectorAll('.pw').forEach(w => { w.style.cursor = ''; });
  const sbBody = document.getElementById('sbBody');
  if (sbBody) sbBody.innerHTML = '<p class="hint">👆 Raum antippen</p>';
}

function removePlacePreview() {
  const prev = document.getElementById('place-preview');
  if (prev) prev.remove();
}

function startPlaceDraw(e) {
  if (!state.isPlacing) return;
  e.preventDefault();

  const raw = getPointerPos(e);
  const wrapper = e.currentTarget.closest('.pw');
  if (!wrapper) return;

  const pi = wrapper.querySelector('.pi');
  const rect = pi.getBoundingClientRect();

  state.placeState = {
    startX: raw.x,
    startY: raw.y,
    relStartX: raw.x - rect.left,
    relStartY: raw.y - rect.top,
    wrapper,
    pi,
    floor: detectFloorId(wrapper.id),
    endX: null,
    endY: null,
    relEndX: null,
    relEndY: null
  };

  // Create a visual preview rectangle
  removePlacePreview();
  const preview = document.createElement('div');
  preview.id = 'place-preview';
  preview.style.cssText = 'position:absolute;border:2px dashed var(--blue);background:rgba(59,130,246,0.12);z-index:100;pointer-events:none;border-radius:4px;';
  preview.style.left = `${state.placeState.relStartX}px`;
  preview.style.top = `${state.placeState.relStartY}px`;
  preview.style.width = '0px';
  preview.style.height = '0px';
  pi.appendChild(preview);

  document.addEventListener('mousemove', onPlaceDrawMove);
  document.addEventListener('mouseup', onPlaceDrawEnd);
  document.addEventListener('touchmove', onPlaceDrawMoveTouch, { passive: false });
  document.addEventListener('touchend', onPlaceDrawEndTouch, { passive: false });
}

function onPlaceDrawMove(e) {
  if (!state.placeState) return;
  e.preventDefault();

  const raw = getPointerPos(e);
  const piRect = state.placeState.pi.getBoundingClientRect();
  const relX = raw.x - piRect.left;
  const relY = raw.y - piRect.top;

  // Store end positions
  state.placeState.endX = raw.x;
  state.placeState.endY = raw.y;
  state.placeState.relEndX = relX;
  state.placeState.relEndY = relY;

  const preview = document.getElementById('place-preview');
  if (!preview) return;

  const sx = state.placeState.relStartX;
  const sy = state.placeState.relStartY;

  const left = Math.min(sx, relX);
  const top = Math.min(sy, relY);
  const width = Math.abs(relX - sx);
  const height = Math.abs(relY - sy);

  preview.style.left = `${left}px`;
  preview.style.top = `${top}px`;
  preview.style.width = `${width}px`;
  preview.style.height = `${height}px`;
}

function onPlaceDrawMoveTouch(e) {
  onPlaceDrawMove(e);
}

function onPlaceDrawEndCleanup() {
  if (!state.placeState) return;
  document.removeEventListener('mousemove', onPlaceDrawMove);
  document.removeEventListener('mouseup', onPlaceDrawEnd);
  document.removeEventListener('touchmove', onPlaceDrawMoveTouch);
  document.removeEventListener('touchend', onPlaceDrawEndTouch);
}

function onPlaceDrawEnd() { onPlaceDrawEndCleanup(); finishPlaceDraw(); }
function onPlaceDrawEndTouch() { onPlaceDrawEndCleanup(); finishPlaceDraw(); }

function finishPlaceDraw() {
  if (!state.placeState) return;

  const ps = state.placeState;

  // Read the preview position before removing it
  const preview = document.getElementById('place-preview');
  let finalLeft = ps.relStartX;
  let finalTop = ps.relStartY;
  let finalWidth = 1;
  let finalHeight = 1;

  if (preview) {
    finalLeft = parseFloat(preview.style.left) || ps.relStartX;
    finalTop = parseFloat(preview.style.top) || ps.relStartY;
    finalWidth = Math.max(20, parseFloat(preview.style.width) || 1);
    finalHeight = Math.max(20, parseFloat(preview.style.height) || 1);
    preview.remove();
  } else if (ps.relEndX !== null) {
    // Fallback: compute from stored end positions
    const sx = ps.relStartX;
    const sy = ps.relStartY;
    const ex = ps.relEndX;
    const ey = ps.relEndY;
    finalLeft = Math.min(sx, ex);
    finalTop = Math.min(sy, ey);
    finalWidth = Math.max(20, Math.abs(ex - sx));
    finalHeight = Math.max(20, Math.abs(ey - sy));
  }

  // Convert display pixels to native coordinates
  const scale = getScale(ps.wrapper);
  const nativeLeft = Math.round(finalLeft / scale);
  const nativeTop = Math.round(finalTop / scale);
  const nativeWidth = Math.round(finalWidth / scale);
  const nativeHeight = Math.round(finalHeight / scale);

  // Build a unique key
  const baseKey = 'raum';
  let key = baseKey;
  let i = 1;
  while (state.rooms[key]) {
    key = baseKey + i;
    i++;
  }

  // Create the room with a default name
  state.rooms[key] = {
    title: 'Neuer Raum',
    floor: ps.floor,
    tasks: [],
    done: {},
    note: '',
    comments: [],
    left: Math.max(0, nativeLeft),
    top: Math.max(0, nativeTop),
    width: Math.max(20, nativeWidth),
    height: Math.max(20, nativeHeight)
  };

  saveData();
  state.isPlacing = false;
  state.placeState = null;
  state.placeFloor = null;
  document.querySelectorAll('.pw').forEach(w => { w.style.cursor = ''; });
  render();
  showRoom(key);
  // Open rename popup so the user can name the room right away
  openRenameModal(key);
}

// =====================================================================
// Rename Room Modal
// =====================================================================
let _renameKey = null;

function openRenameModal(key) {
  const room = state.rooms[key];
  if (!room) return;
  _renameKey = key;
  const el = document.getElementById('rm');
  const input = document.getElementById('rn');
  if (input) {
    input.value = room.title;
    input.setAttribute('data-key', key);
  }
  if (el) el.classList.add('open');
  setTimeout(() => {
    if (input) { input.focus(); input.select(); }
  }, 100);
}

function closeRenameModal() {
  const el = document.getElementById('rm');
  if (el) el.classList.remove('open');
  _renameKey = null;
}

function confirmRename() {
  const input = document.getElementById('rn');
  const key = input?.getAttribute('data-key');
  if (!key || !state.rooms[key]) { closeRenameModal(); return; }
  const title = input.value.trim();
  if (!title) { toast('Name darf nicht leer sein', 'error', 2000); return; }
  const oldTitle = state.rooms[key].title;
  state.rooms[key].title = title;
  saveData();
  closeRenameModal();
  render();
  if (state.selectedRoom === key) renderDetail(key);
  toast(`✏️ "${oldTitle}" → "${title}"`, 'success', 2000);
}

// =====================================================================
// Keyboard Shortcuts
// =====================================================================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.isPlacing) {
      cancelPlaceNewRoom();
      return;
    }
    if (state.overview) {
      state.overview = false;
      document.getElementById('btnOv')?.classList.remove('active');
      const sbBody = document.getElementById('sbBody');
      if (sbBody) sbBody.innerHTML = '<p class="hint">👆 Raum antippen</p>';
      render();
    }
    if (state.editMode) setEditMode(false);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
    e.preventDefault();
    toggleEditMode();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    e.preventDefault();
    showOverview();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveData();
    toast('💾 Gespeichert', 'success', 1500);
  }
});

// =====================================================================
// Init
// =====================================================================
// Set up plan interaction: drawing new rooms via mousedown/touchstart
document.querySelectorAll('.pw').forEach(w => {
  w.addEventListener('mousedown', startPlaceDraw);
  w.addEventListener('touchstart', startPlaceDraw, { passive: false });
  // The old click-based placement (handlePlanClick) has been removed
});

loadData().then(() => {
  render();
  const el = document.createElement('div');
  el.id = 'syncI';
  document.body.appendChild(el);
  setSyncStatus('idle');
  startPolling();
  if (!localStorage.getItem('gd')) setTimeout(showIntro, 500);
});

state.sidebarOpen = false;
document.getElementById('sb')?.classList.toggle('open', state.sidebarOpen);

window.addEventListener('resize', () => { render(); });

document.querySelectorAll('.pw img').forEach(img => {
  if (img.complete) {
    render();
    updateTabBadges();
  } else {
    img.addEventListener('load', () => {
      render();
      updateTabBadges();
    });
  }
});