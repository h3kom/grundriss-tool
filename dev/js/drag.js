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

  D.startDrag = function(e, key) {
    if (!S.get('editMode')) return;
    const raw = D.getPointerPos(e);
    const wrapper = e.currentTarget.closest('.pw');
    const rooms = S.get('rooms');

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
    document.addEventListener('touchmove', D.onDragMoveTouch, { passive: false });
    document.addEventListener('touchend', D.onDragEndTouch, { passive: false });
  };

  D.onDragMove = function(e) {
    const ds = S.get('dragState');
    if (!ds) return;
    const raw = D.getPointerPos(e);
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

    const el = ds.element;
    if (el) {
      const scale = U.getScale(ds.wrapper);
      var newX = ds.origLeft + dx / scale;
      var newY = ds.origTop + dy / scale;

      el.style.left = Math.round(newX * scale) + 'px';
      el.style.top = Math.round(newY * scale) + 'px';
    }
  };

  D.onDragMoveTouch = function(e) {
    D.onDragMove(e);
    const ds = S.get('dragState');
    if (ds && ds.isDragging) e.preventDefault();
  };

  function onDragEndCleanup() {
    const ds = S.get('dragState');
    if (!ds) return;
    document.removeEventListener('mousemove', D.onDragMove);
    document.removeEventListener('mouseup', D.onDragEnd);
    document.removeEventListener('touchmove', D.onDragMoveTouch);
    document.removeEventListener('touchend', D.onDragEndTouch);

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

    const scale = U.getScale(ds.wrapper);
    var newLeft = Math.round(parseInt(el.style.left, 10) / scale);
    var newTop = Math.round(parseInt(el.style.top, 10) / scale);

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

  D.getPointerPos = function(e) {
    return U.getPointerPos(e);
  };
})(window.GR.drag = window.GR.drag || {});