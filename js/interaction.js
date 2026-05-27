/**
 * Grundriss Tool – Interaktions-Bridge
 * =====================================================================
 * @module interaction
 * @description Bruecke zwischen den alten Aufrufkonventionen (window.GR.interaction.*)
 * und den neuen aufgeteilten Modulen drag, resize, placeRoom.
 * Dient als Rueckwaertskompatibilitaet fuer onclick-Attribute im HTML.
 */
window.GR = window.GR || {};

(function(I) {
  'use strict';

  // Lazy references – modules may load AFTER this file
  function D() { return window.GR.drag; }
  function RS() { return window.GR.resize; }
  function PR() { return window.GR.placeRoom; }

  // Drag: only startDrag is public; move/end are handled by trackPointer internally
  I.startDrag = function(e, key) { var d = D(); if (d) d.startDrag(e, key); };

  // Resize: only startResize is public; move/end are handled by trackPointer internally
  I.startResize = function(e, key, handle) { var r = RS(); if (r) r.startResize(e, key, handle); };

  // Place-Room: public entry points
  I.enablePlaceNewRoom = function(floor, roomType) { var p = PR(); if (p) p.enablePlaceNewRoom(floor, roomType); };
  I.cancelPlaceNewRoom = function() { var p = PR(); if (p) p.cancelPlaceNewRoom(); };
  I.removePlacePreview = function() { var p = PR(); if (p) p.removePlacePreview(); };
  I.startPlaceDraw = function(e) { var p = PR(); if (p) p.startPlaceDraw(e); };
  I.finishPlaceDraw = function() { var p = PR(); if (p) p.finishPlaceDraw(); };

})(window.GR.interaction = window.GR.interaction || {});
