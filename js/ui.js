/**
 * Grundriss Tool – UI-Komponenten
 * =====================================================================
 * @module ui
 * @description Toast, Sidebar, Floor-Switching, Edit-Mode, Modals, Intro.
 * Reagiert auf State-Events für lose Kopplung.
 * Alle Event-Handler werden via Event Delegation (data-action) gebunden.
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

    const icons = { success: '\u2705', error: '\u274C', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F' };
    const el = document.createElement('div');
    el.className = 't t' + type[0];

    const iconSpan = document.createElement('span');
    iconSpan.textContent = icons[type] || '\u2139\uFE0F';
    el.appendChild(iconSpan);

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    el.appendChild(msgSpan);

    if (undoCallback) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'tu';
      undoBtn.dataset.action = 'execute-undo';
      undoBtn.textContent = '\u21A9 R\u00FCckg\u00E4ngig';
      el.appendChild(undoBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'td';
    closeBtn.dataset.action = 'dismiss-toast';
    closeBtn.textContent = '\u2715';
    el.appendChild(closeBtn);

    if (undoCallback) {
      el.dataset.undoKey = S.get('undoStack').length;
      S.pushUndo(undoCallback);
    }

    container.appendChild(el);
    if (duration > 0) {
      setTimeout(function() { dismissToast(el); }, duration);
    }
    while (container.children.length > C.TOAST_MAX_COUNT) {
      var first = container.firstChild;
      if (first) dismissToast(first);
    }
  }

  /**
   * Schließt einen Toast mit Animation.
   * @param {HTMLElement} toastElement
   */
  function dismissToast(toastElement) {
    if (!toastElement || !toastElement.classList) return;
    toastElement.classList.add('to');
    setTimeout(function() {
      if (toastElement.parentNode) toastElement.parentNode.removeChild(toastElement);
    }, 300);
  }

  /**
   * Führt eine Undo-Operation aus.
   */
  function executeUndo() {
    var container = document.getElementById('tc');
    if (!container) return;
    var target = null;
    var elements = container.querySelectorAll('.t');
    for (var i = 0; i < elements.length; i++) {
      if (elements[i].dataset.undoKey !== undefined) {
        target = elements[i];
        break;
      }
    }
    if (!target) return;
    var key = parseInt(target.dataset.undoKey);
    var callback = S.getUndo(key);
    if (callback) {
      callback();
      S.clearUndo(key);
      toast('R\u00FCckg\u00E4ngig', 'info', 2000);
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
    document.querySelectorAll('.floor').forEach(function(el) { el.classList.remove('active'); });
    document.querySelectorAll('.floor-tabs button').forEach(function(el) { el.classList.remove('active'); });

    var floorId = 'floor' + floor.charAt(0).toUpperCase() + floor.slice(1);
    var tabId = 'tab' + floor.charAt(0).toUpperCase() + floor.slice(1);

    document.getElementById(floorId)?.classList.add('active');
    document.getElementById(tabId)?.classList.add('active');

    Sync.updateTabBadges();

    var rooms = S.get('rooms');
    if (S.get('selectedRoom') && rooms[S.get('selectedRoom')] && rooms[S.get('selectedRoom')].floor !== floor) {
      S.set('selectedRoom', null);
      var sbBody = document.getElementById('sbBody');
      if (sbBody) sbBody.innerHTML = '<p class="hint">\uD83D\uDC46 Raum antippen</p>';
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
    document.querySelectorAll('.ro').forEach(function(el) { el.classList.toggle('em', enabled); });
    document.querySelectorAll('.fa button').forEach(function(btn) { btn.style.display = enabled ? '' : 'none'; });

    if (enabled) {
      UI.closeSidebar();
    } else {
      if (S.get('sidebarWasManuallyOpened') || S.get('selectedRoom')) UI.openSidebar();
    }

    if (!enabled && S.get('selectedRoom') && !S.get('overview')) {
      var DetailRdr = window.GR.detailRenderer;
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
  var _confirmCallback = null;

  /**
   * Zeigt einen modalen Bestätigungsdialog an.
   * @param {string} message - Die anzuzeigende Nachricht
   * @param {Function} onConfirm - Wird bei Bestätigung aufgerufen
   */
  UI.confirm = function(message, onConfirm) {
    _confirmCallback = onConfirm;
    var body = document.getElementById('sbBody');
    if (!body) return;

    body.innerHTML = '';

    var dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';

    var p = document.createElement('p');
    p.textContent = message;
    dialog.appendChild(p);

    var actions = document.createElement('div');
    actions.className = 'ma';
    actions.style.marginTop = '16px';

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Abbrechen';
    cancelBtn.dataset.action = 'cancel-confirm';
    actions.appendChild(cancelBtn);

    var confirmBtn = document.createElement('button');
    confirmBtn.className = 'p';
    confirmBtn.textContent = 'L\u00F6schen';
    confirmBtn.dataset.action = 'execute-confirm';
    actions.appendChild(confirmBtn);

    dialog.appendChild(actions);
    body.appendChild(dialog);
  };

  /**
   * Führt die Bestätigung aus.
   */
  UI.executeConfirm = function() {
    if (_confirmCallback) _confirmCallback();
    _confirmCallback = null;
    var sbBody = document.getElementById('sbBody');
    if (sbBody) sbBody.innerHTML = '<p class="hint">\uD83D\uDC46 Raum antippen</p>';
  };

  /**
   * Bricht die Bestätigung ab.
   */
  UI.cancelConfirm = function() {
    _confirmCallback = null;
    var sbBody = document.getElementById('sbBody');
    if (sbBody) sbBody.innerHTML = '<p class="hint">\uD83D\uDC46 Raum antippen</p>';
  };

  // ===================================================================
  // Rename Modal
  // ===================================================================

  var _renameKey = null;

  /**
   * Öffnet den Umbenennen-Dialog.
   * @param {string} key - Raumschlüssel
   */
  UI.openRenameModal = function(key) {
    var room = S.get('rooms')[key];
    if (!room) return;
    _renameKey = key;
    var el = document.getElementById('rm');
    var input = document.getElementById('rn');
    if (input) {
      input.value = room.title;
      input.setAttribute('data-key', key);
    }
    if (el) el.classList.add('open');
    setTimeout(function() {
      if (input) { input.focus(); input.select(); }
    }, 100);
  };

  /**
   * Schließt den Umbenennen-Dialog.
   */
  UI.closeRenameModal = function() {
    var el = document.getElementById('rm');
    if (el) el.classList.remove('open');
    _renameKey = null;
  };

  /**
   * Bestätigt die Umbenennung.
   */
  UI.confirmRename = function() {
    var input = document.getElementById('rn');
    var key = input?.getAttribute('data-key');
    if (!key || !S.get('rooms')[key]) { UI.closeRenameModal(); return; }
    var title = input.value.trim();
    if (!title) { toast('Name darf nicht leer sein', 'error', 2000); return; }
    var oldTitle = S.get('rooms')[key].title;
    S.get('rooms')[key].title = title;
    St.saveData();
    UI.closeRenameModal();
    toast('\u270F\uFE0F "' + oldTitle + '" \u2192 "' + title + '"', 'success', 2000);
  };

  // ===================================================================
  // Intro
  // ===================================================================

  /**
   * Zeigt den Intro-Dialog.
   */
  UI.showIntro = function() {
    var el = document.getElementById('io');
    if (el) el.classList.add('open');
  };

  /**
   * Schließt den Intro-Dialog.
   */
  UI.closeIntro = function() {
    var el = document.getElementById('io');
    if (el) el.classList.remove('open');
    localStorage.setItem(C.INTRO_SEEN_KEY, '1');
  };

  // ===================================================================
  // Event Delegation (data-action)
  // ===================================================================

  /**
   * Zentrale Event-Delegation für alle data-action-Buttons.
   * Wird auf document-Ebene registriert, sodass auch dynamisch
   * erzeugte Buttons (via innerHTML) korrekt behandelt werden.
   */
  function setupEventDelegation() {
    // Click-Event-Delegation
    document.addEventListener('click', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;

      var action = target.dataset.action;
      var R = window.GR.rooms;
      switch (action) {
        case 'toggle-edit-mode':
          UI.toggleEditMode();
          break;
        case 'switch-floor':
          UI.switchFloor(target.dataset.floor);
          break;
        case 'place-new-room':
          var I = window.GR.interaction;
          if (I && I.enablePlaceNewRoom) I.enablePlaceNewRoom(target.dataset.floor);
          break;
        case 'cancel-place':
          var PR = window.GR.placeRoom;
          if (PR && PR.cancelPlaceNewRoom) PR.cancelPlaceNewRoom();
          break;
        case 'toggle-sidebar':
          UI.toggleSidebar();
          break;
        case 'show-overview':
          var OR = window.GR.overviewRenderer;
          if (OR) OR.showOverview();
          break;
        case 'close-intro':
          UI.closeIntro();
          break;
        case 'close-rename':
          UI.closeRenameModal();
          break;
        case 'confirm-rename':
          UI.confirmRename();
          break;
        case 'execute-confirm':
          UI.executeConfirm();
          break;
        case 'cancel-confirm':
          UI.cancelConfirm();
          break;
        case 'dismiss-toast':
          dismissToast(target.parentElement);
          break;
        case 'execute-undo':
          executeUndo();
          break;
        case 'show-room':
          var Rdr = window.GR.renderer;
          var roomKey = target.dataset.key;
          if (Rdr && roomKey) Rdr.showRoom(roomKey);
          break;
        case 'open-rename':
          UI.openRenameModal(target.dataset.key);
          break;
        case 'delete-task':
          if (R && target.dataset.key) R.deleteTask(target.dataset.key, parseInt(target.dataset.idx));
          break;
        case 'add-task':
          if (R && target.dataset.key) R.addTask(target.dataset.key);
          break;
        case 'delete-comment':
          if (R && target.dataset.key) R.deleteComment(target.dataset.key, parseInt(target.dataset.idx));
          break;
        case 'add-comment':
          if (R && target.dataset.key) R.addComment(target.dataset.key);
          break;
        case 'delete-room':
          if (R && target.dataset.key) R.deleteRoom(target.dataset.key);
          break;
      }
    });

    // Keydown-Delegation für Rename-Input
    document.addEventListener('keydown', function(e) {
      if (e.target.id === 'rn' && e.key === 'Enter') {
        e.preventDefault();
        UI.confirmRename();
      }
    });

    // Keydown-Delegation für dynamische Inputs (Aufgaben, Kommentare, Suche)
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;

      var target = e.target;
      var action = target.dataset.actionEnter;
      if (!action) return;

      var key = target.dataset.key;
      var R = window.GR.rooms;

      switch (action) {
        case 'add-task':
          if (R && key) R.addTask(key);
          break;
        case 'add-comment':
          if (R && key) R.addComment(key);
          break;
        case 'search-overview':
          var OR = window.GR.overviewRenderer;
          if (OR) OR.debouncedSearch();
          break;
      }
    });

    // Change-Delegation für Checkboxen und Textareas
    document.addEventListener('change', function(e) {
      var target = e.target;
      var action = target.dataset.actionChange;
      if (!action) return;

      var key = target.dataset.key;
      var idx = target.dataset.idx !== undefined ? parseInt(target.dataset.idx) : undefined;
      var R = window.GR.rooms;

      switch (action) {
        case 'toggle-task':
          if (R && key && idx !== undefined) R.toggleTask(key, idx, target.checked);
          break;
        case 'save-note':
          if (R && key) R.saveNote(key, target.value);
          break;
      }
    });

    // Input-Delegation für Suche
    document.addEventListener('input', function(e) {
      if (e.target.classList.contains('os')) {
        // Suchwert im State speichern (zuverlässiger als DOM-Read)
        S.set('searchQuery', e.target.value);
        var OR = window.GR.overviewRenderer;
        if (OR) OR.debouncedSearch();
      }
    });
  }

  // ===================================================================
  // Event-Abonnement für Edit-Mode
  // ===================================================================
  S.subscribe(C.EVT_EDIT_MODE_CHANGED, function(enabled) {
    if (!enabled && S.get('selectedRoom') && !S.get('overview')) {
      var DetailRdr = window.GR.detailRenderer;
      if (DetailRdr) DetailRdr.renderDetail(S.get('selectedRoom'));
    }
  });

  // Event Delegation beim ersten Aufruf initialisieren
  setupEventDelegation();

})(window.GR.ui = window.GR.ui || {});