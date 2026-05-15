/**
 * Grundriss Tool – Raum-CRUD (Aufgaben, Kommentare, Notizen, Löschen)
 * =====================================================================
 * @module rooms
 * @description Operationen auf Raum-Daten (Tasks, Comments, Notes, Delete).
 * Enthält kein Rendering – kommuniziert via State und Storage.
 */import { MIN_ROOM_SIZE, FLOORS, ROOM_TYPES, ROOM_TYPE_DEFAULT, EVT_ROOMS_CHANGED, EVT_SELECTION_CHANGED, EVT_EDIT_MODE_CHANGED } from './constants.js';
import * as S from './state.js';
import { saveData } from './storage.js';
import { escHtml, escAttr, generateKey } from './utils.js';
// Uses window.GR.renderer, window.GR.ui (lazy)

// ===================================================================
  // Task Actions
  // ===================================================================

  /**
   * Schaltet eine Aufgabe um (erledigt/nicht erledigt).
   * @param {string} key - Raumschlüssel
   * @param {number} idx - Aufgaben-Index
   * @param {boolean} checked - Erledigt?
   */
  export function toggleTask(key, idx, checked) {
    const room = S.get('rooms')[key];
    if (!room) return;
    if (!room.done) room.done = {};
    room.done[idx] = checked;
    saveData();
  };

  /**
   * Fügt eine neue Aufgabe hinzu.
   * @param {string} key - Raumschlüssel
   */
  export function addTask(key) {
    const input = document.getElementById(`nti-${key}`);
    const text = input?.value?.trim();
    if (!text) return;
    if (text.length > 200) {
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('Aufgabe zu lang (max. 200 Zeichen)', 'error', 2000);
      return;
    }
    const rooms = S.get('rooms');
    if (!rooms[key].tasks) rooms[key].tasks = [];
    rooms[key].tasks.push(text);
    saveData();
    input.value = '';
    input.focus();
  };

  /**
   * Löscht eine Aufgabe.
   * @param {string} key - Raumschlüssel
   * @param {number} idx - Aufgaben-Index
   */
  export function deleteTask(key, idx) {
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
    saveData();
  };

  // ===================================================================
  // Note Action
  // ===================================================================

  /**
   * Speichert eine Notiz.
   * @param {string} key - Raumschlüssel
   * @param {string} value - Notiztext
   */
  export function saveNote(key, value) {
    S.get('rooms')[key].note = value;
    saveData();
  };

  // ===================================================================
  // Comment Actions
  // ===================================================================

  /**
   * Fügt einen Kommentar hinzu.
   * @param {string} key - Raumschlüssel
   */
  export function addComment(key) {
    const input = document.getElementById(`nci-${key}`);
    const text = input?.value?.trim();
    if (!text) return;
    if (text.length > 1000) {
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('Kommentar zu lang (max. 1000 Zeichen)', 'error', 2000);
      return;
    }
    const rooms = S.get('rooms');
    if (!rooms[key].comments) rooms[key].comments = [];
    var currentUser = S.get('currentUser');
    var userName = (currentUser && currentUser.displayName) || 'Unbekannt';
    rooms[key].comments.push({ text: text, time: new Date().toISOString(), user: userName });
    saveData();
    input.value = '';
    input.focus();
  };

  /**
   * Löscht einen Kommentar.
   * @param {string} key - Raumschlüssel
   * @param {number} idx - Kommentar-Index
   */
  export function deleteComment(key, idx) {
    const rooms = S.get('rooms');
    if (!rooms[key].comments) rooms[key].comments = [];
    rooms[key].comments.splice(idx, 1);
    saveData();
  };

  // ===================================================================
  // Delete Room
  // ===================================================================

  /**
   * Löscht einen Raum (mit Undo-Unterstützung).
   * @param {string} key - Raumschlüssel
   */
  export function deleteRoom(key) {
    const rooms = S.get('rooms');
    const roomTitle = rooms[key]?.title || 'Unbekannt';
    const UI = window.GR.ui;
    if (UI && UI.confirm) {
      UI.confirm(`"${roomTitle}" löschen?`, function() {
        const backupRoom = deepClone(rooms[key]);
        const backupKey = key;
        delete rooms[key];
        S.set('selectedRoom', null);
        saveData();
        if (UI && UI.toast) {
          UI.toast(`"${backupRoom.title}" gelöscht`, 'warning', 6000, function() {
            rooms[backupKey] = backupRoom;
            saveData();
          });
        }
      });
    }
  };
