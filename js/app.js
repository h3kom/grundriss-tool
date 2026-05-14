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
  const Pres = window.GR.presence;

  // ===================================================================
  // View Management
  // ===================================================================

  App.showView = function(view) {
    S.set('currentView', view);

    var authView = document.getElementById('authView');
    var dashboardView = document.getElementById('dashboardView');
    var editorView = document.getElementById('editorView');

    if (authView) authView.style.display = 'none';
    if (dashboardView) dashboardView.style.display = 'none';
    if (editorView) editorView.style.display = 'none';

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

  App.renderDashboard = async function() {
    var container = document.getElementById('dashProjects');
    var userInfo = document.getElementById('dashUser');
    if (!container) return;

    var user = S.get('currentUser');
    if (!user) return;

    if (userInfo) {
      userInfo.innerHTML =
        '<span class="dash-user-name">' + U.escHtml(user.displayName) + '</span>' +
        '<span class="dash-user-email">' + U.escHtml(user.email) + '</span>' +
        '<button data-action="logout" class="dash-btn-logout">Abmelden</button>';
    }

    container.innerHTML = '<div class="dash-loading">⏳ Projekte werden geladen...</div>';

    var result = await Proj.loadProjects();

    var html = '';

    if (result.owned.length > 0) {
      html += '<h3 class="dash-section-title">Meine Projekte</h3>';
      html += '<div class="dash-grid">';
      for (var i = 0; i < result.owned.length; i++) {
        var p = result.owned[i];
        var dateStr = new Date(p.updated_at || p.created_at).toLocaleDateString('de-DE');
        html +=
          '<div class="dash-card" data-action="open-project" data-project-id="' + U.escAttr(p.id) + '">' +
            '<div class="dash-card-icon">🏢</div>' +
            '<div class="dash-card-info">' +
              '<div class="dash-card-name">' + U.escHtml(p.name) + '</div>' +
              '<div class="dash-card-date">' + dateStr + '</div>' +
            '</div>' +
            '<div class="dash-card-actions">' +
              '<button data-action="project-menu" data-project-id="' + U.escAttr(p.id) + '" class="dash-card-delete" title="Mehr">⋯</button>' +
            '</div>' +
          '</div>';
      }
      html += '</div>';
    }

    if (result.shared.length > 0) {
      html += '<h3 class="dash-section-title">Geteilte Projekte</h3>';
      html += '<div class="dash-grid">';
      for (var j = 0; j < result.shared.length; j++) {
        var s = result.shared[j];
        var dateStr2 = new Date(s.updated_at || s.created_at).toLocaleDateString('de-DE');
        html +=
          '<div class="dash-card" data-action="open-project" data-project-id="' + U.escAttr(s.id) + '">' +
            '<div class="dash-card-icon">🤝</div>' +
            '<div class="dash-card-info">' +
              '<div class="dash-card-name">' + U.escHtml(s.name) + '</div>' +
              '<div class="dash-card-date">Von ' + U.escHtml(s.ownerName) + ' · ' + dateStr2 + '</div>' +
            '</div>' +
          '</div>';
      }
      html += '</div>';
    }

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
      App.handlePostLogin();
    } else {
      App.showView('auth');
    }
  });

  App.handlePostLogin = async function() {
    try {
      if (Mig && !Mig.isMigrated()) {
        await Mig.migrateLocalData();
      }
    } catch (e) {
      console.warn('[app] Migration error (non-fatal):', e);
    }
    App.showView('dashboard');
  };

  // ===================================================================
  // App Initialization
  // ===================================================================

  App.init = async function() {
    Auth.initSupabase();
    App.setupActions();
    App.initDarkMode();

    if (Auth.isAvailable()) {
      var session = await Auth.getSession();
      if (session && session.user) {
        Auth.onSignIn(session.user);
        return;
      }
    }

    if (!Auth.isAvailable()) {
      App.initLegacyMode();
    } else {
      App.showView('auth');
    }
  };

  App.initLegacyMode = async function() {
    S.set('currentProjectFloors', [
      { id: 'eg', name: 'Erdgeschoss', imageUrl: 'EG.png', nativeWidth: 1000, sortOrder: 0 },
      { id: 'og', name: 'Obergeschoss', imageUrl: 'OG.png', nativeWidth: 800, sortOrder: 1 }
    ]);
    S.set('currentProject', { id: 'legacy', name: 'Lokales Projekt', ownerId: null, roomsRowId: null });

    var rooms = await St.loadData(true);
    if (rooms) {
      S.set('rooms', rooms);
    }

    S.set('activeFloor', 'eg');
    var nameEl = document.getElementById('projectName');
    if (nameEl) nameEl.textContent = 'Lokales Projekt';
    App.showView('editor');

    if (!localStorage.getItem(C.INTRO_SEEN_KEY)) {
      var UI = window.GR.ui;
      if (UI && UI.showIntro) UI.showIntro();
    }

    var Rdr = window.GR.renderer;
    if (Rdr && Rdr.render) Rdr.render();
    Sync.updateTabBadges();
  };

  // ===================================================================
  // Dark Mode
  // ===================================================================

  App.toggleDarkMode = function() {
    var isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem(C.DARK_MODE_KEY, isDark ? '1' : '0');
    App.updateDarkModeToggle();
  };

  App.updateDarkModeToggle = function() {
    var isDark = document.documentElement.classList.contains('dark');
    var toggle = document.getElementById('settingsDarkToggle');
    if (toggle) {
      toggle.textContent = isDark ? 'An' : 'Aus';
      toggle.classList.toggle('active', isDark);
    }
  };

  App.initDarkMode = function() {
    var saved = localStorage.getItem(C.DARK_MODE_KEY);
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = saved !== null ? saved === '1' : prefersDark;
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
    App.updateDarkModeToggle();
  };

  App.openSettings = function() {
    App.updateDarkModeToggle();
    var modal = document.getElementById('settingsModal');
    if (modal) modal.classList.add('open');
  };

  App.closeSettings = function() {
    var modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('open');
  };

  // ===================================================================
  // Projekt umbenennen
  // ===================================================================

  App.handleRenameProject = function() {
    if (!S.get('editMode')) return;
    var proj = S.get('currentProject');
    if (!proj) return;
    var nameEl = document.getElementById('projectName');
    if (!nameEl) return;

    nameEl.innerHTML = '<input type="text" id="renameProjectInput" class="tb-rename-input" value="' + U.escAttr(proj.name || '') + '" />' +
      '<button data-action="confirm-rename-project" class="tb-btn-sm" title="Speichern">✅</button>' +
      '<button data-action="cancel-rename-project" class="tb-btn-sm" title="Abbrechen">❌</button>';

    var renameBtn = document.querySelector('[data-action="rename-project"]');
    if (renameBtn) renameBtn.style.display = 'none';

    var input = document.getElementById('renameProjectInput');
    if (input) { input.focus(); input.select(); }
  };

  App.confirmRenameProject = async function() {
    var input = document.getElementById('renameProjectInput');
    if (!input) return;
    var newName = input.value.trim();
    if (!newName) { var UI = window.GR.ui; if (UI && UI.toast) UI.toast('Name darf nicht leer sein', 'error', 2000); return; }

    var proj = S.get('currentProject');
    if (!proj) return;

    if (proj.id !== 'legacy' && Proj && Proj.updateProjectName) {
      await Proj.updateProjectName(proj.id, newName);
    }
    proj.name = newName;
    S.set('currentProject', proj);

    var nameEl = document.getElementById('projectName');
    if (nameEl) nameEl.textContent = newName;

    var renameBtn = document.querySelector('[data-action="rename-project"]');
    if (renameBtn) renameBtn.style.display = '';
  };

  App.cancelRenameProject = function() {
    var proj = S.get('currentProject');
    var nameEl = document.getElementById('projectName');
    if (nameEl && proj) nameEl.textContent = proj.name || '';
    var renameBtn = document.querySelector('[data-action="rename-project"]');
    if (renameBtn) renameBtn.style.display = '';
  };

  // ===================================================================
  // Raum kopieren/duplizieren
  // ===================================================================

  App.duplicateRoom = function(key) {
    var rooms = S.get('rooms');
    if (!rooms || !rooms[key]) return;
    var room = rooms[key];
    var newKey = U.generateKey(rooms);
    var offset = 30;

    rooms[newKey] = JSON.parse(JSON.stringify(room));
    rooms[newKey].left = room.left + offset;
    rooms[newKey].top = room.top + offset;
    rooms[newKey].title = room.title + ' (Kopie)';

    S.set('rooms', rooms);
    St.saveData();

    var Rdr = window.GR.renderer;
    if (Rdr && Rdr.render) Rdr.render();

    var UI = window.GR.ui;
    if (UI && UI.toast) UI.toast('📋 Raum dupliziert', 'success', 1500);
  };

  // ===================================================================
  // Raum-Suche
  // ===================================================================

  App.handleRoomSearch = function(query) {
    var rooms = S.get('rooms');
    if (!rooms) return;

    document.querySelectorAll('.ro.search-highlight').forEach(function(el) {
      el.classList.remove('search-highlight');
    });

    query = (query || '').trim().toLowerCase();
    if (!query) return;

    for (var key of Object.keys(rooms)) {
      var room = rooms[key];
      var match = (room.title || '').toLowerCase().indexOf(query) !== -1;
      var roomType = room.type || C.ROOM_TYPE_DEFAULT;
      var typeInfo = C.ROOM_TYPES[roomType];
      if (typeInfo && typeInfo.label.toLowerCase().indexOf(query) !== -1) match = true;
      if (match) {
        var el = document.querySelector('.ro[data-key="' + key + '"]');
        if (el) el.classList.add('search-highlight');
      }
    }
  };

  // ===================================================================
  // Stockwerke verwalten
  // ===================================================================

  App.handleAddFloor = async function() {
    var proj = S.get('currentProject');
    if (!proj || proj.id === 'legacy') {
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('Stockwerke können nur in Cloud-Projekten verwaltet werden', 'warning', 3000);
      return;
    }

    var floorName = 'Stockwerk ' + ((S.get('currentProjectFloors') || []).length + 1);
    var sb = Auth.getSupabase();
    if (!sb) return;

    var result = await sb.from('floors').insert({
      project_id: proj.id,
      name: floorName,
      image_url: '',
      native_width: 1000,
      sort_order: (S.get('currentProjectFloors') || []).length
    }).select('id, name, image_url, native_width, sort_order');

    if (result.error) {
      var UI2 = window.GR.ui;
      if (UI2 && UI2.toast) UI2.toast('❌ Fehler: ' + result.error.message, 'error', 3000);
      return;
    }

    if (result.data && result.data.length > 0) {
      var floors = S.get('currentProjectFloors') || [];
      var newFloor = {
        id: result.data[0].id,
        name: result.data[0].name,
        imageUrl: result.data[0].image_url,
        nativeWidth: result.data[0].native_width,
        sortOrder: result.data[0].sort_order
      };
      floors.push(newFloor);
      S.set('currentProjectFloors', floors);
      if (Proj && Proj.buildFloorUI) Proj.buildFloorUI(floors);

      var UI3 = window.GR.ui;
      if (UI3 && UI3.toast) UI3.toast('✅ ' + floorName + ' hinzugefügt', 'success', 2000);
    }
  };

  App.handleRenameFloor = async function(floorId) {
    var floors = S.get('currentProjectFloors') || [];
    var floor = floors.find(function(f) { return f.id === floorId; });
    if (!floor) return;
    var newName = prompt('Neuer Name für Stockwerk:', floor.name);
    if (!newName || !newName.trim()) return;

    var sb = Auth.getSupabase();
    if (!sb) return;

    await sb.from('floors').update({ name: newName.trim() }).eq('id', floorId);
    floor.name = newName.trim();

    var tab = document.getElementById('tab-' + floorId);
    if (tab) {
      var label = tab.querySelector('.ft-label');
      if (label) label.textContent = newName.trim();
    }
  };

  App.handleDeleteFloor = async function(floorId) {
    var floors = S.get('currentProjectFloors') || [];
    if (floors.length <= 1) {
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('Mindestens ein Stockwerk erforderlich', 'warning', 2000);
      return;
    }
    if (!confirm('Stockwerk wirklich löschen?')) return;

    var sb = Auth.getSupabase();
    if (!sb) return;

    await sb.from('floors').delete().eq('id', floorId);

    var newFloors = floors.filter(function(f) { return f.id !== floorId; });
    S.set('currentProjectFloors', newFloors);

    var rooms = S.get('rooms');
    var changed = false;
    for (var key of Object.keys(rooms)) {
      if (rooms[key].floor === floorId) { delete rooms[key]; changed = true; }
    }
    if (changed) { S.set('rooms', rooms); St.saveData(); }

    if (Proj && Proj.buildFloorUI) Proj.buildFloorUI(newFloors);
    if (S.get('activeFloor') === floorId && newFloors.length > 0) {
      var UI2 = window.GR.ui;
      if (UI2 && UI2.switchFloor) UI2.switchFloor(newFloors[0].id);
    }
  };

  App.showFloorMenu = function(floorId) {
    var choice = confirm('OK = Umbenennen, Abbrechen = Löschen');
    if (choice) { App.handleRenameFloor(floorId); }
    else { App.handleDeleteFloor(floorId); }
  };

  // ===================================================================
  // Action Handlers (data-action delegation)
  // ===================================================================

  App.setupActions = function() {
    document.addEventListener('click', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;

      var action = target.dataset.action;
      var selectedRoom = S.get('selectedRoom');

      switch (action) {
        case 'show-login': App.toggleAuthForm('login'); break;
        case 'show-register': App.toggleAuthForm('register'); break;
        case 'show-reset': App.toggleAuthForm('reset'); break;
        case 'do-login': App.handleLogin(); break;
        case 'do-register': App.handleRegister(); break;
        case 'do-reset': App.handleReset(); break;

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
        case 'project-menu':
          e.stopPropagation();
          e.preventDefault();
          App.showProjectMenu(target.dataset.projectId, target);
          break;
        case 'project-rename':
          App.handleDashboardRename(target.dataset.projectId);
          break;
        case 'project-share':
          App.handleDashboardShare(target.dataset.projectId);
          break;
        case 'project-delete':
          App.handleDeleteProject(target.dataset.projectId);
          break;
        case 'close-project-menu':
          App.closeProjectMenu();
          break;
        case 'logout': App.handleLogout(); break;

        case 'back-to-dashboard':
          Pres.leaveProject();
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

        case 'toggle-dark-mode': App.toggleDarkMode(); break;
        case 'open-settings': App.openSettings(); break;
        case 'close-settings': App.closeSettings(); break;
        case 'rename-project': App.handleRenameProject(); break;
        case 'confirm-rename-project': App.confirmRenameProject(); break;
        case 'cancel-rename-project': App.cancelRenameProject(); break;
        case 'add-floor': App.handleAddFloor(); break;
        case 'manage-floor': App.showFloorMenu(target.dataset.floorId); break;
        case 'rename-floor': App.handleRenameFloor(target.dataset.floorId); break;
        case 'delete-floor': App.handleDeleteFloor(target.dataset.floorId); break;
        case 'duplicate-room':
          if (selectedRoom) App.duplicateRoom(selectedRoom);
          break;

        case 'ob-cancel':
          var OB2 = window.GR.onboarding;
          if (OB2 && OB2.closeWizard) OB2.closeWizard();
          break;
        case 'ob-next':
          var OB3 = window.GR.onboarding;
          if (OB3) {
            // Projektname aus Input lesen BEVOR Step 2 gerendert wird (DOM wird zerstört)
            var nameInput = document.getElementById('obProjectName');
            if (nameInput) OB3._projectName = nameInput.value.trim();
            OB3._wizardStep = 2;
            OB3.renderWizard();
          }
          break;
        case 'ob-back':
          var OB4 = window.GR.onboarding;
          if (OB4) { OB4._wizardStep = 1; OB4.renderWizard(); }
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

        case 'send-invite':
          var Collab3 = window.GR.collaboration;
          if (Collab3 && Collab3.sendInviteFromModal) Collab3.sendInviteFromModal();
          break;
        case 'remove-member':
          App.handleRemoveMember(target.dataset.memberId);
          break;
      }
    });

    document.addEventListener('change', function(e) {
      var target = e.target;
      var action = target.dataset.actionChange;
      if (!action) return;

      switch (action) {
        case 'ob-upload-floor':
          var OB8 = window.GR.onboarding;
          if (OB8 && OB8.handleFloorUpload) {
            var idx = parseInt(target.dataset.floorIndex);
            if (target.files && target.files[0]) OB8.handleFloorUpload(idx, target.files[0]);
          }
          break;
        case 'change-role':
          var Collab = window.GR.collaboration;
          var project = S.get('currentProject');
          if (Collab && project) Collab.changeRole(project.id, target.dataset.memberId, target.value);
          break;
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      var id = e.target.id;
      if (id === 'loginEmail' || id === 'loginPassword') { App.handleLogin(); }
      else if (id === 'regEmail' || id === 'regPassword' || id === 'regName') { App.handleRegister(); }
      else if (id === 'resetEmail') { App.handleReset(); }
      else if (id === 'renameProjectInput') { App.confirmRenameProject(); }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', function(e) {
      var selectedRoom = S.get('selectedRoom');
      if (!selectedRoom) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        App.duplicateRoom(selectedRoom);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        var R = window.GR.rooms;
        if (R && R.deleteRoom) R.deleteRoom(selectedRoom);
      }
    });

    // Raum-Suche
    document.addEventListener('input', function(e) {
      if (e.target.id === 'roomSearch') App.handleRoomSearch(e.target.value);
    });

    // Klick auf Grundriss-Hintergrund schließt Details
    document.addEventListener('click', function(e) {
      var planEl = e.target.closest('.pw');
      if (planEl && !e.target.closest('.ro') && !e.target.closest('.rh')) {
        var UI = window.GR.ui;
        if (UI) {
          S.set('selectedRoom', null);
          UI.closeSidebar();
          var sc = document.getElementById('sc');
          if (sc) sc.innerHTML = '<p class="hint">\uD83D\uDC46 Raum antippen</p>';
        }
      }
    });

    // Details-Toggle: Sidebar öffnen/schließen
    document.addEventListener('click', function(e) {
      if (e.target.closest('#sbToggle')) {
        var _UI = window.GR.ui;
        if (_UI && _UI.toggleSidebar) _UI.toggleSidebar();
      }
    });
  };

  // ===================================================================
  // Auth Form Handlers
  // ===================================================================

  App.toggleAuthForm = function(form) {
    var loginForm = document.getElementById('loginForm');
    var regForm = document.getElementById('registerForm');
    var resetForm = document.getElementById('resetForm');
    if (!loginForm || !regForm || !resetForm) return;
    loginForm.style.display = form === 'login' ? '' : 'none';
    regForm.style.display = form === 'register' ? '' : 'none';
    resetForm.style.display = form === 'reset' ? '' : 'none';
  };

  App.handleLogin = async function() {
    var email = document.getElementById('loginEmail')?.value?.trim();
    var password = document.getElementById('loginPassword')?.value;
    var errorEl = document.getElementById('loginError');
    if (errorEl) errorEl.textContent = '';
    if (!email || !password) { if (errorEl) errorEl.textContent = 'Bitte E-Mail und Passwort eingeben'; return; }

    var btn = document.querySelector('[data-action="do-login"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Anmelden...'; }

    try {
      var result = await Auth.login(email, password);
      if (!result.ok) {
        if (errorEl) errorEl.textContent = result.error || 'Anmeldung fehlgeschlagen';
        if (btn) { btn.disabled = false; btn.textContent = 'Anmelden'; }
      }
    } catch (e) {
      if (errorEl) errorEl.textContent = 'Unerwarteter Fehler: ' + e.message;
      if (btn) { btn.disabled = false; btn.textContent = 'Anmelden'; }
    }
  };

  App.handleRegister = async function() {
    var name = document.getElementById('regName')?.value?.trim();
    var email = document.getElementById('regEmail')?.value?.trim();
    var password = document.getElementById('regPassword')?.value;
    var errorEl = document.getElementById('regError');

    if (!name || !email || !password) { if (errorEl) errorEl.textContent = 'Bitte alle Felder ausfüllen'; return; }
    if (password.length < 6) { if (errorEl) errorEl.textContent = 'Passwort muss mind. 6 Zeichen haben'; return; }

    var btn = document.querySelector('[data-action="do-register"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Registrieren...'; }

    try {
      var result = await Auth.register(email, password, name);
      if (!result.ok) {
        if (errorEl) errorEl.textContent = result.error || 'Registrierung fehlgeschlagen';
        if (btn) { btn.disabled = false; btn.textContent = 'Registrieren'; }
      } else if (result.needsConfirmation) {
        var UI = window.GR.ui;
        if (UI && UI.toast) UI.toast('✅ Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse.', 'success', 5000);
        if (btn) { btn.disabled = false; btn.textContent = 'Registrieren'; }
        App.toggleAuthForm('login');
      }
    } catch (e) {
      if (errorEl) errorEl.textContent = 'Unerwarteter Fehler: ' + e.message;
      if (btn) { btn.disabled = false; btn.textContent = 'Registrieren'; }
    }
  };

  App.handleReset = async function() {
    var email = document.getElementById('resetEmail')?.value?.trim();
    var errorEl = document.getElementById('resetError');
    if (!email) { if (errorEl) errorEl.textContent = 'Bitte E-Mail eingeben'; return; }

    var result = await Auth.resetPassword(email);
    if (result.ok) {
      if (errorEl) { errorEl.textContent = ''; errorEl.style.color = 'var(--green)'; errorEl.textContent = '✅ E-Mail gesendet!'; }
    } else {
      if (errorEl) { errorEl.style.color = ''; errorEl.textContent = result.error || 'Fehler beim Senden'; }
    }
  };

  App.handleOpenProject = async function(projectId) {
    if (!projectId) return;
    var success = await Proj.openProject(projectId);
    if (success) {
      var proj = S.get('currentProject');
      var nameEl = document.getElementById('projectName');
      if (nameEl && proj) nameEl.textContent = proj.name || '';
      App.showView('editor');
      var Rdr = window.GR.renderer;
      if (Rdr && Rdr.render) Rdr.render();
      Sync.updateTabBadges();
      // Presence
      if (Pres && Pres.joinProject && proj) Pres.joinProject(proj.id);
    } else {
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('❌ Projekt konnte nicht geladen werden', 'error', 3000);
    }
  };

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

  App.handleLogout = async function() {
    Pres.leaveProject();
    await Auth.logout();
    St.clearLocal();
    App.showView('auth');
  };

  App.handleRemoveMember = async function(memberId) {
    if (!memberId) return;
    var Collab = window.GR.collaboration;
    var project = S.get('currentProject');
    if (!Collab || !project) return;

    var result = await Collab.removeMember(project.id, memberId);
    if (result.ok) { Collab.showShareModal(); }
  };

  // ===================================================================
  // Project Context Menu (Dashboard "⋯")
  // ===================================================================

  App.showProjectMenu = function(projectId, btnEl) {
    App.closeProjectMenu();
    var rect = btnEl.getBoundingClientRect();
    var menu = document.createElement('div');
    menu.id = 'projectContextMenu';
    menu.style.cssText = 'position:fixed;z-index:300;background:var(--card);border:1px solid var(--border);border-radius:var(--rm);box-shadow:0 8px 24px rgba(0,0,0,.15);padding:4px 0;min-width:180px';
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.innerHTML =
      '<div data-action="project-rename" data-project-id="' + U.escAttr(projectId) + '" style="padding:10px 16px;cursor:pointer;font-size:14px;display:flex;align-items:center;gap:8px">✏️ Umbenennen</div>' +
      '<div data-action="project-share" data-project-id="' + U.escAttr(projectId) + '" style="padding:10px 16px;cursor:pointer;font-size:14px;display:flex;align-items:center;gap:8px">👥 Teilen</div>' +
      '<div style="border-top:1px solid var(--border);margin:4px 0"></div>' +
      '<div data-action="project-delete" data-project-id="' + U.escAttr(projectId) + '" style="padding:10px 16px;cursor:pointer;font-size:14px;display:flex;align-items:center;gap:8px;color:var(--red)">🗑️ Löschen</div>';
    document.body.appendChild(menu);
    setTimeout(function() {
      document.addEventListener('click', App._closeMenuOnOutside);
    }, 10);
  };

  App.closeProjectMenu = function() {
    var menu = document.getElementById('projectContextMenu');
    if (menu) menu.remove();
    document.removeEventListener('click', App._closeMenuOnOutside);
  };

  App._closeMenuOnOutside = function(e) {
    var menu = document.getElementById('projectContextMenu');
    if (menu && !menu.contains(e.target)) App.closeProjectMenu();
  };

  App.handleDashboardRename = async function(projectId) {
    App.closeProjectMenu();
    var newName = prompt('Neuer Projektname:');
    if (!newName || !newName.trim()) return;
    if (Proj && Proj.updateProjectName) {
      await Proj.updateProjectName(projectId, newName.trim());
    }
    var proj = S.get('currentProject');
    if (proj && proj.id === projectId) {
      proj.name = newName.trim();
      S.set('currentProject', proj);
      var nameEl = document.getElementById('projectName');
      if (nameEl) nameEl.textContent = newName.trim();
    }
    App.renderDashboard();
    var UI = window.GR.ui;
    if (UI && UI.toast) UI.toast('✅ Umbenannt', 'success', 1500);
  };

  App.handleDashboardShare = function(projectId) {
    App.closeProjectMenu();
    var Collab = window.GR.collaboration;
    if (Collab && Collab.showShareModalForProject) {
      Collab.showShareModalForProject(projectId);
    } else if (Collab && Collab.showShareModal) {
      Collab.showShareModal();
    }
  };

  // Details-Toggle: Klick auf #sbToggle öffnet/schließt Sidebar
  App._detailToggleInit = false;

  // ===================================================================
  // Auto-Init bei DOM Ready
  // ===================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
  } else {
    App.init();
  }

})(window.GR.app = window.GR.app || {});