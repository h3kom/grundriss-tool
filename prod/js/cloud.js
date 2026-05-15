/**
 * Grundriss Tool – Cloud-Sync (Supabase)
 * =====================================================================
 * @module cloud
 * @description Speichert/Lädt Raumdaten in Supabase (project-based).
 */
window.GR = window.GR || {};

(function(Cloud) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;

  /**
   * Speichert die aktuellen Räume in Supabase.
   * @param {Object} rooms - Raumdaten
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  Cloud.saveToCloud = async function(rooms) {
    var Auth = window.GR.auth;
    var sb = Auth ? Auth.getSupabase() : null;
    if (!sb) return { ok: false, error: 'Supabase nicht verfügbar' };

    if (!rooms || typeof rooms !== 'object') return { ok: false, error: 'Ungültige Raumdaten' };

    var project = S.get('currentProject');
    if (!project) return { ok: false, error: 'Kein Projekt ausgewählt' };

    // Auto-Recovery: roomsRowId fehlt → versuchen zu finden oder zu erstellen
    if (!project.roomsRowId) {
      try {
        // Bestehende rooms-Zeile suchen
        var existing = await sb.from('rooms')
          .select('id')
          .eq('project_id', project.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (existing.data && existing.data.length > 0) {
          // Gefunden → roomsRowId im State aktualisieren
          project.roomsRowId = existing.data[0].id;
          console.info('[cloud] Recovered roomsRowId:', project.roomsRowId);
        } else {
          // Nicht gefunden → neue rooms-Zeile anlegen
          var insertResult = await sb.from('rooms').insert({
            project_id: project.id,
            data: rooms,
            updated_at: new Date().toISOString()
          }).select('id').single();

          if (insertResult.data && insertResult.data.id) {
            project.roomsRowId = insertResult.data.id;
            console.info('[cloud] Created new rooms row:', project.roomsRowId);
            return { ok: true }; // Daten wurden bereits beim INSERT gespeichert
          } else {
            console.warn('[cloud] Failed to create rooms row:', (insertResult.error || {}).message);
            return { ok: false, error: 'Keine Room-Row-ID (Erstellung fehlgeschlagen)' };
          }
        }
      } catch (e) {
        console.warn('[cloud] roomsRowId recovery failed:', e.message);
        return { ok: false, error: 'Keine Room-Row-ID (Recovery fehlgeschlagen)' };
      }
    }

    try {
      var result = await sb.from('rooms')
        .update({ data: rooms, updated_at: new Date().toISOString() })
        .eq('id', project.roomsRowId);

      if (result.error) {
        console.warn('[cloud] Save error:', result.error.message);
        return { ok: false, error: result.error.message };
      }

      return { ok: true };
    } catch (e) {
      console.warn('[cloud] Save exception:', e.message);
      return { ok: false, error: e.message };
    }
  };

  /**
   * Lädt Raumdaten aus Supabase.
   * @returns {Promise<{ok: boolean, rooms?: Object, error?: string}>}
   */
  Cloud.loadFromCloud = async function() {
    var Auth = window.GR.auth;
    var sb = Auth ? Auth.getSupabase() : null;
    if (!sb) return { ok: false, error: 'Supabase nicht verfügbar' };

    var project = S.get('currentProject');
    if (!project) return { ok: false, error: 'Kein Projekt ausgewählt' };

    try {
      var result = await sb.from('rooms')
        .select('data, updated_at, id')
        .eq('project_id', project.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (result.error) {
        console.warn('[cloud] Load error:', result.error.message);
        return { ok: false, error: result.error.message };
      }

      if (result.data && result.data.length > 0) {
        // Update roomsRowId falls nötig
        if (result.data[0].id !== project.roomsRowId) {
          project.roomsRowId = result.data[0].id;
        }
        return { ok: true, rooms: result.data[0].data || {} };
      }

      return { ok: true, rooms: {} };
    } catch (e) {
      console.warn('[cloud] Load exception:', e.message);
      return { ok: false, error: e.message };
    }
  };

  /**
   * Alte saveToSupabase-Funktion (backward compat).
   * Leitet an saveToCloud weiter.
   */
  Cloud.saveToSupabase = Cloud.saveToCloud;

  /**
   * Alte loadFromSupabase-Funktion (backward compat).
   * Leitet an loadFromCloud weiter.
   */
  Cloud.loadFromSupabase = Cloud.loadFromCloud;

})(window.GR.cloud = window.GR.cloud || {});