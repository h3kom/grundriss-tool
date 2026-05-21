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

  // Lazy references – modules may load AFTER this file
  function D() { return window.GR.drag; }
  function RS() { return window.GR.resize; }
  function PR() { return window.GR.placeRoom; }

  // Delegierte Funktionen
  I.startDrag = function(e, key) { var d = D(); if (d) d.startDrag(e, key); };
  I.onDragMove = function(e) { var d = D(); if (d) d.onDragMove(e); };
  I.onDragMoveTouch = function(e) { var d = D(); if (d) d.onDragMoveTouch(e); };
  I.onDragEnd = function() { var d = D(); if (d) d.onDragEnd(); };
  I.onDragEndTouch = function() { var d = D(); if (d) d.onDragEndTouch(); };

  I.startResize = function(e, key, handle) { var r = RS(); if (r) r.startResize(e, key, handle); };
  I.onResizeMove = function(e) { var r = RS(); if (r) r.onResizeMove(e); };
  I.onResizeMoveTouch = function(e) { var r = RS(); if (r) r.onResizeMoveTouch(e); };
  I.onResizeEnd = function() { var r = RS(); if (r) r.onResizeEnd(); };
  I.onResizeEndTouch = function() { var r = RS(); if (r) r.onResizeEndTouch(); };

  I.enablePlaceNewRoom = function(floor, roomType) { var p = PR(); if (p) p.enablePlaceNewRoom(floor, roomType); };
  I.cancelPlaceNewRoom = function() { var p = PR(); if (p) p.cancelPlaceNewRoom(); };
  I.removePlacePreview = function() { var p = PR(); if (p) p.removePlacePreview(); };
  I.startPlaceDraw = function(e) { var p = PR(); if (p) p.startPlaceDraw(e); };
  I.onPlaceDrawMove = function(e) { var p = PR(); if (p) p.onPlaceDrawMove(e); };
  I.onPlaceDrawMoveTouch = function(e) { var p = PR(); if (p) p.onPlaceDrawMoveTouch(e); };
  I.onPlaceDrawEnd = function() { var p = PR(); if (p) p.onPlaceDrawEnd(); };
  I.onPlaceDrawEndTouch = function() { var p = PR(); if (p) p.onPlaceDrawEndTouch(); };
  I.finishPlaceDraw = function() { var p = PR(); if (p) p.finishPlaceDraw(); };

})(window.GR.interaction = window.GR.interaction || {});
