/**
 * Grundriss Tool – Core-Renderer (Räume auf Grundriss zeichnen)
 * =====================================================================
 * @module renderer
 * @description Zeichnet die Raum-Elemente auf den Grundriss und erstellt
 * die Resize-Handles. Reagiert auf roomsChanged-Events.
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

  /**
   * Rendert alle Etagen neu.
   */
  Rdr.render = function() {
    Sync.updateTabBadges();
    Rdr.renderFloor('eg');
    Rdr.renderFloor('og');
  };

  /**
   * Rendert eine einzelne Etage.
   * @param {string} floor - Etagen-Kürzel ('eg' | 'og')
   */
  Rdr.renderFloor = function(floor) {
    const container = document.getElementById(`${floor}-r`);
    if (!container) return;
    container.innerHTML = '';

    const wrapper = document.getElementById(`${floor}-w`);
    const scale = U.getScale(wrapper);
    const rooms = S.get('rooms');

    for (const key of Object.keys(rooms)) {
      const room = rooms[key];
      if (room.floor !== floor) continue;
      container.appendChild(Rdr.createRoomElement(key, room, scale));
    }
  };

  /**
   * Erzeugt ein DOM-Element für einen Raum.
   * @param {string} key - Raumschlüssel
   * @param {Object} room - Raum-Daten
   * @param {number} scale - Skalierungsfaktor
   * @returns {HTMLElement}
   */
  Rdr.createRoomElement = function(key, room, scale) {
    const div = document.createElement('div');
    const isSelected = S.get('selectedRoom') === key;
    const editMode = S.get('editMode');

    div.className = `ro${isSelected ? ' sel' : ''}${editMode ? ' em' : ''}`;
    div.style.left = `${Math.round(room.left * scale)}px`;
    div.style.top = `${Math.round(room.top * scale)}px`;
    div.style.width = `${Math.round(room.width * scale)}px`;
    div.style.height = `${Math.round(room.height * scale)}px`;
    div.setAttribute('data-key', key);

    // Click: select or show
    div.addEventListener('click', (e) => {
      if (e.currentTarget._wasDragged) return;
      if (editMode) {
        Rdr.selectRoomEdit(key);
        return;
      }
      Rdr.showRoom(key);
      if (window.innerWidth < 768) {
        const UI = window.GR.ui;
        if (UI) UI.openSidebar();
      }
    });

    // Drag start
    const I = window.GR.interaction;
    div.addEventListener('mousedown', (e) => {
      if (I && I.startDrag) I.startDrag(e, key);
    });
    div.addEventListener('touchstart', (e) => {
      if (I && I.startDrag) I.startDrag(e, key);
    }, { passive: true });

    // Label
    const label = document.createElement('div');
    label.className = 'rl';
    const progress = U.taskProgress(room);
    label.innerHTML = progress.total > 0
      ? `${U.escHtml(room.title)}<span class="pm">${progress.percent}%</span>`
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

  /**
   * Erzeugt die 8 Resize-Griffe für ein Raum-Element.
   * @param {HTMLElement} element - Raum-DOM-Element
   * @param {string} key - Raumschlüssel
   */
  Rdr.createResizeHandles = function(element, key) {
    const handleNames = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    for (const handle of handleNames) {
      const hdl = document.createElement('div');
      hdl.className = `rh ${handle}`;
      const I = window.GR.interaction;
      hdl.addEventListener('mousedown', (ev) => {
        if (I && I.startResize) I.startResize(ev, key, handle);
      });
      hdl.addEventListener('touchstart', (ev) => {
        if (I && I.startResize) I.startResize(ev, key, handle);
      }, { passive: false });
      hdl.addEventListener('click', (ev) => ev.stopPropagation());
      element.appendChild(hdl);
    }
  };

  // ===================================================================
  // Navigation / Selection
  // ===================================================================

  /**
   * Zeigt einen Raum an (selektiert + Detail-Panel).
   * @param {string} key - Raumschlüssel
   */
  Rdr.showRoom = function(key) {
    const room = S.get('rooms')[key];
    if (!room) return;
    if (room.floor !== S.get('activeFloor')) {
      const UI = window.GR.ui;
      if (UI && UI.switchFloor) UI.switchFloor(room.floor);
    }
    S.set('selectedRoom', key);
    S.set('overview', false);
    document.getElementById('btnOv')?.classList.remove('active');
    Rdr.render();
    const DetailRdr = window.GR.detailRenderer;
    if (DetailRdr) DetailRdr.renderDetail(key);
    Rdr.scrollToRoom(key);
    if (window.innerWidth < 768) {
      const UI = window.GR.ui;
      if (UI) UI.openSidebar();
    }
  };

  /**
   * Scrollt zu einem Raum auf dem Grundriss.
   * @param {string} key - Raumschlüssel
   */
  Rdr.scrollToRoom = function(key) {
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
  };

  /**
   * Selektiert einen Raum im Edit-Mode.
   * @param {string} key - Raumschlüssel
   */
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
    // Re-render floor plan when rooms change
    Rdr.render();
  });

  S.subscribe(C.EVT_SELECTION_CHANGED, function(selectedKey) {
    Rdr.render();
    if (selectedKey && S.get('rooms')[selectedKey]) {
      const DetailRdr = window.GR.detailRenderer;
      if (DetailRdr) DetailRdr.renderDetail(selectedKey);
    }
  });

  // Expose helpers for interaction modules
  Rdr.getScale = U.getScale;
  Rdr.detectFloorId = U.detectFloorId;
})(window.GR.renderer = window.GR.renderer || {});