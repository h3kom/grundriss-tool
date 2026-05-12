/**
 * Grundriss Tool – Übersichts-Renderer
 * =====================================================================
 * @module overviewRenderer
 * @description Rendert die Übersichts-Ansicht mit Suchfunktion in der Sidebar.
 */
window.GR = window.GR || {};

(function(OR) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const U = window.GR.utils;

  /**
   * Zeigt die Übersicht aller Räume an.
   */
  OR.showOverview = function() {
    if (S.get('overview')) return;
    S.set('overview', true);
    S.set('selectedRoom', null);
    document.getElementById('btnOv')?.classList.add('active');
    S.notify(C.EVT_ROOMS_CHANGED);

    const UI = window.GR.ui;
    if (UI) UI.openSidebar();
    OR.renderOverviewContent();
  };

  /**
   * Rendert den Inhalt der Übersicht.
   */
  OR.renderOverviewContent = function() {
    const searchValue = (document.querySelector('.os')?.value || '').toLowerCase();

    let html = '<h3 style="margin:0 0 4px;font-size:16px;">📊 Übersicht</h3>';
    html += '<div class="osw"><span class="si">🔍</span>';
    html += `<input type="text" class="os" id="os" placeholder="Räume suchen…" value="${U.escHtml(searchValue)}" oninput="window.GR.overviewRenderer.debouncedSearch()">`;
    html += '</div><div class="orl">';

    const rooms = S.get('rooms');
    const roomEntries = Object.entries(rooms);
    const filtered = searchValue
      ? roomEntries.filter(([key, room]) =>
          room.title.toLowerCase().includes(searchValue) ||
          key.toLowerCase().includes(searchValue)
        )
      : roomEntries;

    if (filtered.length === 0) {
      html += '<p style="font-size:13px;color:var(--muted);text-align:center;padding:16px 0;">🔍 Keine Räume.</p>';
    } else {
      for (const [key, room] of filtered) {
        const progress = U.taskProgress(room);
        const floorLabel = room.floor === 'eg' ? 'EG' : 'OG';
        html += `<div class="ori" onclick="window.GR.renderer.showRoom('${key}')">
          <div class="nm">${U.escHtml(room.title)}<span style="font-size:11px;color:var(--muted);margin-left:4px;">(${floorLabel})</span></div>
          <div class="pt">${progress.done}/${progress.total} (${progress.percent}%)</div>
        </div>`;
      }
    }

    html += '</div>';
    html += OR.buildLastEditInfo();

    document.getElementById('sbBody').innerHTML = html;
  };

  /**
   * Debounced search (wrapped for onclick).
   */
  OR.debouncedSearch = function() {
    if (S.get('debounceTimer')) clearTimeout(S.get('debounceTimer'));
    S.set('debounceTimer', setTimeout(() => OR.renderOverviewContent(), 200));
  };

  /**
   * Baut die "Zuletzt bearbeitet"-Info.
   * @returns {string} HTML
   */
  OR.buildLastEditInfo = function() {
    const delta = Date.now() - S.get('lastSaveTs');
    let text;
    if (delta < 60000) text = 'Gerade eben';
    else if (delta < 3600000) text = `Vor ${Math.round(delta / 60000)} Min.`;
    else if (delta < 86400000) text = `Vor ${Math.round(delta / 3600000)} Std.`;
    else text = new Date(S.get('lastSaveTs')).toLocaleDateString('de-DE');

    return text
      ? `<div style="margin-top:10px;font-size:11px;color:var(--muted);text-align:center;">${text}</div>`
      : '';
  };
})(window.GR.overviewRenderer = window.GR.overviewRenderer || {});