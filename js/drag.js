/**
 * Grundriss Tool – Drag-Interaktion (Räume verschieben)
 * =====================================================================
 * @module drag
 * @description Ermöglicht das Verschieben von Räumen per Maus/Touch im Edit-Mode.
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
   * @param {Event} e - Mouse-/Touch-Event
   * @param {string} key - Raumschlüssel
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
   * Bewegt den Raum während des Drags.
   * @param {Event} e - Mouse-/Touch-Event
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

    var safeKey = U.escAttr(ds.key);
    var el = document.querySelector('.ro[data-key="' + safeKey + '"]');
    if (el) {
      const scale = U.getScale(ds.wrapper);
      el.style.left = Math.round(ds.origLeft * scale + dx) + 'px';
      el.style.top = Math.round(ds.origTop * scale + dy) + 'px';
    }
  };

  /**
   * Touch-Variante von onDragMove.
   * @param {Event} e
   */
  D.onDragMoveTouch = function(e) {
    D.onDragMove(e);
    const ds = S.get('dragState');
    if (ds && ds.isDragging) e.preventDefault();
  };

  /**
   * Beendet den Drag-Vorgang (Aufräumen + Speichern).
   */
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

    var safeKey = U.escAttr(ds.key);
    var el = document.querySelector('.ro[data-key="' + safeKey + '"]');
    if (!el) {
      S.set('dragState', null);
      return;
    }

    const scale = U.getScale(ds.wrapper);
    const newLeft = Math.round(parseInt(el.style.left, 10) / scale);
    const newTop = Math.round(parseInt(el.style.top, 10) / scale);

    const rooms = S.get('rooms');
    if (newLeft !== ds.origLeft || newTop !== ds.origTop) {
      rooms[ds.key].left = newLeft;
      rooms[ds.key].top = newTop;
      ds.saved = true;
      St.saveData();
    }
    S.set('dragState', null);
  }

  D.onDragEnd = function() { onDragEndCleanup(); };
  D.onDragEndTouch = function() { onDragEndCleanup(); };

  /**
   * Ermittelt die Pointer-Position über die zentrale utils-Funktion.
   * @param {Event} e
   * @returns {{x:number, y:number}}
   */
  D.getPointerPos = function(e) {
    return U.getPointerPos(e);
  };
})(window.GR.drag = window.GR.drag || {});