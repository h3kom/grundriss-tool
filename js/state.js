/**
 * Grundriss Tool – Zentrales State-Management mit Event-System
 * =====================================================================
 * @module state
 * @description Verwaltet den globalen Anwendungszustand und feuert Events
 * bei Änderungen, damit Module lose gekoppelt bleiben.
 */
window.GR = window.GR || {};

(function(S) {
  'use strict';

  const C = window.GR.constants;
  const listeners = {};

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
    activeFloor: 'eg'
  };

  /**
   * Gibt einen State-Wert oder das gesamte State-Objekt zurück.
   * @param {string} [key] - Schlüssel oder undefined für das ganze Objekt
   * @returns {*}
   */
  S.get = function(key) {
    return key ? _state[key] : _state;
  };

  /**
   * Setzt einen State-Wert und benachrichtigt Abonnenten.
   * @param {string} key - Schlüssel
   * @param {*} value - Neuer Wert
   */
  S.set = function(key, value) {
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
    Object.assign(_state, obj);
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
   * Set undo entry to null (consumed).
   * @param {number} key - Index
   */
  S.clearUndo = function(key) {
    _state.undoStack[key] = null;
  };
})(window.GR.state = window.GR.state || {});