/**
 * Grundriss Tool – Supabase-Cloud-API
 * =====================================================================
 * @module cloud
 * @description Kapselt alle Supabase-Fetch-Operationen (lesen & schreiben).
 */
window.GR = window.GR || {};

(function(Cl) {
  'use strict';

  const C = window.GR.constants;
  const U = window.GR.utils;
  const BASE = `${C.SUPABASE_URL}/rest/v1/${C.SUPABASE_TABLE}`;
  const HEADERS = {
    'Content-Type': 'application/json',
    'apikey': C.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${C.SUPABASE_ANON_KEY}`
  };

  /**
   * Lädt Raumdaten von Supabase.
   * Prüft auch, ob die Daten von einem anderen Gerät geändert wurden.
   * @returns {Promise<{data: Object, updatedAt: number, deviceId: string|null}|null>}
   */
  Cl.fetchData = async function() {
    try {
      const rowId = C.SUPABASE_ROW_ID;
      const res = await fetch(`${BASE}?id=eq.${rowId}&select=data,updated_at`, { headers: HEADERS });
      if (!res.ok) return null;
      const rows = await res.json();
      if (rows && rows.length > 0 && rows[0].data) {
        // Metadaten aus den Daten extrahieren (falls vorhanden)
        const cloudData = rows[0].data;
        const cloudDeviceId = cloudData._meta ? cloudData._meta.deviceId : null;
        // Bereinige Metadaten aus den Raumdaten
        if (cloudData._meta) delete cloudData._meta;
        return {
          data: cloudData,
          updatedAt: new Date(rows[0].updated_at).getTime() || 0,
          deviceId: cloudDeviceId
        };
      }
      return null;
    } catch (e) {
      console.warn('[cloud] fetchData failed:', e.message || e);
      return null;
    }
  };

  /**
   * Schreibt Raumdaten nach Supabase (Upsert).
   * Inkludiert Geräte-ID zur Erkennung von Änderungen durch andere Geräte.
   * @param {Object} rooms - Raumdaten-Objekt
   * @returns {Promise<{ok: boolean, updatedAt: number|null}>}
   */
  Cl.saveData = async function(rooms) {
    try {
      const rowId = C.SUPABASE_ROW_ID;
      // Geräte-ID in die Daten einbetten für Multi-Device-Erkennung
      const payload = Object.assign({}, rooms, {
        _meta: {
          deviceId: U.getDeviceId(),
          savedAt: Date.now()
        }
      });
      const res = await fetch(BASE, {
        method: 'POST',
        headers: Object.assign({}, HEADERS, { 'Prefer': 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify({ id: rowId, data: payload })
      });
      if (res.ok) {
        const rows = await res.json();
        let updatedAt = null;
        if (rows && rows.length > 0 && rows[0].updated_at) {
          updatedAt = new Date(rows[0].updated_at).getTime();
        }
        return { ok: true, updatedAt };
      }
      return { ok: false, updatedAt: null };
    } catch (e) {
      console.warn('[cloud] saveData failed:', e.message || e);
      return { ok: false, updatedAt: null };
    }
  };
})(window.GR.cloud = window.GR.cloud || {});
