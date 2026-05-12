/**
 * Grundriss Tool – Detail-Panel Renderer
 * =====================================================================
 * @module detailRenderer
 * @description Rendert das Detail-Panel in der Sidebar für einen selektierten Raum.
 */
window.GR = window.GR || {};

(function(DR) {
  'use strict';

  const S = window.GR.state;
  const St = window.GR.storage;
  const U = window.GR.utils;

  /**
   * Rendert die Detail-Ansicht eines Raums in der Sidebar.
   * @param {string} key - Raumschlüssel
   */
  DR.renderDetail = function(key) {
    const room = S.get('rooms')[key];
    if (!room) return;

    const progress = U.taskProgress(room);
    const sbBody = document.getElementById('sbBody');
    if (!sbBody) return;

    let html = DR.buildDetailHeader(key, room);
    html += DR.buildProgressBar(progress);
    html += DR.buildTaskSection(key, room, progress);
    html += DR.buildNoteSection(key, room);
    html += DR.buildCommentSection(key, room);
    if (S.get('editMode')) html += DR.buildDeleteSection(key);
    html += DR.buildLastEditInfo();

    sbBody.innerHTML = html;
  };

  /**
   * Baut den Header des Detail-Panels.
   * @param {string} key - Raumschlüssel
   * @param {Object} room - Raum-Daten
   * @returns {string} HTML
   */
  DR.buildDetailHeader = function(key, room) {
    return `<div class="rdh">
      <button class="bb" onclick="window.GR.overviewRenderer.showOverview()">←</button>
      <h3>${U.escHtml(room.title)}</h3>
      <button class="rb" onclick="window.GR.ui.openRenameModal('${key}')" title="Umbenennen">✏️</button>
      <span class="rk">${U.escHtml(key)}</span>
    </div>`;
  };

  /**
   * Baut die Fortschrittsanzeige.
   * @param {{done:number,total:number,percent:number}} progress
   * @returns {string} HTML
   */
  DR.buildProgressBar = function(progress) {
    if (progress.total === 0) return '';
    return `<div style="font-size:13px;color:var(--muted);margin-bottom:2px;">
      ${progress.done}/${progress.total} Aufgaben (${progress.percent}%)
    </div>
    <div class="pbw"><div class="pbf" style="width:${progress.percent}%"></div></div>`;
  };

  /**
   * Baut die Aufgaben-Sektion.
   * @param {string} key - Raumschlüssel
   * @param {Object} room - Raum-Daten
   * @param {{done:number,total:number,percent:number}} progress
   * @returns {string} HTML
   */
  DR.buildTaskSection = function(key, room, progress) {
    let html = `<div class="is">
      <h4>Aufgaben${progress.total > 0 ? ` <span class="cnt">${progress.done}/${progress.total}</span>` : ''}</h4>`;

    if (!room.tasks || room.tasks.length === 0) {
      html += '<p style="font-size:13px;color:var(--muted);margin:0;">Keine Aufgaben.</p>';
    } else {
      html += '<div>';
      for (let i = 0; i < room.tasks.length; i++) {
        const checked = (room.done || {})[i] || false;
        html += `<div class="ti${checked ? ' done' : ''}">
          <input type="checkbox"${checked ? ' checked' : ''} onchange="window.GR.rooms.toggleTask('${key}',${i},this.checked)">
          <label>${U.escHtml(room.tasks[i])}</label>
          ${S.get('editMode') ? `<button class="td" onclick="window.GR.rooms.deleteTask('${key}',${i})">×</button>` : ''}
        </div>`;
      }
      html += '</div>';
    }

    if (S.get('editMode')) {
      html += `<div class="atr">
        <input type="text" id="nti-${key}" placeholder="Neue Aufgabe…" onkeydown="if(event.key==='Enter')window.GR.rooms.addTask('${key}')">
        <button onclick="window.GR.rooms.addTask('${key}')">+</button>
      </div>`;
    }

    html += '</div>';
    return html;
  };

  /**
   * Baut die Notiz-Sektion.
   * @param {string} key - Raumschlüssel
   * @param {Object} room - Raum-Daten
   * @returns {string} HTML
   */
  DR.buildNoteSection = function(key, room) {
    let html = `<div class="is"><h4>Notiz</h4>`;
    if (S.get('editMode')) {
      html += `<textarea class="rne" onchange="window.GR.rooms.saveNote('${key}',this.value)">${U.escHtml(room.note || '')}</textarea>`;
    } else {
      html += `<p style="margin:0;font-size:14px;">${U.escHtml(room.note || 'Keine Notiz.')}</p>`;
    }
    html += '</div>';
    return html;
  };

  /**
   * Baut die Kommentar-Sektion.
   * @param {string} key - Raumschlüssel
   * @param {Object} room - Raum-Daten
   * @returns {string} HTML
   */
  DR.buildCommentSection = function(key, room) {
    const commentCount = room.comments ? room.comments.length : 0;
    let html = `<div class="is">
      <h4>Kommentare${commentCount > 0 ? ` <span class="cnt">${commentCount}</span>` : ''}</h4>
      <div class="cl">`;

    if (room.comments && room.comments.length > 0) {
      for (let i = 0; i < room.comments.length; i++) {
        const timeStr = room.comments[i].time
          ? new Date(room.comments[i].time).toLocaleString('de-DE')
          : '';
        html += `<div class="ci">
          ${S.get('editMode') ? `<button class="cd" onclick="window.GR.rooms.deleteComment('${key}',${i})">×</button>` : ''}
          <div class="cm">${timeStr}</div>
          ${U.escHtml(room.comments[i].text)}
        </div>`;
      }
    } else {
      html += '<p style="font-size:13px;color:var(--muted);margin:0;">Keine Kommentare.</p>';
    }

    html += `</div>
      <div class="acr">
        <input type="text" id="nci-${key}" placeholder="Kommentar…" onkeydown="if(event.key==='Enter')window.GR.rooms.addComment('${key}')">
        <button onclick="window.GR.rooms.addComment('${key}')">Senden</button>
      </div>
    </div>`;

    return html;
  };

  /**
   * Baut den Löschen-Button (nur im Edit-Mode).
   * @param {string} key - Raumschlüssel
   * @returns {string} HTML
   */
  DR.buildDeleteSection = function(key) {
    return `<div class="is"><button class="drb" onclick="window.GR.rooms.deleteRoom('${key}')">🗑 Löschen</button></div>`;
  };

  /**
   * Baut die "Zuletzt bearbeitet"-Info.
   * @returns {string} HTML
   */
  DR.buildLastEditInfo = function() {
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
})(window.GR.detailRenderer = window.GR.detailRenderer || {});