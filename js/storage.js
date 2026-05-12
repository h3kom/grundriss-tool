// Grundriss Tool – Datenpersistenz (localStorage + Supabase)
// =====================================================================
window.GR = window.GR || {};

(function(St) {
  const C = window.GR.constants;
  const S = window.GR.state;

  // ===================================================================
  // Public API
  // ===================================================================
  St.loadData = async function() {
    let el = document.getElementById('syncI');
    if (!el) {
      el = document.createElement('div');
      el.id = 'syncI';
      document.body.appendChild(el);
    }
    St.setSyncStatus('idle');

    const cloudLoaded = await St.loadFromCloud();
    if (cloudLoaded) return;

    const local = localStorage.getItem('gR');
    if (local) {
      try {
        S.set('rooms', JSON.parse(local));
        St.ensureAllRooms();
        return;
      } catch (e) {
        // corrupted local data – start empty
      }
    }

    // No default rooms – start with empty object
    S.set('rooms', {});
    St.saveData();
  };

  St.saveData = function() {
    if (S.get('saveTimeout')) clearTimeout(S.get('saveTimeout'));
    const now = Date.now();
    S.set('serverStamp', now);
    S.set('lastSaveTs', now);
    const rooms = S.get('rooms');
    localStorage.setItem('gR', JSON.stringify(rooms));
    St.updateTabBadges();

    const timeout = setTimeout(async () => {
      if (S.get('isSyncing')) return;
      S.set('isSyncing', true);
      St.setSyncStatus('syncing');
      try {
        const res = await fetch(`${C.SUPABASE_URL}/rest/v1/rooms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': C.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${C.SUPABASE_ANON_KEY}`,
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify({ id: 1, data: rooms })
        });
        if (res.ok) {
          const rows = await res.json();
          if (rows && rows.length > 0 && rows[0].updated_at) {
            S.set('serverStamp', new Date(rows[0].updated_at).getTime());
          }
          St.setSyncStatus('synced');
        } else {
          St.setSyncStatus('error');
        }
      } catch (e) {
        St.setSyncStatus('error');
      }
      S.set('isSyncing', false);
    }, 500);
    S.set('saveTimeout', timeout);
  };

  St.loadFromCloud = async function() {
    try {
      const res = await fetch(`${C.SUPABASE_URL}/rest/v1/rooms?id=eq.1&select=data,updated_at`, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': C.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${C.SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0 && rows[0].data) {
          S.set('rooms', rows[0].data);
          St.ensureAllRooms();
          S.set('serverStamp', new Date(rows[0].updated_at).getTime() || Date.now());
          localStorage.setItem('gR', JSON.stringify(S.get('rooms')));
          return true;
        }
      }
    } catch (e) {
      // ignore
    }
    return false;
  };

  St.supabaseFetch = async function() {
    try {
      const res = await fetch(`${C.SUPABASE_URL}/rest/v1/rooms?id=eq.1&select=data,updated_at`, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': C.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${C.SUPABASE_ANON_KEY}`
        }
      });
      if (!res.ok) return null;
      const rows = await res.json();
      if (rows && rows.length > 0 && rows[0].data) {
        return {
          data: rows[0].data,
          updatedAt: new Date(rows[0].updated_at).getTime() || 0
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  St.startPolling = function() {
    if (S.get('pollInterval')) clearInterval(S.get('pollInterval'));
    const interval = setInterval(async () => {
      if (S.get('isSyncing')) return;
      try {
        const result = await St.supabaseFetch();
        if (result && result.data && Object.keys(result.data).length > 0) {
          const serverTime = result.updatedAt || 0;
          if (serverTime > S.get('serverStamp')) {
            if (S.get('lastSaveTs') <= serverTime) {
              St.applyCloudData(result.data, serverTime);
              St.toast('Daten synchronisiert', 'info', 3000);
            } else {
              St.saveData();
            }
          } else {
            St.setSyncStatus('synced');
          }
        }
      } catch (e) {
        if (S.get('syncStatus') !== 'error') St.setSyncStatus('error');
      }
    }, C.SYNC_INTERVAL);
    S.set('pollInterval', interval);
  };

  St.applyCloudData = function(data, timestamp) {
    S.set('rooms', data);
    St.ensureAllRooms();
    const ts = timestamp || Date.now();
    S.set('serverStamp', ts);
    S.set('lastSaveTs', ts);
    localStorage.setItem('gR', JSON.stringify(S.get('rooms')));
    St.updateTabBadges();
    const Rd = window.GR.renderer;
    if (Rd) Rd.render();
    if (S.get('selectedRoom') && S.get('rooms')[S.get('selectedRoom')]) {
      if (Rd) Rd.renderDetail(S.get('selectedRoom'));
    } else if (S.get('overview')) {
      S.set('overview', false);
      if (Rd) Rd.showOverview();
    }
  };

  // ===================================================================
  // Sync Status Indicator
  // ===================================================================
  St.setSyncStatus = function(status) {
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

  // ===================================================================
  // Room Helpers (needed by storage and others)
  // ===================================================================
  St.ensureRoomFields = function(room) {
    if (!room.comments) room.comments = [];
    if (!room.done) room.done = {};
    return room;
  };

  St.ensureAllRooms = function() {
    const rooms = S.get('rooms');
    for (const key of Object.keys(rooms)) {
      St.ensureRoomFields(rooms[key]);
    }
  };

  St.taskProgress = function(room) {
    const done = St.completedTaskCount(room);
    const total = room.tasks ? room.tasks.length : 0;
    return { done, total, percent: total > 0 ? Math.round(done / total * 100) : 0 };
  };

  St.completedTaskCount = function(room) {
    if (!room.done) return 0;
    return Object.values(room.done).filter(Boolean).length;
  };

  St.deepClone = function(obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  // ===================================================================
  // UI Helpers (needed by storage)
  // ===================================================================
  St.updateTabBadges = function() {
    const rooms = S.get('rooms');
    for (const floor of C.FLOORS) {
      const count = Object.values(rooms).filter(r => r.floor === floor).length;
      const badge = document.getElementById(`badge${floor.charAt(0).toUpperCase()}${floor.slice(1)}`);
      if (badge) badge.textContent = count;
      const cnt = document.getElementById(`cnt${floor.charAt(0).toUpperCase()}${floor.slice(1)}`);
      if (cnt) cnt.textContent = `(${count})`;
    }
  };

  St.escHtml = function(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  St.toast = function(message, type, duration, undoCallback) {
    // Will be set by ui.js if it's loaded – otherwise a stub
  };
})(window.GR.storage = window.GR.storage || {});