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

  // rAF throttle for smooth drag rendering
  var _dragRafPending = false;

  D.startDrag = function(e, key) {
    if (!window.GR.permissions.requireEdit()) return;
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

    U.trackPointer(function onMove(e) {
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
          ds.element.classList.add(C.CLASS_DRAGGING);
          ds.element._wasDragged = true;
        }
      } else {
        e.preventDefault();
      }

      const scale = U.getScale(ds.wrapper);
      ds.currentLeft = ds.origLeft + dx / scale;
      ds.currentTop = ds.origTop + dy / scale;

      if (!_dragRafPending) {
        _dragRafPending = true;
        requestAnimationFrame(function() {
          _dragRafPending = false;
          const ds2 = S.get('dragState');
          if (!ds2 || !ds2.isDragging) return;
          const el = ds2.element;
          if (el && ds2.currentLeft !== undefined) {
            const sc = U.getScale(ds2.wrapper);
            el.style.left = Math.round(ds2.currentLeft * sc) + 'px';
            el.style.top = Math.round(ds2.currentTop * sc) + 'px';
          }
        });
      }
    }, function onEnd() {
      _dragRafPending = false;
      const ds = S.get('dragState');
      if (!ds) return;

      if (ds.element) ds.element.classList.remove(C.CLASS_DRAGGING);

      if (!ds.isDragging || ds.saved) {
        S.set('dragState', null);
        return;
      }

      const el = ds.element;
      if (!el) {
        S.set('dragState', null);
        return;
      }

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
    });
  };

})(window.GR.drag = window.GR.drag || {});