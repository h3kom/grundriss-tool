// Grundriss Tool – UI-Komponenten (Toast, Sidebar, Modals, Floor-Tabs, Edit-Mode)
// =====================================================================
window.GR = window.GR || {};

(function(UI) {
  const C = window.GR.constants;
  const S = window.GR.state;
  const St = window.GR.storage;
  const Rdr = window.GR.renderer;

  // ===================================================================
  // Toast
  // ===================================================================
  function toast(message, type, duration, undoCallback) {
    const container = document.getElementById('tc');
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `t t${type[0]}`;
    let html = `<span>${icons[type] || 'ℹ️'}</span><span>${St.escHtml(message)}</span>`;
    if (undoCallback) {
      html += '<button class="tu" onclick="window.GR.ui.executeUndo()">↩ Rückgängig</button>';
    }
    html += '<button class="td" onclick="window.GR.ui.dismissToast(this.parentElement)">✕</button>';
    el.innerHTML = html;

    if (undoCallback) {
      el.dataset.undoKey = S.get('undoStack').length;
      S.pushUndo(undoCallback);
    }

    container.appendChild(el);
    if (duration > 0) {
      setTimeout(() => UI.dismissToast(el), duration);
    }
    while (container.children.length > 3) {
      const first = container.firstChild;
      if (first) UI.dismissToast(first);
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
    const callback = S.getUndo(key);
    if (callback) {
      callback();
      S.clearUndo(key);
      toast('Rückgängig', 'info', 2000);
    }
    dismissToast(target);
  }

  // Expose toast functions both on UI and on Storage (for storage.js calls)
  UI.toast = toast;
  UI.dismissToast = dismissToast;
  UI.executeUndo = executeUndo;
  // Override storage stub
  St.toast = toast;

  // ===================================================================
  // Sidebar
  // ===================================================================
  UI.toggleSidebar = function() {
    S.set('sidebarOpen', !S.get('sidebarOpen'));
    document.getElementById('sb')?.classList.toggle('open', S.get('sidebarOpen'));
    if (S.get('sidebarOpen')) S.set('sidebarWasManuallyOpened', true);
  };

  UI.openSidebar = function() {
    if (!S.get('sidebarOpen')) {
      S.set('sidebarOpen', true);
      document.getElementById('sb')?.classList.add('open');
    }
  };

  UI.closeSidebar = function() {
    if (S.get('sidebarOpen')) {
      S.set('sidebarOpen', false);
      document.getElementById('sb')?.classList.remove('open');
    }
  };

  // ===================================================================
  // Floor Switching
  // ===================================================================
  UI.switchFloor = function(floor) {
    S.set('activeFloor', floor);
    document.querySelectorAll('.floor').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.floor-tabs button').forEach(el => el.classList.remove('active'));

    const floorId = `floor${floor.charAt(0).toUpperCase()}${floor.slice(1)}`;
    const tabId = `tab${floor.charAt(0).toUpperCase()}${floor.slice(1)}`;

    document.getElementById(floorId)?.classList.add('active');
    document.getElementById(tabId)?.classList.add('active');

    St.updateTabBadges();

    const rooms = S.get('rooms');
    if (S.get('selectedRoom') && rooms[S.get('selectedRoom')] && rooms[S.get('selectedRoom')].floor !== floor) {
      S.set('selectedRoom', null);
      Rdr.render();
      const sbBody = document.getElementById('sbBody');
      if (sbBody) sbBody.innerHTML = '<p class="hint">👆 Raum antippen</p>';
    }
  };

  // ===================================================================
  // Edit Mode
  // ===================================================================
  UI.setEditMode = function(enabled) {
    if (S.get('editMode') === enabled) return;
    S.set('editMode', enabled);

    document.getElementById('btnEm')?.classList.toggle('active', enabled);
    document.getElementById('eb')?.classList.toggle('show', enabled);
    document.getElementById('mc')?.classList.toggle('ea', enabled);
    document.querySelectorAll('.ro').forEach(el => el.classList.toggle('em', enabled));
    document.querySelectorAll('.fa button').forEach(btn => { btn.style.display = enabled ? '' : 'none'; });

    if (enabled) {
      UI.closeSidebar();
    } else {
      if (S.get('sidebarWasManuallyOpened') || S.get('selectedRoom')) UI.openSidebar();
    }

    if (!enabled && S.get('selectedRoom') && !S.get('overview')) {
      Rdr.renderDetail(S.get('selectedRoom'));
    }
  };

  UI.toggleEditMode = function() {
    UI.setEditMode(!S.get('editMode'));
  };

  // ===================================================================
  // Rename Modal
  // ===================================================================
  let _renameKey = null;

  UI.openRenameModal = function(key) {
    const room = S.get('rooms')[key];
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
  };

  UI.closeRenameModal = function() {
    const el = document.getElementById('rm');
    if (el) el.classList.remove('open');
    _renameKey = null;
  };

  UI.confirmRename = function() {
    const input = document.getElementById('rn');
    const key = input?.getAttribute('data-key');
    if (!key || !S.get('rooms')[key]) { UI.closeRenameModal(); return; }
    const title = input.value.trim();
    if (!title) { toast('Name darf nicht leer sein', 'error', 2000); return; }
    const oldTitle = S.get('rooms')[key].title;
    S.get('rooms')[key].title = title;
    St.saveData();
    UI.closeRenameModal();
    Rdr.render();
    if (S.get('selectedRoom') === key) Rdr.renderDetail(key);
    toast(`✏️ "${oldTitle}" → "${title}"`, 'success', 2000);
  };

  // ===================================================================
  // Intro
  // ===================================================================
  UI.showIntro = function() {
    const el = document.getElementById('io');
    if (el) el.classList.add('open');
  };

  UI.closeIntro = function() {
    const el = document.getElementById('io');
    if (el) el.classList.remove('open');
    localStorage.setItem('gd', '1');
  };
})(window.GR.ui = window.GR.ui || {});