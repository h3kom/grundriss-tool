/**
 * Grundriss Tool – Interaktions-Bridge
 * =====================================================================
 * @module interaction
 * @description Brücke zwischen den alten Aufrufkonventionen (window.GR.interaction.*)
 * und den neuen aufgeteilten Modulen drag, resize, placeRoom.
 * Dient als Rückwärtskompatibilität für onclick-Attribute im HTML.
 */
window.GR = window.GR || {};

(function(I) {
  'use strict';

  const D = window.GR.drag;
  const RS = window.GR.resize;
  const PR = window.GR.placeRoom;

  // Delegierte Funktionen
  I.startDrag = function(e, key) { if (D) D.startDrag(e, key); };
  I.onDragMove = function(e) { if (D) D.onDragMove(e); };
  I.onDragMoveTouch = function(e) { if (D) D.onDragMoveTouch(e); };
  I.onDragEnd = function() { if (D) D.onDragEnd(); };
  I.onDragEndTouch = function() { if (D) D.onDragEndTouch(); };

  I.startResize = function(e, key, handle) { if (RS) RS.startResize(e, key, handle); };
  I.onResizeMove = function(e) { if (RS) RS.onResizeMove(e); };
  I.onResizeMoveTouch = function(e) { if (RS) RS.onResizeMoveTouch(e); };
  I.onResizeEnd = function() { if (RS) RS.onResizeEnd(); };
  I.onResizeEndTouch = function() { if (RS) RS.onResizeEndTouch(); };

  I.enablePlaceNewRoom = function(floor) { if (PR) PR.enablePlaceNewRoom(floor); };
  I.cancelPlaceNewRoom = function() { if (PR) PR.cancelPlaceNewRoom(); };
  I.removePlacePreview = function() { if (PR) PR.removePlacePreview(); };
  I.startPlaceDraw = function(e) { if (PR) PR.startPlaceDraw(e); };
  I.onPlaceDrawMove = function(e) { if (PR) PR.onPlaceDrawMove(e); };
  I.onPlaceDrawMoveTouch = function(e) { if (PR) PR.onPlaceDrawMoveTouch(e); };
  I.onPlaceDrawEnd = function() { if (PR) PR.onPlaceDrawEnd(); };
  I.onPlaceDrawEndTouch = function() { if (PR) PR.onPlaceDrawEndTouch(); };
  I.finishPlaceDraw = function() { if (PR) PR.finishPlaceDraw(); };

  /**
   * Ermittelt die Pointer-Position aus einem Mouse- oder Touch-Event.
   * @param {Event} e
   * @returns {{x:number, y:number}}
   */
  I.getPointerPos = function(e) {
    const touch = e.touches;
    if (touch && touch.length > 0) {
      return { x: touch[0].clientX, y: touch[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };
})(window.GR.interaction = window.GR.interaction || {});