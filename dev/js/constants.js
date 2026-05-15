/**
 * Grundriss Tool – Konstanten
 * =====================================================================
 * @module constants
 * @description Zentrale Konstanten für API-Keys, Maße, Schwellwerte.
 */

/** @type {string} Supabase-Projekt-URL */
export const SUPABASE_URL = window._GR_CONFIG?.SUPABASE_URL || 'https://civkerrcyqgsqqjpccqe.supabase.co';

/** @type {string} Supabase anonymer API-Key */
export const SUPABASE_ANON_KEY = window._GR_CONFIG?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpdmtlcnJjeXFnc3FxanBjY3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzkxNzAsImV4cCI6MjA5MzkxNTE3MH0.Q01QUWnwYm-aDAhbwi-Rb_kBU28s8Rx27J0RUkILY1U';

/** @type {number} Mindestgröße für Räume in Pixeln */
export const MIN_ROOM_SIZE = 20;

/** @type {Object<string,number>} Native Breiten – wird dynamisch überschrieben */
export const NATIVE_WIDTHS = { eg: 1000, og: 800 };

/** @type {string[]} Liste der Etagen-Kürzel – wird dynamisch überschrieben */
export const FLOORS = ['eg', 'og'];

/** @type {number} Maximale Anzahl von Undo-Einträgen */
export const MAX_UNDO = 20;

/** @type {number} Polling-Intervall in ms für Cloud-Sync */
export const SYNC_INTERVAL = 3000;

/** @type {string} localStorage Key für Raumdaten */
export const LOCAL_STORAGE_KEY = 'gR';

/** @type {string} localStorage Key für Intro-Seen-Flag */
export const INTRO_SEEN_KEY = 'gd';

/** @type {string} Supabase Tabellenname */
export const SUPABASE_TABLE = 'rooms';

/** @type {number} Supabase Row-ID – legacy, wird nicht mehr verwendet */
export const SUPABASE_ROW_ID = 1;

// ===================================================================
// Events
// ===================================================================

/** @type {string} Event-Name bei Raum-Änderungen */
export const EVT_ROOMS_CHANGED = 'roomsChanged';

/** @type {string} Event-Name bei Auswahl-Änderungen */
export const EVT_SELECTION_CHANGED = 'selectionChanged';

/** @type {string} Event-Name bei Edit-Mode-Änderungen */
export const EVT_EDIT_MODE_CHANGED = 'editModeChanged';

/** @type {string} Event-Name bei Etagen-Wechsel */
export const EVT_FLOOR_CHANGED = 'floorChanged';

/** @type {string} Event-Name bei Sync-Status */
export const EVT_SYNC_STATUS_CHANGED = 'syncStatusChanged';

/** @type {string} Event-Name bei Auth-Änderungen */
export const EVT_AUTH_CHANGED = 'authChanged';

/** @type {string} Event-Name bei Projekt-Wechsel */
export const EVT_PROJECT_CHANGED = 'projectChanged';

// ===================================================================
// Weitere Konstanten
// ===================================================================

/** @type {number} Drag-Deadzone in px bevor Drag aktiviert wird */
export const DRAG_DEAD_ZONE = 3;

/** @type {string[]} Handle-Richtungen für Resize-Griffe */
export const HANDLE_DIRECTIONS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** @type {number} Cache-Gültigkeit für Skalierungsfaktor in ms */
export const SCALE_CACHE_TTL = 500;

/** @type {number} Debounce-Zeit für Cloud-Sync in ms */
export const CLOUD_SYNC_DEBOUNCE = 500;

/** @type {number} Maximale Anzahl gleichzeitig sichtbarer Toasts */
export const TOAST_MAX_COUNT = 3;

/** @type {number} Debounce-Zeit für Sucheingabe in ms */
export const SEARCH_DEBOUNCE = 200;

// ===================================================================
// Raum-Typen
// ===================================================================

/** @type {Object} Raum-Typen mit Farbzuordnung */
export const ROOM_TYPES = {
  'buero':       { label: 'Büro',           color: '#3b82f6' },
  'besprechung': { label: 'Besprechung',     color: '#8b5cf6' },
  'flur':        { label: 'Flur',            color: '#94a3b8' },
  'kueche':      { label: 'Küche',          color: '#f59e0b' },
  'wc':          { label: 'WC / Bad',        color: '#06b6d4' },
  'lager':       { label: 'Lager',           color: '#78716c' },
  'serverraum':  { label: 'Serverraum',      color: '#64748b' },
  'empfang':     { label: 'Empfang',         color: '#ec4899' },
  'pause':       { label: 'Pausenraum',      color: '#22c55e' },
  'sonstige':    { label: 'Sonstige',        color: '#a3a3a3' }
};

/** @type {string} Standard-Raum-Typ */
export const ROOM_TYPE_DEFAULT = 'sonstige';

// ===================================================================
// Magnetisches Snappen
// ===================================================================

/** @type {number} Snap-Distanz in Pixeln (skaliert) */
export const SNAP_DISTANCE = 8;

/** @type {boolean} Snappen aktiviert */
export const SNAP_ENABLED = true;

// ===================================================================
// Dark Mode
// ===================================================================

/** @type {string} localStorage Key für Dark Mode Preference */
export const DARK_MODE_KEY = 'gr_dark';

// ===================================================================
// Presence
// ===================================================================

/** @type {string} Event-Name bei Presence-Änderung */
export const EVT_PRESENCE_CHANGED = 'presenceChanged';

/** @type {number} Schwellwerte für "Zuletzt bearbeitet"-Anzeige in ms */
export const TIME_THRESHOLD_MINUTE = 60000;
export const TIME_THRESHOLD_HOUR = 3600000;
export const TIME_THRESHOLD_DAY = 86400000;