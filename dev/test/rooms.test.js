/**
 * Tests for js/rooms.js
 * Covers: toggleTask, deleteTask, addTask, saveNote, addComment, deleteComment
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupGR, loadUtilsSync, loadRoomsSync, getRooms } from './helpers/setup.js';

/**
 * Helper: creates a fresh environment with seeded rooms and returns the rooms API + tracker.
 */
function freshRooms(seed = {}) {
  const tracker = setupGR({
    initialRooms: {
      raum1: {
        title: 'Büro',
        tasks: ['Task A', 'Task B', 'Task C'],
        done: { 0: true, 1: false },
        comments: [],
        note: '',
        floor: 'eg',
      },
      ...seed,
    },
  });
  loadUtilsSync();
  loadRoomsSync();
  return { api: getRooms(), tracker };
}

/**
 * Helper: get current rooms from state
 */
function getRoomsState() {
  return window.GR.state.get('rooms');
}

describe('rooms', () => {
  // ===================================================================
  // toggleTask
  // ===================================================================
  describe('toggleTask()', () => {
    it('marks a task as done', () => {
      const { api, tracker } = freshRooms();
      api.toggleTask('raum1', 1, true);
      const rooms = getRoomsState();
      expect(rooms.raum1.done[1]).toBe(true);
      expect(tracker.saveDataCalls).toBe(1);
    });

    it('marks a task as undone', () => {
      const { api, tracker } = freshRooms();
      api.toggleTask('raum1', 0, false);
      const rooms = getRoomsState();
      expect(rooms.raum1.done[0]).toBe(false);
      expect(tracker.saveDataCalls).toBe(1);
    });

    it('creates done map if missing', () => {
      const { api } = freshRooms();
      const rooms = getRoomsState();
      delete rooms.raum1.done;
      api.toggleTask('raum1', 0, true);
      expect(rooms.raum1.done).toBeDefined();
      expect(rooms.raum1.done[0]).toBe(true);
    });

    it('does nothing for non-existent room', () => {
      const { api, tracker } = freshRooms();
      api.toggleTask('nonexistent', 0, true);
      expect(tracker.saveDataCalls).toBe(0);
    });
  });

  // ===================================================================
  // deleteTask
  // ===================================================================
  describe('deleteTask()', () => {
    it('removes a task from the array', () => {
      const { api } = freshRooms();
      api.deleteTask('raum1', 1);
      const rooms = getRoomsState();
      expect(rooms.raum1.tasks).toEqual(['Task A', 'Task C']);
    });

    it('shifts done-map entries for tasks after deleted index', () => {
      // Initial: done = { 0: true, 1: false }
      // Delete task at index 0
      // After: tasks = ['Task B', 'Task C'], done should shift: old index 1 -> new index 0
      const { api } = freshRooms();
      api.deleteTask('raum1', 0);
      const rooms = getRoomsState();
      // Old done[1] (false) should now be at done[0]
      expect(rooms.raum1.done[0]).toBe(false);
      // Old done[0] is gone (was the deleted task)
      expect(Object.keys(rooms.raum1.done)).toEqual(['0']);
    });

    it('preserves done-map entries for tasks before deleted index', () => {
      // Initial: done = { 0: true, 1: false }
      // Delete task at index 1
      const { api } = freshRooms();
      api.deleteTask('raum1', 1);
      const rooms = getRoomsState();
      expect(rooms.raum1.done[0]).toBe(true);
    });

    it('handles deleting from a room with no done map', () => {
      const { api } = freshRooms();
      const rooms = getRoomsState();
      delete rooms.raum1.done;
      // Room starts with tasks but no done map
      rooms.raum1.done = {};
      api.deleteTask('raum1', 0);
      expect(rooms.raum1.tasks).toEqual(['Task B', 'Task C']);
    });

    it('does nothing for non-existent room', () => {
      const { api, tracker } = freshRooms();
      api.deleteTask('nonexistent', 0);
      expect(tracker.saveDataCalls).toBe(0);
    });

    it('creates tasks array if missing and does not crash', () => {
      const { api } = freshRooms();
      const rooms = getRoomsState();
      delete rooms.raum1.tasks;
      // The module sets tasks = [] if missing, then splices empty array
      api.deleteTask('raum1', 0);
      expect(rooms.raum1.tasks).toEqual([]);
    });

    it('calls saveData', () => {
      const { api, tracker } = freshRooms();
      api.deleteTask('raum1', 0);
      expect(tracker.saveDataCalls).toBe(1);
    });
  });

  // ===================================================================
  // addTask
  // ===================================================================
  describe('addTask()', () => {
    it('adds a valid task to the room', () => {
      const { api, tracker } = freshRooms();
      // Mock DOM input
      const input = document.createElement('input');
      input.id = 'nti-raum1';
      input.value = 'Neue Aufgabe';
      document.body.appendChild(input);

      api.addTask('raum1');
      const rooms = getRoomsState();
      expect(rooms.raum1.tasks).toContain('Neue Aufgabe');
      expect(tracker.saveDataCalls).toBe(1);

      document.body.removeChild(input);
    });

    it('rejects empty task text', () => {
      const { api, tracker } = freshRooms();
      const input = document.createElement('input');
      input.id = 'nti-raum1';
      input.value = '   ';
      document.body.appendChild(input);

      const initialLength = getRoomsState().raum1.tasks.length;
      api.addTask('raum1');
      expect(getRoomsState().raum1.tasks.length).toBe(initialLength);
      expect(tracker.saveDataCalls).toBe(0);

      document.body.removeChild(input);
    });

    it('rejects task text longer than 200 characters', () => {
      const { api, tracker } = freshRooms();
      const input = document.createElement('input');
      input.id = 'nti-raum1';
      input.value = 'x'.repeat(201);
      document.body.appendChild(input);

      const initialLength = getRoomsState().raum1.tasks.length;
      api.addTask('raum1');
      expect(getRoomsState().raum1.tasks.length).toBe(initialLength);
      expect(tracker.saveDataCalls).toBe(0);
      // Should show toast error
      expect(window.GR.ui.toasts.length).toBeGreaterThan(0);
      expect(window.GR.ui.toasts[0].type).toBe('error');

      document.body.removeChild(input);
    });

    it('accepts task text exactly 200 characters', () => {
      const { api, tracker } = freshRooms();
      const input = document.createElement('input');
      input.id = 'nti-raum1';
      input.value = 'x'.repeat(200);
      document.body.appendChild(input);

      api.addTask('raum1');
      expect(getRoomsState().raum1.tasks).toContain('x'.repeat(200));
      expect(tracker.saveDataCalls).toBe(1);

      document.body.removeChild(input);
    });

    it('clears input after adding', () => {
      const { api } = freshRooms();
      const input = document.createElement('input');
      input.id = 'nti-raum1';
      input.value = 'Test';
      document.body.appendChild(input);

      api.addTask('raum1');
      expect(input.value).toBe('');

      document.body.removeChild(input);
    });

    it('does nothing when input element is missing', () => {
      const { api, tracker } = freshRooms();
      // No DOM element for this room key
      api.addTask('raum1');
      expect(tracker.saveDataCalls).toBe(0);
    });

    it('does nothing for non-existent room', () => {
      const { api, tracker } = freshRooms();
      const input = document.createElement('input');
      input.id = 'nti-nonexistent';
      input.value = 'Test';
      document.body.appendChild(input);

      api.addTask('nonexistent');
      expect(tracker.saveDataCalls).toBe(0);

      document.body.removeChild(input);
    });

    it('creates tasks array if missing', () => {
      const { api } = freshRooms();
      const rooms = getRoomsState();
      delete rooms.raum1.tasks;
      const input = document.createElement('input');
      input.id = 'nti-raum1';
      input.value = 'First task';
      document.body.appendChild(input);

      api.addTask('raum1');
      expect(rooms.raum1.tasks).toEqual(['First task']);

      document.body.removeChild(input);
    });
  });

  // ===================================================================
  // saveNote
  // ===================================================================
  describe('saveNote()', () => {
    it('saves a note to the room', () => {
      const { api, tracker } = freshRooms();
      api.saveNote('raum1', 'Important note');
      expect(getRoomsState().raum1.note).toBe('Important note');
      expect(tracker.saveDataCalls).toBe(1);
    });

    it('overwrites existing note', () => {
      const { api } = freshRooms();
      api.saveNote('raum1', 'New note');
      expect(getRoomsState().raum1.note).toBe('New note');
    });

    it('does nothing for non-existent room', () => {
      const { api, tracker } = freshRooms();
      api.saveNote('nonexistent', 'note');
      expect(tracker.saveDataCalls).toBe(0);
    });
  });

  // ===================================================================
  // addComment
  // ===================================================================
  describe('addComment()', () => {
    it('adds a comment with timestamp and user', () => {
      const { api, tracker } = freshRooms();
      window.GR.state.set('currentUser', { displayName: 'Max' });
      const input = document.createElement('input');
      input.id = 'nci-raum1';
      input.value = 'Great room!';
      document.body.appendChild(input);

      api.addComment('raum1');
      const comments = getRoomsState().raum1.comments;
      expect(comments).toHaveLength(1);
      expect(comments[0].text).toBe('Great room!');
      expect(comments[0].user).toBe('Max');
      expect(comments[0].time).toBeDefined();
      expect(tracker.saveDataCalls).toBe(1);

      document.body.removeChild(input);
    });

    it('uses "Unbekannt" when no current user', () => {
      const { api } = freshRooms();
      const input = document.createElement('input');
      input.id = 'nci-raum1';
      input.value = 'Test comment';
      document.body.appendChild(input);

      api.addComment('raum1');
      expect(getRoomsState().raum1.comments[0].user).toBe('Unbekannt');

      document.body.removeChild(input);
    });

    it('rejects empty comment text', () => {
      const { api, tracker } = freshRooms();
      const input = document.createElement('input');
      input.id = 'nci-raum1';
      input.value = '  ';
      document.body.appendChild(input);

      api.addComment('raum1');
      expect(getRoomsState().raum1.comments).toHaveLength(0);
      expect(tracker.saveDataCalls).toBe(0);

      document.body.removeChild(input);
    });

    it('rejects comment longer than 1000 characters', () => {
      const { api, tracker } = freshRooms();
      const input = document.createElement('input');
      input.id = 'nci-raum1';
      input.value = 'x'.repeat(1001);
      document.body.appendChild(input);

      api.addComment('raum1');
      expect(getRoomsState().raum1.comments).toHaveLength(0);
      expect(window.GR.ui.toasts.length).toBeGreaterThan(0);

      document.body.removeChild(input);
    });

    it('clears input after adding', () => {
      const { api } = freshRooms();
      const input = document.createElement('input');
      input.id = 'nci-raum1';
      input.value = 'Comment';
      document.body.appendChild(input);

      api.addComment('raum1');
      expect(input.value).toBe('');

      document.body.removeChild(input);
    });
  });

  // ===================================================================
  // deleteComment
  // ===================================================================
  describe('deleteComment()', () => {
    it('removes a comment by index', () => {
      const { api, tracker } = freshRooms();
      const rooms = getRoomsState();
      rooms.raum1.comments = [
        { text: 'First', time: '2025-01-01', user: 'A' },
        { text: 'Second', time: '2025-01-02', user: 'B' },
      ];

      api.deleteComment('raum1', 0);
      expect(rooms.raum1.comments).toHaveLength(1);
      expect(rooms.raum1.comments[0].text).toBe('Second');
      expect(tracker.saveDataCalls).toBe(1);
    });

    it('does nothing for non-existent room', () => {
      const { api, tracker } = freshRooms();
      api.deleteComment('nonexistent', 0);
      expect(tracker.saveDataCalls).toBe(0);
    });
  });
});
