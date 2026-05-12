// Grundriss Tool – Konstanten
// =====================================================================
window.GR = window.GR || {};

(function(C) {
  C.SUPABASE_URL = 'https://civkerrcyqgsqqjpccqe.supabase.co';
  C.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpdmtlcnJjeXFnc3FxanBjY3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzkxNzAsImV4cCI6MjA5MzkxNTE3MH0.Q01QUWnwYm-aDAhbwi-Rb_kBU28s8Rx27J0RUkILY1U';
  C.NATIVE_WIDTHS = { eg: 1000, og: 800 };
  C.FLOORS = ['eg', 'og'];
  C.MAX_UNDO = 20;
  C.SYNC_INTERVAL = 3000;
})(window.GR.constants = window.GR.constants || {});