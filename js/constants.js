/**
 * Grundriss Tool – Konstanten
 * =====================================================================
 * @module constants
 * @description Zentrale Konstanten für API-Keys, Maße, Schwellwerte.
 */
window.GR = window.GR || {};

(function(C) {
  'use strict';

  /** @const {string} Supabase-Projekt-URL */
  C.SUPABASE_URL = window._GR_CONFIG?.SUPABASE_URL || 'https://civkerrcyqgsqqjpccqe.supabase.co';

  /** @const {string} Supabase anonymer API-Key */
  C.SUPABASE_ANON_KEY = window._GR_CONFIG?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpdmtlcnJjeXFnc3FxanBjY3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzkxNzAsImV4cCI6MjA5MzkxNTE3MH0.Q01QUWnwYm-aDAhbwi-Rb_kBU28s8Rx27J0RUkILY1U';

  /** @const {number} Mindestgröße für Räume in Pixeln */
  C.MIN_ROOM_SIZE = 20;

  /** @const {Object<string,number>} Native Breiten für jede Etage */
  C.NATIVE_WIDTHS = { eg: 1000, og: 800 };

  /** @const {string[]} Liste der Etagen-Kürzel */
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

  /** @const {number} Supabase Row-ID */
  C.SUPABASE_ROW_ID = 1;

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
})(window.GR.constants = window.GR.constants || {});