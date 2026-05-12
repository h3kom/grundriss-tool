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

  // ===================================================================
  // Task Actions
  // ===================================================================

  /**
   * Schaltet eine Aufgabe um (erledigt/nicht erledigt).
   * @param {string} key - Raumschlüssel
   * @param {number} idx - Aufgaben-Index
   * @param {boolean} checked - Erledigt?
   */
  R.toggleTask = function(key, idx, checked) {
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
    const input = document.getElementById(`nti-${key}`);
    const text = input?.value?.trim();
    if (!text) return;
    const rooms = S.get('rooms');
    if (!rooms[key].tasks) rooms[key].tasks = [];
    rooms[key].tasks.push(text);
    St.saveData();
    input.value = '';
    input.focus();
  };

  /**
   * Löscht eine Aufgabe.
   * @param {string} key - Raumschlüssel
   * @param {number} idx - Aufgaben-Index
   */
  R.deleteTask = function(key, idx) {
    const room = S.get('rooms')[key];
    if (!room) return;
    if (!room.tasks) room.tasks = [];
    room.tasks.splice(idx, 1);
    const newDone = {};
    for (const k of Object.keys(room.done)) {
      if (!Object.prototype.hasOwnProperty.call(room.done, k)) continue;
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
    S.get('rooms')[key].note = value;
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
    const input = document.getElementById(`nci-${key}`);
    const text = input?.value?.trim();
    if (!text) return;
    const rooms = S.get('rooms');
    if (!rooms[key].comments) rooms[key].comments = [];
    rooms[key].comments.push({ text, time: new Date().toISOString() });
    St.saveData();
    input.value = '';
    input.focus();
  };

  /**
   * Löscht einen Kommentar.
   * @param {string} key - Raumschlüssel
   * @param {number} idx - Kommentar-Index
   */
  R.deleteComment = function(key, idx) {
    const rooms = S.get('rooms');
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
            rooms[backupKey] = backupRoom;
            St.saveData();
          });
        }
      });
    }
  };
})(window.GR.rooms = window.GR.rooms || {});