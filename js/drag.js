/**
 * Grundriss Tool – Drag-Interaktion
 * =====================================================================
 * @module drag
 * @description Drag von Räumen mit magnetischem Snappen.
 */
window.GR = window.GR || {};

(function(D) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const St = window.GR.storage;
  const U = window.GR.utils;

  /**
   * Startet einen Drag-Vorgang.
   */
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

  /**
   * Berechnet Snap-Punkte für magnetisches Snappen.
   * @param {number} x - Aktuelle X-Position (unscaled)
   * @param {number} y - Aktuelle Y-Position (unscaled)
   * @param {number} w - Raum-Breite (unscaled)
   * @param {number} h - Raum-Höhe (unscaled)
   * @param {string} excludeKey - Key des verschobenen Raums
   * @returns {{x: number, y: number, snappedX: boolean, snappedY: boolean}}
   */
  D.calcSnap = function(x, y, w, h, excludeKey) {
    if (!S.get('snapEnabled')) return { x: x, y: y, snappedX: false, snappedY: false };

    var rooms = S.get('rooms');
    var snapDist = C.SNAP_DISTANCE;
    var bestDx = snapDist + 1;
    var bestDy = snapDist + 1;
    var snapX = x;
    var snapY = y;

    // Kanten des aktuellen Raums
    var edges = {
      left: x,
      right: x + w,
      top: y,
      bottom: y + h,
      centerX: x + w / 2,
      centerY: y + h / 2
    };

    for (var key of Object.keys(rooms)) {
      if (key === excludeKey) continue;
      var r = rooms[key];

      var otherEdges = {
        left: r.left,
        right: r.left + r.width,
        top: r.top,
        bottom: r.top + r.height,
        centerX: r.left + r.width / 2,
        centerY: r.top + r.height / 2
      };

      // Snap left to other right
      var d = Math.abs(edges.left - otherEdges.right);
      if (d < bestDx) { bestDx = d; snapX = otherEdges.right; }
      // Snap right to other left
      d = Math.abs(edges.right - otherEdges.left);
      if (d < bestDx) { bestDx = d; snapX = otherEdges.left - w; }
      // Snap left to other left
      d = Math.abs(edges.left - otherEdges.left);
      if (d < bestDx) { bestDx = d; snapX = otherEdges.left; }
      // Snap right to other right
      d = Math.abs(edges.right - otherEdges.right);
      if (d < bestDx) { bestDx = d; snapX = otherEdges.right - w; }

      // Snap top to other bottom
      d = Math.abs(edges.top - otherEdges.bottom);
      if (d < bestDy) { bestDy = d; snapY = otherEdges.bottom; }
      // Snap bottom to other top
      d = Math.abs(edges.bottom - otherEdges.top);
      if (d < bestDy) { bestDy = d; snapY = otherEdges.top - h; }
      // Snap top to other top
      d = Math.abs(edges.top - otherEdges.top);
      if (d < bestDy) { bestDy = d; snapY = otherEdges.top; }
      // Snap bottom to other bottom
      d = Math.abs(edges.bottom - otherEdges.bottom);
      if (d < bestDy) { bestDy = d; snapY = otherEdges.bottom - h; }
    }

    return {
      x: bestDx <= snapDist ? snapX : x,
      y: bestDy <= snapDist ? snapY : y,
      snappedX: bestDx <= snapDist,
      snappedY: bestDy <= snapDist
    };
  };

  /**
   * Zeigt/Versteckt Snap-Linien.
   */
  D.showSnapLines = function(snappedX, snappedY, x, y, w, h, scale, wrapper) {
    D.removeSnapLines();
    if (!snappedX && !snappedY) return;

    var container = wrapper;
    if (!container) return;

    if (snappedX) {
      var line = document.createElement('div');
      line.className = 'snap-line snap-line-x';
      line.style.left = Math.round(x * scale) + 'px';
      line.style.top = '0';
      line.style.height = '100%';
      container.appendChild(line);
    }
    if (snappedY) {
      var lineY = document.createElement('div');
      lineY.className = 'snap-line snap-line-y';
      lineY.style.top = Math.round(y * scale) + 'px';
      lineY.style.left = '0';
      lineY.style.width = '100%';
      container.appendChild(lineY);
    }
  };

  D.removeSnapLines = function() {
    document.querySelectorAll('.snap-line').forEach(function(el) { el.remove(); });
  };

  /**
   * Bewegt den Raum während des Drags.
   */
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

      // Snap
      var room = S.get('rooms')[ds.key];
      if (room) {
        var snap = D.calcSnap(newX, newY, room.width, room.height, ds.key);
        if (snap.snappedX) newX = snap.x;
        if (snap.snappedY) newY = snap.y;
        D.showSnapLines(snap.snappedX, snap.snappedY, newX, newY, room.width, room.height, scale, ds.wrapper.querySelector('.pr') || ds.wrapper);
      }

      el.style.left = Math.round(newX * scale) + 'px';
      el.style.top = Math.round(newY * scale) + 'px';
    }
  };

  D.onDragMoveTouch = function(e) {
    D.onDragMove(e);
    const ds = S.get('dragState');
    if (ds && ds.isDragging) e.preventDefault();
  };

  /**
   * Beendet den Drag-Vorgang.
   */
  function onDragEndCleanup() {
    D.removeSnapLines();
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