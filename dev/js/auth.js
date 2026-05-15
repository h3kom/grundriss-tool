/**
 * Grundriss Tool – Auth-Modul (Supabase)
 * =====================================================================
 * @module auth
 * @description E-Mail/Passwort Login, Register, Session-Management.
 * Nutzt den Supabase JS Client für Auth-Operationen.
 */import { SUPABASE_URL, SUPABASE_ANON_KEY, EVT_AUTH_CHANGED } from './constants.js';
import * as S from './state.js';

/** @type {Object|null} Supabase Client Instanz */
  var _sb = null;

  /** @type {Object|null} Auth state subscription (for cleanup) */
  var _authSubscription = null;

  /**
   * Initialisiert den Supabase Client.
   * Wird beim App-Start aufgerufen.
   */
  export function initSupabase() {
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      console.warn('[auth] Supabase JS Client nicht geladen. Auth deaktiviert.');
      return;
    }
    // Prevent duplicate listeners on re-init
    if (_authSubscription) {
      try { _authSubscription.unsubscribe(); } catch (e) { /* noop */ }
    }
    _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // Listener für Auth-Status-Änderungen
    var { data } = _sb.auth.onAuthStateChange(function(event, session) {
      if (event === 'SIGNED_IN' && session) {
        onSignIn(session.user);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Update user state on token refresh to prevent session expiry
        onSignIn(session.user);
      } else if (event === 'SIGNED_OUT') {
        onSignOut();
      }
    });
    _authSubscription = data.subscription;
  };

  /**
   * Gibt den Supabase Client zurück.
   * @returns {Object|null}
   */
  export function getSupabase() {
    return _sb;
  };

  /**
   * Prüft, ob Supabase Auth verfügbar ist.
   * @returns {boolean}
   */
  export function isAvailable() {
    return _sb !== null;
  };

  // ===================================================================
  // Session
  // ===================================================================

  /**
   * Holt die aktuelle Session.
   * @returns {Promise<Object|null>}
   */
export async function getSession() {
    if (!_sb) return null;
    try {
      var result = await _sb.auth.getSession();
      return result.data.session;
    } catch (e) {
      console.warn('[auth] getSession error:', e.message);
      return null;
    }
  };

  /**
   * Holt den aktuellen User.
   * @returns {Promise<Object|null>}
   */
export async function getCurrentUser() {
    if (!_sb) return null;
    try {
      var result = await _sb.auth.getUser();
      return result.data.user;
    } catch (e) {
      console.warn('[auth] getUser error:', e.message);
      return null;
    }
  };

  // ===================================================================
  // E-Mail/Passwort Auth
  // ===================================================================

  /**
   * Registriert einen neuen User mit E-Mail und Passwort.
   * @param {string} email
   * @param {string} password
   * @param {string} displayName
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
export async function register(email, password, displayName) {
    if (!_sb) return { ok: false, error: 'Auth nicht verfügbar' };
    try {
      var result = await _sb.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { display_name: displayName }
        }
      });
      if (result.error) {
        return { ok: false, error: translateError(result.error.message) };
      }
      // Prüfe ob E-Mail-Bestätigung erforderlich ist
      if (result.data?.user && result.data.session) {
        // Auto-Login: E-Mail-Bestätigung deaktiviert, User ist direkt eingeloggt
        return { ok: true, autoLogin: true };
      }
      return { ok: true, needsConfirmation: true };
    } catch (e) {
      return { ok: false, error: translateError(e.message) };
    }
  };

  /**
   * Übersetzt Supabase-Fehlermeldungen auf Deutsch.
   * @param {string} msg - Original-Fehlermeldung
   * @returns {string} Deutsche Fehlermeldung
   */
  function translateError(msg) {
    if (!msg) return 'Unbekannter Fehler';
    var lower = msg.toLowerCase();
    if (lower.includes('invalid login credentials')) return 'E-Mail oder Passwort falsch';
    if (lower.includes('email not confirmed')) return 'Bitte bestätige zuerst deine E-Mail-Adresse';
    if (lower.includes('user already registered')) return 'Diese E-Mail ist bereits registriert';
    if (lower.includes('password should be at least')) return 'Passwort muss mind. 6 Zeichen haben';
    if (lower.includes('unable to validate email address')) return 'Ungültige E-Mail-Adresse';
    if (lower.includes('signup is disabled')) return 'Registrierung ist deaktiviert';
    if (lower.includes('too many requests')) return 'Zu viele Versuche. Bitte warte einen Moment';
    if (lower.includes('network')) return 'Netzwerkfehler. Bitte prüfe deine Verbindung';
    return msg;
  }

  /**
   * Loggt einen User mit E-Mail und Passwort ein.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
export async function login(email, password) {
    if (!_sb) return { ok: false, error: 'Auth nicht verfügbar' };
    try {
      var result = await _sb.auth.signInWithPassword({
        email: email,
        password: password
      });
      if (result.error) {
        return { ok: false, error: translateError(result.error.message) };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: translateError(e.message) };
    }
  };

  // ===================================================================
  // Logout
  // ===================================================================

  /**
   * Loggt den aktuellen User aus.
   * @returns {Promise<{ok: boolean}>}
   */
export async function logout() {
    if (!_sb) return { ok: false };
    try {
      await _sb.auth.signOut();
      return { ok: true };
    } catch (e) {
      console.warn('[auth] logout error:', e.message);
      return { ok: false };
    }
  };

  // ===================================================================
  // Event Handlers
  // ===================================================================

  /**
   * Wird aufgerufen, wenn ein User sich erfolgreich anmeldet.
   * @param {Object} user - Supabase User-Objekt
   */
  export function onSignIn(user) {
    S.set('currentUser', {
      id: user.id,
      email: user.email,
      displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'
    });
    S.set('isAuthenticated', true);
    S.notify(EVT_AUTH_CHANGED, { authenticated: true, user: user });
  };

  /**
   * Wird aufgerufen, wenn ein User sich abmeldet.
   */
  export function onSignOut() {
    S.set('currentUser', null);
    S.set('isAuthenticated', false);
    S.set('currentProject', null);
    S.set('currentProjectFloors', []);
    S.notify(EVT_AUTH_CHANGED, { authenticated: false });
  };

  /**
   * Passwort-Reset anfordern.
   * @param {string} email
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
export async function resetPassword(email) {
    if (!_sb) return { ok: false, error: 'Auth nicht verfügbar' };
    try {
      var result = await _sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });
      if (result.error) {
        return { ok: false, error: result.error.message };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || 'Unbekannter Fehler' };
    }
  };
