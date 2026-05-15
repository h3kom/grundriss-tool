/**
 * Grundriss Tool – Global Error Handler
 * =====================================================================
 * @module error-handler
 * @description Fängt unbehandelte Fehler ab und zeigt sie nutzerfreundlich an.
 * Muss als erstes Script geladen werden.
 */

/** @type {Error[]} Gesammelte Fehler der aktuellen Session (max. 10) */
var _errors = [];
var MAX_ERRORS = 10;

/**
 * Formatiert einen Fehler für die Anzeige.
 * @param {string} source - Fehlerquelle
 * @param {string} message - Fehlermeldung
 * @param {string} [filename] - Dateiname
 * @param {number} [lineno] - Zeilennummer
 * @returns {string}
 */
function formatError(source, message, filename, lineno) {
  var short = (message || 'Unbekannter Fehler').substring(0, 120);
  if (filename) {
    var parts = filename.split('/');
    var file = parts[parts.length - 1] || '';
    short += ' (' + file;
    if (lineno) short += ':' + lineno;
    short += ')';
  }
  return '[' + source + '] ' + short;
}

/**
 * Loggt einen Fehler intern.
 */
function logError(formatted) {
  _errors.push({ ts: Date.now(), msg: formatted });
  if (_errors.length > MAX_ERRORS) _errors.shift();
  console.error('[GR Error]', formatted);
}

/**
 * Zeigt eine nutzerfreundliche Fehlermeldung an (via Toast wenn möglich).
 * Lazy reference to ui.toast – may not be loaded yet.
 */
function showError(formatted) {
  // Dynamic import would be cleaner but error handler must be synchronous
  if (window.GR && window.GR.ui && window.GR.ui.toast) {
    window.GR.ui.toast('⚠️ Unerwarteter Fehler – siehe Konsole', 'warning', 4000);
  }
}

/**
 * Gibt die gesammelten Fehler zurück.
 * @returns {Error[]}
 */
export function getErrors() {
  return _errors.slice();
}

/**
 * Löscht die Fehlersammlung.
 */
export function clearErrors() {
  _errors = [];
}

// ===================================================================
// window.onerror – synchrone Fehler
// ===================================================================
export function onerror(message, filename, lineno, colno, error) {
  var formatted = formatError('JS', message, filename, lineno);
  logError(formatted);
  showError(formatted);
  return false; // weiterhin in Konsole anzeigen
};

// ===================================================================
// unhandledrejection – asynchrone Fehler (Promises)
// ===================================================================
window.addEventListener('unhandledrejection', function(event) {
  var reason = event.reason;
  var message = (reason && reason.message) ? reason.message : String(reason);
  var formatted = formatError('Async', message, reason && reason.stack ? '' : '');
  logError(formatted);
  showError(formatted);
});