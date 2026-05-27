/**
 * Grundriss Tool – Neue Räume auf dem Grundriss platzieren
 * =====================================================================
 * @module placeRoom
 * @description Ermöglicht das interaktive Platzieren neuer Räume per
 * Maus-/Touch-Draw auf dem Grundriss.
 */
window.GR = window.GR || {};

(function(PR) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const St = window.GR.storage;
  const U = window.GR.utils;

  /**
   * Aktiviert den Platzierungs-Modus.
   * @param {string} floor - Etagen-Kürzel ('eg' | 'og')
   */
  PR.enablePlaceNewRoom = function(floor, roomType) {
    if (!window.GR.permissions.requireEdit()) return;
    S.set('isPlacing', true);
    S.set('placeFloor', floor);
    S.set('placeRoomType', roomType || null);
    document.querySelectorAll('.pw').forEach(w => { w.style.cursor = 'crosshair'; });
    const UI = window.GR.ui;
    if (UI) UI.closeSidebar();
    const sc = document.getElementById('sc');
    if (sc) {
      sc.innerHTML = '<p class="hint"><strong>Neuen Raum platzieren</strong><br/>' +
        '\uD83D\uDC46 Auf den Grundriss tippen & ziehen um die Gr\u00F6\u00DFe festzulegen.<br/>' +
        '<button data-action="cancel-place" class="btn-danger" style="margin-top:8px;">Abbrechen</button>' +
      '</p>';
    }
  };

  /**
   * Bricht den Platzierungs-Modus ab.
   */
  PR.cancelPlaceNewRoom = function() {
    PR.removePlacePreview();
    S.set('isPlacing', false);
    S.set('placeFloor', null);
    S.set('placeRoomType', null);
    S.set('placeState', null);
    document.querySelectorAll('.pw').forEach(w => { w.style.cursor = ''; });
    const sc = document.getElementById('sc');
    if (sc) sc.innerHTML = C.HINT_TAP_ROOM;
  };

  /**
   * Entfernt die Platzierungs-Vorschau.
   */
  PR.removePlacePreview = function() {
    const prev = document.getElementById('place-preview');
    if (prev) prev.remove();
  };

  /**
   * Startet das Zeichnen eines neuen Raums.
   * @param {Event} e - Mouse-/Touch-Event
   */
  PR.startPlaceDraw = function(e) {
    if (!S.get('isPlacing')) return;
    if (e.target.closest('.' + C.CLASS_ROOM) || e.target.closest('.' + C.CLASS_RESIZE_HANDLE)) return;
    e.preventDefault();

    const raw = U.getPointerPos(e);
    const wrapper = e.currentTarget.closest('.pw');
    if (!wrapper) return;

    const pi = wrapper.querySelector('.pi');
    if (!pi) return;
    const rect = pi.getBoundingClientRect();

    S.set('placeState', {
      startX: raw.x,
      startY: raw.y,
      relStartX: raw.x - rect.left,
      relStartY: raw.y - rect.top,
      wrapper,
      pi,
      floor: wrapper.id.replace(/-w$/, ''),
      endX: null,
      endY: null,
      relEndX: null,
      relEndY: null
    });

    PR.removePlacePreview();
    const preview = document.createElement('div');
    preview.id = 'place-preview';
    preview.className = 'place-preview';
    preview.style.cssText = 'position:absolute;z-index:100;';
    preview.style.left = `${S.get('placeState').relStartX}px`;
    preview.style.top = `${S.get('placeState').relStartY}px`;
    preview.style.width = '0px';
    preview.style.height = '0px';
    pi.appendChild(preview);

    U.trackPointer(function onMove(e) {
      const ps = S.get('placeState');
      if (!ps) return;
      e.preventDefault();

      const raw = U.getPointerPos(e);
      const piRect = ps.pi.getBoundingClientRect();
      const relX = raw.x - piRect.left;
      const relY = raw.y - piRect.top;

      ps.endX = raw.x;
      ps.endY = raw.y;
      ps.relEndX = relX;
      ps.relEndY = relY;

      const preview = document.getElementById('place-preview');
      if (!preview) return;

      const sx = ps.relStartX;
      const sy = ps.relStartY;

      preview.style.left = `${Math.min(sx, relX)}px`;
      preview.style.top = `${Math.min(sy, relY)}px`;
      preview.style.width = `${Math.abs(relX - sx)}px`;
      preview.style.height = `${Math.abs(relY - sy)}px`;
    }, function onEnd() {
      PR.finishPlaceDraw();
    });
  };

  /**
   * Schließt die Platzierung ab und erstellt den neuen Raum.
   */
  PR.finishPlaceDraw = function() {
    const ps = S.get('placeState');
    if (!ps) return;

    // Read the preview position before removing it
    const preview = document.getElementById('place-preview');
    let finalLeft = ps.relStartX;
    let finalTop = ps.relStartY;
    let finalWidth = 1;
    let finalHeight = 1;

    if (preview) {
      finalLeft = parseFloat(preview.style.left) || ps.relStartX;
      finalTop = parseFloat(preview.style.top) || ps.relStartY;
      finalWidth = Math.max(C.MIN_ROOM_SIZE, parseFloat(preview.style.width) || 1);
      finalHeight = Math.max(C.MIN_ROOM_SIZE, parseFloat(preview.style.height) || 1);
      preview.remove();
    } else if (ps.relEndX !== null) {
      const sx = ps.relStartX;
      const sy = ps.relStartY;
      const ex = ps.relEndX;
      const ey = ps.relEndY;
      finalLeft = Math.min(sx, ex);
      finalTop = Math.min(sy, ey);
      finalWidth = Math.max(C.MIN_ROOM_SIZE, Math.abs(ex - sx));
      finalHeight = Math.max(C.MIN_ROOM_SIZE, Math.abs(ey - sy));
    }

    // Convert display pixels to native coordinates
    const scale = U.getScale(ps.wrapper);
    const nativeLeft = Math.round(finalLeft / scale);
    const nativeTop = Math.round(finalTop / scale);
    const nativeWidth = Math.round(finalWidth / scale);
    const nativeHeight = Math.round(finalHeight / scale);

    // Build a unique key
    const rooms = S.get('rooms');
    const key = U.generateKey(rooms);

    // Create the new room
    rooms[key] = {
      title: 'Neuer Raum',
      type: S.get('placeRoomType') || C.ROOM_TYPE_DEFAULT,
      floor: ps.floor,
      tasks: [],
      done: {},
      note: '',
      comments: [],
      left: Math.max(0, nativeLeft),
      top: Math.max(0, nativeTop),
      width: Math.max(C.MIN_ROOM_SIZE, nativeWidth),
      height: Math.max(C.MIN_ROOM_SIZE, nativeHeight)
    };

    St.saveData();
    S.set('isPlacing', false);
    S.set('placeState', null);
    S.set('placeFloor', null);
    S.set('placeRoomType', null);
    document.querySelectorAll('.pw').forEach(w => { w.style.cursor = ''; });
    S.notify(C.EVT_ROOMS_CHANGED);

    // Open rename popup so the user can name the room right away
    const UI = window.GR.ui;
    if (UI) UI.openRenameModal(key);
  };

})(window.GR.placeRoom = window.GR.placeRoom || {});
