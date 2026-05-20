/**
 * Grundriss Tool – Kollaboration
 * =====================================================================
 * @module collaboration
 * @description Teilen von Projekten, Einladungen, Rollen-Verwaltung.
 */
window.GR = window.GR || {};

(function(Collab) {
  'use strict';

  var C = window.GR.constants;
  var S = window.GR.state;
  var Auth = window.GR.auth;

  /**
   * Lädt die Mitglieder eines Projekts.
   * @param {string} projectId
   * @returns {Promise<Array>}
   */
  Collab.loadMembers = async function(projectId) {
    var sb = Auth.getSupabase();
    if (!sb) return [];

    try {
      var result = await sb.from('project_members')
        .select('id, user_id, role, invited_at, profiles(display_name, email)')
        .eq('project_id', projectId)
        .order('invited_at', { ascending: true });
      if (result.error) {
        console.warn('[collaboration] loadMembers error:', result.error.message);
        return [];
      }
      return (result.data || []).map(function(m) {
        return {
          id: m.id,
          userId: m.user_id,
          role: m.role,
          invitedAt: m.invited_at,
          displayName: m.profiles?.display_name || 'Unbekannt',
          email: m.profiles?.email || ''
        };
      });
    } catch (e) {
      console.warn('[collaboration] loadMembers error:', e.message);
      return [];
    }
  };

  /**
   * Lädt ein Benutzerprofil per E-Mail-Adresse.
   * Wird verwendet, um User für Einladungen zu finden.
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  Collab.findUserByEmail = async function(email) {
    var sb = Auth.getSupabase();
    if (!sb) return null;

    try {
      var result = await sb.from('profiles')
        .select('id, display_name, email')
        .eq('email', email)
        .single();
      if (result.error || !result.data) return null;
      return result.data;
    } catch (e) {
      return null;
    }
  };

  /**
   * Fügt ein Mitglied zu einem Projekt hinzu.
   * @param {string} projectId
   * @param {string} email - E-Mail des einzuladenden Users
   * @param {string} role - 'editor' | 'viewer'
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  Collab.inviteMember = async function(projectId, email, role) {
    var sb = Auth.getSupabase();
    if (!sb) return { ok: false, error: 'Verbindung fehlgeschlagen' };

    var currentUser = S.get('currentUser');
    if (!currentUser) return { ok: false, error: 'Nicht angemeldet' };

    try {
      // User per E-Mail finden
      var userProfile = await Collab.findUserByEmail(email);
      if (!userProfile) {
        return { ok: false, error: 'Benutzer mit dieser E-Mail nicht gefunden' };
      }
      if (userProfile.id === currentUser.id) {
        return { ok: false, error: 'Du kannst dich nicht selbst einladen' };
      }

      // Prüfen ob bereits Mitglied
      var existing = await sb.from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userProfile.id)
        .single();

      if (existing.data) {
        return { ok: false, error: 'Benutzer ist bereits Mitglied' };
      }

      // Mitglied hinzufügen
      var result = await sb.from('project_members').insert({
        project_id: projectId,
        user_id: userProfile.id,
        role: role
      });

      if (result.error) {
        return { ok: false, error: result.error.message };
      }

      return { ok: true, displayName: userProfile.display_name };
    } catch (e) {
      return { ok: false, error: e.message || 'Unbekannter Fehler' };
    }
  };

  /**
   * Prüft, ob der aktuelle User Owner des Projekts ist.
   * @param {string} projectId
   * @returns {Promise<boolean>}
   */
  async function _isProjectOwner(projectId) {
    var currentUser = S.get('currentUser');
    if (!currentUser) return false;

    var sb = Auth.getSupabase();
    if (!sb) return false;

    try {
      var result = await sb.from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', currentUser.id)
        .single();
      return !!(result.data && result.data.role === 'owner');
    } catch (e) {
      return false;
    }
  }

  /**
   * Entfernt ein Mitglied aus einem Projekt.
   * @param {string} projectId
   * @param {string} memberId - project_members.id
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  Collab.removeMember = async function(projectId, memberId) {
    var sb = Auth.getSupabase();
    if (!sb) return { ok: false, error: 'Verbindung fehlgeschlagen' };

    // Client-seitige Owner-Prüfung (Defense-in-Depth, RLS enforced server-side)
    var isOwner = await _isProjectOwner(projectId);
    if (!isOwner) return { ok: false, error: 'Nur der Projekt-Owner darf Mitglieder entfernen' };

    try {
      var result = await sb.from('project_members')
        .delete()
        .eq('id', memberId)
        .eq('project_id', projectId);
      if (result.error) {
        console.warn('[collaboration] removeMember error:', result.error.message);
        return { ok: false, error: result.error.message };
      }
      return { ok: true };
    } catch (e) {
      console.warn('[collaboration] removeMember exception:', e.message);
      return { ok: false, error: e.message };
    }
  };

  /**
   * Ändert die Rolle eines Mitglieds.
   * @param {string} projectId
   * @param {string} memberId - project_members.id
   * @param {string} newRole - 'editor' | 'viewer'
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  Collab.changeRole = async function(projectId, memberId, newRole) {
    var sb = Auth.getSupabase();
    if (!sb) return { ok: false, error: 'Verbindung fehlgeschlagen' };

    // Client-seitige Owner-Prüfung (Defense-in-Depth, RLS enforced server-side)
    var isOwner = await _isProjectOwner(projectId);
    if (!isOwner) return { ok: false, error: 'Nur der Projekt-Owner darf Rollen ändern' };

    // Role-Wert validieren
    if (newRole !== 'editor' && newRole !== 'viewer') {
      return { ok: false, error: 'Ungültige Rolle: ' + newRole };
    }

    try {
      var result = await sb.from('project_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .eq('project_id', projectId);
      if (result.error) {
        console.warn('[collaboration] changeRole error:', result.error.message);
        return { ok: false, error: result.error.message };
      }
      return { ok: true };
    } catch (e) {
      console.warn('[collaboration] changeRole exception:', e.message);
      return { ok: false, error: e.message };
    }
  };

  /**
   * Rendert das Teilen-Modal.
   */
  Collab.showShareModal = async function() {
    var project = S.get('currentProject');
    if (!project) return;

    var sb = Auth.getSupabase();
    var U = window.GR.utils;

    // Modal anzeigen
    var modal = document.getElementById('shareModal');
    if (!modal) return;
    modal.classList.add('open');

    var body = document.getElementById('shareBody');
    if (!body) return;

    body.innerHTML = '<p class="hint">⏳ Lade Mitglieder...</p>';

    var members = await Collab.loadMembers(project.id);

    var html =
      '<div class="share-section">' +
        '<h4>Mitglieder</h4>' +
        '<div class="member-list">';

    for (var i = 0; i < members.length; i++) {
      var m = members[i];
      var isOwner = m.role === 'owner';
      var currentUser = S.get('currentUser');
      var isSelf = currentUser && m.userId === currentUser.id;

      html +=
        '<div class="member-item">' +
          '<div class="member-info">' +
            '<span class="member-name">' + U.escHtml(m.displayName) + '</span>' +
            '<span class="member-email">' + U.escHtml(m.email) + '</span>' +
          '</div>' +
          '<div class="member-role">' +
            (isOwner ? '<span class="role-badge owner">Owner</span>' :
              isSelf ? '<span class="role-badge">' + U.escHtml(m.role) + '</span>' :
              '<select data-action-change="change-role" data-member-id="' + m.id + '" class="role-select">' +
                '<option value="editor"' + (m.role === 'editor' ? ' selected' : '') + '>Editor</option>' +
                '<option value="viewer"' + (m.role === 'viewer' ? ' selected' : '') + '>Viewer</option>' +
              '</select>' +
              '<button data-action="remove-member" data-member-id="' + m.id + '" class="btn-remove-member" title="Entfernen">✕</button>'
            ) +
          '</div>' +
        '</div>';
    }

    html +=
        '</div>' +
      '</div>' +
      '<div class="share-section">' +
        '<h4>Neues Mitglied einladen</h4>' +
        '<div class="invite-form">' +
          '<input type="email" id="inviteEmail" placeholder="E-Mail-Adresse" class="ob-input" />' +
          '<select id="inviteRole" class="role-select">' +
            '<option value="editor">Editor</option>' +
            '<option value="viewer">Viewer</option>' +
          '</select>' +
          '<button data-action="send-invite" class="ob-btn-primary">Einladen</button>' +
        '</div>' +
      '</div>';

    body.innerHTML = html;
  };

  /**
   * Teilen-Modal für ein Projekt vom Dashboard aus (ohne currentProject).
   * @param {string} projectId
   */
  Collab.showShareModalForProject = async function(projectId) {
    // Temporär currentProject setzen, damit showShareModal funktioniert
    var prev = S.get('currentProject');
    S.set('currentProject', { id: projectId });
    try {
      await Collab.showShareModal();
    } finally {
      // Immer wiederherstellen – verhindert State-Korruption
      S.set('currentProject', prev);
    }
  };

  /**
   * Schließt das Teilen-Modal.
   */
  Collab.closeShareModal = function() {
    var modal = document.getElementById('shareModal');
    if (modal) modal.classList.remove('open');
  };

  /**
   * Sendet eine Einladung aus dem Modal.
   */
  Collab.sendInviteFromModal = async function() {
    var project = S.get('currentProject');
    if (!project) return;

    var emailInput = document.getElementById('inviteEmail');
    var roleSelect = document.getElementById('inviteRole');
    if (!emailInput || !roleSelect) return;

    var email = emailInput.value.trim();
    var role = roleSelect.value;

    if (!email) {
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('Bitte E-Mail eingeben', 'error', 2000);
      return;
    }

    // Invite-Button deaktivieren, um doppelte Einladungen zu verhindern
    var inviteBtn = document.querySelector('[data-action="send-invite"]');
    if (inviteBtn) {
      inviteBtn.disabled = true;
      inviteBtn.textContent = 'Einladen\u2026';
    }

    try {
      var result = await Collab.inviteMember(project.id, email, role);
      var UI = window.GR.ui;
      if (result.ok) {
        if (UI && UI.toast) UI.toast('✅ ' + (result.displayName || email) + ' eingeladen!', 'success', 3000);
        emailInput.value = '';
        // Member-Liste aktualisieren (await um Race-Condition zu vermeiden)
        await Collab.showShareModal();
      } else {
        if (UI && UI.toast) UI.toast('❌ ' + result.error, 'error', 3000);
      }
    } finally {
      // Button wieder aktivieren
      if (inviteBtn) {
        inviteBtn.disabled = false;
        inviteBtn.textContent = 'Einladen';
      }
    }
  };

})(window.GR.collaboration = window.GR.collaboration || {});