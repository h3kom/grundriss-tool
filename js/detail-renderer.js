/**
 * Grundriss Tool – Detail-Panel Renderer
 * =====================================================================
 * @module detailRenderer
 * @description Rendert das Detail-Panel in der Sidebar für einen selektierten Raum.
 * Verwendet data-action/data-actionEnter/data-actionChange für Event Delegation.
 */import { ROOM_TYPES } from './constants.js';
import * as S from './state.js';
import { escHtml, escAttr, taskProgress, formatLastEdit } from './utils.js';
// Uses window.GR.rooms (lazy)

/**
   * Rendert die Detail-Ansicht eines Raums in der Sidebar.
   * @param {string} key - Raumschlüssel
   */
  export function renderDetail(key) {
    var room = S.get('rooms')[key];
    if (!room) return;

    var progress = taskProgress(room);
    var sc = document.getElementById('sc');
    if (!sc) return;

    var html = buildDetailHeader(key, room);
    html += buildProgressBar(progress);
    html += buildTaskSection(key, room, progress);
    html += buildNoteSection(key, room);
    html += buildCommentSection(key, room);
    if (S.get('editMode')) html += buildActionButtons(key);
    html += buildLastEditInfo();

    sc.innerHTML = html;
  };

  /**
   * Baut den Header des Detail-Panels.
   */
  export function buildDetailHeader(key, room) {
    return '<div class="rdh">' +
      '<button class="bb" data-action="close-sidebar">\u2190</button>' +
      '<h3>' + escHtml(room.title) + '</h3>' +
      (S.get('editMode') ? '<button class="rb" data-action="open-rename" data-key="' + escAttr(key) + '" title="Umbenennen">\u270F\uFE0F</button>' : '') +
      '<span class="rk">' + escHtml(key) + '</span>' +
    '</div>';
  };

  export function buildProgressBar(progress) {
    if (progress.total === 0) return '';
    return '<div style="font-size:13px;color:var(--muted);margin-bottom:2px;">' +
      progress.done + '/' + progress.total + ' Aufgaben (' + progress.percent + '%)' +
    '</div>' +
    '<div class="pbw"><div class="pbf" style="width:' + progress.percent + '%"></div></div>';
  };

  export function buildTaskSection(key, room, progress) {
    var safeKey = escAttr(key);
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
          '<label>' + escHtml(room.tasks[i]) + '</label>' +
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

  export function buildNoteSection(key, room) {
    var safeKey = escAttr(key);
    var html = '<div class="is"><h4>Notiz</h4>';
    if (S.get('editMode')) {
      html += '<textarea class="rne" data-action-change="save-note" data-key="' + safeKey + '">' + escHtml(room.note || '') + '</textarea>';
    } else {
      html += '<p style="margin:0;font-size:14px;text-align:left;">' + escHtml(room.note || 'Keine Notiz.') + '</p>';
    }
    html += '</div>';
    return html;
  };

  export function buildCommentSection(key, room) {
    var safeKey = escAttr(key);
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
          (S.get('editMode') ? '<button class="cd" data-action="delete-comment" data-key="' + safeKey + '" data-idx="' + i + '">\u00D7</button>' : '') +
          '<div class="cm"><strong>' + escHtml(userName) + '</strong> · ' + escHtml(timeStr) + '</div>' +
          '<div class="ct">' + escHtml(c.text) + '</div>' +
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
   * Baut Aktions-Buttons (Duplizieren + Löschen).
   */
  export function buildActionButtons(key) {
    return '<div class="is" style="display:flex;gap:8px;">' +
      '<button class="dup-btn" data-action="duplicate-room" style="flex:1;">📋 Duplizieren</button>' +
      '<button class="drb" data-action="delete-room" data-key="' + escAttr(key) + '" style="flex:1;">🗑️ Löschen</button>' +
    '</div>';
  };

  export function buildDeleteSection(key) {
    return '<div class="is"><button class="drb" data-action="delete-room" data-key="' + escAttr(key) + '">🗑️ Löschen</button></div>';
  };

  export function buildLastEditInfo() {
    var text = formatLastEdit(S.get('lastSaveTs'));
    return text
      ? '<div style="margin-top:10px;font-size:11px;color:var(--muted);text-align:center;">' + escHtml(text) + '</div>'
      : '';
  };
