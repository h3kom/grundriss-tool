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
  // DEV Supabase
  SUPABASE_URL: 'https://dein-dev-projekt.supabase.co',
  SUPABASE_ANON_KEY: 'dein-dev-anon-key',

  // PROD Supabase (auskommentieren für Produktiv-Einsatz)
  // SUPABASE_URL: 'https://civkerrcyqgsqqjpccqe.supabase.co',
  // SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
};