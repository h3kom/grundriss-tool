/**
 * Grundriss Tool – Echtzeit-Präsenz
 * =====================================================================
 * @module presence
 * @description Zeigt an, welche Benutzer aktuell im Projekt online sind.
 * Nutzt Supabase Realtime Presence API.
 */
window.GR = window.GR || {};

(function(Pres) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const Auth = window.GR.auth;

  let _channel = null;
  let _onlineUsers = {};

  /** @const {string[]} Farben für User-Avatare */
  const USER_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#78716c'];

  /**
   * Tritt dem Presence-Channel für ein Projekt bei.
   * @param {string} projectId
   */
  Pres.joinProject = function(projectId) {
    if (!projectId || projectId === 'legacy') return;

    // Alten Channel verlassen
    Pres.leaveProject();

    const sb = Auth.getSupabase();
    if (!sb) return;

    const user = S.get('currentUser');
    if (!user) return;

    const channelName = 'presence-project-' + projectId;

    _channel = sb.channel(channelName, {
      config: { presence: { key: user.id } }
    });

    _channel.on('presence', { event: 'sync' }, function() {
      const state = _channel.presenceState();
      _onlineUsers = {};
      let colorIdx = 0;
      for (const userId of Object.keys(state)) {
        const presence = state[userId];
        if (presence && presence.length > 0) {
          _onlineUsers[userId] = {
            id: userId,
            name: presence[0].name || 'Unbekannt',
            color: USER_COLORS[colorIdx % USER_COLORS.length]
          };
          colorIdx++;
        }
      }
      Pres.updateUI();
      S.notify(C.EVT_PRESENCE_CHANGED, _onlineUsers);
    });

    _channel.subscribe(async function(status) {
      if (status === 'SUBSCRIBED') {
        try {
          await _channel.track({
            name: user.displayName || user.email || 'User',
            userId: user.id,
            online_at: new Date().toISOString()
          });
        } catch (e) {
          console.warn('[presence] track error:', e.message);
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn('[presence] channel status:', status);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setTimeout(function() {
            if (_channel) {
              _channel.track({
                name: user.displayName || user.email || 'User',
                userId: user.id,
                online_at: new Date().toISOString()
              }).catch(function(e) { console.warn('[presence] re-track error:', e.message); });
            }
          }, 3000);
        }
      }
    });
  };

  /**
   * Verlässt den aktuellen Presence-Channel.
   */
  Pres.leaveProject = function() {
    if (_channel) {
      _channel.untrack();
      _channel.unsubscribe();
      const sb = Auth.getSupabase();
      if (sb) sb.removeChannel(_channel);
      _channel = null;
    }
    _onlineUsers = {};
    Pres.updateUI();
  };

  /**
   * Gibt die aktuell onlineUsers zurück.
   * @returns {Object}
   */
  Pres.getOnlineUsers = function() {
    return _onlineUsers;
  };

  /**
   * Aktualisiert die Presence-Anzeige in der Top-Bar.
   */
  Pres.updateUI = function() {
    const indicator = document.getElementById('presenceIndicator');
    if (!indicator) return;

    const userIds = Object.keys(_onlineUsers);
    // Eigener User ausblenden
    const currentUser = S.get('currentUser');
    const otherUsers = userIds.filter(function(id) { return id !== (currentUser && currentUser.id); });

    if (otherUsers.length === 0) {
      indicator.style.display = 'none';
      return;
    }

    indicator.style.display = '';
    let html = '';
    for (let i = 0; i < Math.min(otherUsers.length, 4); i++) {
      const u = _onlineUsers[otherUsers[i]];
      const initial = u.name ? u.name.charAt(0).toUpperCase() : '?';
      const U = window.GR.utils;
      html += '<span class="presence-avatar" style="background:' + u.color + '" title="' + U.escAttr(u.name || 'Unbekannt') + '">' + U.escHtml(initial) + '</span>';
    }
    if (otherUsers.length > 4) {
      html += '<span class="presence-more">+' + (otherUsers.length - 4) + '</span>';
    }
    indicator.innerHTML = html;
  };

})(window.GR.presence = window.GR.presence || {});