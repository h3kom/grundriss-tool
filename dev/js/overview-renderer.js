/**
 * Grundriss Tool – Übersichts-Renderer
 * =====================================================================
 * @module overviewRenderer
 * @description Rendert die Übersichts-Ansicht mit Suchfunktion in der Sidebar.
 * Verwendet data-action für Event Delegation.
 */import { ROOM_TYPES, ROOM_TYPE_DEFAULT, EVT_ROOMS_CHANGED, SEARCH_DEBOUNCE } from './constants.js';
import * as S from './state.js';
import { escHtml, taskProgress, formatLastEdit } from './utils.js';

/**
   * Zeigt die Übersicht aller Räume an.
   */
  export function showOverview() {
    if (S.get('overview')) return;
    S.set('overview', true);
    S.set('selectedRoom', null);
    document.getElementById('btnOv')?.classList.add('active');
    S.notify(EVT_ROOMS_CHANGED);

    var UI = window.GR.ui;
    if (UI) UI.openSidebar();
    renderOverviewContent();
  };

  /**
   * Rendert den Inhalt der Übersicht.
   */
  export function renderOverviewContent() {
    // Suchwert aus State statt aus DOM (zuverlässiger bei Re-Renders)
    var searchValue = (S.get('searchQuery') || '').toLowerCase();
    var searchInput = document.querySelector('.os');
    if (searchInput && searchInput.value.toLowerCase() !== searchValue) {
      searchInput.value = searchValue;
    }

    var html = '<h3 style="margin:0 0 4px;font-size:16px;">\uD83D\uDCCA \u00DCbersicht</h3>';
    html += '<div class="osw"><span class="si">\uD83D\uDD0D</span>';
    html += '<input type="text" class="os" id="os" placeholder="R\u00E4ume suchen\u2026" value="' + U.escAttr(searchValue) + '">';
    html += '</div><div class="orl">';

    var rooms = S.get('rooms');
    var roomEntries = Object.entries(rooms);
    var filtered = searchValue
      ? roomEntries.filter(function(entry) {
          return entry[1].title.toLowerCase().includes(searchValue) ||
            entry[0].toLowerCase().includes(searchValue);
        })
      : roomEntries;

    if (filtered.length === 0) {
      html += '<p style="font-size:13px;color:var(--muted);text-align:center;padding:16px 0;">\uD83D\uDD0D Keine R\u00E4ume.</p>';
    } else {
      for (var i = 0; i < filtered.length; i++) {
        var key = filtered[i][0];
        var room = filtered[i][1];
        var progress = U.taskProgress(room);
        var floorLabel = room.floor === 'eg' ? 'EG' : 'OG';
        html += '<div class="ori" data-action="show-room" data-key="' + U.escAttr(key) + '">' +
          '<div class="nm">' + U.escHtml(room.title) + '<span style="font-size:11px;color:var(--muted);margin-left:4px;">(' + floorLabel + ')</span></div>' +
          '<div class="pt">' + progress.done + '/' + progress.total + ' (' + progress.percent + '%)</div>' +
        '</div>';
      }
    }

    html += '</div>';
    html += buildLastEditInfo();

    document.getElementById('sc').innerHTML = html;
  };

  /**
   * Debounced search (wrapped for input delegation).
   */
  export function debouncedSearch() {
    if (S.get('debounceTimer')) clearTimeout(S.get('debounceTimer'));
    S.set('debounceTimer', setTimeout(function() { renderOverviewContent(); }, SEARCH_DEBOUNCE));
  };

  /**
   * Baut die "Zuletzt bearbeitet"-Info.
   * @returns {string} HTML
   */
  export function buildLastEditInfo() {
    var text = U.formatLastEdit(S.get('lastSaveTs'));
    return text
      ? '<div style="margin-top:10px;font-size:11px;color:var(--muted);text-align:center;">' + U.escHtml(text) + '</div>'
      : '';
  };
