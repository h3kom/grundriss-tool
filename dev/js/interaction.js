/**
 * Grundriss Tool – Interaktions-Bridge
 * =====================================================================
 * @module interaction
 * @description Brücke zwischen den alten Aufrufkonventionen (window.GR.interaction.*)
 * und den neuen aufgeteilten Modulen drag, resize, placeRoom.
 * Dient als Rückwärtskompatibilität für onclick-Attribute im HTML.
 */import { MIN_ROOM_SIZE } from './constants.js';
// Uses window.GR.drag, window.GR.resize, window.GR.placeRoom, window.GR.renderer (lazy)

// Lazy references – modules may load AFTER this file
  function D() { return window.GR.drag; }
  function RS() { return window.GR.resize; }
  function PR() { return window.GR.placeRoom; }

  // Delegierte Funktionen
  export function startDrag(e, key) { var d = D(); if (d) d.startDrag(e, key); };
  export function onDragMove(e) { var d = D(); if (d) d.onDragMove(e); };
  export function onDragMoveTouch(e) { var d = D(); if (d) d.onDragMoveTouch(e); };
  export function onDragEnd() { var d = D(); if (d) d.onDragEnd(); };
  export function onDragEndTouch() { var d = D(); if (d) d.onDragEndTouch(); };

  export function startResize(e, key, handle) { var r = RS(); if (r) r.startResize(e, key, handle); };
  export function onResizeMove(e) { var r = RS(); if (r) r.onResizeMove(e); };
  export function onResizeMoveTouch(e) { var r = RS(); if (r) r.onResizeMoveTouch(e); };
  export function onResizeEnd() { var r = RS(); if (r) r.onResizeEnd(); };
  export function onResizeEndTouch() { var r = RS(); if (r) r.onResizeEndTouch(); };

  export function enablePlaceNewRoom(floor, roomType) { var p = PR(); if (p) p.enablePlaceNewRoom(floor, roomType); };
  export function cancelPlaceNewRoom() { var p = PR(); if (p) p.cancelPlaceNewRoom(); };
  export function removePlacePreview() { var p = PR(); if (p) p.removePlacePreview(); };
  export function startPlaceDraw(e) { var p = PR(); if (p) p.startPlaceDraw(e); };
  export function onPlaceDrawMove(e) { var p = PR(); if (p) p.onPlaceDrawMove(e); };
  export function onPlaceDrawMoveTouch(e) { var p = PR(); if (p) p.onPlaceDrawMoveTouch(e); };
  export function onPlaceDrawEnd() { var p = PR(); if (p) p.onPlaceDrawEnd(); };
  export function onPlaceDrawEndTouch() { var p = PR(); if (p) p.onPlaceDrawEndTouch(); };
  export function finishPlaceDraw() { var p = PR(); if (p) p.finishPlaceDraw(); };

  /**
   * Ermittelt die Pointer-Position über die zentrale utils-Funktion.
   * @param {Event} e
   * @returns {{x:number, y:number}}
   */
  export function getPointerPos(e) {
    if (u && u.getPointerPos) return u.getPointerPos(e);
    // Fallback wenn utils noch nicht geladen
    return { x: e.clientX, y: e.clientY };
  };
