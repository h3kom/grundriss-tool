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
  const C = window.GR.constants;

  /** Role-based check: owner or editor can edit content (tasks, notes, comments). */
  function _canEdit() {
    return window.GR.app && window.GR.app.canEdit();
  }

  /** Spatial check: editMode must be on AND user must have edit role. */
  function _editable() {
    return S.get('editMode') && _canEdit();
  }

  /**
   * Rendert die Detail-Ansicht eines Raums in der Sidebar.
   * @param {string} key - Raumschlüssel
   */
  DR.renderDetail = function(key) {
    var room = S.get('rooms')[key];
    if (!room) return;

    var progress = U.taskProgress(room);
    var sc = document.getElementById('sc');
    if (!sc) return;

    var html = DR.buildDetailHeader(key, room);
    html += DR.buildProgressBar(progress);
    html += DR.buildTaskSection(key, room, progress);
    html += DR.buildNoteSection(key, room);
    html += DR.buildCommentSection(key, room);
    if (_editable()) html += DR.buildActionButtons(key);
    html += U.buildLastEditInfo(S.get('lastSaveTs'));

    sc.innerHTML = html;
  };

  /**
   * Baut den Header des Detail-Panels.
   */
  DR.buildDetailHeader = function(key, room) {
    return '<div class="rdh">' +
      '<button class="bb" data-action="close-sidebar">\u2190</button>' +
      '<h3>' + U.escHtml(room.title) + '</h3>' +
      (_editable() ? '<button class="rb" data-action="open-rename" data-key="' + U.escAttr(key) + '" title="Umbenennen">\u270F\uFE0F</button>' : '') +
      '<span class="rk">' + U.escHtml(key) + '</span>' +
    '</div>';
  };

  DR.buildProgressBar = function(progress) {
    if (progress.total === 0) return '';
    return '<div class="progress-text">' +
      progress.done + '/' + progress.total + ' Aufgaben (' + progress.percent + '%)' +
    '</div>' +
    '<div class="pbw"><div class="pbf" style="width:' + progress.percent + '%"></div></div>';
  };

  DR.buildTaskSection = function(key, room, progress) {
    var safeKey = U.escAttr(key);
    var html = '<div class="is">' +
      '<h4>Aufgaben' + (progress.total > 0 ? ' <span class="cnt">' + progress.done + '/' + progress.total + '</span>' : '') + '</h4>';

    if (!room.tasks || room.tasks.length === 0) {
      html += '<p class="empty-hint">Keine Aufgaben.</p>';
    } else {
      html += '<div>';
      for (var i = 0; i < room.tasks.length; i++) {
        var checked = (room.done || {})[i] || false;
        html += '<div class="ti' + (checked ? ' done' : '') + '">' +
          '<input type="checkbox"' + (checked ? ' checked' : '') +
          (_canEdit() ? '' : ' disabled') +
          ' data-action-change="toggle-task" data-key="' + safeKey + '" data-idx="' + i + '">' +
          '<label>' + U.escHtml(room.tasks[i]) + '</label>' +
          (_canEdit() ? '<button class="td" data-action="delete-task" data-key="' + safeKey + '" data-idx="' + i + '">\u00D7</button>' : '') +
        '</div>';
      }
      html += '</div>';
    }

    if (_canEdit()) {
      html += '<div class="atr">' +
        '<input type="text" id="nti-' + safeKey + '" placeholder="Neue Aufgabe\u2026" data-action-enter="add-task" data-key="' + safeKey + '">' +
        '<button data-action="add-task" data-key="' + safeKey + '">+</button>' +
      '</div>';
    }

    html += '</div>';
    return html;
  };

  DR.buildNoteSection = function(key, room) {
    var safeKey = U.escAttr(key);
    var html = '<div class="is"><h4>Notiz</h4>';
    if (_canEdit()) {
      html += '<textarea class="rne" data-action-change="save-note" data-key="' + safeKey + '">' + U.escHtml(room.note || '') + '</textarea>';
    } else {
      html += '<p class="empty-hint" style="font-size:14px;text-align:left;">' + U.escHtml(room.note || 'Keine Notiz.') + '</p>';
    }
    html += '</div>';
    return html;
  };

  DR.buildCommentSection = function(key, room) {
    var safeKey = U.escAttr(key);
    var commentCount = room.comments ? room.comments.length : 0;
    var html = '<div class="is">' +
      '<h4>Kommentare' + (commentCount > 0 ? ' <span class="cnt">' + commentCount + '</span>' : '') + '</h4>' +
      '<div class="cl">';

    if (room.comments && room.comments.length > 0) {
      for (var i = 0; i < room.comments.length; i++) {
        var c = room.comments[i];
        var timeStr = c.time
          ? new Date(c.time).toLocaleString('de-DE')
          : '';
        var userName = c.user || 'Unbekannt';
        html += '<div class="ci">' +
          (_canEdit() ? '<button class="cd" data-action="delete-comment" data-key="' + safeKey + '" data-idx="' + i + '">\u00D7</button>' : '') +
          '<div class="cm"><strong>' + U.escHtml(userName) + '</strong> · ' + U.escHtml(timeStr) + '</div>' +
          '<div class="ct">' + U.escHtml(c.text) + '</div>' +
        '</div>';
      }
    } else {
      html += '<p class="empty-hint">Keine Kommentare.</p>';
    }

    html += '</div>';
    if (_canEdit()) {
      html += '<div class="acr">' +
        '<input type="text" id="nci-' + safeKey + '" placeholder="Kommentar\u2026" data-action-enter="add-comment" data-key="' + safeKey + '">' +
        '<button data-action="add-comment" data-key="' + safeKey + '">Senden</button>' +
      '</div>';
    }
    html += '</div>';

    return html;
  };

  /**
   * Baut Aktions-Buttons (Duplizieren + Löschen).
   */
  DR.buildActionButtons = function(key) {
    return '<div class="is is-flex">' +
      '<button class="dup-btn" data-action="duplicate-room">📋 Duplizieren</button>' +
      '<button class="drb" data-action="delete-room" data-key="' + U.escAttr(key) + '">🗑️ Löschen</button>' +
    '</div>';
  };

})(window.GR.detailRenderer = window.GR.detailRenderer || {});
