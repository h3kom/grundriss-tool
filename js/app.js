/**
 * Grundriss Tool – App-Initialisierung & Routing
 * =====================================================================
 * @module app
 * @description Entry point – importiert alle Module und startet die App.
 */
import { INTRO_SEEN_KEY, DARK_MODE_KEY, EVT_AUTH_CHANGED, SUPABASE_URL, SUPABASE_ANON_KEY, MIN_ROOM_SIZE, NATIVE_WIDTHS, FLOORS, MAX_UNDO, SYNC_INTERVAL, LOCAL_STORAGE_KEY, SUPABASE_TABLE, SUPABASE_ROW_ID, EVT_ROOMS_CHANGED, EVT_SELECTION_CHANGED, EVT_EDIT_MODE_CHANGED, EVT_FLOOR_CHANGED, EVT_SYNC_STATUS_CHANGED, EVT_PROJECT_CHANGED, DRAG_DEAD_ZONE, HANDLE_DIRECTIONS, SCALE_CACHE_TTL, CLOUD_SYNC_DEBOUNCE, TOAST_MAX_COUNT, SEARCH_DEBOUNCE, ROOM_TYPES, ROOM_TYPE_DEFAULT, SNAP_DISTANCE, SNAP_ENABLED, EVT_PRESENCE_CHANGED, TIME_THRESHOLD_MINUTE, TIME_THRESHOLD_HOUR, TIME_THRESHOLD_DAY } from './constants.js';
import * as S from './state.js';
import { escHtml, escAttr, generateKey } from './utils.js';
import { updateTabBadges } from './sync.js';
import * as Auth from './auth.js';
import * as St from './storage.js';
import * as Proj from './projects.js';
import * as Pres from './presence.js';
import * as Mig from './migration.js';

// ===================================================================
// window.GR namespace – for lazy cross-module references
// ===================================================================
window.GR = window.GR || {};
window.GR.state = S;
window.GR.constants = { SUPABASE_URL, SUPABASE_ANON_KEY, MIN_ROOM_SIZE, NATIVE_WIDTHS, FLOORS, MAX_UNDO, SYNC_INTERVAL, LOCAL_STORAGE_KEY, INTRO_SEEN_KEY, SUPABASE_TABLE, SUPABASE_ROW_ID, EVT_ROOMS_CHANGED, EVT_SELECTION_CHANGED, EVT_EDIT_MODE_CHANGED, EVT_FLOOR_CHANGED, EVT_SYNC_STATUS_CHANGED, EVT_AUTH_CHANGED, EVT_PROJECT_CHANGED, DRAG_DEAD_ZONE, HANDLE_DIRECTIONS, SCALE_CACHE_TTL, CLOUD_SYNC_DEBOUNCE, TOAST_MAX_COUNT, SEARCH_DEBOUNCE, ROOM_TYPES, ROOM_TYPE_DEFAULT, SNAP_DISTANCE, SNAP_ENABLED, DARK_MODE_KEY, EVT_PRESENCE_CHANGED, TIME_THRESHOLD_MINUTE, TIME_THRESHOLD_HOUR, TIME_THRESHOLD_DAY };
window.GR.utils = { escHtml, escAttr, generateKey, getScale, getPointerPos, detectFloorId, taskProgress, formatLastEdit, deepClone, ensureRoomFields, ensureAllRooms, completedTaskCount, isValidKey, getDeviceId, _resetScaleCache };
window.GR.sync = { updateTabBadges };
window.GR.auth = Auth;
window.GR.storage = St;
window.GR.projects = Proj;
window.GR.presence = Pres;
window.GR.migration = Mig;

