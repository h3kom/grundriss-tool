/**
 * Grundriss Tool – Drag-Interaktion (Räume verschieben)
 * =====================================================================
 * @module drag
 * @description Ermöglicht das Verschieben von Räumen per Maus/Touch im Edit-Mode.
 */
window.GR = window.GR || {};

(function(D) {
  'use strict';

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
    const scale = U.getScale(wrapper);
    const rooms = S.get('rooms');

    S.set('dragState', {
      key,
      wrapper,
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
      if (Math.sqrt(dx * dx + dy * dy) < 3) return;
      ds.isDragging = true;
      e.preventDefault();
      if (ds.element) {
        ds.element.classList.add('dg');
        ds.element._wasDragged = true;
      }
    } else {
      if (ds.isDragging) e.preventDefault();
    }

    const el = document.querySelector(`.ro[data-key="${ds.key}"]`);
    if (el) {
      const scale = U.getScale(ds.wrapper);
      el.style.left = `${Math.round(ds.origLeft * scale + dx)}px`;
      el.style.top = `${Math.round(ds.origTop * scale + dy)}px`;
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

    const el = document.querySelector(`.ro[data-key="${ds.key}"]`);
    if (!el) {
      S.set('dragState', null);
      return;
    }

    const scale = U.getScale(ds.wrapper);
    const newLeft = Math.round(parseInt(el.style.left) / scale);
    const newTop = Math.round(parseInt(el.style.top) / scale);

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
   * Ermittelt die Pointer-Position aus einem Mouse- oder Touch-Event.
   * @param {Event} e
   * @returns {{x:number, y:number}}
   */
  D.getPointerPos = function(e) {
    const touch = e.touches;
    if (touch && touch.length > 0) {
      return { x: touch[0].clientX, y: touch[0].clientY };
    }
    // Fallback for TouchEvent without touches (e.g. touchend)
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };
})(window.GR.drag = window.GR.drag || {});