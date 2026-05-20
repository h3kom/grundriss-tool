window.GR = window.GR || {};

(function(RS) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const St = window.GR.storage;
  const U = window.GR.utils;

  // Shared options object for touch event listeners – must be same reference for add/remove
  RS._touchOptions = { passive: false };

  // rAF throttle for smooth resize rendering
  var _resizeRafPending = false;

  /**
   * Startet einen Resize-Vorgang.
   * @param {Event} e - Mouse-/Touch-Event
   * @param {string} key - Raumschlüssel
   * @param {string} handle - Handle-Name (nw, n, ne, e, se, s, sw, w)
   */
  RS.startResize = function(e, key, handle) {
    if (!S.get('editMode')) return;
    e.preventDefault();
    e.stopPropagation();

    const raw = RS.getPointerPos(e);
    const wrapper = e.currentTarget.closest('.pw');
    const scale = U.getScale(wrapper);
    const room = S.get('rooms')[key];
    if (!room) return;
    const el = e.currentTarget.closest('.ro');

    S.set('resizeState', {
      key: key,
      handle: handle,
      wrapper: wrapper,
      startX: raw.x,
      startY: raw.y,
      origLeft: room.left,
      origTop: room.top,
      origWidth: room.width,
      origHeight: room.height,
      scale: scale,
      saved: false,
      element: el // Element referenzieren statt jedes Mal DOM-Query
    });

    if (el) el.classList.add('rs');

    document.addEventListener('mousemove', RS.onResizeMove);
    document.addEventListener('mouseup', RS.onResizeEnd);
    document.addEventListener('touchmove', RS.onResizeMoveTouch, RS._touchOptions);
    document.addEventListener('touchend', RS.onResizeEndTouch, RS._touchOptions);
  };

  /**
   * Bewegt die Resize-Grenzen während des Vorgangs.
   * @param {Event} e
   */
  RS._doResizeUpdate = function() {
    _resizeRafPending = false;
    const rs = S.get('resizeState');
    if (!rs || rs.currentLeft === undefined) return;

    const el = rs.element;
    const scale = rs.scale;
    if (el) {
      el.style.left = Math.round(rs.currentLeft * scale) + 'px';
      el.style.top = Math.round(rs.currentTop * scale) + 'px';
      el.style.width = Math.round(rs.currentWidth * scale) + 'px';
      el.style.height = Math.round(rs.currentHeight * scale) + 'px';
    }
  };

  RS.onResizeMove = function(e) {
    const rs = S.get('resizeState');
    if (!rs) return;
    e.preventDefault();
    const raw = RS.getPointerPos(e);
    const dx = raw.x - rs.startX;
    const dy = raw.y - rs.startY;
    const dl = dx / rs.scale;
    const dt = dy / rs.scale;

    const handle = rs.handle;
    let nl = rs.origLeft;
    let nt = rs.origTop;
    let nw = rs.origWidth;
    let nh = rs.origHeight;

    if (handle.indexOf('e') >= 0) nw = Math.max(C.MIN_ROOM_SIZE, rs.origWidth + dl);
    if (handle.indexOf('w') >= 0) {
      nw = Math.max(C.MIN_ROOM_SIZE, rs.origWidth - dl);
      nl = rs.origLeft + rs.origWidth - nw;
    }
    if (handle.indexOf('s') >= 0) nh = Math.max(C.MIN_ROOM_SIZE, rs.origHeight + dt);
    if (handle.indexOf('n') >= 0) {
      nh = Math.max(C.MIN_ROOM_SIZE, rs.origHeight - dt);
      nt = rs.origTop + rs.origHeight - nh;
    }

    // Grenzenprüfung: Positionen dürfen nicht negativ werden, Größe begrenzen
    nl = Math.max(0, nl);
    nt = Math.max(0, nt);
    var maxW = 2000 - nl;
    var maxH = 2000 - nt;
    nw = Math.min(nw, maxW);
    nh = Math.min(nh, maxH);

    // Store raw values (cheap – runs every event)
    rs.currentLeft = nl;
    rs.currentTop = nt;
    rs.currentWidth = nw;
    rs.currentHeight = nh;

    // Throttle DOM writes to rAF (max once per frame)
    if (!_resizeRafPending) {
      _resizeRafPending = true;
      requestAnimationFrame(RS._doResizeUpdate);
    }
  };

  /**
   * Touch-Variante von onResizeMove.
   * @param {Event} e
   */
  RS.onResizeMoveTouch = function(e) {
    e.preventDefault();
    RS.onResizeMove(e);
  };

  /**
   * Beendet den Resize-Vorgang und speichert die finale Position.
   */
  function onResizeEndCleanup() {
    // Flush any pending rAF update
    _resizeRafPending = false;

    const rs = S.get('resizeState');
    if (!rs) return;

    document.removeEventListener('mousemove', RS.onResizeMove);
    document.removeEventListener('mouseup', RS.onResizeEnd);
    document.removeEventListener('touchmove', RS.onResizeMoveTouch, RS._touchOptions);
    document.removeEventListener('touchend', RS.onResizeEndTouch, RS._touchOptions);

    const el = rs.element;
    if (el) el.classList.remove('rs');

    const room = S.get('rooms')[rs.key];
    if (!el || !room || rs.saved) {
      S.set('resizeState', null);
      return;
    }

    // Use raw values from resizeState (not CSS-parsed) to avoid rounding drift
    if (rs.currentLeft !== undefined) {
      room.left = Math.max(0, Math.round(rs.currentLeft));
      room.top = Math.max(0, Math.round(rs.currentTop));
      room.width = Math.max(C.MIN_ROOM_SIZE, Math.round(rs.currentWidth));
      room.height = Math.max(C.MIN_ROOM_SIZE, Math.round(rs.currentHeight));
    }

    rs.saved = true;
    St.saveData();
    S.set('resizeState', null);
  }

  RS.onResizeEnd = function() { onResizeEndCleanup(); };
  RS.onResizeEndTouch = function() { onResizeEndCleanup(); };

  // Cleanup bei Tab-Wechsel/Fokusverlust
  document.addEventListener('visibilitychange', function() {
    if (document.hidden && S.get('resizeState')) onResizeEndCleanup();
  });

  /**
   * Ermittelt die Pointer-Position über die zentrale utils-Funktion.
   * @param {Event} e
   * @returns {{x:number, y:number}}
   */
  RS.getPointerPos = function(e) {
    return U.getPointerPos(e);
  };
})(window.GR.resize = window.GR.resize || {});