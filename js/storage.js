/**
 * Grundriss Tool – Lokale Speicherung + Cloud-Trigger
 * =====================================================================
 * @module storage
 * @description localStorage als Cache, cloudSync als optionaler Hintergrund-Sync.
 */import { LOCAL_STORAGE_KEY, CLOUD_SYNC_DEBOUNCE } from './constants.js';
import * as S from './state.js';
// Uses window.GR.cloud (lazy)

/** @type {number} Debounce-Timer für Cloud-Save */
  var _saveTimer = null;

  /**
   * Speichert Daten: sofort lokal, debounced in die Cloud.
   */
  export function saveData() {
    saveToLocal();
    debouncedCloudSave();
    S.set('lastSaveTs', Date.now());
  };

  /**
   * Speichert Raumdaten in localStorage (synchron).
   */
  export function saveToLocal() {
    try {
      const rooms = S.get('rooms');
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(rooms));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || (e.code === 22) || (e.message && e.message.indexOf('quota') !== -1)) {
        console.warn('[storage] localStorage quota exceeded — cloud save still active');
        var UI = window.GR.ui;
        if (UI && UI.toast) UI.toast('⚠️ Lokaler Speicher voll. Daten werden nur in der Cloud gespeichert.', 'warning', 4000);
      } else {
        console.error('[storage] saveToLocal error:', e);
        var UI2 = window.GR.ui;
        if (UI2 && UI2.toast) UI2.toast('Speichern fehlgeschlagen', 'error', 2000);
      }
    }
  };

  /**
   * Debounced Cloud-Save – sammelt schnelle Änderungen.
   */
  export function debouncedCloudSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function() {
      cloudSave();
    }, CLOUD_SYNC_DEBOUNCE);
  };

  /** @type {string|null} Timestamp der letzten erfolgreich geladenen Cloud-Daten */
  var _lastCloudLoadTs = null;

  /**
   * Speichert Raumdaten asynchron in die Cloud.
   * Prüft vorher auf neuere Remote-Daten (einfache Konfliktauflösung).
   */
export async function cloudSave() {
    var isAuthenticated = S.get('isAuthenticated');
    var project = S.get('currentProject');

    if (!isAuthenticated || !project) return;

    var rooms = S.get('rooms');

    try {
      // Check for newer remote data before overwriting
      if (project.roomsRowId) {
        var checkResult = await Cloud.getCloudTimestamp(project.roomsRowId);
        if (checkResult.ok && checkResult.updated_at) {
          if (_lastCloudLoadTs && checkResult.updated_at > _lastCloudLoadTs) {
            // Remote is newer than what we last loaded – potential conflict
            console.warn('[storage] Remote data is newer than local. Skipping save to prevent overwrite.');
            S.set('syncStatus', 'error');
            var UI = window.GR.ui;
            if (UI && UI.toast) UI.toast('⚠️ Konflikt: Neuere Daten in der Cloud. Seite neu laden.', 'warning', 5000);
            return;
          }
        }
      }

      var result = await Cloud.saveToCloud(rooms);

      if (result.ok) {
        _lastCloudLoadTs = new Date().toISOString();
        S.set('syncStatus', 'saved');
      } else {
        S.set('syncStatus', 'error');
        console.warn('[storage] Cloud save failed:', result.error);
      }
    } catch (e) {
      S.set('syncStatus', 'error');
      console.warn('[storage] Cloud save exception:', e.message);
    }
  };

  /**
   * Lädt Daten: bevorzugt aus der Cloud, Fallback localStorage.
   * @param {boolean} [forceLocal=false] - Nur lokal laden
   * @returns {Object|null} Raumdaten oder null
   */
export async function loadData(forceLocal) {
    var rooms = null;

    // Versuche Cloud-Laden (wenn eingeloggt und Projekt ausgewählt)
    if (!forceLocal && S.get('isAuthenticated') && S.get('currentProject')) {
      var result = await Cloud.loadFromCloud();
      if (result.ok && result.rooms) {
        rooms = result.rooms;
        _lastCloudLoadTs = new Date().toISOString();
      }
    }

    // Fallback: localStorage
    if (!rooms) {
      rooms = loadFromLocal();
    }

    if (rooms) {
      ensureAllRooms(rooms);
      var hadMigration = S.migrateRooms(rooms);
      // Persist migrated rooms back to localStorage so migration doesn't get lost
      if (hadMigration) {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(rooms));
        } catch (e) { /* noop */ }
      }
    }

    return rooms;
  };

  /**
   * Lädt Raumdaten aus localStorage (synchron).
   * @returns {Object|null}
   */
  export function loadFromLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object' && Object.keys(data).length > 0) return data;
    } catch (e) { /* noop */ }
    return null;
  };

  /**
   * Löscht lokale Daten.
   */
  export function clearLocal() {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (e) { /* noop */ }
  };

  // Toast-Stub (wird von ui.js überschrieben)
