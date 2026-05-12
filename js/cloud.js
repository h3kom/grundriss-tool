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
  const BASE = `${C.SUPABASE_URL}/rest/v1/${C.SUPABASE_TABLE}`;
  const HEADERS = {
    'Content-Type': 'application/json',
    'apikey': C.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${C.SUPABASE_ANON_KEY}`
  };

  /**
   * Lädt Raumdaten von Supabase.
   * @returns {Promise<{data: Object, updatedAt: number}|null>}
   */
  Cl.fetchData = async function() {
    try {
      const res = await fetch(`${BASE}?id=eq.${C.SUPABASE_ROW_ID}&select=data,updated_at`, { headers: HEADERS });
      if (!res.ok) return null;
      const rows = await res.json();
      if (rows && rows.length > 0 && rows[0].data) {
        return {
          data: rows[0].data,
          updatedAt: new Date(rows[0].updated_at).getTime() || 0
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  /**
   * Schreibt Raumdaten nach Supabase (Upsert).
   * @param {Object} rooms - Raumdaten-Objekt
   * @returns {Promise<{ok: boolean, updatedAt: number|null}>}
   */
  Cl.saveData = async function(rooms) {
    try {
      const res = await fetch(BASE, {
        method: 'POST',
        headers: Object.assign({}, HEADERS, { 'Prefer': 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify({ id: C.SUPABASE_ROW_ID, data: rooms })
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
      return { ok: false, updatedAt: null };
    }
  };
})(window.GR.cloud = window.GR.cloud || {});