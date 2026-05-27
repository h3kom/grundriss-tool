/**
 * Grundriss Tool – Raum-CRUD (Aufgaben, Kommentare, Notizen, Löschen)
 * =====================================================================
 * @module rooms
 * @description Operationen auf Raum-Daten (Tasks, Comments, Notes, Delete).
 * Enthält kein Rendering – kommuniziert via State und Storage.
 */
window.GR = window.GR || {};

(function(R) {
  'use strict';

  const S = window.GR.state;
  const St = window.GR.storage;
  const U = window.GR.utils;
  const C = window.GR.constants;

  function _canEditContent() {
    return window.GR.app && window.GR.app.canEdit();
  }

  function _canEditSpatial() {
    return S.get('editMode') && _canEditContent();
  }

  R.toggleTask = function(key, idx, checked) {
    if (!_canEditContent()) return;
    const room = S.get('rooms')[key];
    if (!room) return;
    if (!room.done) room.done = {};
    room.done[idx] = checked;
    St.saveData();
  };

  /**
   * Fügt eine neue Aufgabe hinzu.
   * @param {string} key - Raumschlüssel
   */
  R.addTask = function(key) {
    if (!_canEditSpatial()) return;
    const input = document.getElementById(`nti-${key}`);
    const text = input?.value?.trim();
    if (!text) return;
    if (text.length > C.MAX_TASK_LENGTH) {
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('Aufgabe zu lang (max. ' + C.MAX_TASK_LENGTH + ' Zeichen)', 'error', 2000);
      return;
    }
    const rooms = S.get('rooms');
    if (!rooms[key]) return;
    if (!rooms[key].tasks) rooms[key].tasks = [];
    rooms[key].tasks.push(text);
    if (input) input.value = '';
    St.saveData();
    var newInput = document.getElementById(`nti-${key}`);
    if (newInput) newInput.focus();
  };

  /**
   * Löscht eine Aufgabe.
   * @param {string} key - Raumschlüssel
   * @param {number} idx - Aufgaben-Index
   */
  R.deleteTask = function(key, idx) {
    if (!_canEditContent()) return;
    const room = S.get('rooms')[key];
    if (!room) return;
    if (!room.tasks) room.tasks = [];
    room.tasks.splice(idx, 1);
    const newDone = {};
    for (const k of Object.keys(room.done)) {
      const ki = parseInt(k);
      if (ki < idx) newDone[k] = room.done[k];
      else if (ki > idx) newDone[(ki - 1).toString()] = room.done[k];
    }
    room.done = newDone;
    St.saveData();
  };

  // ===================================================================
  // Note Action
  // ===================================================================

  /**
   * Speichert eine Notiz.
   * @param {string} key - Raumschlüssel
   * @param {string} value - Notiztext
   */
  R.saveNote = function(key, value) {
    if (!_canEditSpatial()) return;
    var room = S.get('rooms')[key];
    if (!room) return;
    room.note = value;
    St.saveData();
  };

  // ===================================================================
  // Comment Actions
  // ===================================================================

  /**
   * Fügt einen Kommentar hinzu.
   * @param {string} key - Raumschlüssel
   */
  R.addComment = function(key) {
    if (!_canEditContent()) return;
    const input = document.getElementById(`nci-${key}`);
    const text = input?.value?.trim();
    if (!text) return;
    if (text.length > C.MAX_COMMENT_LENGTH) {
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('Kommentar zu lang (max. ' + C.MAX_COMMENT_LENGTH + ' Zeichen)', 'error', 2000);
      return;
    }
    const rooms = S.get('rooms');
    if (!rooms[key]) return;
    if (!rooms[key].comments) rooms[key].comments = [];
    var currentUser = S.get('currentUser');
    var userName = (currentUser && currentUser.displayName) || 'Unbekannt';
    rooms[key].comments.push({ text: text, time: new Date().toISOString(), user: userName });
    if (input) input.value = '';
    St.saveData();
    var newInput = document.getElementById(`nci-${key}`);
    if (newInput) newInput.focus();
  };

  /**
   * Löscht einen Kommentar.
   * @param {string} key - Raumschlüssel
   * @param {number} idx - Kommentar-Index
   */
  R.deleteComment = function(key, idx) {
    if (!_canEditContent()) return;
    const rooms = S.get('rooms');
    if (!rooms[key]) return;
    if (!rooms[key].comments) rooms[key].comments = [];
    rooms[key].comments.splice(idx, 1);
    St.saveData();
  };

  // ===================================================================
  // Delete Room
  // ===================================================================

  /**
   * Löscht einen Raum (mit Undo-Unterstützung).
   * @param {string} key - Raumschlüssel
   */
  R.deleteRoom = function(key) {
    if (!_canEditSpatial()) return;
    const rooms = S.get('rooms');
    const roomTitle = rooms[key]?.title || 'Unbekannt';
    const UI = window.GR.ui;
    if (UI && UI.confirm) {
      UI.confirm(`"${roomTitle}" löschen?`, function() {
        const backupRoom = U.deepClone(rooms[key]);
        const backupKey = key;
        delete rooms[key];
        S.set('selectedRoom', null);
        St.saveData();
        if (UI && UI.toast) {
          UI.toast(`"${backupRoom.title}" gelöscht`, 'warning', 6000, function() {
            if (!rooms[backupKey]) {
              rooms[backupKey] = backupRoom;
              St.saveData();
              S.notify(C.EVT_ROOMS_CHANGED);
            }
          });
        }
      });
    }
  };
})(window.GR.rooms = window.GR.rooms || {});