/**
 * Grundriss Tool – Sync-Manager (Polling + Status)
 * =====================================================================
 * @module sync
 * @description Überwacht Cloud-Änderungen via Polling und aktualisiert den lokalen State.
 */
window.GR = window.GR || {};

(function(Sync) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const Cl = window.GR.cloud;
  const U = window.GR.utils;
  const St = window.GR.storage;

  /**
   * Prüft, ob das Gerät online ist.
   * @returns {boolean}
   */
  function isOnline() {
    return typeof navigator.onLine === 'undefined' ? true : navigator.onLine;
  }

  /**
   * Startet das Polling-Intervall für Cloud-Sync.
   * Berücksichtigt Offline-Status und Tab-Visibility.
   */
  Sync.startPolling = function() {
    if (S.get('pollInterval')) clearInterval(S.get('pollInterval'));
    var syncErrors = 0;
    var MAX_SYNC_ERRORS = 5;
    const interval = setInterval(async () => {
      // Nicht synchen wenn offline
      if (!isOnline()) {
        if (S.get('syncStatus') !== 'error') Sync.setSyncStatus('error');
        return;
      }
      // Nicht synchen wenn bereits ein Sync läuft
      if (S.get('isSyncing')) return;
      try {
        const result = await Cl.fetchData();
        if (result && result.data && Object.keys(result.data).length > 0) {
          const serverTime = result.updatedAt || 0;
          if (serverTime > S.get('serverStamp')) {
            if (S.get('lastSaveTs') <= serverTime) {
              Sync.applyCloudData(result.data, serverTime);
            } else {
              // Lokale Daten sind neuer – push
              Sync.saveToCloud();
            }
          } else {
            Sync.setSyncStatus('synced');
          }
        }
        syncErrors = 0;
      } catch (e) {
        syncErrors++;
        console.warn('[sync] Polling error (' + syncErrors + '/' + MAX_SYNC_ERRORS + '):', e.message || e);
        if (syncErrors >= MAX_SYNC_ERRORS) {
          Sync.pausePolling();
          Sync.setSyncStatus('error');
          var UI = window.GR.ui;
          if (UI && UI.toast) UI.toast('Sync-Fehler: Verbindung verloren', 'error', 5000);
          // Retry nach 30 Sekunden
          setTimeout(function() {
            syncErrors = 0;
            Sync.resumePolling();
          }, 30000);
        } else if (S.get('syncStatus') !== 'error') {
          Sync.setSyncStatus('error');
        }
      }
    }, C.SYNC_INTERVAL);
    S.set('pollInterval', interval);

    // Tab-Visibility API: Polling pausieren wenn Tab unsichtbar
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        Sync.pausePolling();
      } else {
        Sync.resumePolling();
      }
    });

    // Online/Offline-Event-Listener
    window.addEventListener('online', function() {
      Sync.setSyncStatus('idle');
      // Sofort einmal synchen bei Rückkehr online
      Sync.saveToCloud();
    });
    window.addEventListener('offline', function() {
      Sync.setSyncStatus('error');
    });
  };

  /**
   * Pausiert das Polling-Intervall.
   */
  Sync.pausePolling = function() {
    const interval = S.get('pollInterval');
    if (interval) {
      clearInterval(interval);
      S.set('pollInterval', null);
    }
  };

  /**
   * Setzt das Polling-Intervall fort.
   */
  Sync.resumePolling = function() {
    if (!S.get('pollInterval')) {
      Sync.startPolling();
    }
  };

  /**
   * Wendet Cloud-Daten auf den lokalen State an.
   * @param {Object} data - Raumdaten von der Cloud
   * @param {number} timestamp - Server-Timestamp
   */
  Sync.applyCloudData = function(data, timestamp) {
    S.set('rooms', data);
    U.ensureAllRooms(S.get('rooms'));
    const ts = timestamp || Date.now();
    S.set('serverStamp', ts);
    S.set('lastSaveTs', ts);
    St.saveToLocal();
    Sync.updateTabBadges();
    S.notify(C.EVT_ROOMS_CHANGED);
  };

  /**
   * Speichert lokale Daten asynchron in die Cloud.
   */
  Sync.saveToCloud = async function() {
    if (!isOnline()) {
      Sync.setSyncStatus('error');
      return;
    }
    if (S.get('isSyncing')) return;
    S.set('isSyncing', true);
    Sync.setSyncStatus('syncing');
    try {
      const result = await Cl.saveData(S.get('rooms'));
      if (result.ok) {
        if (result.updatedAt) S.set('serverStamp', result.updatedAt);
        Sync.setSyncStatus('synced');
      } else {
        Sync.setSyncStatus('error');
      }
    } catch (e) {
      Sync.setSyncStatus('error');
    }
    S.set('isSyncing', false);
  };

  /**
   * Aktualisiert die Sync-Status-Anzeige.
   * @param {string} status - 'idle' | 'syncing' | 'synced' | 'error'
   */
  Sync.setSyncStatus = function(status) {
    S.set('syncStatus', status);
    const el = document.getElementById('syncI');
    if (!el) return;
    const icons = { idle: '🔄', syncing: '⏳', synced: '✅', error: '⚠️' };
    const colors = { idle: '#aaa', syncing: '#fbbf24', synced: '#4ade80', error: '#f87171' };
    let html = '';
    if (status === 'syncing') html = '<span class="ssp"></span> ';
    html += `<span>${icons[status] || '🔄'}</span>`;
    el.innerHTML = html;
    el.style.borderBottom = `2px solid ${colors[status] || '#aaa'}`;
  };

  /**
   * Aktualisiert die Badges in den Etagen-Tabs.
   */
  Sync.updateTabBadges = function() {
    const rooms = S.get('rooms');
    for (const floor of C.FLOORS) {
      const count = Object.values(rooms).filter(r => r.floor === floor).length;
      const badge = document.getElementById(`badge${floor.charAt(0).toUpperCase()}${floor.slice(1)}`);
      if (badge) badge.textContent = count;
      const cnt = document.getElementById(`cnt${floor.charAt(0).toUpperCase()}${floor.slice(1)}`);
      if (cnt) cnt.textContent = `(${count})`;
    }
  };
})(window.GR.sync = window.GR.sync || {});