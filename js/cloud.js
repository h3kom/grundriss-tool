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

    var project = S.get('currentProject');
    if (!project) return { ok: false, error: 'Kein Projekt ausgewählt' };
    if (!project.roomsRowId) return { ok: false, error: 'Keine Room-Row-ID' };

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