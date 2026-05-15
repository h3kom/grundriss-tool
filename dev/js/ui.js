/**
 * Grundriss Tool – UI-Komponenten
 * =====================================================================
 * @module ui
 * @description Toast, Sidebar, Floor-Switching, Edit-Mode, Modals, Intro.
 * Reagiert auf State-Events für lose Kopplung.
 * Alle Event-Handler werden via Event Delegation (data-action) gebunden.
 */import { FLOORS, INTRO_SEEN_KEY, DARK_MODE_KEY, SEARCH_DEBOUNCE, EVT_EDIT_MODE_CHANGED, EVT_AUTH_CHANGED, EVT_ROOMS_CHANGED, EVT_SELECTION_CHANGED, EVT_FLOOR_CHANGED, EVT_SYNC_STATUS_CHANGED, ROOM_TYPES, TOAST_MAX_COUNT, EVT_PRESENCE_CHANGED } from './constants.js';
import * as S from './state.js';
import { _resetScaleCache } from './utils.js';
import { updateTabBadges } from './sync.js';
import { saveData } from './storage.js';
// Uses window.GR.storage, window.GR.rooms, window.GR.renderer, etc. (lazy)

// DOM element cache – avoids repeated getElementById calls
  var _dom = {};
  // Expose for cleanup module
  _dom = _dom;
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
  export function toast(message, type, duration, undoCallback) {
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
    while (container.children.length > TOAST_MAX_COUNT) {
      var first = container.firstChild;
      if (first) dismissToast(first);
    }
  }

  /**
   * Schließt einen Toast mit Animation.
   */
  export function dismissToast(toastElement) {
    if (!toastElement || !toastElement.classList) return;
    toastElement.classList.add('to');
    setTimeout(function() {
      if (toastElement.parentNode) toastElement.parentNode.removeChild(toastElement);
    }, 300);
  }

  /**
   * Führt eine Undo-Operation aus.
   */
  export function executeUndo() {
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

  // ===================================================================
  // Sidebar
  // ===================================================================

  function _updateSidebarAria() {
    var toggle = document.getElementById('sbToggle');
    if (toggle) toggle.setAttribute('aria-expanded', String(S.get('sidebarOpen')));
  }

  export function toggleSidebar() {
    S.set('sidebarOpen', !S.get('sidebarOpen'));
    var sb = $('sb');
    if (sb) sb.classList.toggle('open', S.get('sidebarOpen'));
    _updateSidebarAria();
    if (S.get('sidebarOpen')) S.set('sidebarWasManuallyOpened', true);
  };

  export function openSidebar() {
    if (!S.get('sidebarOpen')) {
      S.set('sidebarOpen', true);
      var sb = $('sb');
      if (sb) sb.classList.add('open');
      _updateSidebarAria();
    }
  };

  export function closeSidebar() {
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

  export function switchFloor(floor) {
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
    _resetScaleCache();

    updateTabBadges();

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

  export function setEditMode(enabled) {
    if (S.get('editMode') === enabled) return;
    S.set('editMode', enabled);

    var btnEdit = $('btnEdit');
    if (btnEdit) {
      btnEdit.classList.toggle('active', enabled);
      btnEdit.setAttribute('aria-pressed', String(enabled));
    }

    document.querySelectorAll('.ro').forEach(function(el) { el.classList.toggle('em', enabled); });

    if (enabled) {
      closeSidebar();
    } else {
      if (S.get('sidebarWasManuallyOpened') || S.get('selectedRoom')) openSidebar();
    }

    if (!enabled && S.get('selectedRoom') && !S.get('overview')) {
      var DetailRdr = window.GR.detailRenderer;
      if (DetailRdr) DetailRdr.renderDetail(S.get('selectedRoom'));
    }
  };

  export function toggleEditMode() {
    setEditMode(!S.get('editMode'));
  };

  // ===================================================================
  // Overview
  // ===================================================================

  export function toggleOverview() {
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

  export function confirm(message, onConfirm) {
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

  export function executeConfirm() {
    if (_confirmCallback) _confirmCallback();
    _confirmCallback = null;
    var sc = document.getElementById('sc');
    if (sc) sc.innerHTML = '<p class="hint">\uD83D\uDC46 Raum antippen</p>';
  };

  export function cancelConfirm() {
    _confirmCallback = null;
    var sc = document.getElementById('sc');
    if (sc) sc.innerHTML = '<p class="hint">\uD83D\uDC46 Raum antippen</p>';
  };

  // ===================================================================
  // Rename Modal
  // ===================================================================

  var _renameKey = null;

  export function openRenameModal(key) {
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

  export function closeRenameModal() {
    var el = document.getElementById('rm');
    if (el) el.classList.remove('open');
    _renameKey = null;
  };

  export function confirmRename() {
    var input = document.getElementById('rn');
    var key = input?.getAttribute('data-key');
    if (!key || !S.get('rooms')[key]) { closeRenameModal(); return; }
    var title = input.value.trim();
    if (!title) { toast('Name darf nicht leer sein', 'error', 2000); return; }
    if (title.length > 100) { toast('Name zu lang (max. 100 Zeichen)', 'error', 2000); return; }
    var oldTitle = S.get('rooms')[key].title;
    S.get('rooms')[key].title = title;
    saveData();
    closeRenameModal();
    toast('\u270F\uFE0F "' + oldTitle + '" \u2192 "' + title + '"', 'success', 2000);
  };

  // ===================================================================
  // Intro
  // ===================================================================

  export function showIntro() {
    var el = document.getElementById('intro');
    if (el) el.classList.add('open');
  };

  export function closeIntro() {
    var el = document.getElementById('intro');
    if (el) el.classList.remove('open');
    localStorage.setItem(INTRO_SEEN_KEY, '1');
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
          toggleEditMode();
          break;
        case 'switch-floor':
          switchFloor(target.dataset.floor);
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
          toggleSidebar();
          break;
        case 'close-sidebar':
          closeSidebar();
          break;
        case 'show-overview':
        case 'toggle-overview':
          toggleOverview();
          break;
        case 'close-intro':
        case 'intro-close':
          closeIntro();
          break;
        case 'close-rename':
          closeRenameModal();
          break;
        case 'confirm-rename':
          confirmRename();
          break;
        case 'execute-confirm':
          executeConfirm();
          break;
        case 'cancel-confirm':
          cancelConfirm();
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
          openRenameModal(target.dataset.key);
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
        confirmRename();
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
      switchFloor(tab.dataset.floor);
    }
  });

  // Edit-Mode Button
  document.addEventListener('click', function(e) {
    if (e.target.closest('#btnEdit')) {
      toggleEditMode();
    }
    if (e.target.closest('#btnOv')) {
      toggleOverview();
    }
    if (e.target.closest('#sbC')) {
      closeSidebar();
    }
    if (e.target.closest('#introClose')) {
      closeIntro();
    }
  });

  // ===================================================================
  // State Events
  // ===================================================================

  S.subscribe(EVT_EDIT_MODE_CHANGED, function(enabled) {
    if (!enabled && S.get('selectedRoom') && !S.get('overview')) {
      var DetailRdr = window.GR.detailRenderer;
      if (DetailRdr) DetailRdr.renderDetail(S.get('selectedRoom'));
    }
  });

  // Init
  setupEventDelegation();
