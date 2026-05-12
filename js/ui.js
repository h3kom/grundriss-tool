/**
 * Grundriss Tool – UI-Komponenten
 * =====================================================================
 * @module ui
 * @description Toast, Sidebar, Floor-Switching, Edit-Mode, Modals, Intro.
 * Reagiert auf State-Events für lose Kopplung.
 */
window.GR = window.GR || {};

(function(UI) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const St = window.GR.storage;
  const Sync = window.GR.sync;
  const U = window.GR.utils;

  // ===================================================================
  // Toast
  // ===================================================================

  /**
   * Zeigt einen Toast-Notification an.
   * @param {string} message - Nachricht
   * @param {string} type - 'success' | 'error' | 'warning' | 'info'
   * @param {number} duration - Anzeigedauer in ms (0 = manuell schließen)
   * @param {Function} [undoCallback] - Optionale Undo-Funktion
   */
  function toast(message, type, duration, undoCallback) {
    const container = document.getElementById('tc');
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `t t${type[0]}`;
    let html = `<span>${icons[type] || 'ℹ️'}</span><span>${U.escHtml(message)}</span>`;
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

  /**
   * Schließt einen Toast mit Animation.
   * @param {HTMLElement} toastElement
   */
  function dismissToast(toastElement) {
    if (!toastElement || !toastElement.classList) return;
    toastElement.classList.add('to');
    setTimeout(() => {
      if (toastElement.parentNode) toastElement.parentNode.removeChild(toastElement);
    }, 300);
  }

  /**
   * Führt eine Undo-Operation aus.
   */
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

  // Expose toast functions
  UI.toast = toast;
  UI.dismissToast = dismissToast;
  UI.executeUndo = executeUndo;
  // Override storage stub
  St.toast = toast;

  // ===================================================================
  // Sidebar
  // ===================================================================

  /**
   * Öffnet/schließt die Sidebar.
   */
  UI.toggleSidebar = function() {
    S.set('sidebarOpen', !S.get('sidebarOpen'));
    document.getElementById('sb')?.classList.toggle('open', S.get('sidebarOpen'));
    if (S.get('sidebarOpen')) S.set('sidebarWasManuallyOpened', true);
  };

  /**
   * Öffnet die Sidebar, falls geschlossen.
   */
  UI.openSidebar = function() {
    if (!S.get('sidebarOpen')) {
      S.set('sidebarOpen', true);
      document.getElementById('sb')?.classList.add('open');
    }
  };

  /**
   * Schließt die Sidebar, falls offen.
   */
  UI.closeSidebar = function() {
    if (S.get('sidebarOpen')) {
      S.set('sidebarOpen', false);
      document.getElementById('sb')?.classList.remove('open');
    }
  };

  // ===================================================================
  // Floor Switching
  // ===================================================================

  /**
   * Wechselt zwischen EG und OG.
   * @param {string} floor - 'eg' | 'og'
   */
  UI.switchFloor = function(floor) {
    S.set('activeFloor', floor);
    document.querySelectorAll('.floor').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.floor-tabs button').forEach(el => el.classList.remove('active'));

    const floorId = `floor${floor.charAt(0).toUpperCase()}${floor.slice(1)}`;
    const tabId = `tab${floor.charAt(0).toUpperCase()}${floor.slice(1)}`;

    document.getElementById(floorId)?.classList.add('active');
    document.getElementById(tabId)?.classList.add('active');

    Sync.updateTabBadges();

    const rooms = S.get('rooms');
    if (S.get('selectedRoom') && rooms[S.get('selectedRoom')] && rooms[S.get('selectedRoom')].floor !== floor) {
      S.set('selectedRoom', null);
      const sbBody = document.getElementById('sbBody');
      if (sbBody) sbBody.innerHTML = '<p class="hint">👆 Raum antippen</p>';
    }
  };

  // ===================================================================
  // Edit Mode
  // ===================================================================

  /**
   * Setzt den Edit-Mode.
   * @param {boolean} enabled
   */
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
      const DetailRdr = window.GR.detailRenderer;
      if (DetailRdr) DetailRdr.renderDetail(S.get('selectedRoom'));
    }
  };

  /**
   * Schaltet den Edit-Mode um.
   */
  UI.toggleEditMode = function() {
    UI.setEditMode(!S.get('editMode'));
  };

  // ===================================================================
  // Confirm Modal (ersetzt browser-native confirm())
  // ===================================================================

  /** @type {Function|null} Aktueller Confirm-Callback */
  let _confirmCallback = null;

  /**
   * Zeigt einen modalen Bestätigungsdialog an.
   * @param {string} message - Die anzuzeigende Nachricht
   * @param {Function} onConfirm - Wird bei Bestätigung aufgerufen
   */
  UI.confirm = function(message, onConfirm) {
    _confirmCallback = onConfirm;
    const body = document.getElementById('sbBody');
    if (body) {
      body.innerHTML = `
        <div class="confirm-dialog">
          <p>${U.escHtml(message)}</p>
          <div class="ma" style="margin-top:16px">
            <button onclick="window.GR.ui.cancelConfirm()">Abbrechen</button>
            <button class="p" onclick="window.GR.ui.executeConfirm()">Löschen</button>
          </div>
        </div>`;
    }
  };

  /**
   * Führt die Bestätigung aus.
   */
  UI.executeConfirm = function() {
    if (_confirmCallback) _confirmCallback();
    _confirmCallback = null;
    const sbBody = document.getElementById('sbBody');
    if (sbBody) sbBody.innerHTML = '<p class="hint">👆 Raum antippen</p>';
  };

  /**
   * Bricht die Bestätigung ab.
   */
  UI.cancelConfirm = function() {
    _confirmCallback = null;
    const sbBody = document.getElementById('sbBody');
    if (sbBody) sbBody.innerHTML = '<p class="hint">👆 Raum antippen</p>';
  };

  // ===================================================================
  // Rename Modal
  // ===================================================================

  let _renameKey = null;

  /**
   * Öffnet den Umbenennen-Dialog.
   * @param {string} key - Raumschlüssel
   */
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

  /**
   * Schließt den Umbenennen-Dialog.
   */
  UI.closeRenameModal = function() {
    const el = document.getElementById('rm');
    if (el) el.classList.remove('open');
    _renameKey = null;
  };

  /**
   * Bestätigt die Umbenennung.
   */
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
    toast(`✏️ "${oldTitle}" → "${title}"`, 'success', 2000);
  };

  // ===================================================================
  // Intro
  // ===================================================================

  /**
   * Zeigt den Intro-Dialog.
   */
  UI.showIntro = function() {
    const el = document.getElementById('io');
    if (el) el.classList.add('open');
  };

  /**
   * Schließt den Intro-Dialog.
   */
  UI.closeIntro = function() {
    const el = document.getElementById('io');
    if (el) el.classList.remove('open');
    localStorage.setItem(C.INTRO_SEEN_KEY, '1');
  };

  // ===================================================================
  // Event-Abonnement für Edit-Mode
  // ===================================================================
  S.subscribe(C.EVT_EDIT_MODE_CHANGED, function(enabled) {
    // Re-render detail if needed
    if (!enabled && S.get('selectedRoom') && !S.get('overview')) {
      const DetailRdr = window.GR.detailRenderer;
      if (DetailRdr) DetailRdr.renderDetail(S.get('selectedRoom'));
    }
  });

})(window.GR.ui = window.GR.ui || {});
