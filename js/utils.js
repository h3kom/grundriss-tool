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
    // String-basiertes Escaping – performanter als DOM-Element-Erstellung
    return String(str).replace(/[&<>"']/g, function(ch) {
      return { '&': '\x26amp;', '<': '\x26lt;', '>': '\x26gt;', '"': '\x26quot;', "'": '\x26#39;' }[ch];
    });
  };

  /**
   * Escaped einen String für die sichere Verwendung in HTML-Attributen.
   * Schützt gegen Injection in onclick/data-Attribute.
   * @param {string} str - Roher String
   * @returns {string} Escapeter String
   */
  U.escAttr = function(str) {
    if (str == null) return '';
    return String(str).replace(/[&"'<>]/g, function(ch) {
      return { '&': '\x26amp;', '"': '\x26quot;', "'": '\x26#39;', '<': '\x26lt;', '>': '\x26gt;' }[ch];
    });
  };

  /**
   * Validiert, dass ein Raum-Key nur sichere Zeichen enthält.
   * Verhindert Injection über Raum-Schlüssel.
   * @param {string} key - Zu prüfender Schlüssel
   * @returns {boolean} True wenn der Key sicher ist
   */
  U.isValidKey = function(key) {
    return typeof key === 'string' && /^[a-zA-Z0-9_\-]+$/.test(key);
  };

  /**
   * Formatiert die "Zuletzt bearbeitet"-Anzeige.
   * Zentralisiert, um Duplikate in detail-renderer und overview-renderer zu vermeiden.
   * @param {number} lastSaveTs - Timestamp der letzten Speicherung
   * @returns {string} Formatierte Zeitanzeige
   */
  U.formatLastEdit = function(lastSaveTs) {
    const C = window.GR.constants;
    const delta = Date.now() - lastSaveTs;
    if (delta < C.TIME_THRESHOLD_MINUTE) return 'Gerade eben';
    if (delta < C.TIME_THRESHOLD_HOUR) return 'Vor ' + Math.round(delta / C.TIME_THRESHOLD_MINUTE) + ' Min.';
    if (delta < C.TIME_THRESHOLD_DAY) return 'Vor ' + Math.round(delta / C.TIME_THRESHOLD_HOUR) + ' Std.';
    return new Date(lastSaveTs).toLocaleDateString('de-DE');
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
   * Cache für Skalierungsfaktoren pro Etagen-Wrapper.
   * @type {Map<HTMLElement,{value:number,stamp:number}>}
   */
  const _scaleCache = new Map();

  /**
   * Berechnet den aktuellen Skalierungsfaktor für eine Zeichenfläche.
   * Verwendet einen Cache, der nach SCALE_CACHE_TTL ms ungültig wird (Resize-freundlich).
   * @param {HTMLElement} wrapper - .pw-Wrapper-Element
   * @returns {number} Skalierungsfaktor
   */
  U.getScale = function(wrapper) {
    const C = window.GR.constants;
    if (!wrapper) return 1;
    const cached = _scaleCache.get(wrapper);
    const now = Date.now();
    if (cached && (now - cached.stamp) < C.SCALE_CACHE_TTL) return cached.value;
    const img = wrapper.querySelector('img');
    if (!img) return 1;
    const nativeWidth = C.NATIVE_WIDTHS[U.detectFloorId(wrapper.id)] || 1000;
    const displayWidth = img.getBoundingClientRect().width;
    const value = displayWidth > 0 && nativeWidth > 0 ? displayWidth / nativeWidth : 1;
    _scaleCache.set(wrapper, { value, stamp: now });
    return value;
  };

  /**
   * Ermittelt die Pointer-Position aus einem Mouse- oder Touch-Event.
   * Zentralisiert, damit die Logik nicht in mehreren Modulen dupliziert wird.
   * @param {Event} e - Mouse- oder Touch-Event
   * @returns {{x:number, y:number}} Pointer-Koordinaten
   */
  U.getPointerPos = function(e) {
    const touch = e.touches;
    if (touch && touch.length > 0) {
      return { x: touch[0].clientX, y: touch[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  /**
   * Generiert oder liest eine eindeutige Geräte-ID (UUID) aus dem localStorage.
   * Wird für die Benutzerisolierung bei Supabase-Zeilen verwendet.
   * @returns {string} Geräte-UUID
   */
  U.getDeviceId = function() {
    const KEY = 'gr_device_id';
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = 'd' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(KEY, id);
    }
    return id;
  };
})(window.GR.utils = window.GR.utils || {});