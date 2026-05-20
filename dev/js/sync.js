/**
 * Grundriss Tool – Sync-Status-UI
 * =====================================================================
 * @module sync
 * @description Zeigt den Cloud-Sync-Status an und aktualisiert Tab-Badges.
 */
window.GR = window.GR || {};

(function(Sync) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;

  /**
   * Aktualisiert den Sync-Status-Indikator (#syncI).
   * @param {string} status - 'idle' | 'saving' | 'saved' | 'error' | 'offline'
   */
  Sync.updateSyncUI = function(status) {
    var el = document.getElementById('syncI');
    if (!el) return;

    var labels = {
      idle: '',
      saving: '<span class="ssp"></span> Speichert\u2026',
      saved: '\u2705 Gespeichert',
      error: '\u26A0\uFE0F Fehler',
      offline: '\uD83D\uDD0C Offline'
    };
    el.innerHTML = labels[status] || '';
    el.style.display = status === 'idle' ? 'none' : '';
  };

  /**
   * Aktualisiert die Tab-Badges (Anzahl Räume pro Etage).
   * Unterstützt jetzt dynamische Floor-IDs.
   */
  Sync.updateTabBadges = function() {
    var rooms = S.get('rooms');
    if (!rooms) return;

    var floors = S.get('currentProjectFloors');
    // Falls keine Projekt-Floors, versuche Legacy 'eg'/'og'
    if (!floors || floors.length === 0) {
      floors = [
        { id: 'eg', name: 'Erdgeschoss' },
        { id: 'og', name: 'Obergeschoss' }
      ];
    }

    for (var fi = 0; fi < floors.length; fi++) {
      var floor = floors[fi];
      var count = 0;
      for (var key of Object.keys(rooms)) {
        if (rooms[key].floor === floor.id) count++;
      }

      // Badge aktualisieren
      var badge = document.getElementById('badge-' + floor.id);
      if (badge) badge.textContent = count;

      // Count-Anzeige aktualisieren
      var cnt = document.getElementById('cnt-' + floor.id);
      if (cnt) cnt.textContent = count > 0 ? '(' + count + ')' : '';
    }
  };

  // ===================================================================
  // Sync-Status Events
  // ===================================================================

  S.subscribe(C.EVT_SYNC_STATUS_CHANGED, function(status) {
    Sync.updateSyncUI(status);
    // Auto-hide nach 3 Sekunden
    if (status === 'saved') {
      setTimeout(function() {
        if (S.get('syncStatus') === 'saved') {
          S.set('syncStatus', 'idle');
        }
      }, 3000);
    }
  });

  S.subscribe(C.EVT_ROOMS_CHANGED, function() {
    Sync.updateTabBadges();
  });

  S.subscribe(C.EVT_PROJECT_CHANGED, function() {
    Sync.updateTabBadges();
  });

  // ===================================================================
  // Online/Offline Detection
  // ===================================================================

  Sync._isOnline = navigator.onLine;

  function handleOnline() {
    Sync._isOnline = true;
    if (S.get('syncStatus') === 'offline') {
      S.set('syncStatus', 'idle');
    }
    var UI = window.GR.ui;
    if (UI && UI.toast) UI.toast('✅ Verbindung wiederhergestellt', 'success', 2000);
  }

  function handleOffline() {
    Sync._isOnline = false;
    S.set('syncStatus', 'offline');
    var UI = window.GR.ui;
    if (UI && UI.toast) UI.toast('🔌 Verbindung verloren – Offline-Modus', 'warning', 4000);
  }

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial status
  if (!navigator.onLine) {
    S.set('syncStatus', 'offline');
  }

})(window.GR.sync = window.GR.sync || {});
