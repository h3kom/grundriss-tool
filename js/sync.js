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

  /**
   * Startet das Polling-Intervall für Cloud-Sync.
   */
  Sync.startPolling = function() {
    if (S.get('pollInterval')) clearInterval(S.get('pollInterval'));
    const interval = setInterval(async () => {
      if (S.get('isSyncing')) return;
      try {
        const result = await Cl.fetchData();
        if (result && result.data && Object.keys(result.data).length > 0) {
          const serverTime = result.updatedAt || 0;
          if (serverTime > S.get('serverStamp')) {
            if (S.get('lastSaveTs') <= serverTime) {
              Sync.applyCloudData(result.data, serverTime);
              const UI = window.GR.ui;
              if (UI && UI.toast) UI.toast('Daten synchronisiert', 'info', 3000);
            } else {
              // Lokale Daten sind neuer – push
              Sync.saveToCloud();
            }
          } else {
            Sync.setSyncStatus('synced');
          }
        }
      } catch (e) {
        if (S.get('syncStatus') !== 'error') Sync.setSyncStatus('error');
      }
    }, C.SYNC_INTERVAL);
    S.set('pollInterval', interval);
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
    localStorage.setItem(C.LOCAL_STORAGE_KEY, JSON.stringify(S.get('rooms')));
    Sync.updateTabBadges();
    S.notify(C.EVT_ROOMS_CHANGED);
  };

  /**
   * Speichert lokale Daten asynchron in die Cloud.
   */
  Sync.saveToCloud = async function() {
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