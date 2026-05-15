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

  // DOM element cache – avoids repeated getElementById calls
  var _dom = {};
  // Expose for cleanup module
  UI._dom = _dom;
  function $(id) {
    if (!_dom[id]) _dom[id] = document.getElementById(id);
    // Fallback: element may have been replaced in the DOM
    if (_dom[id] && !_dom[id].isConnected) _dom[id] = document.getElementById(id);
    return _dom[id];
  }

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
    var container = document.getElementById('toasts') || document.getElementById('tc');
    if (!container) return;

    var icons = { success: '\u2705', error: '\u274C', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F' };
    var el = document.createElement('div');
    el.className = 't t' + type[0];

    var iconSpan = document.createElement('span');
    iconSpan.textContent = icons[type] || '\u2139\uFE0F';
    el.appendChild(iconSpan);

    var msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    el.appendChild(msgSpan);

    if (undoCallback) {
      var undoBtn = document.createElement('button');
      undoBtn.className = 'tu';
      undoBtn.dataset.action = 'execute-undo';
      undoBtn.textContent = '\u21A9 R\u00FCckg\u00E4ngig';
      el.appendChild(undoBtn);
    }

    var closeBtn = document.createElement('button');
    closeBtn.className = 'td';
    closeBtn.dataset.action = 'dismiss-toast';
    closeBtn.textContent = '\u2715';
    el.appendChild(closeBtn);

    if (undoCallback) {
      el.dataset.undoKey = S.pushUndo(undoCallback);
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
    var container = document.getElementById('toasts') || document.getElementById('tc');
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
  St.toast = toast;

  // ===================================================================
  // Sidebar
  // ===================================================================

  function _updateSidebarAria() {
    var toggle = document.getElementById('sbToggle');
    if (toggle) toggle.setAttribute('aria-expanded', String(S.get('sidebarOpen')));
  }

  UI.toggleSidebar = function() {
    S.set('sidebarOpen', !S.get('sidebarOpen'));
    var sb = $('sb');
    if (sb) sb.classList.toggle('open', S.get('sidebarOpen'));
    _updateSidebarAria();
    if (S.get('sidebarOpen')) S.set('sidebarWasManuallyOpened', true);
  };

  UI.openSidebar = function() {
    if (!S.get('sidebarOpen')) {
      S.set('sidebarOpen', true);
      var sb = $('sb');
      if (sb) sb.classList.add('open');
      _updateSidebarAria();
    }
  };

  UI.closeSidebar = function() {
    if (S.get('sidebarOpen')) {
      S.set('sidebarOpen', false);
      var sb = $('sb');
      if (sb) sb.classList.remove('open');
      _updateSidebarAria();
    }
  };

  // ===================================================================
  // Floor Switching
  // ===================================================================

  UI.switchFloor = function(floor) {
    S.set('activeFloor', floor);

    // Floor-Tabs aktualisieren
    document.querySelectorAll('.ft-tab').forEach(function(el) { el.classList.remove('active'); });
    var tab = document.getElementById('tab-' + floor);
    if (tab) tab.classList.add('active');

    // Plan-Wrapper Sichtbarkeit
    var floors = S.get('currentProjectFloors');
    if (!floors || floors.length === 0) {
      floors = [{ id: 'eg' }, { id: 'og' }];
    }
    for (var i = 0; i < floors.length; i++) {
      var w = document.getElementById(floors[i].id + '-w');
      if (w) w.style.display = (floors[i].id === floor) ? '' : 'none';
    }

    // Scale-Cache zurücksetzen
    U._resetScaleCache();

    Sync.updateTabBadges();

    // Auswahl zurücksetzen wenn Raum auf anderer Etage
    var rooms = S.get('rooms');
    var selected = S.get('selectedRoom');
    if (selected && rooms[selected] && rooms[selected].floor !== floor) {
      S.set('selectedRoom', null);
      var sc = document.getElementById('sc');
      if (sc) sc.innerHTML = '<p class="hint">\uD83D\uDC46 Raum antippen</p>';
    }
  };

  // ===================================================================
  // Edit Mode
  // ===================================================================

  UI.setEditMode = function(enabled) {
    if (S.get('editMode') === enabled) return;
    S.set('editMode', enabled);

    var btnEdit = $('btnEdit');
    if (btnEdit) {
      btnEdit.classList.toggle('active', enabled);
      btnEdit.setAttribute('aria-pressed', String(enabled));
    }

    document.querySelectorAll('.ro').forEach(function(el) { el.classList.toggle('em', enabled); });

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

  UI.toggleEditMode = function() {
    UI.setEditMode(!S.get('editMode'));
  };

  // ===================================================================
  // Overview
  // ===================================================================

  UI.toggleOverview = function() {
    var overview = !S.get('overview');
    S.set('overview', overview);

    var btnOv = $('btnOv');
    if (btnOv) {
      btnOv.classList.toggle('active', overview);
      btnOv.setAttribute('aria-pressed', String(overview));
    }

    if (overview) {
      var OR = window.GR.overviewRenderer;
      if (OR) OR.showOverview();
    }
  };

  // ===================================================================
  // Confirm (im Sidebar-Content)
  // ===================================================================

  var _confirmCallback = null;

  UI.confirm = function(message, onConfirm) {
    _confirmCallback = onConfirm;
    var body = document.getElementById('sc');
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

  UI.executeConfirm = function() {
    if (_confirmCallback) _confirmCallback();
    _confirmCallback = null;
    var sc = document.getElementById('sc');
    if (sc) sc.innerHTML = '<p class="hint">\uD83D\uDC46 Raum antippen</p>';
  };

  UI.cancelConfirm = function() {
    _confirmCallback = null;
    var sc = document.getElementById('sc');
    if (sc) sc.innerHTML = '<p class="hint">\uD83D\uDC46 Raum antippen</p>';
  };

  // ===================================================================
  // Rename Modal
  // ===================================================================

  var _renameKey = null;

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

  UI.closeRenameModal = function() {
    var el = document.getElementById('rm');
    if (el) el.classList.remove('open');
    _renameKey = null;
  };

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

  UI.showIntro = function() {
    var el = document.getElementById('intro');
    if (el) el.classList.add('open');
  };

  UI.closeIntro = function() {
    var el = document.getElementById('intro');
    if (el) el.classList.remove('open');
    localStorage.setItem(C.INTRO_SEEN_KEY, '1');
  };

  // ===================================================================
  // Event Delegation (data-action)
  // ===================================================================

  /**
   * Aktualisiert Detail-Panel und Raum-Label nach Datenänderung.
   */
  function _refreshDetail(key) {
    var DetailRdr = window.GR.detailRenderer;
    var Rdr = window.GR.renderer;
    if (DetailRdr && key) DetailRdr.renderDetail(key);
    if (Rdr && Rdr.render) Rdr.render();
  }

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
          if (I && I.enablePlaceNewRoom) I.enablePlaceNewRoom(target.dataset.floor, target.dataset.roomType);
          break;
        case 'cancel-place':
          var PR = window.GR.placeRoom;
          if (PR && PR.cancelPlaceNewRoom) PR.cancelPlaceNewRoom();
          break;
        case 'toggle-sidebar':
          UI.toggleSidebar();
          break;
        case 'close-sidebar':
          UI.closeSidebar();
          break;
        case 'show-overview':
        case 'toggle-overview':
          UI.toggleOverview();
          break;
        case 'close-intro':
        case 'intro-close':
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
          if (R && target.dataset.key) {
            R.deleteTask(target.dataset.key, parseInt(target.dataset.idx));
            _refreshDetail(target.dataset.key);
          }
          break;
        case 'add-task':
          if (R && target.dataset.key) {
            R.addTask(target.dataset.key);
            _refreshDetail(target.dataset.key);
          }
          break;
        case 'delete-comment':
          if (R && target.dataset.key) {
            R.deleteComment(target.dataset.key, parseInt(target.dataset.idx));
            _refreshDetail(target.dataset.key);
          }
          break;
        case 'add-comment':
          if (R && target.dataset.key) {
            R.addComment(target.dataset.key);
            _refreshDetail(target.dataset.key);
          }
          break;
        case 'delete-room':
          if (R && target.dataset.key) R.deleteRoom(target.dataset.key);
          break;
      }
    });

    // Keydown für Rename-Input
    document.addEventListener('keydown', function(e) {
      if (e.target.id === 'rn' && e.key === 'Enter') {
        e.preventDefault();
        UI.confirmRename();
      }
    });

    // Enter-Key für dynamische Inputs
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;

      var target = e.target;
      var action = target.dataset.actionEnter;
      if (!action) return;

      var key = target.dataset.key;
      var R = window.GR.rooms;

      switch (action) {
        case 'add-task':
          if (R && key) {
            R.addTask(key);
            _refreshDetail(key);
          }
          break;
        case 'add-comment':
          if (R && key) {
            R.addComment(key);
            _refreshDetail(key);
          }
          break;
        case 'search-overview':
          var OR = window.GR.overviewRenderer;
          if (OR) OR.debouncedSearch();
          break;
      }
    });

      // Change für Checkboxen, Textareas und Selects
    document.addEventListener('change', function(e) {
      var target = e.target;
      var action = target.dataset.actionChange;
      if (!action) return;

      var key = target.dataset.key;
      var idx = target.dataset.idx !== undefined ? parseInt(target.dataset.idx) : undefined;
      var R = window.GR.rooms;

      switch (action) {
        case 'toggle-task':
          if (R && key && idx !== undefined) {
            R.toggleTask(key, idx, target.checked);
            _refreshDetail(key);
          }
          break;
        case 'save-note':
          if (R && key) R.saveNote(key, target.value);
          break;
      }
    });

    // Input für Suche
    document.addEventListener('input', function(e) {
      if (e.target.classList.contains('os')) {
        S.set('searchQuery', e.target.value);
        var OR = window.GR.overviewRenderer;
        if (OR) OR.debouncedSearch();
      }
    });
  }

  // ===================================================================
  // Floor-Tab Click Handler
  // ===================================================================

  document.addEventListener('click', function(e) {
    var tab = e.target.closest('.ft-tab');
    if (tab && tab.dataset.floor) {
      UI.switchFloor(tab.dataset.floor);
    }
  });

  // Edit-Mode Button
  document.addEventListener('click', function(e) {
    if (e.target.closest('#btnEdit')) {
      UI.toggleEditMode();
    }
    if (e.target.closest('#btnOv')) {
      UI.toggleOverview();
    }
    if (e.target.closest('#sbC')) {
      UI.closeSidebar();
    }
    if (e.target.closest('#introClose')) {
      UI.closeIntro();
    }
  });

  // ===================================================================
  // State Events
  // ===================================================================

  S.subscribe(C.EVT_EDIT_MODE_CHANGED, function(enabled) {
    if (!enabled && S.get('selectedRoom') && !S.get('overview')) {
      var DetailRdr = window.GR.detailRenderer;
      if (DetailRdr) DetailRdr.renderDetail(S.get('selectedRoom'));
    }
  });

  // Init
  setupEventDelegation();

})(window.GR.ui = window.GR.ui || {});