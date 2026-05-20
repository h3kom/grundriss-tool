/**
 * Grundriss Tool – Konstanten
 * =====================================================================
 * @module constants
 * @description Zentrale Konstanten für API-Keys, Maße, Schwellwerte.
 */
window.GR = window.GR || {};

(function(C) {
  'use strict';

  /** @const {string} Supabase-Projekt-URL (fallback wenn config.local.js fehlt) */
  C.SUPABASE_URL = (window._GR_CONFIG && window._GR_CONFIG.SUPABASE_URL) || 'https://adxhzolvqxgrswttnaga.supabase.co';

  /** @const {string} Supabase anonymer API-Key (fallback wenn config.local.js fehlt) */
  C.SUPABASE_ANON_KEY = (window._GR_CONFIG && window._GR_CONFIG.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkeGh6b2x2cXhncnN3dHRuYWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTExNjUsImV4cCI6MjA5NDE2NzE2NX0.-iDqxI7rbOjqcaWwn0qo1znj18tkbl3KXmFURF6rh1k';

  /** @const {number} Mindestgröße für Räume in Pixeln */
  C.MIN_ROOM_SIZE = 20;

  /** @const {Object<string,number>} Native Breiten – wird dynamisch überschrieben */
  C.NATIVE_WIDTHS = { eg: 1000, og: 800 };

  /** @const {string[]} Liste der Etagen-Kürzel – wird dynamisch überschrieben */
  C.FLOORS = ['eg', 'og'];

  /** @const {number} Maximale Anzahl von Undo-Einträgen */
  C.MAX_UNDO = 20;

  /** @const {number} Polling-Intervall in ms für Cloud-Sync */
  C.SYNC_INTERVAL = 3000;

  /** @const {string} localStorage Key für Raumdaten */
  C.LOCAL_STORAGE_KEY = 'gR';

  /** @const {string} localStorage Key für Intro-Seen-Flag */
  C.INTRO_SEEN_KEY = 'gd';

  /** @const {string} Supabase Tabellenname */
  C.SUPABASE_TABLE = 'rooms';

  /** @const {number} Supabase Row-ID – legacy, wird nicht mehr verwendet */
  C.SUPABASE_ROW_ID = 1;

  // ===================================================================
  // Events
  // ===================================================================

  /** @const {string} Event-Name bei Raum-Änderungen */
  C.EVT_ROOMS_CHANGED = 'roomsChanged';

  /** @const {string} Event-Name bei Auswahl-Änderungen */
  C.EVT_SELECTION_CHANGED = 'selectionChanged';

  /** @const {string} Event-Name bei Edit-Mode-Änderungen */
  C.EVT_EDIT_MODE_CHANGED = 'editModeChanged';

  /** @const {string} Event-Name bei Etagen-Wechsel */
  C.EVT_FLOOR_CHANGED = 'floorChanged';

  /** @const {string} Event-Name bei Sync-Status */
  C.EVT_SYNC_STATUS_CHANGED = 'syncStatusChanged';

  /** @const {string} Event-Name bei Auth-Änderungen */
  C.EVT_AUTH_CHANGED = 'authChanged';

  /** @const {string} Event-Name bei View-Wechsel (auth/dashboard/editor) */
  C.EVT_VIEW_CHANGED = 'viewChanged';

  /** @const {string} Event-Name bei Projekt-Wechsel */
  C.EVT_PROJECT_CHANGED = 'projectChanged';

  // ===================================================================
  // Weitere Konstanten
  // ===================================================================

  /** @const {number} Drag-Deadzone in px bevor Drag aktiviert wird */
  C.DRAG_DEAD_ZONE = 3;

  /** @const {string[]} Handle-Richtungen für Resize-Griffe */
  C.HANDLE_DIRECTIONS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  /** @const {number} Cache-Gültigkeit für Skalierungsfaktor in ms */
  C.SCALE_CACHE_TTL = 500;

  /** @const {number} Debounce-Zeit für Cloud-Sync in ms */
  C.CLOUD_SYNC_DEBOUNCE = 500;

  /** @const {number} Maximale Anzahl gleichzeitig sichtbarer Toasts */
  C.TOAST_MAX_COUNT = 3;

  /** @const {number} Debounce-Zeit für Sucheingabe in ms */
  C.SEARCH_DEBOUNCE = 200;

  // ===================================================================
  // Raum-Typen
  // ===================================================================

  /** @const {Object} Raum-Typen mit Farbzuordnung */
  C.ROOM_TYPES = {
    'buero':       { label: 'Büro',           color: '#3b82f6' },
    'besprechung': { label: 'Besprechung',     color: '#8b5cf6' },
    'flur':        { label: 'Flur',            color: '#94a3b8' },
    'kueche':      { label: 'Küche',           color: '#f59e0b' },
    'wc':          { label: 'WC / Bad',        color: '#06b6d4' },
    'lager':       { label: 'Lager',           color: '#78716c' },
    'serverraum':  { label: 'Serverraum',      color: '#64748b' },
    'empfang':     { label: 'Empfang',         color: '#ec4899' },
    'pause':       { label: 'Pausenraum',      color: '#22c55e' },
    'sonstige':    { label: 'Sonstige',        color: '#a3a3a3' }
  };

  /** @const {string} Standard-Raum-Typ */
  C.ROOM_TYPE_DEFAULT = 'sonstige';

  // ===================================================================
  // Magnetisches Snappen
  // ===================================================================

  /** @const {number} Snap-Distanz in Pixeln (skaliert) */
  C.SNAP_DISTANCE = 8;

  /** @const {boolean} Snappen aktiviert */
  C.SNAP_ENABLED = true;

  // ===================================================================
  // Dark Mode
  // ===================================================================

  /** @const {string} localStorage Key für Dark Mode Preference */
  C.DARK_MODE_KEY = 'gr_dark';

  // ===================================================================
  // Presence
  // ===================================================================

  /** @const {string} Event-Name bei Presence-Änderung */
  C.EVT_PRESENCE_CHANGED = 'presenceChanged';

  /** @const {number} Schwellwerte für "Zuletzt bearbeitet"-Anzeige in ms */
  C.TIME_THRESHOLD_MINUTE = 60000;
  C.TIME_THRESHOLD_HOUR = 3600000;
  C.TIME_THRESHOLD_DAY = 86400000;
})(window.GR.constants = window.GR.constants || {});