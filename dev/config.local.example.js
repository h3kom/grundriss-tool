/**
 * Grundriss Tool – Lokale Konfiguration
 * =====================================================================
 * Kopiere diese Datei zu config.local.js und trage deine Supabase-Daten ein.
 * config.local.js wird NICHT in Git eingecheckt (siehe .gitignore).
 */
window._GR_CONFIG = window._GR_CONFIG || {};

// Supabase-Projekt-URL (aus Supabase Dashboard → Settings → API)
window._GR_CONFIG.SUPABASE_URL = 'https://dein-projekt.supabase.co';

// Supabase Anonymer Key (public, sicher für Frontend)
window._GR_CONFIG.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';