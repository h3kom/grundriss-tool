/**
 * Grundriss Tool – Core-Renderer (Räume auf Grundriss zeichnen)
 * =====================================================================
 * @module renderer
 * @description Zeichnet die Raum-Elemente auf den Grundriss und erstellt
 * die Resize-Handles. Reagiert auf roomsChanged-Events.
 * Nutzt DOM-Diffing: nur geänderte Räume werden neu gerendert.
 */
window.GR = window.GR || {};

(function(Rdr) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const Sync = window.GR.sync;
  const U = window.GR.utils;

  // ===================================================================
  // Main Render
  // ===================================================================

  Rdr.render = function() {
    Sync.updateTabBadges();
    var floors = S.get('currentProjectFloors');
    if (floors && floors.length > 0) {
      for (var i = 0; i < floors.length; i++) {
        Rdr.renderFloor(floors[i].id);
      }
    } else {
      Rdr.renderFloor('eg');
      Rdr.renderFloor('og');
    }
  };

  Rdr.renderFloor = function(floor) {
    const container = document.getElementById(floor + '-r');
    if (!container) return;

    const wrapper = document.getElementById(floor + '-w');
    const scale = U.getScale(wrapper);
    const rooms = S.get('rooms');
    const selectedKey = S.get('selectedRoom');
    const editMode = S.get('editMode');

    const existingElements = new Map();
    for (const child of container.children) {
      const key = child.getAttribute('data-key');
      if (key) existingElements.set(key, child);
    }

    const processedKeys = new Set();
    for (const key of Object.keys(rooms)) {
      const room = rooms[key];
      if (room.floor !== floor) continue;

      processedKeys.add(key);
      let element = existingElements.get(key);

      if (!element) {
        element = Rdr.createRoomElement(key, room, scale);
        container.appendChild(element);
      } else {
        element.style.left = Math.round(room.left * scale) + 'px';
        element.style.top = Math.round(room.top * scale) + 'px';
        element.style.width = Math.round(room.width * scale) + 'px';
        element.style.height = Math.round(room.height * scale) + 'px';

        const isSelected = selectedKey === key;
        element.classList.toggle('sel', isSelected);
        element.classList.toggle('em', editMode);


        const progress = U.taskProgress(room);
        const existingLabel = element.querySelector('.rl');
        if (existingLabel) {
          const newHtml = progress.total > 0
            ? U.escHtml(room.title) + '<span class="pm">' + progress.percent + '%</span>'
            : U.escHtml(room.title);
          if (existingLabel.innerHTML !== newHtml) {
            existingLabel.innerHTML = newHtml;
          }
        }
      }
    }

    for (const [key, element] of existingElements) {
      if (!processedKeys.has(key)) {
        element.remove();
      }
    }
  };

  Rdr.createRoomElement = function(key, room, scale) {
    const div = document.createElement('div');
    const isSelected = S.get('selectedRoom') === key;
    const editMode = S.get('editMode');

    div.className = 'ro' + (isSelected ? ' sel' : '') + (editMode ? ' em' : '');
    div.style.left = Math.round(room.left * scale) + 'px';
    div.style.top = Math.round(room.top * scale) + 'px';
    div.style.width = Math.round(room.width * scale) + 'px';
    div.style.height = Math.round(room.height * scale) + 'px';
    div.setAttribute('data-key', key);
    div.setAttribute('tabindex', '0');
    div.setAttribute('role', 'button');
    div.setAttribute('aria-label', 'Raum: ' + room.title);

    // Click: select or show
    // NOTE: editMode must be read LIVE from state (not from closure) to avoid stale value after mode toggle
    div.addEventListener('click', function(e) {
      if (e.currentTarget._wasDragged) return;
      if (S.get('editMode')) {
        Rdr.selectRoomEdit(key);
        return;
      }
      Rdr.showRoom(key);
      if (window.innerWidth < 768) {
        const UI = window.GR.ui;
        if (UI) UI.openSidebar();
      }
    });

    // Keyboard-Navigation
    div.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (S.get('editMode')) { Rdr.selectRoomEdit(key); }
        else { Rdr.showRoom(key); }
      }
    });

    // Drag start
    const I = window.GR.interaction;
    div.addEventListener('mousedown', function(e) {
      if (I && I.startDrag) I.startDrag(e, key);
    });
    div.addEventListener('touchstart', function(e) {
      if (I && I.startDrag) I.startDrag(e, key);
    }, { passive: true });

    // Label
    const label = document.createElement('div');
    label.className = 'rl';
    const progress = U.taskProgress(room);
    label.innerHTML = progress.total > 0
      ? U.escHtml(room.title) + '<span class="pm">' + progress.percent + '%</span>'
      : U.escHtml(room.title);
    div.appendChild(label);

    // Selection dot
    const sdot = document.createElement('div');
    sdot.className = 'sd';
    div.appendChild(sdot);

    // Resize handles
    Rdr.createResizeHandles(div, key);

    return div;
  };

  Rdr.createResizeHandles = function(element, key) {
    const handleNames = C.HANDLE_DIRECTIONS;
    for (const handle of handleNames) {
      const hdl = document.createElement('div');
      hdl.className = 'rh ' + handle;
      const I = window.GR.interaction;
      hdl.addEventListener('mousedown', function(ev) {
        if (I && I.startResize) I.startResize(ev, key, handle);
      });
      hdl.addEventListener('touchstart', function(ev) {
        if (I && I.startResize) I.startResize(ev, key, handle);
      }, { passive: false });
      hdl.addEventListener('click', function(ev) { ev.stopPropagation(); });
      element.appendChild(hdl);
    }
  };

  // ===================================================================
  // Navigation / Selection
  // ===================================================================

  Rdr.showRoom = function(key) {
    const room = S.get('rooms')[key];
    if (!room) return;
    if (room.floor !== S.get('activeFloor')) {
      const UI = window.GR.ui;
      if (UI && UI.switchFloor) UI.switchFloor(room.floor);
    }
    S.set('overview', false);
    var btnOv = document.getElementById('btnOv');
    if (btnOv) btnOv.classList.remove('active');
    S.set('selectedRoom', key);
    const DetailRdr = window.GR.detailRenderer;
    if (DetailRdr) DetailRdr.renderDetail(key);
    Rdr.scrollToRoom(key);
    if (window.innerWidth < 768) {
      const UI = window.GR.ui;
      if (UI) UI.openSidebar();
    }
  };

  Rdr.scrollToRoom = function(key) {
    const el = document.querySelector('.ro[data-key="' + key + '"]');
    if (!el) return;
    setTimeout(function() {
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
  };

  Rdr.selectRoomEdit = function(key) {
    S.set('selectedRoom', key);
    Rdr.render();
    if (S.get('rooms')[key]) {
      const DetailRdr = window.GR.detailRenderer;
      if (DetailRdr) DetailRdr.renderDetail(key);
      if (window.innerWidth < 768) {
        const UI = window.GR.ui;
        if (UI) UI.openSidebar();
      }
    }
  };

  // ===================================================================
  // Event-Abonnement
  // ===================================================================
  S.subscribe(C.EVT_ROOMS_CHANGED, function() {
    Rdr.render();
  });

  S.subscribe(C.EVT_SELECTION_CHANGED, function(selectedKey) {
    Rdr.render();
    if (selectedKey && S.get('rooms')[selectedKey]) {
      const DetailRdr = window.GR.detailRenderer;
      if (DetailRdr) DetailRdr.renderDetail(selectedKey);
    }
  });

  Rdr.getScale = U.getScale;
  Rdr.detectFloorId = U.detectFloorId;
})(window.GR.renderer = window.GR.renderer || {});