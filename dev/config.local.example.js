/**
 * Grundriss Tool – Lokale Konfiguration (Beispiel)
 * =====================================================================
 * 
 * Kopiere diese Datei als 'config.local.js' und trage deine Keys ein.
 * Die Datei 'config.local.js' wird von .gitignore ignoriert.
 *
 * DEV-Umgebung:  Nutze die Dev-Supabase-Keys
 * PROD-Umgebung: Nutze die Prod-Supabase-Keys (oder lass die Datei weg
 *                → Standardwerte aus constants.js werden verwendet)
 */

window._GR_CONFIG = {
  SUPABASE_URL: 'https://dein-dev-projekt.supabase.co',
  SUPABASE_ANON_KEY: 'dein-dev-anon-key'
};