// Lazy-load remaining modules into window.GR
async function loadModules() {
  const [rooms, renderer, detailRenderer, overviewRenderer, drag, resize,
    interaction, placeRoom, ui, demoTemplate, collaboration, onboarding,
    exportMod, cloud] = await Promise.all([
    import('./rooms.js'),
    import('./renderer.js'),
    import('./detail-renderer.js'),
    import('./overview-renderer.js'),
    import('./drag.js'),
    import('./resize.js'),
    import('./interaction.js'),
    import('./place-room.js'),
    import('./ui.js'),
    import('./demo-template.js'),
    import('./collaboration.js'),
    import('./onboarding.js'),
    import('./export.js'),
    import('./cloud.js')
  ]);
  window.GR.rooms = rooms;
  window.GR.renderer = renderer;
  window.GR.detailRenderer = detailRenderer;
  window.GR.overviewRenderer = overviewRenderer;
  window.GR.drag = drag;
  window.GR.resize = resize;
  window.GR.interaction = interaction;
  window.GR.placeRoom = placeRoom;
  window.GR.ui = ui;
  window.GR.demoTemplate = demoTemplate;
  window.GR.collaboration = collaboration;
  window.GR.onboarding = onboarding;
  window.GR.exportMod = exportMod;
  window.GR.cloud = cloud;
  window.GR.sync = await import('./sync.js');
}

// ===================================================================
// View Management
// ===================================================================

function showView(view) {
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
      renderDashboard();
      break;
    case 'editor':
      if (editorView) editorView.style.display = '';
      break;
  }
}

// ===================================================================
// Dashboard Rendering
// ===================================================================

async function renderDashboard() {
  var container = document.getElementById('dashProjects');
  var userInfo = document.getElementById('dashUser');
  if (!container) return;
  var user = S.get('currentUser');
  if (!user) return;

  if (userInfo) {
    userInfo.innerHTML =
      '<span class="dash-user-name">' + escHtml(user.displayName) + '</span>' +
      '<span class="dash-user-email">' + escHtml(user.email) + '</span>' +
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
        '<div class="dash-card" data-action="open-project" data-project-id="' + escAttr(p.id) + '">' +
          '<div class="dash-card-icon">🏢</div>' +
          '<div class="dash-card-info">' +
            '<div class="dash-card-name">' + escHtml(p.name) + '</div>' +
            '<div class="dash-card-date">' + dateStr + '</div>' +
          '</div>' +
          '<div class="dash-card-actions">' +
            '<button data-action="project-menu" data-project-id="' + escAttr(p.id) + '" class="dash-card-delete" title="Mehr">⋯</button>' +
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
        '<div class="dash-card" data-action="open-project" data-project-id="' + escAttr(s.id) + '">' +
          '<div class="dash-card-icon">🤝</div>' +
          '<div class="dash-card-info">' +
            '<div class="dash-card-name">' + escHtml(s.name) + '</div>' +
            '<div class="dash-card-date">Von ' + escHtml(s.ownerName) + ' · ' + dateStr2 + '</div>' +
          '</div>' +
        '</div>';
    }
    html += '</div>';
  }

  html = '<button data-action="new-project" class="dash-btn-new">+ Neues Projekt</button>' + html;

  if (result.owned.length === 0 && result.shared.length === 0) {
    html += '<div class="dash-empty"><div class="dash-empty-icon">🏗️</div><p>Noch keine Projekte vorhanden.</p><p>Erstelle dein erstes Projekt!</p></div>';
  }

  container.innerHTML = html;
}

// ===================================================================
// Auth Event Handlers
// ===================================================================

S.subscribe(EVT_AUTH_CHANGED, function(data) {
  if (data && data.authenticated) {
    handlePostLogin();
  } else {
    showView('auth');
  }
});

async function handlePostLogin() {
  try {
    if (Mig && !Mig.isMigrated()) {
      await Mig.migrateLocalData();
    }
  } catch (e) {
    console.warn('[app] Migration error (non-fatal):', e);
  }
  showView('dashboard');
}

// ===================================================================
// App Initialization
// ===================================================================

async function init() {
  await loadModules();
  Auth.initSupabase();
  setupActions();
  initDarkMode();

  if (Auth.isAvailable()) {
    var session = await Auth.getSession();
    if (session && session.user) {
      Auth.onSignIn(session.user);
      return;
    }
    showView('auth');
  } else {
    initLegacyMode();
  }
}

