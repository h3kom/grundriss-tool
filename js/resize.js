window.GR = window.GR || {};

(function(RS) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const St = window.GR.storage;
  const U = window.GR.utils;

  // rAF throttle for smooth resize rendering
  var _resizeRafPending = false;

  /**
   * Startet einen Resize-Vorgang.
   * @param {Event} e - Mouse-/Touch-Event
   * @param {string} key - Raumschlüssel
   * @param {string} handle - Handle-Name (nw, n, ne, e, se, s, sw, w)
   */
  RS.startResize = function(e, key, handle) {
    if (!window.GR.permissions.requireEdit()) return;
    e.preventDefault();
    e.stopPropagation();

    const raw = U.getPointerPos(e);
    const wrapper = e.currentTarget.closest('.pw');
    const scale = U.getScale(wrapper);
    const room = S.get('rooms')[key];
    const el = e.currentTarget.closest('.' + C.CLASS_ROOM);

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
      element: el
    });

    if (el) el.classList.add(C.CLASS_RESIZING);

    U.trackPointer(function onMove(e) {
      const rs = S.get('resizeState');
      if (!rs) return;
      e.preventDefault();
      const raw = U.getPointerPos(e);
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

      nl = Math.max(0, nl);
      nt = Math.max(0, nt);

      rs.currentLeft = nl;
      rs.currentTop = nt;
      rs.currentWidth = nw;
      rs.currentHeight = nh;

      if (!_resizeRafPending) {
        _resizeRafPending = true;
        requestAnimationFrame(function() {
          _resizeRafPending = false;
          const rs2 = S.get('resizeState');
          if (!rs2 || rs2.currentLeft === undefined) return;
          const el2 = rs2.element;
          const sc = rs2.scale;
          if (el2) {
            el2.style.left = Math.round(rs2.currentLeft * sc) + 'px';
            el2.style.top = Math.round(rs2.currentTop * sc) + 'px';
            el2.style.width = Math.round(rs2.currentWidth * sc) + 'px';
            el2.style.height = Math.round(rs2.currentHeight * sc) + 'px';
          }
        });
      }
    }, function onEnd() {
      _resizeRafPending = false;

      const rs = S.get('resizeState');
      if (!rs) return;

      const el = rs.element;
      if (el) el.classList.remove(C.CLASS_RESIZING);

      const room = S.get('rooms')[rs.key];
      if (!el || !room || rs.saved) {
        S.set('resizeState', null);
        return;
      }

      if (rs.currentLeft !== undefined) {
        room.left = Math.max(0, Math.round(rs.currentLeft));
        room.top = Math.max(0, Math.round(rs.currentTop));
        room.width = Math.max(C.MIN_ROOM_SIZE, Math.round(rs.currentWidth));
        room.height = Math.max(C.MIN_ROOM_SIZE, Math.round(rs.currentHeight));
      }

      rs.saved = true;
      St.saveData();
      S.set('resizeState', null);
    });
  };

})(window.GR.resize = window.GR.resize || {});