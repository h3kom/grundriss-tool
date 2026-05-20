/**
 * Grundriss Tool – Interaktions-Bridge
 * =====================================================================
 * @module interaction
 * @description Brücke zwischen renderer.js und den drag/resize Modulen.
 */
window.GR = window.GR || {};

(function(I) {
  'use strict';

  function D() { return window.GR.drag; }
  function RS() { return window.GR.resize; }

  I.startDrag = function(e, key) { var d = D(); if (d) d.startDrag(e, key); };
  I.startResize = function(e, key, handle) { var r = RS(); if (r) r.startResize(e, key, handle); };
})(window.GR.interaction = window.GR.interaction || {});