async function initLegacyMode() {
  S.set('currentProjectFloors', [
    { id: 'eg', name: 'Erdgeschoss', imageUrl: 'EG.png', nativeWidth: 1000, sortOrder: 0 },
    { id: 'og', name: 'Obergeschoss', imageUrl: 'OG.png', nativeWidth: 800, sortOrder: 1 }
  ]);
  S.set('currentProject', { id: 'legacy', name: 'Lokales Projekt', ownerId: null, roomsRowId: null });

  var rooms = await St.loadData(true);
  if (rooms) S.set('rooms', rooms);

  S.set('activeFloor', 'eg');
  var nameEl = document.getElementById('projectName');
  if (nameEl) nameEl.textContent = 'Lokales Projekt';
  showView('editor');

  if (!localStorage.getItem(INTRO_SEEN_KEY)) {
    var UI = window.GR.ui;
    if (UI && UI.showIntro) UI.showIntro();
  }

  var Rdr = window.GR.renderer;
  if (Rdr && Rdr.render) Rdr.render();
  updateTabBadges();
}

// ===================================================================
// Dark Mode
// ===================================================================

function toggleDarkMode() {
  var isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem(DARK_MODE_KEY, isDark ? '1' : '0');
  updateDarkModeToggle();
}

function updateDarkModeToggle() {
  var isDark = document.documentElement.classList.contains('dark');
  var toggle = document.getElementById('settingsDarkToggle');
  if (toggle) {
    toggle.textContent = isDark ? 'An' : 'Aus';
    toggle.classList.toggle('active', isDark);
  }
}

function initDarkMode() {
  var saved = localStorage.getItem(DARK_MODE_KEY);
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isDark = saved !== null ? saved === '1' : prefersDark;
  if (isDark) document.documentElement.classList.add('dark');
  updateDarkModeToggle();
}

function openSettings() {
  updateDarkModeToggle();
  var modal = document.getElementById('settingsModal');
  if (modal) modal.classList.add('open');
}

function closeSettings() {
  var modal = document.getElementById('settingsModal');
  if (modal) modal.classList.remove('open');
}

// ===================================================================
// Projekt umbenennen
// ===================================================================

function handleRenameProject() {
  if (!S.get('editMode')) return;
  var proj = S.get('currentProject');
  if (!proj) return;
  var nameEl = document.getElementById('projectName');
  if (!nameEl) return;
  nameEl.innerHTML = '<input type="text" id="renameProjectInput" class="tb-rename-input" value="' + escAttr(proj.name || '') + '" />' +
    '<button data-action="confirm-rename-project" class="tb-btn-sm" title="Speichern">✅</button>' +
    '<button data-action="cancel-rename-project" class="tb-btn-sm" title="Abbrechen">❌</button>';
  var renameBtn = document.querySelector('[data-action="rename-project"]');
  if (renameBtn) renameBtn.style.display = 'none';
  var input = document.getElementById('renameProjectInput');
  if (input) { input.focus(); input.select(); }
}

async function confirmRenameProject() {
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
}

function cancelRenameProject() {
  var proj = S.get('currentProject');
  var nameEl = document.getElementById('projectName');
  if (nameEl && proj) nameEl.textContent = proj.name || '';
  var renameBtn = document.querySelector('[data-action="rename-project"]');
  if (renameBtn) renameBtn.style.display = '';
}

// ===================================================================
// Raum duplizieren
// ===================================================================

function duplicateRoom(key) {
  var rooms = S.get('rooms');
  if (!rooms || !rooms[key]) return;
  var room = rooms[key];
  var newKey = generateKey(rooms);
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
}

// ===================================================================
// Stockwerke verwalten
// ===================================================================

async function handleAddFloor() {
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
    project_id: proj.id, name: floorName, image_url: '', native_width: 1000,
    sort_order: (S.get('currentProjectFloors') || []).length
  }).select('id, name, image_url, native_width, sort_order');
  if (result.error) {
    var UI2 = window.GR.ui;
    if (UI2 && UI2.toast) UI2.toast('❌ Fehler: ' + result.error.message, 'error', 3000);
    return;
  }
  if (result.data && result.data.length > 0) {
    var floors = S.get('currentProjectFloors') || [];
    floors.push({
      id: result.data[0].id, name: result.data[0].name,
      imageUrl: result.data[0].image_url, nativeWidth: result.data[0].native_width,
      sortOrder: result.data[0].sort_order
    });
    S.set('currentProjectFloors', floors);
    if (Proj && Proj.buildFloorUI) Proj.buildFloorUI(floors);
    var UI3 = window.GR.ui;
    if (UI3 && UI3.toast) UI3.toast('✅ ' + floorName + ' hinzugefügt', 'success', 2000);
  }
}

