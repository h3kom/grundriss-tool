/**
 * Grundriss Tool – Drag-Interaktion
 * =====================================================================
 * @module drag
 * @description Drag von Räumen auf dem Grundriss.
 */
window.GR = window.GR || {};

(function(D) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const St = window.GR.storage;
  const U = window.GR.utils;

  // Shared options object for touch event listeners – must be same reference for add/remove
  D._touchOptions = { passive: false };

  // rAF throttle for smooth drag rendering
  var _dragRafPending = false;

  D.startDrag = function(e, key) {
    if (!S.get('editMode')) return;
    if (window.GR.app && !window.GR.app.canEdit()) return;
    const raw = U.getPointerPos(e);
    const wrapper = e.currentTarget.closest('.pw');
    const rooms = S.get('rooms');
    if (!rooms[key]) return;

    S.set('dragState', {
      key: key,
      wrapper: wrapper,
      startX: raw.x,
      startY: raw.y,
      origLeft: rooms[key].left,
      origTop: rooms[key].top,
      element: e.currentTarget,
      isDragging: false,
      saved: false
    });

    e.currentTarget._wasDragged = false;

    document.addEventListener('mousemove', D.onDragMove);
    document.addEventListener('mouseup', D.onDragEnd);
    document.addEventListener('touchmove', D.onDragMoveTouch, D._touchOptions);
    document.addEventListener('touchend', D.onDragEndTouch, D._touchOptions);
  };

  D._doDragUpdate = function() {
    _dragRafPending = false;
    const ds = S.get('dragState');
    if (!ds || !ds.isDragging) return;

    const el = ds.element;
    if (el && ds.currentLeft !== undefined) {
      const scale = U.getScale(ds.wrapper);
      el.style.left = Math.round(ds.currentLeft * scale) + 'px';
      el.style.top = Math.round(ds.currentTop * scale) + 'px';
    }
  };

  D.onDragMove = function(e) {
    const ds = S.get('dragState');
    if (!ds) return;
    const raw = U.getPointerPos(e);
    const dx = raw.x - ds.startX;
    const dy = raw.y - ds.startY;

    if (!ds.isDragging) {
      if (Math.sqrt(dx * dx + dy * dy) < C.DRAG_DEAD_ZONE) return;
      ds.isDragging = true;
      e.preventDefault();
      if (ds.element) {
        ds.element.classList.add('dg');
        ds.element._wasDragged = true;
      }
    } else {
      e.preventDefault();
    }

    // Calculate new position (cheap – runs every event)
    const scale = U.getScale(ds.wrapper);
    ds.currentLeft = ds.origLeft + dx / scale;
    ds.currentTop = ds.origTop + dy / scale;

    // Throttle DOM writes to rAF (max once per frame)
    if (!_dragRafPending) {
      _dragRafPending = true;
      requestAnimationFrame(function() { D._doDragUpdate(); });
    }
  };

  D.onDragMoveTouch = function(e) {
    D.onDragMove(e);
    const ds = S.get('dragState');
    if (ds && ds.isDragging) e.preventDefault();
  };

  function onDragEndCleanup() {
    // Flush any pending rAF update
    _dragRafPending = false;

    const ds = S.get('dragState');
    if (!ds) return;
    document.removeEventListener('mousemove', D.onDragMove);
    document.removeEventListener('mouseup', D.onDragEnd);
    document.removeEventListener('touchmove', D.onDragMoveTouch, D._touchOptions);
    document.removeEventListener('touchend', D.onDragEndTouch, D._touchOptions);

    if (ds.element) ds.element.classList.remove('dg');

    if (!ds.isDragging || ds.saved) {
      S.set('dragState', null);
      return;
    }

    const el = ds.element;
    if (!el) {
      S.set('dragState', null);
      return;
    }

    // Use raw values from dragState (not CSS-parsed) to avoid rounding drift
    var newLeft = Math.round(ds.currentLeft !== undefined ? ds.currentLeft : ds.origLeft);
    var newTop = Math.round(ds.currentTop !== undefined ? ds.currentTop : ds.origTop);

    const rooms = S.get('rooms');
    if (newLeft !== ds.origLeft || newTop !== ds.origTop) {
      const nativeWidth = C.NATIVE_WIDTHS[U.detectFloorId(ds.wrapper.id)] || 1000;
      const room = rooms[ds.key];
      const clampedLeft = Math.max(0, Math.min(newLeft, nativeWidth - (room ? room.width : C.MIN_ROOM_SIZE)));
      const clampedTop = Math.max(0, newTop);

      rooms[ds.key].left = clampedLeft;
      rooms[ds.key].top = clampedTop;
      ds.saved = true;
      St.saveData();
    }
    S.set('dragState', null);
  }

  D.onDragEnd = function() { onDragEndCleanup(); };
  D.onDragEndTouch = function() { onDragEndCleanup(); };

})(window.GR.drag = window.GR.drag || {});