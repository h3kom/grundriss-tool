// Grundriss Tool – Zentrales State-Management
// =====================================================================
window.GR = window.GR || {};

(function(S) {
  const C = window.GR.constants;

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

  // Public getter
  S.get = function(key) {
    return key ? _state[key] : _state;
  };

  // Public setter (with optional callback)
  S.set = function(key, value) {
    _state[key] = value;
  };

  // Merge partial state
  S.merge = function(obj) {
    Object.assign(_state, obj);
  };

  // Push undo callback (with max limit)
  S.pushUndo = function(callback) {
    _state.undoStack.push(callback);
    if (_state.undoStack.length > C.MAX_UNDO) _state.undoStack.shift();
  };

  // Get undo callback by key
  S.getUndo = function(key) {
    return _state.undoStack[key];
  };

  // Set undo entry to null (consumed)
  S.clearUndo = function(key) {
    _state.undoStack[key] = null;
  };
})(window.GR.state = window.GR.state || {});