/**
 * Grundriss Tool – Projekt-Verwaltung
 * =====================================================================
 * @module projects
 * @description CRUD für Projekte, Dashboard-Rendering, Projekt-Auswahl.
 * Kommuniziert mit Supabase über den Auth-Client.
 */
window.GR = window.GR || {};

(function(Proj) {
  'use strict';

  var C = window.GR.constants;
  var S = window.GR.state;
  var U = window.GR.utils;
  var Auth = window.GR.auth;

  // ===================================================================
  // API Helpers (via Supabase Client)
  // ===================================================================

  /**
   * Führt eine Supabase REST-Abfrage durch.
   * @param {string} table - Tabellenname
   * @param {Object} options - Query-Optionen
   * @returns {Promise<Array>}
   */
  async function query(table, options) {
    var sb = Auth.getSupabase();
    if (!sb) return [];
    var q = sb.from(table).select(options.select || '*');
    if (options.filter) {
      for (var key of Object.keys(options.filter)) {
        q = q.eq(key, options.filter[key]);
      }
    }
    if (options.order) q = q.order(options.order.column, { ascending: options.order.ascending !== false });
    var result = await q;
    if (result.error) {
      console.warn('[projects] query error:', result.error.message);
      return [];
    }
    return result.data || [];
  }

  // ===================================================================
  // Projekt CRUD
  // ===================================================================

  /**
   * Lädt alle Projekte des aktuellen Users (owned + shared).
   * @returns {Promise<{owned: Array, shared: Array}>}
   */
  Proj.loadProjects = async function() {
    var user = S.get('currentUser');
    if (!user) return { owned: [], shared: [] };

    var sb = Auth.getSupabase();
    if (!sb) return { owned: [], shared: [] };

    try {
      // Eigene Projekte
      var ownedResult = await sb.from('projects')
        .select('id, name, created_at, updated_at')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false });
      var owned = ownedResult.data || [];

      // Geteilte Projekte (über project_members)
      var memberResult = await sb.from('project_members')
        .select('role, projects(id, name, created_at, updated_at, owner_id, profiles(display_name))')
        .eq('user_id', user.id);
      var shared = (memberResult.data || [])
        .filter(function(m) { return m.projects; })
        .map(function(m) {
          return {
            id: m.projects.id,
            name: m.projects.name,
            created_at: m.projects.created_at,
            updated_at: m.projects.updated_at,
            ownerName: m.projects.profiles?.display_name || 'Unbekannt',
            role: m.role
          };
        });

      return { owned: owned, shared: shared };
    } catch (e) {
      console.warn('[projects] loadProjects error:', e.message);
      return { owned: [], shared: [] };
    }
  };

  /**
   * Erstellt ein neues Projekt mit Stockwerken und Demo-Räumen.
   * @param {string} name - Projektname
   * @param {Array<{name: string, imageFile?: File, imageUrl?: string, nativeWidth?: number}>} floors
   * @returns {Promise<{ok: boolean, projectId?: string, error?: string}>}
   */
  Proj.createProject = async function(name, floors) {
    var user = S.get('currentUser');
    if (!user) return { ok: false, error: 'Nicht angemeldet' };

    var sb = Auth.getSupabase();
    if (!sb) return { ok: false, error: 'Verbindung fehlgeschlagen' };

    try {
      // 1. Projekt anlegen
      var projResult = await sb.from('projects').insert({
        owner_id: user.id,
        name: name
      }).select('id').single();

      if (projResult.error) {
        return { ok: false, error: projResult.error.message };
      }
      var projectId = projResult.data.id;

      // 2. Stockwerke anlegen
      var floorRecords = [];
      for (var i = 0; i < floors.length; i++) {
        var floor = floors[i];
        var imageUrl = floor.imageUrl || '';

        // Bild hochladen, falls File vorhanden
        if (floor.imageFile) {
          var ext = floor.imageFile.name.split('.').pop();
          var filePath = user.id + '/' + projectId + '/floor_' + i + '.' + ext;
          var uploadResult = await sb.storage.from('floor-plans').upload(filePath, floor.imageFile, {
            cacheControl: '3600',
            upsert: true
          });
          if (uploadResult.data) {
            var urlResult = sb.storage.from('floor-plans').getPublicUrl(filePath);
            imageUrl = urlResult.data.publicUrl;
          }
        }

        floorRecords.push({
          project_id: projectId,
          name: floor.name,
          image_url: imageUrl,
          native_width: floor.nativeWidth || 1000,
          sort_order: i
        });
      }

      if (floorRecords.length > 0) {
        var floorResult = await sb.from('floors').insert(floorRecords).select('id, name, image_url, native_width, sort_order');
        if (floorResult.error) {
          console.warn('[projects] floor insert error:', floorResult.error.message);
        }

        // 3. Demo-Räume anlegen (mit Floor-IDs)
        var DT = window.GR.demoTemplate;
        if (DT && floorResult.data && floorResult.data.length > 0) {
          var demoRooms = DT.getDemoRooms(floorResult.data);
          await sb.from('rooms').insert({
            project_id: projectId,
            data: demoRooms
          });
        } else {
          await sb.from('rooms').insert({
            project_id: projectId,
            data: {}
          });
        }
      }

      // Owner als project_member hinzufügen
      await sb.from('project_members').insert({
        project_id: projectId,
        user_id: user.id,
        role: 'owner'
      });

      return { ok: true, projectId: projectId };
    } catch (e) {
      console.error('[projects] createProject error:', e);
      return { ok: false, error: e.message || 'Unbekannter Fehler' };
    }
  };

  /**
   * Aktualisiert einen Projektnamen.
   * @param {string} projectId
   * @param {string} name
   * @returns {Promise<{ok: boolean}>}
   */
  Proj.updateProjectName = async function(projectId, name) {
    var sb = Auth.getSupabase();
    if (!sb) return { ok: false };
    try {
      var result = await sb.from('projects').update({ name: name }).eq('id', projectId);
      return { ok: !result.error };
    } catch (e) {
      return { ok: false };
    }
  };

  /**
   * Löscht ein Projekt (und alle zugehörigen Daten via CASCADE).
   * @param {string} projectId
   * @returns {Promise<{ok: boolean}>}
   */
  Proj.deleteProject = async function(projectId) {
    var sb = Auth.getSupabase();
    if (!sb) return { ok: false };
    try {
      // Zuerst Stockwerk-Bilder aus Storage löschen
      var floors = await sb.from('floors').select('image_url').eq('project_id', projectId);
      if (floors.data) {
        for (var floor of floors.data) {
          if (floor.image_url && floor.image_url.includes('floor-plans')) {
            var pathMatch = floor.image_url.match(/\/floor-plans\/(.+)/);
            if (pathMatch) {
              await sb.storage.from('floor-plans').remove([pathMatch[1]]);
            }
          }
        }
      }
      var result = await sb.from('projects').delete().eq('id', projectId);
      return { ok: !result.error };
    } catch (e) {
      return { ok: false };
    }
  };

  // ===================================================================
  // Projekt öffnen / laden
  // ===================================================================

  /**
   * Lädt ein Projekt und öffnet den Editor.
   * @param {string} projectId
   * @returns {Promise<boolean>}
   */
  Proj.openProject = async function(projectId) {
    var sb = Auth.getSupabase();
    if (!sb) return false;

    try {
      // Projekt-Details laden
      var projResult = await sb.from('projects').select('*').eq('id', projectId).single();
      if (projResult.error || !projResult.data) return false;

      // Floors laden
      var floorsResult = await sb.from('floors')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      var floors = floorsResult.data || [];

      // Räume laden
      var roomsResult = await sb.from('rooms')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(1);
      var roomsData = (roomsResult.data && roomsResult.data.length > 0) ? roomsResult.data[0].data : {};
      var roomsRowId = (roomsResult.data && roomsResult.data.length > 0) ? roomsResult.data[0].id : null;

      // State setzen
      S.set('currentProject', {
        id: projectId,
        name: projResult.data.name,
        ownerId: projResult.data.owner_id,
        roomsRowId: roomsRowId
      });
      S.set('currentProjectFloors', floors.map(function(f) {
        return {
          id: f.id,
          name: f.name,
          imageUrl: f.image_url,
          nativeWidth: f.native_width,
          sortOrder: f.sort_order
        };
      }));

      // Räume in State laden
      if (roomsData && typeof roomsData === 'object') {
        U.ensureAllRooms(roomsData);
        S.set('rooms', roomsData);
      } else {
        S.set('rooms', {});
      }

      // Lokal speichern (Cache)
      var St = window.GR.storage;
      if (St && St.saveToLocal) St.saveToLocal();

      // Floor-Tabs dynamisch aufbauen
      Proj.buildFloorUI(floors);

      // Ersten Floor aktivieren
      if (floors.length > 0) {
        S.set('activeFloor', floors[0].id);
      }

      S.notify(C.EVT_PROJECT_CHANGED, projectId);
      return true;
    } catch (e) {
      console.error('[projects] openProject error:', e);
      return false;
    }
  };

  /**
   * Baut die Floor-Tabs und Floor-Container dynamisch auf.
   * @param {Array} floors - Floor-Daten aus Supabase
   */
  Proj.buildFloorUI = function(floors) {
    var tabsContainer = document.getElementById('ft');
    var contentEl = document.getElementById('mc');
    if (!tabsContainer || !contentEl) return;

    // Bestehende Floor-Elemente entfernen
    var existingFloors = contentEl.querySelectorAll('.floor');
    existingFloors.forEach(function(el) { el.remove(); });
    tabsContainer.innerHTML = '';

    // Floor-Tabs und Container erstellen
    for (var i = 0; i < floors.length; i++) {
      var f = floors[i];
      var isActive = i === 0;

      // Tab-Button
      var tab = document.createElement('button');
      tab.className = isActive ? 'active' : '';
      tab.setAttribute('data-action', 'switch-floor');
      tab.setAttribute('data-floor', f.id);
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.innerHTML = U.escHtml(f.name) + ' <span class="tab-badge" id="badge-' + f.id + '">0</span>';
      tabsContainer.appendChild(tab);

      // Floor-Container
      var floorDiv = document.createElement('div');
      floorDiv.className = 'floor' + (isActive ? ' active' : '');
      floorDiv.id = 'floor-' + f.id;

      var h1 = document.createElement('h1');
      h1.innerHTML = U.escHtml(f.name) +
        ' <span class="fa"><button data-action="place-new-room" data-floor="' + f.id + '">+ Raum</button>' +
        '<span class="cnt" id="cnt-' + f.id + '"></span></span>';
      floorDiv.appendChild(h1);

      var pw = document.createElement('div');
      pw.className = 'pw';
      pw.id = f.id + '-w';
      pw.style.width = (f.native_width || 1000) + 'px';

      var pi = document.createElement('div');
      pi.className = 'pi';

      var img = document.createElement('img');
      img.src = f.image_url || '';
      img.alt = U.escHtml(f.name);
      img.addEventListener('load', function() {
        var Rdr = window.GR.renderer;
        var Sync = window.GR.sync;
        if (Rdr && Rdr.render) Rdr.render();
        if (Sync && Sync.updateTabBadges) Sync.updateTabBadges();
      });

      var roomsDiv = document.createElement('div');
      roomsDiv.id = f.id + '-r';

      pi.appendChild(img);
      pi.appendChild(roomsDiv);
      pw.appendChild(pi);
      floorDiv.appendChild(pw);
      contentEl.appendChild(floorDiv);

      // Plan-Wrapper Events (für place-room)
      var PR = window.GR.placeRoom;
      pw.addEventListener('mousedown', function(e) {
        if (PR && PR.startPlaceDraw) PR.startPlaceDraw(e);
      });
      pw.addEventListener('touchstart', function(e) {
        if (PR && PR.startPlaceDraw) PR.startPlaceDraw(e);
      }, { passive: false });
    }

    // Caches zurücksetzen
    if (window.GR.utils && window.GR.utils._resetScaleCache) {
      window.GR.utils._resetScaleCache();
    }
  };

  /**
   * Lädt die aktuellen User-Role für ein Projekt.
   * @param {string} projectId
   * @returns {Promise<string>} 'owner' | 'editor' | 'viewer' | ''
   */
  Proj.getProjectRole = async function(projectId) {
    var user = S.get('currentUser');
    if (!user) return '';
    var sb = Auth.getSupabase();
    if (!sb) return '';

    // Check if owner
    var proj = await sb.from('projects').select('owner_id').eq('id', projectId).single();
    if (proj.data && proj.data.owner_id === user.id) return 'owner';

    // Check membership
    var member = await sb.from('project_members').select('role').eq('project_id', projectId).eq('user_id', user.id).single();
    return member.data ? member.data.role : '';
  };

})(window.GR.projects = window.GR.projects || {});