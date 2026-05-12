/**
 * Grundriss Tool – Lokale Datenpersistenz (localStorage) + Init-Logik
 * =====================================================================
 * @module storage
 * @description Lädt und speichert Raumdaten lokal, delegiert Cloud-Operationen
 * an cloud.js und sync.js.
 */
window.GR = window.GR || {};

(function(St) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const U = window.GR.utils;
  const Cl = window.GR.cloud;
  const Sync = window.GR.sync;

  /**
   * Lädt Daten: zuerst Cloud, dann localStorage als Fallback.
   * @returns {Promise<void>}
   */
  St.loadData = async function() {
    Sync.setSyncStatus('idle');

    const cloudLoaded = await St.loadFromCloud();
    if (cloudLoaded) return;

    const local = localStorage.getItem(C.LOCAL_STORAGE_KEY);
    if (local) {
      try {
        S.set('rooms', JSON.parse(local));
        U.ensureAllRooms(S.get('rooms'));
        return;
      } catch (e) {
        // corrupted – start empty
      }
    }

    S.set('rooms', {});
    St.saveToLocal();
  };

  /**
   * Lädt Daten aus der Cloud.
   * @returns {Promise<boolean>} true bei Erfolg
   */
  St.loadFromCloud = async function() {
    const result = await Cl.fetchData();
    if (result && result.data && Object.keys(result.data).length > 0) {
      S.set('rooms', result.data);
      U.ensureAllRooms(S.get('rooms'));
      S.set('serverStamp', result.updatedAt || Date.now());
      localStorage.setItem(C.LOCAL_STORAGE_KEY, JSON.stringify(S.get('rooms')));
      return true;
    }
    return false;
  };

  /**
   * Speichert Daten lokal und triggert Cloud-Sync.
   */
  St.saveData = function() {
    St.saveToLocal();
    Sync.updateTabBadges();
    S.notify(C.EVT_ROOMS_CHANGED);

    // Debounced Cloud-Sync
    if (S.get('saveTimeout')) clearTimeout(S.get('saveTimeout'));
    const timeout = setTimeout(() => {
      Sync.saveToCloud();
    }, 500);
    S.set('saveTimeout', timeout);
  };

  /**
   * Speichert nur lokal (ohne Cloud).
   */
  St.saveToLocal = function() {
    const now = Date.now();
    S.set('serverStamp', now);
    S.set('lastSaveTs', now);
    localStorage.setItem(C.LOCAL_STORAGE_KEY, JSON.stringify(S.get('rooms')));
  };

  /**
   * Toast-Stub – wird von ui.js überschrieben.
   */
  St.toast = function() {};
})(window.GR.storage = window.GR.storage || {});