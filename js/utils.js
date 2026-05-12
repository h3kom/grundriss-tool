/**
 * Grundriss Tool – Gemeinsame Hilfsfunktionen
 * =====================================================================
 * @module utils
 * @description Stellt duplikatsfreie Utility-Funktionen für alle Module bereit.
 */
window.GR = window.GR || {};

(function(U) {
  'use strict';

  /**
   * Stellt sicher, dass ein Raum-Objekt die benötigten Felder hat.
   * @param {Object} room - Raum-Objekt
   * @returns {Object} Das modifizierte Raum-Objekt
   */
  U.ensureRoomFields = function(room) {
    if (!room.comments) room.comments = [];
    if (!room.done) room.done = {};
    return room;
  };

  /**
   * Stellt für alle Räume die benötigten Felder sicher.
   * @param {Object<string,Object>} rooms - Räume-Objekt
   */
  U.ensureAllRooms = function(rooms) {
    for (const key of Object.keys(rooms)) {
      U.ensureRoomFields(rooms[key]);
    }
  };

  /**
   * Zählt erledigte Aufgaben eines Raums.
   * @param {Object} room - Raum-Objekt
   * @returns {number} Anzahl erledigter Aufgaben
   */
  U.completedTaskCount = function(room) {
    if (!room.done) return 0;
    return Object.values(room.done).filter(Boolean).length;
  };

  /**
   * Berechnet den Aufgaben-Fortschritt eines Raums.
   * @param {Object} room - Raum-Objekt
   * @returns {{done:number, total:number, percent:number}}
   */
  U.taskProgress = function(room) {
    const done = U.completedTaskCount(room);
    const total = room.tasks ? room.tasks.length : 0;
    return { done, total, percent: total > 0 ? Math.round(done / total * 100) : 0 };
  };

  /**
   * Deep-Clone eines Objekts via JSON.
   * @param {*} obj - Beliebiges serialisierbares Objekt
   * @returns {*} Tiefenkopie
   */
  U.deepClone = function(obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  /**
   * Escaped HTML-Sonderzeichen in einem String.
   * @param {string} str - Roher String
   * @returns {string} Escapeter HTML-String
   */
  U.escHtml = function(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  /**
   * Generiert einen eindeutigen Raumschlüssel.
   * @param {Object<string,Object>} rooms - Aktuelle Räume
   * @returns {string} Eindeutiger Key (z. B. "raum", "raum1", …)
   */
  U.generateKey = function(rooms) {
    const baseKey = 'raum';
    let key = baseKey;
    let i = 1;
    while (rooms[key]) {
      key = baseKey + i;
      i++;
    }
    return key;
  };

  /**
   * Ermittelt die Etagen-ID aus einem String.
   * @param {string} [id] - Beliebiger Identifikator
   * @returns {string} 'eg' oder 'og'
   */
  U.detectFloorId = function(id) {
    if (!id) return 'eg';
    const lower = id.toLowerCase();
    if (lower === 'og' || lower.startsWith('og') || lower.includes('-og') || lower.includes('_og')) return 'og';
    return 'eg';
  };

  /**
   * Berechnet den aktuellen Skalierungsfaktor für eine Zeichenfläche.
   * @param {HTMLElement} wrapper - .pw-Wrapper-Element
   * @returns {number} Skalierungsfaktor
   */
  U.getScale = function(wrapper) {
    const C = window.GR.constants;
    if (!wrapper) return 1;
    const img = wrapper.querySelector('img');
    if (!img) return 1;
    const nativeWidth = C.NATIVE_WIDTHS[U.detectFloorId(wrapper.id)] || 1000;
    const displayWidth = img.getBoundingClientRect().width;
    return displayWidth > 0 && nativeWidth > 0 ? displayWidth / nativeWidth : 1;
  };
})(window.GR.utils = window.GR.utils || {});