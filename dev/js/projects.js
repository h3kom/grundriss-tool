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

  const C = window.GR.constants;
  const S = window.GR.state;
  const U = window.GR.utils;
  const Auth = window.GR.auth;

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
    const sb = Auth.getSupabase();
    if (!sb) return [];
    try {
      let q = sb.from(table).select(options.select || '*');
      if (options.filter) {
        for (const key of Object.keys(options.filter)) {
          q = q.eq(key, options.filter[key]);
        }
      }
      if (options.order) q = q.order(options.order.column, { ascending: options.order.ascending !== false });
      const result = await q;
      if (result.error) {
        console.warn('[projects] query error:', result.error.message);
        return [];
      }
      return result.data || [];
    } catch (e) {
      console.warn('[projects] query exception:', e.message);
      return [];
    }
  }

  // ===================================================================
  // Projekt CRUD
  // ===================================================================

  /**
   * Lädt alle Projekte des aktuellen Users (owned + shared).
   * @returns {Promise<{owned: Array, shared: Array}>}
   */
  Proj.loadProjects = async function() {
    const user = S.get('currentUser');
    if (!user) return { owned: [], shared: [] };

    const sb = Auth.getSupabase();
    if (!sb) return { owned: [], shared: [] };

    try {
      // Eigene Projekte
      const ownedResult = await sb.from('projects')
        .select('id, name, created_at, updated_at')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false });
      const owned = ownedResult.data || [];

      // Geteilte Projekte (über project_members)
      const memberResult = await sb.from('project_members')
        .select('role, projects(id, name, created_at, updated_at, owner_id, profiles(display_name))')
        .eq('user_id', user.id);
      const shared = (memberResult.data || [])
        .filter(function(m) { return m.projects && m.projects.owner_id !== user.id; })
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
    const user = S.get('currentUser');
    if (!user) return { ok: false, error: 'Nicht angemeldet' };

    const sb = Auth.getSupabase();
    if (!sb) return { ok: false, error: 'Verbindung fehlgeschlagen' };

    try {
      // 1. Projekt anlegen
      const projResult = await sb.from('projects').insert({
        owner_id: user.id,
        name: name
      }).select('id').single();

      if (projResult.error) {
        return { ok: false, error: projResult.error.message };
      }
      const projectId = projResult.data.id;

      // 2. Stockwerke anlegen
      const floorRecords = [];
      for (let i = 0; i < floors.length; i++) {
        const floor = floors[i];
        let imageUrl = floor.imageUrl || '';

        // Bild hochladen, falls File vorhanden
        if (floor.imageFile) {
          const ext = floor.imageFile.name.split('.').pop();
          const filePath = user.id + '/' + projectId + '/floor_' + i + '.' + ext;
          const uploadResult = await sb.storage.from('floor-plans').upload(filePath, floor.imageFile, {
            cacheControl: '3600',
            upsert: true
          });
          if (uploadResult.data) {
            const urlResult = sb.storage.from('floor-plans').getPublicUrl(filePath);
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
        const floorResult = await sb.from('floors').insert(floorRecords).select('id, name, image_url, native_width, sort_order');
        if (floorResult.error) {
          console.warn('[projects] floor insert error:', floorResult.error.message);
        }

        // 3. Demo-Räume anlegen (mit Floor-IDs)
        const DT = window.GR.demoTemplate;
        if (DT && floorResult.data && floorResult.data.length > 0) {
          const demoRooms = DT.getDemoRooms(floorResult.data);
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
    const sb = Auth.getSupabase();
    if (!sb) return { ok: false, error: 'Verbindung fehlgeschlagen' };
    try {
      const result = await sb.from('projects').update({ name: name }).eq('id', projectId);
      if (result.error) {
        console.warn('[projects] updateProjectName error:', result.error.message);
        return { ok: false, error: result.error.message };
      }
      return { ok: true };
    } catch (e) {
      console.warn('[projects] updateProjectName exception:', e.message);
      return { ok: false, error: e.message };
    }
  };

  /**
   * Löscht ein Projekt (und alle zugehörigen Daten via CASCADE).
   * @param {string} projectId
   * @returns {Promise<{ok: boolean}>}
   */
  Proj.deleteProject = async function(projectId) {
    const sb = Auth.getSupabase();
    if (!sb) return { ok: false, error: 'Verbindung fehlgeschlagen' };
    try {
      // Zuerst Stockwerk-Bilder aus Storage löschen
      const floors = await sb.from('floors').select('image_url').eq('project_id', projectId);
      if (floors.data) {
        for (const floor of floors.data) {
          if (floor.image_url && floor.image_url.includes('floor-plans')) {
            const pathMatch = floor.image_url.match(/\/floor-plans\/(.+)/);
            if (pathMatch) {
              try {
                await sb.storage.from('floor-plans').remove([pathMatch[1]]);
              } catch (storageErr) {
                console.warn('[projects] Failed to delete floor image:', storageErr.message);
              }
            }
          }
        }
      }
      const result = await sb.from('projects').delete().eq('id', projectId);
      if (result.error) {
        console.warn('[projects] deleteProject error:', result.error.message);
        return { ok: false, error: result.error.message };
      }
      return { ok: true };
    } catch (e) {
      console.warn('[projects] deleteProject exception:', e.message);
      return { ok: false, error: e.message };
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
    const sb = Auth.getSupabase();
    if (!sb) return false;

    try {
      // Projekt-Details laden
      const projResult = await sb.from('projects').select('*').eq('id', projectId).single();
      if (projResult.error || !projResult.data) return false;

      // Floors laden
      const floorsResult = await sb.from('floors')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      const floors = floorsResult.data || [];

      // Räume laden
      const roomsResult = await sb.from('rooms')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(1);
      const roomsData = (roomsResult.data && roomsResult.data.length > 0) ? roomsResult.data[0].data : {};
      const roomsRowId = (roomsResult.data && roomsResult.data.length > 0) ? roomsResult.data[0].id : null;

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
      const St = window.GR.storage;
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
   * Struktur entspricht exakt dem statischen HTML in index.html:
   *   .pw > .plan-nav > span.cnt, img.pi, div.pr
   * @param {Array} floors - Floor-Daten aus Supabase
   */
  Proj.buildFloorUI = function(floors) {
    const tabsContainer = document.getElementById('ft');
    const contentEl = document.getElementById('mc');
    if (!tabsContainer || !contentEl) return;

    // Sidebar-Element merken (darf nicht gelöscht werden)
    const sidebar = document.getElementById('sb');

    // Alle bestehenden Floor-Elemente entfernen
    // Alte dynamische .floor-Container
    contentEl.querySelectorAll('.floor').forEach(function(el) { el.remove(); });
    // Alte .pw-Wrapper (statisch oder dynamisch)
    contentEl.querySelectorAll('.pw').forEach(function(el) { el.remove(); });
    // Alte statische Elemente falls noch vorhanden
    ['eg-w', 'og-w', 'eg-r', 'og-r', 'eg-img', 'og-img'].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    tabsContainer.innerHTML = '';

    // Floor-Tabs und Container erstellen
    for (let i = 0; i < floors.length; i++) {
      const f = floors[i];
      const isActive = i === 0;

      // Tab-Button (wie im statischen HTML: class="ft-tab")
      const tab = document.createElement('button');
      tab.id = 'tab-' + f.id;
      tab.className = 'ft-tab' + (isActive ? ' active' : '');
      tab.setAttribute('data-floor', f.id);
      tab.innerHTML =
        '<span class="ft-label">' + U.escHtml(f.name) + '</span>' +
        '<span class="ft-badge" id="badge-' + f.id + '">0</span>';
      tabsContainer.appendChild(tab);

      // Plan-Wrapper (.pw) – wie im statischen HTML
      const pw = document.createElement('div');
      pw.className = 'pw';
      pw.id = f.id + '-w';
      pw.setAttribute('data-floor', f.id);
      if (!isActive) pw.style.display = 'none';

      // plan-nav mit Raumzähler
      const planNav = document.createElement('div');
      planNav.className = 'plan-nav';
      const cntSpan = document.createElement('span');
      cntSpan.id = 'cnt-' + f.id;
      cntSpan.className = 'cnt';
      planNav.appendChild(cntSpan);
      pw.appendChild(planNav);

      // Image (class="pi" direkt auf img, nicht auf wrapper div)
      const img = document.createElement('img');
      img.className = 'pi';
      img.id = f.id + '-img';
      img.src = f.image_url || '';
      img.alt = U.escHtml(f.name);
      img.setAttribute('draggable', 'false');
      img.addEventListener('load', function() {
        const Rdr = window.GR.renderer;
        const Sync = window.GR.sync;
        if (Rdr && Rdr.render) Rdr.render();
        if (Sync && Sync.updateTabBadges) Sync.updateTabBadges();
      });
      pw.appendChild(img);

      // Rooms-Container (class="pr")
      const roomsDiv = document.createElement('div');
      roomsDiv.className = 'pr';
      roomsDiv.id = f.id + '-r';
      pw.appendChild(roomsDiv);

      contentEl.appendChild(pw);

      // Plan-Wrapper Events (für place-room)
      const PR = window.GR.placeRoom;
      pw.addEventListener('mousedown', function(e) {
        if (PR && PR.startPlaceDraw) PR.startPlaceDraw(e);
      });
      pw.addEventListener('touchstart', function(e) {
        if (PR && PR.startPlaceDraw) PR.startPlaceDraw(e);
      }, { passive: false });
    }

    // Sidebar wieder anhängen (falls entfernt)
    if (sidebar && !document.getElementById('sb')) {
      contentEl.appendChild(sidebar);
    }

    // Caches zurücksetzen
    if (U && U._resetScaleCache) {
      U._resetScaleCache();
    }
  };

  /**
   * Lädt die aktuellen User-Role für ein Projekt.
   * @param {string} projectId
   * @returns {Promise<string>} 'owner' | 'editor' | 'viewer' | ''
   */
  Proj.getProjectRole = async function(projectId) {
    const user = S.get('currentUser');
    if (!user) return '';
    const sb = Auth.getSupabase();
    if (!sb) return '';

    try {
      // Check if owner
      const proj = await sb.from('projects').select('owner_id').eq('id', projectId).single();
      if (proj.data && proj.data.owner_id === user.id) return 'owner';

      // Check membership
      const member = await sb.from('project_members').select('role').eq('project_id', projectId).eq('user_id', user.id).single();
      return member.data ? member.data.role : '';
    } catch (e) {
      console.warn('[projects] getProjectRole error:', e.message);
      return '';
    }
  };

})(window.GR.projects = window.GR.projects || {});