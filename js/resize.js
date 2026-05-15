import { MIN_ROOM_SIZE, HANDLE_DIRECTIONS } from './constants.js';
import * as S from './state.js';
import { saveData } from './storage.js';
import { getScale, getPointerPos } from './utils.js';

// Shared options object for touch event listeners – must be same reference for add/remove
  _touchOptions = { passive: false };

  // rAF throttle for smooth resize rendering
  var _resizeRafPending = false;

  /**
   * Startet einen Resize-Vorgang.
   * @param {Event} e - Mouse-/Touch-Event
   * @param {string} key - Raumschlüssel
   * @param {string} handle - Handle-Name (nw, n, ne, e, se, s, sw, w)
   */
  export function startResize(e, key, handle) {
    if (!S.get('editMode')) return;
    e.preventDefault();
    e.stopPropagation();

    const raw = getPointerPos(e);
    const wrapper = e.currentTarget.closest('.pw');
    const scale = getScale(wrapper);
    const room = S.get('rooms')[key];
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
    document.addEventListener('touchmove', RS.onResizeMoveTouch, _touchOptions);
    document.addEventListener('touchend', RS.onResizeEndTouch, _touchOptions);
  };

  /**
   * Bewegt die Resize-Grenzen während des Vorgangs.
   * @param {Event} e
   */
  export function _doResizeUpdate() {
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

  export function onResizeMove(e) {
    const rs = S.get('resizeState');
    if (!rs) return;
    e.preventDefault();
    const raw = getPointerPos(e);
    const dx = raw.x - rs.startX;
    const dy = raw.y - rs.startY;
    const dl = dx / rs.scale;
    const dt = dy / rs.scale;

    const handle = rs.handle;
    let nl = rs.origLeft;
    let nt = rs.origTop;
    let nw = rs.origWidth;
    let nh = rs.origHeight;

    if (handle.indexOf('e') >= 0) nw = Math.max(MIN_ROOM_SIZE, rs.origWidth + dl);
    if (handle.indexOf('w') >= 0) {
      nw = Math.max(MIN_ROOM_SIZE, rs.origWidth - dl);
      nl = rs.origLeft + rs.origWidth - nw;
    }
    if (handle.indexOf('s') >= 0) nh = Math.max(MIN_ROOM_SIZE, rs.origHeight + dt);
    if (handle.indexOf('n') >= 0) {
      nh = Math.max(MIN_ROOM_SIZE, rs.origHeight - dt);
      nt = rs.origTop + rs.origHeight - nh;
    }

    // Grenzenprüfung: Positionen dürfen nicht negativ werden
    nl = Math.max(0, nl);
    nt = Math.max(0, nt);

    // Store raw values (cheap – runs every event)
    rs.currentLeft = nl;
    rs.currentTop = nt;
    rs.currentWidth = nw;
    rs.currentHeight = nh;

    // Throttle DOM writes to rAF (max once per frame)
    if (!_resizeRafPending) {
      _resizeRafPending = true;
      requestAnimationFrame(_doResizeUpdate);
    }
  };

  /**
   * Touch-Variante von onResizeMove.
   * @param {Event} e
   */
  export function onResizeMoveTouch(e) {
    e.preventDefault();
    onResizeMove(e);
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
    document.removeEventListener('touchmove', RS.onResizeMoveTouch, _touchOptions);
    document.removeEventListener('touchend', RS.onResizeEndTouch, _touchOptions);

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
      room.width = Math.max(MIN_ROOM_SIZE, Math.round(rs.currentWidth));
      room.height = Math.max(MIN_ROOM_SIZE, Math.round(rs.currentHeight));
    }

    rs.saved = true;
    saveData();
    S.set('resizeState', null);
  }

  export function onResizeEnd() { onResizeEndCleanup(); };
  export function onResizeEndTouch() { onResizeEndCleanup(); };

  /**
   * Ermittelt die Pointer-Position über die zentrale utils-Funktion.
   * @param {Event} e
   * @returns {{x:number, y:number}}
   */