async function handleRenameFloor(floorId) {
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
  if (tab) { var label = tab.querySelector('.ft-label'); if (label) label.textContent = newName.trim(); }
}

async function handleDeleteFloor(floorId) {
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
}

function showFloorMenu(floorId) {
  var choice = confirm('OK = Umbenennen, Abbrechen = Löschen');
  if (choice) handleRenameFloor(floorId);
  else handleDeleteFloor(floorId);
}

// ===================================================================
// Action Handlers (data-action delegation)
// ===================================================================

function setupActions() {
  document.addEventListener('click', function(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;
    var selectedRoom = S.get('selectedRoom');

    switch (action) {
      case 'show-login': toggleAuthForm('login'); break;
      case 'show-register': toggleAuthForm('register'); break;
      case 'show-reset': toggleAuthForm('reset'); break;
      case 'do-login': handleLogin(); break;
      case 'do-register': handleRegister(); break;
      case 'do-reset': handleReset(); break;
      case 'new-project':
        var OB = window.GR.onboarding;
        if (OB && OB.openWizard) OB.openWizard();
        break;
      case 'open-project':
        e.stopPropagation();
        handleOpenProject(target.dataset.projectId);
        break;
      case 'delete-project':
        e.stopPropagation();
        handleDeleteProject(target.dataset.projectId);
        break;
      case 'project-menu':
        e.stopPropagation(); e.preventDefault();
        showProjectMenu(target.dataset.projectId, target);
        break;
      case 'project-rename': handleDashboardRename(target.dataset.projectId); break;
      case 'project-share': handleDashboardShare(target.dataset.projectId); break;
      case 'project-delete': handleDeleteProject(target.dataset.projectId); break;
      case 'project-export': handleDashboardExport(target.dataset.projectId); break;
      case 'project-import': handleDashboardImport(target.dataset.projectId); break;
      case 'close-project-menu': closeProjectMenu(); break;
      case 'logout': handleLogout(); break;
      case 'back-to-dashboard':
        Pres.leaveProject();
        showView('dashboard');
        break;
      case 'share-project':
        var Collab = window.GR.collaboration;
        if (Collab && Collab.showShareModal) Collab.showShareModal();
        break;
      case 'close-share':
        var Collab2 = window.GR.collaboration;
        if (Collab2 && Collab2.closeShareModal) Collab2.closeShareModal();
        break;
      case 'toggle-dark-mode': toggleDarkMode(); break;
      case 'open-settings': openSettings(); break;
      case 'close-settings': closeSettings(); break;
      case 'rename-project': handleRenameProject(); break;
      case 'confirm-rename-project': confirmRenameProject(); break;
      case 'cancel-rename-project': cancelRenameProject(); break;
      case 'add-floor': handleAddFloor(); break;
      case 'manage-floor': showFloorMenu(target.dataset.floorId); break;
      case 'rename-floor': handleRenameFloor(target.dataset.floorId); break;
      case 'delete-floor': handleDeleteFloor(target.dataset.floorId); break;
      case 'duplicate-room':
        if (selectedRoom) duplicateRoom(selectedRoom);
        break;
      case 'open-project-settings':
        var ExpPS = window.GR.exportMod;
        if (ExpPS && ExpPS.openProjectSettings) ExpPS.openProjectSettings();
        break;
      case 'close-project-settings':
        var ExpCS = window.GR.exportMod;
        if (ExpCS && ExpCS.closeProjectSettings) ExpCS.closeProjectSettings();
        break;
      case 'ps-dropzone-click': break;
      case 'ps-do-import':
        var ExpImp = window.GR.exportMod;
        if (ExpImp && ExpImp.doProjectSettingsImport) ExpImp.doProjectSettingsImport();
        break;
      case 'ps-do-export':
        var ExpExp = window.GR.exportMod;
        if (ExpExp && ExpExp.exportProject) ExpExp.exportProject();
        break;
      case 'ob-cancel':
        var OB2 = window.GR.onboarding;
        if (OB2 && OB2.closeWizard) OB2.closeWizard();
        break;
      case 'ob-next':
        var OB3 = window.GR.onboarding;
        if (OB3) {
          var nameInput = document.getElementById('obProjectName');
          if (nameInput && nameInput.value.trim()) OB3._projectName = nameInput.value.trim();
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
        handleRemoveMember(target.dataset.memberId);
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
    if (id === 'loginEmail' || id === 'loginPassword') handleLogin();
    else if (id === 'regEmail' || id === 'regPassword' || id === 'regName') handleRegister();
    else if (id === 'resetEmail') handleReset();
    else if (id === 'renameProjectInput') confirmRenameProject();
  });

  document.addEventListener('keydown', function(e) {
    var selectedRoom = S.get('selectedRoom');
    if (!selectedRoom) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      duplicateRoom(selectedRoom);
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      var R = window.GR.rooms;
      if (R && R.deleteRoom) R.deleteRoom(selectedRoom);
    }
  });

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

  document.addEventListener('click', function(e) {
    if (e.target.closest('#sbToggle')) {
      var _UI = window.GR.ui;
      if (_UI && _UI.toggleSidebar) _UI.toggleSidebar();
    }
  });
}

// ===================================================================
// Auth Form Handlers
// ===================================================================

function toggleAuthForm(form) {
  var loginForm = document.getElementById('loginForm');
  var regForm = document.getElementById('registerForm');
  var resetForm = document.getElementById('resetForm');
  if (!loginForm || !regForm || !resetForm) return;
  loginForm.style.display = form === 'login' ? '' : 'none';
  regForm.style.display = form === 'register' ? '' : 'none';
  resetForm.style.display = form === 'reset' ? '' : 'none';
}

async function handleLogin() {
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
}

async function handleRegister() {
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
      toggleAuthForm('login');
    }
  } catch (e) {
    if (errorEl) errorEl.textContent = 'Unerwarteter Fehler: ' + e.message;
    if (btn) { btn.disabled = false; btn.textContent = 'Registrieren'; }
  }
}

