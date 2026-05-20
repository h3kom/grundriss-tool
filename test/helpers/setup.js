/**
 * Test helper - sets up the window.GR namespace with mocks and real constants
 * so that IIFE-based modules can be loaded and tested in isolation.
 *
 * Modules are loaded by reading their source with node:fs and evaluating
 * via new Function(), which lets us control window.GR before execution.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JS_DIR = resolve(__dirname, '../../js');

/**
 * Reads a JS module file and evaluates it in a context where `window` is provided.
 * This lets IIFE modules attach to our mocked window.GR namespace.
 */
function loadModule(filename) {
  const src = readFileSync(resolve(JS_DIR, filename), 'utf8');
  const fn = new Function('window', src);
  fn(window);
}

/**
 * Creates a fresh window.GR namespace with mock state, storage, ui, and real constants.
 *
 * @param {Object} [opts]
 * @param {Object} [opts.initialRooms={}]  - Rooms to seed into mock state.
 * @param {Object} [opts.initialState={}]  - Additional state overrides.
 * @returns {{ saveDataCalls: number }} Tracker to verify saveData calls.
 */
export function setupGR(opts = {}) {
  const { initialRooms = {}, initialState = {} } = opts;

  // Reset global namespace
  window.GR = {};

  // Inline real constants (avoids importing the IIFE with side-effects)
  window.GR.constants = {
    MIN_ROOM_SIZE: 20,
    NATIVE_WIDTHS: { eg: 1000, og: 800 },
    MAX_UNDO: 20,
    LOCAL_STORAGE_KEY: 'gR',
    INTRO_SEEN_KEY: 'gd',

    EVT_ROOMS_CHANGED: 'roomsChanged',
    EVT_SELECTION_CHANGED: 'selectionChanged',
    EVT_EDIT_MODE_CHANGED: 'editModeChanged',
    EVT_SYNC_STATUS_CHANGED: 'syncStatusChanged',
    EVT_AUTH_CHANGED: 'authChanged',
    EVT_PROJECT_CHANGED: 'projectChanged',

    DRAG_DEAD_ZONE: 3,
    HANDLE_DIRECTIONS: ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'],
    SCALE_CACHE_TTL: 500,
    CLOUD_SYNC_DEBOUNCE: 500,
    TOAST_MAX_COUNT: 3,
    SEARCH_DEBOUNCE: 200,

    ROOM_TYPE_DEFAULT: 'sonstige',
    DARK_MODE_KEY: 'gr_dark',

    TIME_THRESHOLD_MINUTE: 60000,
    TIME_THRESHOLD_HOUR: 3600000,
    TIME_THRESHOLD_DAY: 86400000,
  };

  // Internal state store
  const _store = {
    rooms: initialRooms,
    selectedRoom: null,
    editMode: false,
    overview: false,
    sidebarOpen: false,
    sidebarWasManuallyOpened: false,
    activeFloor: 'eg',
    searchQuery: '',
    currentView: 'auth',
    currentUser: null,
    isAuthenticated: false,
    currentProject: null,
    currentProjectFloors: [],
    lastSaveTs: Date.now(),
    syncStatus: 'idle',
    ...initialState,
  };

  const _listeners = {};
  const tracker = { saveDataCalls: 0 };

  // Mock state
  window.GR.state = {
    get(key, defaultValue) {
      if (key === undefined) return _store;
      return key in _store ? _store[key] : defaultValue;
    },
    set(key, value) {
      _store[key] = value;
    },
    subscribe(event, cb) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(cb);
      return function unsubscribe() {
        const idx = _listeners[event].indexOf(cb);
        if (idx >= 0) _listeners[event].splice(idx, 1);
      };
    },
    notify(event, data) {
      if (!_listeners[event]) return;
      for (const cb of _listeners[event]) cb(data);
    },
  };

  // Mock storage
  window.GR.storage = {
    saveData() {
      tracker.saveDataCalls++;
    },
    saveToLocal() {},
    debouncedCloudSave() {},
  };

  // Mock ui
  window.GR.ui = {
    toasts: [],
    toast(msg, type, duration, undoCb) {
      window.GR.ui.toasts.push({ msg, type, duration, undoCb });
    },
    confirms: [],
    confirm(msg, cb) {
      window.GR.ui.confirms.push({ msg, cb });
    },
  };

  return tracker;
}

/** Loads js/utils.js into the current window.GR namespace. */
export function loadUtilsSync() {
  window.GR.utils = window.GR.utils || {};
  loadModule('utils.js');
}

/** Loads js/rooms.js into the current window.GR namespace. */
export function loadRoomsSync() {
  window.GR.rooms = window.GR.rooms || {};
  loadModule('rooms.js');
}

/** Loads js/export.js into the current window.GR namespace. */
export function loadExportSync() {
  window.GR.exportMod = window.GR.exportMod || {};
  loadModule('export.js');
}

/** Returns the current GR.utils namespace. */
export function getUtils() {
  return window.GR.utils;
}

/** Returns the current GR.rooms namespace. */
export function getRooms() {
  return window.GR.rooms;
}

/** Returns the current GR.exportMod namespace. */
export function getExport() {
  return window.GR.exportMod;
}
