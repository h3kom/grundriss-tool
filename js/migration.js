/**
 * Grundriss Tool – Daten-Migration
 * =====================================================================
 * @module migration
 * @description Migriert bestehende localStorage-Daten (Single-User) zu
 * einem Projekt im neuen Multi-User-System.
 */
window.GR = window.GR || {};

(function(Mig) {
  'use strict';

  var C = window.GR.constants;
  var S = window.GR.state;

  /** @const {string} Key für Migrations-Flag */
  var MIGRATION_KEY = 'gr_migrated_v2';

  /**
   * Prüft, ob die Migration bereits durchgeführt wurde.
   * @returns {boolean}
   */
  Mig.isMigrated = function() {
    try {
      return localStorage.getItem(MIGRATION_KEY) === 'true';
    } catch (e) {
      return false;
    }
  };

  /**
   * Migriert bestehende localStorage-Daten zu einem Supabase-Projekt.
   * Wird beim ersten Login nach der Multi-User-Aktualisierung ausgeführt.
   * @returns {Promise<{ok: boolean, projectId?: string}>}
   */
  Mig.migrateLocalData = async function() {
    if (Mig.isMigrated()) return { ok: true };

    var Auth = window.GR.auth;
    var Proj = window.GR.projects;
    if (!Auth || !Proj) return { ok: false };

    var user = S.get('currentUser');
    if (!user) return { ok: false };

    // Bestehende Daten laden
    var localData = null;
    try {
      var raw = localStorage.getItem(C.LOCAL_STORAGE_KEY);
      if (raw) localData = JSON.parse(raw);
    } catch (e) {
      localData = null;
    }

    // Keine Daten vorhanden → Migration als fertig markieren
    if (!localData || Object.keys(localData).length === 0) {
      Mig._markMigrated();
      return { ok: true };
    }

    try {
      var sb = Auth.getSupabase();
      if (!sb) return { ok: false };

      // Idempotency: Check if migrated project already exists
      var existingProject = await sb.from('projects')
        .select('id')
        .eq('owner_id', user.id)
        .eq('name', 'Altes Projekt (migriert)')
        .limit(1);
      if (existingProject.data && existingProject.data.length > 0) {
        console.info('[migration] Migrated project already exists, skipping');
        Mig._markMigrated();
        return { ok: true, projectId: existingProject.data[0].id };
      }

      // Projekt "Altes Projekt (migriert)" erstellen
      var projResult = await sb.from('projects').insert({
        owner_id: user.id,
        name: 'Altes Projekt (migriert)'
      }).select('id').single();

      if (projResult.error || !projResult.data) {
        console.warn('[migration] project creation failed:', projResult.error?.message);
        return { ok: false };
      }
      var projectId = projResult.data.id;

      // Standard-Floors erstellen (EG/OG mit lokalen Bildern)
      var floorRecords = [
        { project_id: projectId, name: 'Erdgeschoss', image_url: 'EG.png', native_width: 1000, sort_order: 0 },
        { project_id: projectId, name: 'Obergeschoss', image_url: 'OG.png', native_width: 800, sort_order: 1 }
      ];

      var floorResult = await sb.from('floors').insert(floorRecords).select('id, name, sort_order');
      if (floorResult.error) {
        console.warn('[migration] floor insert failed:', floorResult.error.message);
        return { ok: false };
      }
      var floors = floorResult.data || [];

      // Alte Raumdaten: Floor-IDs von 'eg'/'og' auf neue Floor-IDs mappen
      var migratedRooms = JSON.parse(JSON.stringify(localData));
      var egFloor = floors.find(function(f) { return f.sort_order === 0; });
      var ogFloor = floors.find(function(f) { return f.sort_order === 1; });

      for (var key of Object.keys(migratedRooms)) {
        if (migratedRooms[key].floor === 'eg' && egFloor) {
          migratedRooms[key].floor = egFloor.id;
        } else if (migratedRooms[key].floor === 'og' && ogFloor) {
          migratedRooms[key].floor = ogFloor.id;
        }
      }

      // Räume in Supabase speichern
      var roomsResult = await sb.from('rooms').insert({
        project_id: projectId,
        data: migratedRooms
      });
      if (roomsResult.error) {
        console.warn('[migration] rooms insert failed:', roomsResult.error.message);
        return { ok: false };
      }

      // Owner als Member hinzufügen
      var memberResult = await sb.from('project_members').insert({
        project_id: projectId,
        user_id: user.id,
        role: 'owner'
      });
      if (memberResult.error) {
        console.warn('[migration] member insert failed:', memberResult.error.message);
        return { ok: false, error: 'Owner-Mitglied konnte nicht erstellt werden' };
      }

      // Migration als fertig markieren
      Mig._markMigrated();

      console.log('[migration] Successfully migrated local data to project:', projectId);
      return { ok: true, projectId: projectId };
    } catch (e) {
      console.error('[migration] Error:', e);
      return { ok: false };
    }
  };

  /**
   * Markiert die Migration als abgeschlossen.
   */
  Mig._markMigrated = function() {
    try {
      localStorage.setItem(MIGRATION_KEY, 'true');
    } catch (e) { /* noop */ }
  };

})(window.GR.migration = window.GR.migration || {});