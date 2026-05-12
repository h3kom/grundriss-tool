/**
 * Grundriss Tool – Detail-Panel Renderer
 * =====================================================================
 * @module detailRenderer
 * @description Rendert das Detail-Panel in der Sidebar für einen selektierten Raum.
 * Verwendet data-action/data-actionEnter/data-actionChange für Event Delegation.
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
    var room = S.get('rooms')[key];
    if (!room) return;

    var progress = U.taskProgress(room);
    var sbBody = document.getElementById('sbBody');
    if (!sbBody) return;

    var html = DR.buildDetailHeader(key, room);
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
    return '<div class="rdh">' +
      '<button class="bb" data-action="show-overview">\u2190</button>' +
      '<h3>' + U.escHtml(room.title) + '</h3>' +
      '<button class="rb" data-action="open-rename" data-key="' + U.escAttr(key) + '" title="Umbenennen">\u270F\uFE0F</button>' +
      '<span class="rk">' + U.escHtml(key) + '</span>' +
    '</div>';
  };

  /**
   * Baut die Fortschrittsanzeige.
   * @param {{done:number,total:number,percent:number}} progress
   * @returns {string} HTML
   */
  DR.buildProgressBar = function(progress) {
    if (progress.total === 0) return '';
    return '<div style="font-size:13px;color:var(--muted);margin-bottom:2px;">' +
      progress.done + '/' + progress.total + ' Aufgaben (' + progress.percent + '%)' +
    '</div>' +
    '<div class="pbw"><div class="pbf" style="width:' + progress.percent + '%"></div></div>';
  };

  /**
   * Baut die Aufgaben-Sektion.
   * @param {string} key - Raumschlüssel
   * @param {Object} room - Raum-Daten
   * @param {{done:number,total:number,percent:number}} progress
   * @returns {string} HTML
   */
  DR.buildTaskSection = function(key, room, progress) {
    var safeKey = U.escAttr(key);
    var html = '<div class="is">' +
      '<h4>Aufgaben' + (progress.total > 0 ? ' <span class="cnt">' + progress.done + '/' + progress.total + '</span>' : '') + '</h4>';

    if (!room.tasks || room.tasks.length === 0) {
      html += '<p style="font-size:13px;color:var(--muted);margin:0;">Keine Aufgaben.</p>';
    } else {
      html += '<div>';
      for (var i = 0; i < room.tasks.length; i++) {
        var checked = (room.done || {})[i] || false;
        html += '<div class="ti' + (checked ? ' done' : '') + '">' +
          '<input type="checkbox"' + (checked ? ' checked' : '') +
          ' data-action-change="toggle-task" data-key="' + safeKey + '" data-idx="' + i + '">' +
          '<label>' + U.escHtml(room.tasks[i]) + '</label>' +
          (S.get('editMode') ? '<button class="td" data-action="delete-task" data-key="' + safeKey + '" data-idx="' + i + '">\u00D7</button>' : '') +
        '</div>';
      }
      html += '</div>';
    }

    if (S.get('editMode')) {
      html += '<div class="atr">' +
        '<input type="text" id="nti-' + safeKey + '" placeholder="Neue Aufgabe\u2026" data-action-enter="add-task" data-key="' + safeKey + '">' +
        '<button data-action="add-task" data-key="' + safeKey + '">+</button>' +
      '</div>';
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
    var safeKey = U.escAttr(key);
    var html = '<div class="is"><h4>Notiz</h4>';
    if (S.get('editMode')) {
      html += '<textarea class="rne" data-action-change="save-note" data-key="' + safeKey + '">' + U.escHtml(room.note || '') + '</textarea>';
    } else {
      html += '<p style="margin:0;font-size:14px;">' + U.escHtml(room.note || 'Keine Notiz.') + '</p>';
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
    var safeKey = U.escAttr(key);
    var commentCount = room.comments ? room.comments.length : 0;
    var html = '<div class="is">' +
      '<h4>Kommentare' + (commentCount > 0 ? ' <span class="cnt">' + commentCount + '</span>' : '') + '</h4>' +
      '<div class="cl">';

    if (room.comments && room.comments.length > 0) {
      for (var i = 0; i < room.comments.length; i++) {
        var timeStr = room.comments[i].time
          ? new Date(room.comments[i].time).toLocaleString('de-DE')
          : '';
        html += '<div class="ci">' +
          (S.get('editMode') ? '<button class="cd" data-action="delete-comment" data-key="' + safeKey + '" data-idx="' + i + '">\u00D7</button>' : '') +
          '<div class="cm">' + U.escHtml(timeStr) + '</div>' +
          U.escHtml(room.comments[i].text) +
        '</div>';
      }
    } else {
      html += '<p style="font-size:13px;color:var(--muted);margin:0;">Keine Kommentare.</p>';
    }

    html += '</div>' +
      '<div class="acr">' +
        '<input type="text" id="nci-' + safeKey + '" placeholder="Kommentar\u2026" data-action-enter="add-comment" data-key="' + safeKey + '">' +
        '<button data-action="add-comment" data-key="' + safeKey + '">Senden</button>' +
      '</div>' +
    '</div>';

    return html;
  };

  /**
   * Baut den Löschen-Button (nur im Edit-Mode).
   * @param {string} key - Raumschlüssel
   * @returns {string} HTML
   */
  DR.buildDeleteSection = function(key) {
    return '<div class="is"><button class="drb" data-action="delete-room" data-key="' + U.escAttr(key) + '">\uD83D\uDDD1 L\u00F6schen</button></div>';
  };

  /**
   * Baut die "Zuletzt bearbeitet"-Info.
   * @returns {string} HTML
   */
  DR.buildLastEditInfo = function() {
    var text = U.formatLastEdit(S.get('lastSaveTs'));
    return text
      ? '<div style="margin-top:10px;font-size:11px;color:var(--muted);text-align:center;">' + U.escHtml(text) + '</div>'
      : '';
  };
})(window.GR.detailRenderer = window.GR.detailRenderer || {});