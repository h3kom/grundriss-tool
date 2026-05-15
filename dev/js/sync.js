/**
 * Grundriss Tool – Sync-Status-UI
 * =====================================================================
 * @module sync
 * @description Zeigt den Cloud-Sync-Status an und aktualisiert Tab-Badges.
 */
import { EVT_SYNC_STATUS_CHANGED, EVT_ROOMS_CHANGED, EVT_PROJECT_CHANGED } from './constants.js';
import * as S from './state.js';

export function updateSyncUI(status) {
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
}

export function updateTabBadges() {
  var rooms = S.get('rooms');
  if (!rooms) return;
  var floors = S.get('currentProjectFloors');
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
    var badge = document.getElementById('badge-' + floor.id);
    if (badge) badge.textContent = count;
    var cnt = document.getElementById('cnt-' + floor.id);
    if (cnt) cnt.textContent = count > 0 ? '(' + count + ')' : '';
  }
}

S.subscribe(EVT_SYNC_STATUS_CHANGED, function(status) {
  updateSyncUI(status);
  if (status === 'saved') {
    setTimeout(function() {
      if (S.get('syncStatus') === 'saved') {
        S.set('syncStatus', 'idle');
      }
    }, 3000);
  }
});

S.subscribe(EVT_ROOMS_CHANGED, function() { updateTabBadges(); });
S.subscribe(EVT_PROJECT_CHANGED, function() { updateTabBadges(); });

// ===================================================================
// Online/Offline Detection
// ===================================================================

export var _isOnline = navigator.onLine;

function handleOnline() {
  _isOnline = true;
  if (S.get('syncStatus') === 'offline') {
    S.set('syncStatus', 'idle');
  }
  var UI = window.GR && window.GR.ui;
  if (UI && UI.toast) UI.toast('✅ Verbindung wiederhergestellt', 'success', 2000);
}

function handleOffline() {
  _isOnline = false;
  S.set('syncStatus', 'offline');
  var UI = window.GR && window.GR.ui;
  if (UI && UI.toast) UI.toast('🔌 Verbindung verloren – Offline-Modus', 'warning', 4000);
}

window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

if (!navigator.onLine) {
  S.set('syncStatus', 'offline');
}