async function handleReset() {
  var email = document.getElementById('resetEmail')?.value?.trim();
  var errorEl = document.getElementById('resetError');
  if (!email) { if (errorEl) errorEl.textContent = 'Bitte E-Mail eingeben'; return; }
  var result = await Auth.resetPassword(email);
  if (result.ok) {
    if (errorEl) { errorEl.textContent = ''; errorEl.style.color = 'var(--green)'; errorEl.textContent = '✅ E-Mail gesendet!'; }
  } else {
    if (errorEl) { errorEl.style.color = ''; errorEl.textContent = result.error || 'Fehler beim Senden'; }
  }
}

async function handleOpenProject(projectId) {
  if (!projectId) return;
  var success = await Proj.openProject(projectId);
  if (success) {
    var proj = S.get('currentProject');
    var nameEl = document.getElementById('projectName');
    if (nameEl && proj) nameEl.textContent = proj.name || '';
    showView('editor');
    var Rdr = window.GR.renderer;
    if (Rdr && Rdr.render) Rdr.render();
    updateTabBadges();
    if (Pres && Pres.joinProject && proj) Pres.joinProject(proj.id);
  } else {
    var UI = window.GR.ui;
    if (UI && UI.toast) UI.toast('❌ Projekt konnte nicht geladen werden', 'error', 3000);
  }
}

async function handleDeleteProject(projectId) {
  if (!projectId) return;
  if (!confirm('Projekt wirklich löschen? Alle Daten gehen verloren.')) return;
  var result = await Proj.deleteProject(projectId);
  if (result.ok) {
    renderDashboard();
    var UI = window.GR.ui;
    if (UI && UI.toast) UI.toast('🗑️ Projekt gelöscht', 'success', 2000);
  }
}

async function handleLogout() {
  Pres.leaveProject();
  await Auth.logout();
  St.clearLocal();
  showView('auth');
}

async function handleRemoveMember(memberId) {
  if (!memberId) return;
  var Collab = window.GR.collaboration;
  var project = S.get('currentProject');
  if (!Collab || !project) return;
  var result = await Collab.removeMember(project.id, memberId);
  if (result.ok) Collab.showShareModal();
}

// ===================================================================
// Project Context Menu
// ===================================================================

