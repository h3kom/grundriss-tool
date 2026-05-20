/**
 * Grundriss Tool – State Management
 * =====================================================================
 * @module state
 * @description Zentraler State mit Pub/Sub-Event-System.
 */
window.GR = window.GR || {};

(function(S) {
  'use strict';

  const C = window.GR.constants;
  const listeners = {};

  /**
   * Aktuelle Daten-Migrations-Version.
   * Wird erhöht, wenn neue Felder in rooms[] benötigt werden.
   * @type {number}
   */
  const DATA_VERSION = 2;

  /** @const {string} localStorage Key für Daten-Versionsnummer */
  const DATA_VERSION_KEY = 'gr_data_version';

  /**
   * Führt versionierte Daten-Migrationen auf allen Räumen durch.
   * Wird nur ausgeführt, wenn sich DATA_VERSION erhöht hat.
   * @param {Object<string,Object>} rooms
   */
  function migrateRooms(rooms) {
    if (!rooms || typeof rooms !== 'object') return false;
    // Prüfe, ob Migration überhaupt nötig ist
    const storedVersion = parseInt(localStorage.getItem(DATA_VERSION_KEY) || '0', 10);
    if (storedVersion >= DATA_VERSION) return false;
    for (const key of Object.keys(rooms)) {
      const room = rooms[key];
      if (!room.comments) room.comments = [];
      if (!room.done) room.done = {};
    }
    // Version persistieren, damit Migration nicht bei jedem Laden läuft
    try { localStorage.setItem(DATA_VERSION_KEY, String(DATA_VERSION)); } catch (e) { /* noop */ }
    return true;
  }

  const _state = {
    // === Auth & User ===
    currentUser: null,
    isAuthenticated: false,

    // === Project ===
    currentProject: null,        // { id, name, ownerId, roomsRowId }
    currentProjectFloors: [],    // [{ id, name, imageUrl, nativeWidth, sortOrder }]

    // === Rooms ===
    rooms: {},
    selectedRoom: null,
    editMode: false,
    overview: false,

    // === UI ===
    sidebarOpen: false,
    sidebarWasManuallyOpened: false,
    activeFloor: 'eg',
    searchQuery: '',
    currentView: 'auth',        // 'auth' | 'dashboard' | 'editor'

    // === Interaction ===
    dragState: null,
    resizeState: null,
    isPlacing: false,
    placeFloor: null,
    placeState: null,
    placeRoomType: null,

    // === Sync ===
    debounceTimer: null,
    lastSaveTs: Date.now(),
    undoStack: [],
    syncStatus: 'idle'
  };

  /**
   * Gibt einen State-Wert, das gesamte State-Objekt oder einen Default-Wert zurück.
   * @param {string} [key] - Schlüssel oder undefined für das ganze Objekt
   * @param {*} [defaultValue] - Fallback-Wert, wenn key nicht in _state existiert
   * @returns {*}
   */
  S.get = function(key, defaultValue) {
    if (key === undefined) return _state;
    return key in _state ? _state[key] : defaultValue;
  };

  /**
   * Setzt einen State-Wert und benachrichtigt Abonnenten.
   * @param {string} key - Schlüssel
   * @param {*} value - Neuer Wert
   */
  S.set = function(key, value) {
    if (!(key in _state)) {
      console.warn(`[state] Unknown key "${key}" ignored by set()`);
      return;
    }
    const old = _state[key];
    _state[key] = value;
    // Automatische Events für bekannte Schlüssel
    if (key === 'editMode' && old !== value) {
      S.notify(C.EVT_EDIT_MODE_CHANGED, value);
    }
    if (key === 'selectedRoom' && old !== value) {
      S.notify(C.EVT_SELECTION_CHANGED, value);
    }
    if (key === 'syncStatus' && old !== value) {
      S.notify(C.EVT_SYNC_STATUS_CHANGED, value);
    }
  };

  // ===================================================================
  // Event-System
  // ===================================================================

  /**
   * Abonniert ein Event.
   * @param {string} event - Event-Name (z. B. 'roomsChanged')
   * @param {Function} callback - Wird beim Event ausgeführt
   * @returns {Function} unsubscribe-Funktion
   */
  S.subscribe = function(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
    return function unsubscribe() {
      const idx = listeners[event].indexOf(callback);
      if (idx >= 0) listeners[event].splice(idx, 1);
    };
  };

  /**
   * Feuert ein Event an alle Abonnenten.
   * @param {string} event - Event-Name
   * @param {*} [data] - Optionale Daten
   */
  S.notify = function(event, data) {
    const evtListeners = listeners[event];
    if (!evtListeners) return;
    for (const cb of evtListeners) {
      try {
        cb(data);
      } catch (e) {
        console.error(`[state] Error in listener for "${event}":`, e);
      }
    }
  };

  // ===================================================================
  // Undo
  // ===================================================================

  /** Unique ID counter for undo entries */
  var _undoCounter = 0;

  /**
   * Push an undo callback (with max limit).
   * @param {Function} callback - Rückgängig-Funktion
   * @returns {number} Unique undo ID
   */
  S.pushUndo = function(callback) {
    var id = ++_undoCounter;
    _state.undoStack.push({ id: id, fn: callback });
    if (_state.undoStack.length > C.MAX_UNDO) _state.undoStack.shift();
    return id;
  };

  /**
   * Get undo callback by ID.
   * @param {number} id - Undo ID
   * @returns {Function|null}
   */
  S.getUndo = function(id) {
    var entry = _state.undoStack.find(function(e) { return e.id === id; });
    return entry ? entry.fn : null;
  };

  /**
   * Removes an undo entry by ID (consumed).
   * @param {number} id - Undo ID
   */
  S.clearUndo = function(id) {
    var idx = _state.undoStack.findIndex(function(e) { return e.id === id; });
    if (idx >= 0) _state.undoStack.splice(idx, 1);
  };

  // Export migration for storage module
  S.migrateRooms = migrateRooms;
})(window.GR.state = window.GR.state || {});