/**
 * Grundriss Tool – Cloud-Sync (Supabase)
 * =====================================================================
 * @module cloud
 * @description Speichert/Lädt Raumdaten in Supabase (project-based).
 */import * as S from './state.js';
// Uses window.GR.auth, window.GR.sync (lazy)

/** Lock-Flag: verhindert parallele Save-Operationen */
  var _saveInProgress = false;

  /**
   * Speichert die aktuellen Räume in Supabase.
   * @param {Object} rooms - Raumdaten
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
export async function saveToCloud(rooms) {
    var sb = Auth ? Auth.getSupabase() : null;
    if (!sb) return { ok: false, error: 'Supabase nicht verfügbar' };

    if (!rooms || typeof rooms !== 'object') return { ok: false, error: 'Ungültige Raumdaten' };

    var project = S.get('currentProject');
    if (!project) return { ok: false, error: 'Kein Projekt ausgewählt' };

    // Offline-Check: keine Netzwerk-Requests wenn offline
    if (Sync && !Sync._isOnline) {
      return { ok: false, error: 'Offline – wird gespeichert wenn Verbindung wieder da ist' };
    }

    // Parallele Saves verhindern
    if (_saveInProgress) {
      console.warn('[cloud] Save already in progress – skipping');
      return { ok: false, error: 'Speichern bereits im Gange' };
    }
    _saveInProgress = true;

    try {

    // Auto-Recovery: roomsRowId fehlt → versuchen zu finden oder zu erstellen
    if (!project.roomsRowId) {
      try {
        // Bestehende rooms-Zeile suchen
        var existing = await sb.from('rooms')
          .select('id')
          .eq('project_id', project.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (existing.error) {
          console.warn('[cloud] roomsRowId lookup error:', existing.error.message);
          return { ok: false, error: 'Keine Room-Row-ID (Lookup fehlgeschlagen)' };
        }

        if (existing.data && existing.data.length > 0) {
          // Gefunden → roomsRowId im State aktualisieren
          project.roomsRowId = existing.data[0].id;
          S.set('currentProject', project);
          console.info('[cloud] Recovered roomsRowId:', project.roomsRowId);
        } else {
          // Nicht gefunden → neue rooms-Zeile anlegen
          var insertResult = await sb.from('rooms').insert({
            project_id: project.id,
            data: rooms,
            updated_at: new Date().toISOString()
          }).select('id').single();

          if (insertResult.error) {
            console.warn('[cloud] Failed to create rooms row:', insertResult.error.message);
            return { ok: false, error: 'Keine Room-Row-ID (Erstellung fehlgeschlagen: ' + insertResult.error.message + ')' };
          }

          if (insertResult.data && insertResult.data.id) {
            project.roomsRowId = insertResult.data.id;
            S.set('currentProject', project);
            console.info('[cloud] Created new rooms row:', project.roomsRowId);
            return { ok: true }; // Daten wurden bereits beim INSERT gespeichert
          } else {
            console.warn('[cloud] Insert returned no data');
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

    } finally {
      _saveInProgress = false;
    }
  };

  /**
   * Lädt Raumdaten aus Supabase.
   * @returns {Promise<{ok: boolean, rooms?: Object, error?: string}>}
   */
export async function loadFromCloud() {
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
          S.set('currentProject', project);
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
   * Ruft nur den updated_at-Timestamp einer rooms-Zeile ab.
   * Wird für die Konflikterkennung vor dem Speichern verwendet.
   * @param {string} roomsRowId - ID der rooms-Zeile
   * @returns {Promise<{ok: boolean, updated_at?: string, error?: string}>}
   */
export async function getCloudTimestamp(roomsRowId) {
    var sb = Auth ? Auth.getSupabase() : null;
    if (!sb) return { ok: false, error: 'Supabase nicht verfügbar' };

    try {
      var result = await sb.from('rooms')
        .select('updated_at')
        .eq('id', roomsRowId)
        .single();

      if (result.error) {
        return { ok: false, error: result.error.message };
      }

      return { ok: true, updated_at: result.data ? result.data.updated_at : null };
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