function showProjectMenu(projectId, btnEl) {
  closeProjectMenu();
  var rect = btnEl.getBoundingClientRect();
  var menu = document.createElement('div');
  menu.id = 'projectContextMenu';
  menu.style.cssText = 'position:fixed;z-index:300;background:var(--card);border:1px solid var(--border);border-radius:var(--rm);box-shadow:0 8px 24px rgba(0,0,0,.15);padding:4px 0;min-width:180px';
  menu.style.top = rect.bottom + 4 + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  menu.innerHTML =
    '<div data-action="project-rename" data-project-id="' + escAttr(projectId) + '" style="padding:10px 16px;cursor:pointer;font-size:14px;display:flex;align-items:center;gap:8px">✏️ Umbenennen</div>' +
    '<div data-action="project-share" data-project-id="' + escAttr(projectId) + '" style="padding:10px 16px;cursor:pointer;font-size:14px;display:flex;align-items:center;gap:8px">👥 Teilen</div>' +
    '<div style="border-top:1px solid var(--border);margin:4px 0"></div>' +
    '<div data-action="project-export" data-project-id="' + escAttr(projectId) + '" style="padding:10px 16px;cursor:pointer;font-size:14px;display:flex;align-items:center;gap:8px">💾 Als JSON exportieren</div>' +
    '<div data-action="project-import" data-project-id="' + escAttr(projectId) + '" style="padding:10px 16px;cursor:pointer;font-size:14px;display:flex;align-items:center;gap:8px">📂 JSON importieren</div>' +
    '<div style="border-top:1px solid var(--border);margin:4px 0"></div>' +
    '<div data-action="project-delete" data-project-id="' + escAttr(projectId) + '" style="padding:10px 16px;cursor:pointer;font-size:14px;display:flex;align-items:center;gap:8px;color:var(--red)">🗑️ Löschen</div>';
  document.body.appendChild(menu);
  setTimeout(function() { document.addEventListener('click', _closeMenuOnOutside); }, 10);
}

function closeProjectMenu() {
  var menu = document.getElementById('projectContextMenu');
  if (menu) menu.remove();
  document.removeEventListener('click', _closeMenuOnOutside);
}

function _closeMenuOnOutside(e) {
  var menu = document.getElementById('projectContextMenu');
  if (menu && !menu.contains(e.target)) closeProjectMenu();
}

async function handleDashboardRename(projectId) {
  closeProjectMenu();
  var newName = prompt('Neuer Projektname:');
  if (!newName || !newName.trim()) return;
  if (Proj && Proj.updateProjectName) await Proj.updateProjectName(projectId, newName.trim());
  var proj = S.get('currentProject');
  if (proj && proj.id === projectId) {
    proj.name = newName.trim();
    S.set('currentProject', proj);
    var nameEl = document.getElementById('projectName');
    if (nameEl) nameEl.textContent = newName.trim();
  }
  renderDashboard();
  var UI = window.GR.ui;
  if (UI && UI.toast) UI.toast('✅ Umbenannt', 'success', 1500);
}

function handleDashboardShare(projectId) {
  closeProjectMenu();
  var Collab = window.GR.collaboration;
  if (Collab && Collab.showShareModalForProject) Collab.showShareModalForProject(projectId);
  else if (Collab && Collab.showShareModal) Collab.showShareModal();
}

async function handleDashboardExport(projectId) {
  closeProjectMenu();
  var success = await Proj.openProject(projectId);
  if (!success) { var UI = window.GR.ui; if (UI && UI.toast) UI.toast('❌ Projekt konnte nicht geladen werden', 'error', 3000); return; }
  var Exp = window.GR.exportMod;
  if (Exp && Exp.exportProject) Exp.exportProject();
  showView('dashboard');
}

async function handleDashboardImport(projectId) {
  closeProjectMenu();
  var success = await Proj.openProject(projectId);
  if (!success) { var UI = window.GR.ui; if (UI && UI.toast) UI.toast('❌ Projekt konnte nicht geladen werden', 'error', 3000); return; }
  var proj = S.get('currentProject');
  var nameEl = document.getElementById('projectName');
  if (nameEl && proj) nameEl.textContent = proj.name || '';
  showView('editor');
  var Rdr = window.GR.renderer;
  if (Rdr && Rdr.render) Rdr.render();
  updateTabBadges();
  var ExpPS = window.GR.exportMod;
  if (ExpPS && ExpPS.openProjectSettings) ExpPS.openProjectSettings();
}

// ===================================================================
// Auto-Init
// ===================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}