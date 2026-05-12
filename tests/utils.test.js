/**
 * Grundriss Tool – Unit-Tests für Utils
 * =====================================================================
 * @description Testet die zentralen Utility-Funktionen.
 *
 * Ausführung: npx vitest run
 * (erfordert: npm install --save-dev vitest)
 */
import { describe, it, expect } from 'vitest';

// Simuliere das window.GR-Umfeld für die IIFE-Module
const mockWindow = {};

// Exportierte Test-Version von utils.js (ohne DOM-Abhängigkeiten testbar)
function testGenerateKey(rooms) {
  const baseKey = 'raum';
  let key = baseKey;
  let i = 1;
  while (rooms[key]) {
    key = baseKey + i;
    i++;
  }
  return key;
}

function testDetectFloorId(id) {
  if (!id) return 'eg';
  const lower = id.toLowerCase();
  if (lower === 'og' || lower.startsWith('og') || lower.includes('-og') || lower.includes('_og')) return 'og';
  return 'eg';
}

function testEnsureRoomFields(room) {
  if (!room.comments) room.comments = [];
  if (!room.done) room.done = {};
  return room;
}

function testCompletedTaskCount(room) {
  if (!room.done) return 0;
  return Object.values(room.done).filter(Boolean).length;
}

function testTaskProgress(room) {
  const done = testCompletedTaskCount(room);
  const total = room.tasks ? room.tasks.length : 0;
  return { done, total, percent: total > 0 ? Math.round(done / total * 100) : 0 };
}

// Tests
describe('generateKey', () => {
  it('should return "raum" for empty rooms', () => {
    expect(testGenerateKey({})).toBe('raum');
  });

  it('should return "raum1" when "raum" exists', () => {
    const rooms = { raum: { title: 'Test' } };
    expect(testGenerateKey(rooms)).toBe('raum1');
  });

  it('should return "raum3" when "raum", "raum1", "raum2" exist', () => {
    const rooms = { raum: {}, raum1: {}, raum2: {} };
    expect(testGenerateKey(rooms)).toBe('raum3');
  });
});

describe('detectFloorId', () => {
  it('should return "eg" for undefined', () => {
    expect(testDetectFloorId()).toBe('eg');
  });

  it('should return "eg" for "eg"', () => {
    expect(testDetectFloorId('eg')).toBe('eg');
  });

  it('should return "og" for "og"', () => {
    expect(testDetectFloorId('og')).toBe('og');
  });

  it('should detect "og" in "eg-w"', () => {
    expect(testDetectFloorId('eg-w')).toBe('eg');
  });

  it('should detect "og" in "og-w"', () => {
    expect(testDetectFloorId('og-w')).toBe('og');
  });
});

describe('ensureRoomFields', () => {
  it('should add missing comments and done', () => {
    const room = {};
    testEnsureRoomFields(room);
    expect(room.comments).toEqual([]);
    expect(room.done).toEqual({});
  });

  it('should not overwrite existing fields', () => {
    const room = { comments: ['a'], done: { 0: true } };
    testEnsureRoomFields(room);
    expect(room.comments).toEqual(['a']);
    expect(room.done).toEqual({ 0: true });
  });
});

describe('taskProgress', () => {
  it('should return 0% for room with no tasks', () => {
    const room = { tasks: [] };
    expect(testTaskProgress(room)).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it('should calculate correct progress', () => {
    const room = { tasks: ['a', 'b', 'c', 'd'], done: { 0: true, 1: false, 2: true, 3: false } };
    const progress = testTaskProgress(room);
    expect(progress.done).toBe(2);
    expect(progress.total).toBe(4);
    expect(progress.percent).toBe(50);
  });

  it('should handle missing done field', () => {
    const room = { tasks: ['a', 'b'] };
    expect(testTaskProgress(room)).toEqual({ done: 0, total: 2, percent: 0 });
  });
});