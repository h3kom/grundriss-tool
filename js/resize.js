/**
 * Grundriss Tool – Resize-Interaktion (Räume skalieren)
 * =====================================================================
 * @module resize
 * @description Ermöglicht das Skalieren von Räumen über 8 Anfasspunkte im Edit-Mode.
 */
window.GR = window.GR || {};

(function(RS) {
  'use strict';

  const S = window.GR.state;
  const St = window.GR.storage;
  const U = window.GR.utils;

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

    S.set('resizeState', {
      key,
      handle,
      wrapper,
      startX: raw.x,
      startY: raw.y,
      origLeft: room.left,
      origTop: room.top,
      origWidth: room.width,
      origHeight: room.height,
      scale,
      saved: false
    });

    const el = e.currentTarget.closest('.ro');
    if (el) el.classList.add('rs');

    document.addEventListener('mousemove', RS.onResizeMove);
    document.addEventListener('mouseup', RS.onResizeEnd);
    document.addEventListener('touchmove', RS.onResizeMoveTouch, { passive: false });
    document.addEventListener('touchend', RS.onResizeEndTouch, { passive: false });
  };

  /**
   * Bewegt die Resize-Grenzen während des Vorgangs.
   * @param {Event} e
   */
  RS.onResizeMove = function(e) {
    const rs = S.get('resizeState');
    if (!rs) return;
    const raw = RS.getPointerPos(e);
    const scale = U.getScale(rs.wrapper);
    const dx = raw.x - rs.startX;
    const dy = raw.y - rs.startY;
    const dl = dx / scale;
    const dt = dy / scale;

    const handle = rs.handle;
    let nl = rs.origLeft;
    let nt = rs.origTop;
    let nw = rs.origWidth;
    let nh = rs.origHeight;

    if (handle.indexOf('e') >= 0) nw = Math.max(20, rs.origWidth + dl);
    if (handle.indexOf('w') >= 0) {
      nw = Math.max(20, rs.origWidth - dl);
      nl = rs.origLeft + rs.origWidth - nw;
    }
    if (handle.indexOf('s') >= 0) nh = Math.max(20, rs.origHeight + dt);
    if (handle.indexOf('n') >= 0) {
      nh = Math.max(20, rs.origHeight - dt);
      nt = rs.origTop + rs.origHeight - nh;
    }

    const el = document.querySelector(`.ro[data-key="${rs.key}"]`);
    if (el) {
      el.style.left = `${Math.round(nl * scale)}px`;
      el.style.top = `${Math.round(nt * scale)}px`;
      el.style.width = `${Math.round(nw * scale)}px`;
      el.style.height = `${Math.round(nh * scale)}px`;
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
    const rs = S.get('resizeState');
    if (!rs) return;

    document.removeEventListener('mousemove', RS.onResizeMove);
    document.removeEventListener('mouseup', RS.onResizeEnd);
    document.removeEventListener('touchmove', RS.onResizeMoveTouch);
    document.removeEventListener('touchend', RS.onResizeEndTouch);

    const el = document.querySelector(`.ro[data-key="${rs.key}"]`);
    if (el) el.classList.remove('rs');

    const room = S.get('rooms')[rs.key];
    if (!el || !room || rs.saved) {
      S.set('resizeState', null);
      return;
    }

    const scale = U.getScale(rs.wrapper);
    const nl = Math.round(parseInt(el.style.left) / scale);
    const nt = Math.round(parseInt(el.style.top) / scale);
    const nw = Math.round(parseInt(el.style.width) / scale);
    const nh = Math.round(parseInt(el.style.height) / scale);

    if (!isNaN(nl)) room.left = nl;
    if (!isNaN(nt)) room.top = nt;
    if (!isNaN(nw)) room.width = Math.max(20, nw);
    if (!isNaN(nh)) room.height = Math.max(20, nh);

    rs.saved = true;
    St.saveData();
    S.set('resizeState', null);
  }

  RS.onResizeEnd = function() { onResizeEndCleanup(); };
  RS.onResizeEndTouch = function() { onResizeEndCleanup(); };

  /**
   * Ermittelt die Pointer-Position aus einem Mouse- oder Touch-Event.
   * @param {Event} e
   * @returns {{x:number, y:number}}
   */
  RS.getPointerPos = function(e) {
    const touch = e.touches;
    if (touch && touch.length > 0) {
      return { x: touch[0].clientX, y: touch[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };
})(window.GR.resize = window.GR.resize || {});