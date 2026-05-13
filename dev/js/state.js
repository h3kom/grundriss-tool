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
    if (!rooms || typeof rooms !== 'object') return;
    // Prüfe, ob Migration überhaupt nötig ist
    const storedVersion = parseInt(localStorage.getItem(DATA_VERSION_KEY) || '0', 10);
    if (storedVersion >= DATA_VERSION) return;
    for (const key of Object.keys(rooms)) {
      const room = rooms[key];
      if (!room.comments) room.comments = [];
      if (!room.done) room.done = {};
    }
    // Version persistieren, damit Migration nicht bei jedem Laden läuft
    try { localStorage.setItem(DATA_VERSION_KEY, String(DATA_VERSION)); } catch (e) { /* noop */ }
  }

  const _state = {
    rooms: {},
    selectedRoom: null,
    editMode: false,
    overview: false,
    sidebarOpen: false,
    sidebarWasManuallyOpened: false,
    dragState: null,
    resizeState: null,
    isPlacing: false,
    placeFloor: null,
    placeState: null,
    debounceTimer: null,
    lastSaveTs: Date.now(),
    undoStack: [],
    syncStatus: 'idle',
    serverStamp: 0,
    pollInterval: null,
    isSyncing: false,
    saveTimeout: null,
    activeFloor: 'eg',
    searchQuery: ''
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
    // Nur bekannte State-Keys setzen, sonst Warnung
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
    if (key === 'activeFloor' && old !== value) {
      S.notify(C.EVT_FLOOR_CHANGED, value);
    }
    if (key === 'selectedRoom' && old !== value) {
      S.notify(C.EVT_SELECTION_CHANGED, value);
    }
    if (key === 'syncStatus' && old !== value) {
      S.notify(C.EVT_SYNC_STATUS_CHANGED, value);
    }
  };

  /**
   * Führt ein partielles Merge mit dem State aus und feuert roomsChanged.
   * @param {Object} obj - Teilzustand (z. B. { rooms: ... })
   */
  S.notifyRoomsChanged = function() {
    S.notify(C.EVT_ROOMS_CHANGED);
  };

  /**
   * Merged mehrere Werte auf einmal in den State (ohne Events, außer man ruft notify auf).
   * @param {Object} obj - Partial-Objekt
   */
  S.merge = function(obj) {
    const old = {};
    for (const key of Object.keys(obj)) {
      old[key] = _state[key];
    }
    Object.assign(_state, obj);
    // Feuert Events für bekannte Schlüssel
    for (const key of Object.keys(obj)) {
      if (old[key] !== obj[key]) {
        if (key === 'editMode') S.notify(C.EVT_EDIT_MODE_CHANGED, obj[key]);
        if (key === 'activeFloor') S.notify(C.EVT_FLOOR_CHANGED, obj[key]);
        if (key === 'selectedRoom') S.notify(C.EVT_SELECTION_CHANGED, obj[key]);
        if (key === 'syncStatus') S.notify(C.EVT_SYNC_STATUS_CHANGED, obj[key]);
        if (key === 'rooms') S.notify(C.EVT_ROOMS_CHANGED);
      }
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

  /**
   * Push an undo callback (with max limit).
   * @param {Function} callback - Rückgängig-Funktion
   */
  S.pushUndo = function(callback) {
    _state.undoStack.push(callback);
    if (_state.undoStack.length > C.MAX_UNDO) _state.undoStack.shift();
  };

  /**
   * Get undo callback by key.
   * @param {number} key - Index
   * @returns {Function|null}
   */
  S.getUndo = function(key) {
    return _state.undoStack[key];
  };

  /**
   * Removes an undo entry completely (consumed).
   * Verwendet splice statt null-Setzung, um Memory-Leaks zu vermeiden.
   * @param {number} key - Index
   */
  S.clearUndo = function(key) {
    _state.undoStack.splice(key, 1);
  };

  // Export migration for storage module
  S.migrateRooms = migrateRooms;
})(window.GR.state = window.GR.state || {});