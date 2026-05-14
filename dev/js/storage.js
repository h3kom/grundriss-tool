/**
 * Grundriss Tool – Lokale Speicherung + Cloud-Trigger
 * =====================================================================
 * @module storage
 * @description localStorage als Cache, cloudSync als optionaler Hintergrund-Sync.
 */
window.GR = window.GR || {};

(function(St) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const Cloud = window.GR.cloud;
  const U = window.GR.utils;

  /** @type {number} Debounce-Timer für Cloud-Save */
  var _saveTimer = null;

  /**
   * Speichert Daten: sofort lokal, debounced in die Cloud.
   */
  St.saveData = function() {
    St.saveToLocal();
    St.debouncedCloudSave();
    S.set('lastSaveTs', Date.now());
  };

  /**
   * Speichert Raumdaten in localStorage (synchron).
   */
  St.saveToLocal = function() {
    try {
      const rooms = S.get('rooms');
      localStorage.setItem(C.LOCAL_STORAGE_KEY, JSON.stringify(rooms));
    } catch (e) {
      if (St.toast) St.toast('Speichern fehlgeschlagen', 'error', 2000);
    }
  };

  /**
   * Debounced Cloud-Save – sammelt schnelle Änderungen.
   */
  St.debouncedCloudSave = function() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function() {
      St.cloudSave();
    }, C.CLOUD_SYNC_DEBOUNCE);
  };

  /**
   * Speichert Raumdaten asynchron in die Cloud.
   */
  St.cloudSave = async function() {
    var Auth = window.GR.auth;
    var isAuthenticated = S.get('isAuthenticated');
    var project = S.get('currentProject');

    if (!isAuthenticated || !project) return;

    var rooms = S.get('rooms');
    var result = await Cloud.saveToCloud(rooms);

    if (result.ok) {
      S.set('syncStatus', 'saved');
    } else {
      S.set('syncStatus', 'error');
      console.warn('[storage] Cloud save failed:', result.error);
    }
  };

  /**
   * Lädt Daten: bevorzugt aus der Cloud, Fallback localStorage.
   * @param {boolean} [forceLocal=false] - Nur lokal laden
   * @returns {Object|null} Raumdaten oder null
   */
  St.loadData = async function(forceLocal) {
    var rooms = null;

    // Versuche Cloud-Laden (wenn eingeloggt und Projekt ausgewählt)
    if (!forceLocal && S.get('isAuthenticated') && S.get('currentProject')) {
      var result = await Cloud.loadFromCloud();
      if (result.ok && result.rooms) {
        rooms = result.rooms;
      }
    }

    // Fallback: localStorage
    if (!rooms) {
      rooms = St.loadFromLocal();
    }

    if (rooms) {
      U.ensureAllRooms(rooms);
      var hadMigration = S.migrateRooms(rooms);
      // Persist migrated rooms back to localStorage so migration doesn't get lost
      if (hadMigration) {
        try {
          localStorage.setItem(C.LOCAL_STORAGE_KEY, JSON.stringify(rooms));
        } catch (e) { /* noop */ }
      }
    }

    return rooms;
  };

  /**
   * Lädt Raumdaten aus localStorage (synchron).
   * @returns {Object|null}
   */
  St.loadFromLocal = function() {
    try {
      const raw = localStorage.getItem(C.LOCAL_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object' && Object.keys(data).length > 0) return data;
    } catch (e) { /* noop */ }
    return null;
  };

  /**
   * Löscht lokale Daten.
   */
  St.clearLocal = function() {
    try {
      localStorage.removeItem(C.LOCAL_STORAGE_KEY);
    } catch (e) { /* noop */ }
  };

  // Toast-Stub (wird von ui.js überschrieben)
  St.toast = null;

})(window.GR.storage = window.GR.storage || {});