/**
 * Grundriss Tool – State Management
 * =====================================================================
 * @module state
 * @description Zentraler State mit Pub/Sub-Event-System.
 */
import {
  EVT_ROOMS_CHANGED, EVT_SELECTION_CHANGED, EVT_EDIT_MODE_CHANGED,
  EVT_FLOOR_CHANGED, EVT_SYNC_STATUS_CHANGED, MAX_UNDO
} from './constants.js';

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
  const storedVersion = parseInt(localStorage.getItem(DATA_VERSION_KEY) || '0', 10);
  if (storedVersion >= DATA_VERSION) return false;
  for (const key of Object.keys(rooms)) {
    const room = rooms[key];
    if (!room.comments) room.comments = [];
    if (!room.done) room.done = {};
  }
  try { localStorage.setItem(DATA_VERSION_KEY, String(DATA_VERSION)); } catch (e) { /* noop */ }
  return true;
}

const _state = {
  // === Auth & User ===
  currentUser: null,
  isAuthenticated: false,

  // === Project ===
  currentProject: null,
  currentProjectFloors: [],

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
  currentView: 'auth',

  // === Interaction ===
  dragState: null,
  resizeState: null,
  isPlacing: false,
  placeFloor: null,
  placeState: null,

  // === Sync ===
  debounceTimer: null,
  lastSaveTs: Date.now(),
  undoStack: [],
  syncStatus: 'idle',
  serverStamp: 0,
  pollInterval: null,
  isSyncing: false,
  saveTimeout: null
};

/**
 * Gibt einen State-Wert, das gesamte State-Objekt oder einen Default-Wert zurück.
 * @param {string} [key] - Schlüssel oder undefined für das ganze Objekt
 * @param {*} [defaultValue] - Fallback-Wert, wenn key nicht in _state existiert
 * @returns {*}
 */
export function get(key, defaultValue) {
  if (key === undefined) return _state;
  return key in _state ? _state[key] : defaultValue;
}

/**
 * Setzt einen State-Wert und benachrichtigt Abonnenten.
 * @param {string} key - Schlüssel
 * @param {*} value - Neuer Wert
 */
export function set(key, value) {
  if (!(key in _state)) {
    console.warn(`[state] Unknown key "${key}" ignored by set()`);
    return;
  }
  const old = _state[key];
  _state[key] = value;
  if (key === 'editMode' && old !== value) notify(EVT_EDIT_MODE_CHANGED, value);
  if (key === 'activeFloor' && old !== value) notify(EVT_FLOOR_CHANGED, value);
  if (key === 'selectedRoom' && old !== value) notify(EVT_SELECTION_CHANGED, value);
  if (key === 'syncStatus' && old !== value) notify(EVT_SYNC_STATUS_CHANGED, value);
}

/**
 * Feuert roomsChanged-Event.
 */
export function notifyRoomsChanged() {
  notify(EVT_ROOMS_CHANGED);
}

/**
 * Merged mehrere Werte auf einmal in den State.
 * @param {Object} obj - Partial-Objekt
 */
export function merge(obj) {
  const old = {};
  for (const key of Object.keys(obj)) {
    old[key] = _state[key];
  }
  Object.assign(_state, obj);
  for (const key of Object.keys(obj)) {
    if (old[key] !== obj[key]) {
      if (key === 'editMode') notify(EVT_EDIT_MODE_CHANGED, obj[key]);
      if (key === 'activeFloor') notify(EVT_FLOOR_CHANGED, obj[key]);
      if (key === 'selectedRoom') notify(EVT_SELECTION_CHANGED, obj[key]);
      if (key === 'syncStatus') notify(EVT_SYNC_STATUS_CHANGED, obj[key]);
      if (key === 'rooms') notify(EVT_ROOMS_CHANGED);
    }
  }
}

// ===================================================================
// Event-System
// ===================================================================

/**
 * Abonniert ein Event.
 * @param {string} event - Event-Name
 * @param {Function} callback - Wird beim Event ausgeführt
 * @returns {Function} unsubscribe-Funktion
 */
export function subscribe(event, callback) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);
  return function unsubscribe() {
    const idx = listeners[event].indexOf(callback);
    if (idx >= 0) listeners[event].splice(idx, 1);
  };
}

/**
 * Feuert ein Event an alle Abonnenten.
 * @param {string} event - Event-Name
 * @param {*} [data] - Optionale Daten
 */
export function notify(event, data) {
  const evtListeners = listeners[event];
  if (!evtListeners) return;
  for (const cb of evtListeners) {
    try {
      cb(data);
    } catch (e) {
      console.error(`[state] Error in listener for "${event}":`, e);
    }
  }
}

// ===================================================================
// Undo
// ===================================================================

var _undoCounter = 0;

/**
 * Push an undo callback (with max limit).
 * @param {Function} callback - Rückgängig-Funktion
 * @returns {number} Unique undo ID
 */
export function pushUndo(callback) {
  var id = ++_undoCounter;
  _state.undoStack.push({ id: id, fn: callback });
  if (_state.undoStack.length > MAX_UNDO) _state.undoStack.shift();
  return id;
}

/**
 * Get undo callback by ID.
 * @param {number} id - Undo ID
 * @returns {Function|null}
 */
export function getUndo(id) {
  var entry = _state.undoStack.find(function(e) { return e.id === id; });
  return entry ? entry.fn : null;
}

/**
 * Removes an undo entry by ID (consumed).
 * @param {number} id - Undo ID
 */
export function clearUndo(id) {
  var idx = _state.undoStack.findIndex(function(e) { return e.id === id; });
  if (idx >= 0) _state.undoStack.splice(idx, 1);
}

export { migrateRooms };