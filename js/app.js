/**
 * Grundriss Tool – App-Initialisierung & Routing
 * =====================================================================
 * @module app
 * @description Startet die Anwendung, prüft Auth-Status, routed zwischen
 * Login/Dashboard/Editor-Views.
 */
window.GR = window.GR || {};

(function(App) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const St = window.GR.storage;
  const Sync = window.GR.sync;
  const U = window.GR.utils;
  const Auth = window.GR.auth;
  const Proj = window.GR.projects;
  const Mig = window.GR.migration;

  // ===================================================================
  // View Management
  // ===================================================================

  /**
   * Zeigt eine bestimmte View an (auth, dashboard, editor).
   * @param {string} view - 'auth' | 'dashboard' | 'editor'
   */
  App.showView = function(view) {
    S.set('currentView', view);

    var authView = document.getElementById('authView');
    var dashboardView = document.getElementById('dashboardView');
    var editorView = document.getElementById('editorView');

    // Alle Views verstecken
    if (authView) authView.style.display = 'none';
    if (dashboardView) dashboardView.style.display = 'none';
    if (editorView) editorView.style.display = 'none';

    // Gewünschte View anzeigen
    switch (view) {
      case 'auth':
        if (authView) authView.style.display = '';
        break;
      case 'dashboard':
        if (dashboardView) dashboardView.style.display = '';
        App.renderDashboard();
        break;
      case 'editor':
        if (editorView) editorView.style.display = '';
        break;
    }
  };

  // ===================================================================
  // Dashboard Rendering
  // ===================================================================

  /**
   * Rendert das Projekt-Dashboard.
   */
  App.renderDashboard = async function() {
    var container = document.getElementById('dashProjects');
    var userInfo = document.getElementById('dashUser');
    if (!container) return;

    var user = S.get('currentUser');
    if (!user) return;

    // User-Info anzeigen
    if (userInfo) {
      userInfo.innerHTML =
        '<span class="dash-user-name">' + U.escHtml(user.displayName) + '</span>' +
        '<span class="dash-user-email">' + U.escHtml(user.email) + '</span>' +
        '<button data-action="logout" class="dash-btn-logout">Abmelden</button>';
    }

    // Projekte laden
    container.innerHTML = '<div class="dash-loading">⏳ Projekte werden geladen...</div>';

    var result = await Proj.loadProjects();

    var html = '';

    // Eigene Projekte
    if (result.owned.length > 0) {
      html += '<h3 class="dash-section-title">Meine Projekte</h3>';
      html += '<div class="dash-grid">';
      for (var i = 0; i < result.owned.length; i++) {
        var p = result.owned[i];
        var dateStr = new Date(p.updated_at || p.created_at).toLocaleDateString('de-DE');
        html +=
          '<div class="dash-card" data-action="open-project" data-project-id="' + p.id + '">' +
            '<div class="dash-card-icon">🏢</div>' +
            '<div class="dash-card-info">' +
              '<div class="dash-card-name">' + U.escHtml(p.name) + '</div>' +
              '<div class="dash-card-date">' + dateStr + '</div>' +
            '</div>' +
            '<div class="dash-card-actions">' +
              '<button data-action="delete-project" data-project-id="' + p.id + '" class="dash-card-delete" title="Löschen">🗑️</button>' +
            '</div>' +
          '</div>';
      }
      html += '</div>';
    }

    // Geteilte Projekte
    if (result.shared.length > 0) {
      html += '<h3 class="dash-section-title">Geteilte Projekte</h3>';
      html += '<div class="dash-grid">';
      for (var j = 0; j < result.shared.length; j++) {
        var s = result.shared[j];
        var dateStr2 = new Date(s.updated_at || s.created_at).toLocaleDateString('de-DE');
        html +=
          '<div class="dash-card" data-action="open-project" data-project-id="' + s.id + '">' +
            '<div class="dash-card-icon">🤝</div>' +
            '<div class="dash-card-info">' +
              '<div class="dash-card-name">' + U.escHtml(s.name) + '</div>' +
              '<div class="dash-card-date">Von ' + U.escHtml(s.ownerName) + ' · ' + dateStr2 + '</div>' +
            '</div>' +
          '</div>';
      }
      html += '</div>';
    }

    // Neues Projekt Button
    html =
      '<button data-action="new-project" class="dash-btn-new">+ Neues Projekt</button>' +
      html;

    if (result.owned.length === 0 && result.shared.length === 0) {
      html +=
        '<div class="dash-empty">' +
          '<div class="dash-empty-icon">🏗️</div>' +
          '<p>Noch keine Projekte vorhanden.</p>' +
          '<p>Erstelle dein erstes Projekt!</p>' +
        '</div>';
    }

    container.innerHTML = html;
  };

  // ===================================================================
  // Auth Event Handlers
  // ===================================================================

  S.subscribe(C.EVT_AUTH_CHANGED, function(data) {
    if (data && data.authenticated) {
      // User eingeloggt → Migration prüfen, dann Dashboard
      App.handlePostLogin();
    } else {
      // User ausgeloggt → Login-Seite
      App.showView('auth');
    }
  });

  /**
   * Wird nach erfolgreichem Login aufgerufen.
   * Führt Migration durch und zeigt Dashboard.
   */
  App.handlePostLogin = async function() {
    // Migration prüfen
    if (!Mig.isMigrated()) {
      await Mig.migrateLocalData();
    }
    App.showView('dashboard');
  };

  // ===================================================================
  // App Initialization
  // ===================================================================

  /**
   * Initialisiert die gesamte Anwendung.
   */
  App.init = async function() {
    // Supabase initialisieren
    Auth.initSupabase();

    // UI-Events registrieren
    App.setupActions();

    // Auth-Status prüfen
    if (Auth.isAvailable()) {
      var session = await Auth.getSession();
      if (session && session.user) {
        // Bereits eingeloggt
        Auth.onSignIn(session.user);
        // handlePostLogin wird durch EVT_AUTH_CHANGED getriggert
        return;
      }
    }

    // Nicht eingeloggt oder kein Supabase → Auth-View oder Legacy-Modus
    if (!Auth.isAvailable()) {
      // Legacy-Modus: Direkt Editor ohne Login
      App.initLegacyMode();
    } else {
      App.showView('auth');
    }
  };

  /**
   * Legacy-Modus: Editor ohne Login (fallback wenn kein Supabase).
   */
  App.initLegacyMode = async function() {
    S.set('currentProjectFloors', [
      { id: 'eg', name: 'Erdgeschoss', imageUrl: 'EG.png', nativeWidth: 1000, sortOrder: 0 },
      { id: 'og', name: 'Obergeschoss', imageUrl: 'OG.png', nativeWidth: 800, sortOrder: 1 }
    ]);
    S.set('currentProject', { id: 'legacy', name: 'Lokales Projekt', ownerId: null, roomsRowId: null });

    var rooms = await St.loadData(true); // forceLocal = true
    if (rooms) {
      S.set('rooms', rooms);
    }

    S.set('activeFloor', 'eg');
    App.showView('editor');

    // Intro anzeigen falls noch nicht gesehen
    if (!localStorage.getItem(C.INTRO_SEEN_KEY)) {
      var UI = window.GR.ui;
      if (UI && UI.showIntro) UI.showIntro();
    }

    // Initiales Rendering
    var Rdr = window.GR.renderer;
    if (Rdr && Rdr.render) Rdr.render();
    Sync.updateTabBadges();
  };

  // ===================================================================
  // Action Handlers (data-action delegation)
  // ===================================================================

  App.setupActions = function() {
    // Click-Delegation für Auth/Dashboard Actions
    document.addEventListener('click', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;

      var action = target.dataset.action;

      switch (action) {
        // === Auth Actions ===
        case 'show-login':
          App.toggleAuthForm('login');
          break;
        case 'show-register':
          App.toggleAuthForm('register');
          break;
        case 'show-reset':
          App.toggleAuthForm('reset');
          break;
        case 'do-login':
          App.handleLogin();
          break;
        case 'do-register':
          App.handleRegister();
          break;
        case 'do-reset':
          App.handleReset();
          break;

        // === Dashboard Actions ===
        case 'new-project':
          var OB = window.GR.onboarding;
          if (OB && OB.openWizard) OB.openWizard();
          break;
        case 'open-project':
          e.stopPropagation();
          App.handleOpenProject(target.dataset.projectId);
          break;
        case 'delete-project':
          e.stopPropagation();
          App.handleDeleteProject(target.dataset.projectId);
          break;
        case 'logout':
          App.handleLogout();
          break;

        // === Editor Actions (Top-Bar) ===
        case 'back-to-dashboard':
          App.showView('dashboard');
          break;
        case 'share-project':
          var Collab = window.GR.collaboration;
          if (Collab && Collab.showShareModal) Collab.showShareModal();
          break;
        case 'close-share':
          var Collab2 = window.GR.collaboration;
          if (Collab2 && Collab2.closeShareModal) Collab2.closeShareModal();
          break;

        // === Onboarding Wizard ===
        case 'ob-cancel':
          var OB2 = window.GR.onboarding;
          if (OB2 && OB2.closeWizard) OB2.closeWizard();
          break;
        case 'ob-next':
          var OB3 = window.GR.onboarding;
          if (OB3) {
            OB3._wizardStep = 2;
            OB3.renderWizard();
          }
          break;
        case 'ob-back':
          var OB4 = window.GR.onboarding;
          if (OB4) {
            OB4._wizardStep = 1;
            OB4.renderWizard();
          }
          break;
        case 'ob-create':
          var OB5 = window.GR.onboarding;
          if (OB5 && OB5.createProjectFromWizard) OB5.createProjectFromWizard();
          break;
        case 'ob-add-floor':
          var OB6 = window.GR.onboarding;
          if (OB6 && OB6.addFloor) {
            OB6.addFloor('Stockwerk ' + ((OB6._wizardFloors || []).length + 1), '', 1000);
            OB6.renderFloorList();
          }
          break;
        case 'ob-remove-floor':
          var OB7 = window.GR.onboarding;
          if (OB7 && OB7.removeFloor) OB7.removeFloor(parseInt(target.dataset.floorIndex));
          break;

        // === Collaboration ===
        case 'send-invite':
          var Collab3 = window.GR.collaboration;
          if (Collab3 && Collab3.sendInviteFromModal) Collab3.sendInviteFromModal();
          break;
        case 'remove-member':
          App.handleRemoveMember(target.dataset.memberId);
          break;
      }
    });

    // Change-Delegation für Onboarding File-Uploads
    document.addEventListener('change', function(e) {
      var target = e.target;
      var action = target.dataset.actionChange;
      if (!action) return;

      switch (action) {
        case 'ob-upload-floor':
          var OB8 = window.GR.onboarding;
          if (OB8 && OB8.handleFloorUpload) {
            var idx = parseInt(target.dataset.floorIndex);
            if (target.files && target.files[0]) {
              OB8.handleFloorUpload(idx, target.files[0]);
            }
          }
          break;
        case 'change-role':
          var Collab = window.GR.collaboration;
          var project = S.get('currentProject');
          if (Collab && project) {
            Collab.changeRole(project.id, target.dataset.memberId, target.value);
          }
          break;
      }
    });

    // Enter-Key für Auth-Formulare
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      var id = e.target.id;
      if (id === 'loginEmail' || id === 'loginPassword') {
        App.handleLogin();
      } else if (id === 'regEmail' || id === 'regPassword' || id === 'regName') {
        App.handleRegister();
      } else if (id === 'resetEmail') {
        App.handleReset();
      }
    });
  };

  // ===================================================================
  // Auth Form Handlers
  // ===================================================================

  /**
   * Wechselt zwischen Login/Register/Reset-Formularen.
   */
  App.toggleAuthForm = function(form) {
    var loginForm = document.getElementById('loginForm');
    var regForm = document.getElementById('registerForm');
    var resetForm = document.getElementById('resetForm');
    if (!loginForm || !regForm || !resetForm) return;

    loginForm.style.display = form === 'login' ? '' : 'none';
    regForm.style.display = form === 'register' ? '' : 'none';
    resetForm.style.display = form === 'reset' ? '' : 'none';
  };

  /**
   * Behandelt Login-Formular-Submit.
   */
  App.handleLogin = async function() {
    var email = document.getElementById('loginEmail')?.value?.trim();
    var password = document.getElementById('loginPassword')?.value;
    var errorEl = document.getElementById('loginError');

    if (!email || !password) {
      if (errorEl) errorEl.textContent = 'Bitte E-Mail und Passwort eingeben';
      return;
    }

    var btn = document.querySelector('[data-action="do-login"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Anmelden...'; }

    var result = await Auth.login(email, password);

    if (!result.ok) {
      if (errorEl) errorEl.textContent = result.error || 'Anmeldung fehlgeschlagen';
      if (btn) { btn.disabled = false; btn.textContent = 'Anmelden'; }
    }
    // Bei Erfolg wird EVT_AUTH_CHANGED gefeuert → handlePostLogin
  };

  /**
   * Behandelt Register-Formular-Submit.
   */
  App.handleRegister = async function() {
    var name = document.getElementById('regName')?.value?.trim();
    var email = document.getElementById('regEmail')?.value?.trim();
    var password = document.getElementById('regPassword')?.value;
    var errorEl = document.getElementById('regError');

    if (!name || !email || !password) {
      if (errorEl) errorEl.textContent = 'Bitte alle Felder ausfüllen';
      return;
    }
    if (password.length < 6) {
      if (errorEl) errorEl.textContent = 'Passwort muss mind. 6 Zeichen haben';
      return;
    }

    var btn = document.querySelector('[data-action="do-register"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Registrieren...'; }

    var result = await Auth.register(email, password, name);

    if (!result.ok) {
      if (errorEl) errorEl.textContent = result.error || 'Registrierung fehlgeschlagen';
      if (btn) { btn.disabled = false; btn.textContent = 'Registrieren'; }
    } else {
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('✅ Registrierung erfolgreich! Bitte bestätige deine E-Mail.', 'success', 5000);
      App.toggleAuthForm('login');
    }
  };

  /**
   * Behandelt Passwort-Reset.
   */
  App.handleReset = async function() {
    var email = document.getElementById('resetEmail')?.value?.trim();
    var errorEl = document.getElementById('resetError');

    if (!email) {
      if (errorEl) errorEl.textContent = 'Bitte E-Mail eingeben';
      return;
    }

    var result = await Auth.resetPassword(email);
    if (result.ok) {
      if (errorEl) { errorEl.textContent = ''; errorEl.style.color = 'var(--green)'; errorEl.textContent = '✅ E-Mail gesendet!'; }
    } else {
      if (errorEl) { errorEl.style.color = ''; errorEl.textContent = result.error || 'Fehler beim Senden'; }
    }
  };

  /**
   * Öffnet ein Projekt.
   */
  App.handleOpenProject = async function(projectId) {
    if (!projectId) return;

    var success = await Proj.openProject(projectId);
    if (success) {
      App.showView('editor');
      var Rdr = window.GR.renderer;
      if (Rdr && Rdr.render) Rdr.render();
      Sync.updateTabBadges();
    } else {
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('❌ Projekt konnte nicht geladen werden', 'error', 3000);
    }
  };

  /**
   * Löscht ein Projekt mit Bestätigung.
   */
  App.handleDeleteProject = async function(projectId) {
    if (!projectId) return;
    if (!confirm('Projekt wirklich löschen? Alle Daten gehen verloren.')) return;

    var result = await Proj.deleteProject(projectId);
    if (result.ok) {
      App.renderDashboard();
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('🗑️ Projekt gelöscht', 'success', 2000);
    }
  };

  /**
   * Behandelt Logout.
   */
  App.handleLogout = async function() {
    await Auth.logout();
    St.clearLocal();
    App.showView('auth');
  };

  /**
   * Entfernt ein Projektmitglied.
   */
  App.handleRemoveMember = async function(memberId) {
    if (!memberId) return;
    var Collab = window.GR.collaboration;
    var project = S.get('currentProject');
    if (!Collab || !project) return;

    var result = await Collab.removeMember(project.id, memberId);
    if (result.ok) {
      Collab.showShareModal(); // Refresh
    }
  };

  // ===================================================================
  // Auto-Init bei DOM Ready
  // ===================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
  } else {
    App.init();
  }

})(window.GR.app = window.GR.app || {});