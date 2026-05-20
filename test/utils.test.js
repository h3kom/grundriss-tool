/**
 * Tests for js/utils.js
 * Covers: escHtml, escAttr, isValidKey, taskProgress, completedTaskCount,
 *         generateKey, deepClone, formatLastEdit, ensureRoomFields, ensureAllRooms,
 *         detectFloorId, getPointerPos
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupGR, loadUtilsSync, getUtils } from './helpers/setup.js';

// ─── Module loading ───
// utils.js has no GR dependencies except for formatLastEdit (needs constants) and
// getScale (needs constants + DOM). We load constants via setupGR().

describe('utils', () => {
  beforeEach(() => {
    setupGR();
    loadUtilsSync();
  });

  // ===================================================================
  // escHtml
  // ===================================================================
  describe('escHtml()', () => {
    const esc = () => getUtils().escHtml;

    it('escapes & to &amp;', () => {
      expect(esc()('foo & bar')).toBe('foo &amp; bar');
    });

    it('escapes < to &lt;', () => {
      expect(esc()('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes > to &gt;', () => {
      expect(esc()('a>b')).toBe('a&gt;b');
    });

    it('escapes " to &quot;', () => {
      expect(esc()('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it("escapes ' to &#39;", () => {
      expect(esc()("it's")).toBe('it&#39;s');
    });

    it('returns empty string for null', () => {
      expect(esc()(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(esc()(undefined)).toBe('');
    });

    it('converts numbers to strings', () => {
      expect(esc()(42)).toBe('42');
    });

    it('leaves safe strings unchanged', () => {
      expect(esc()('Hello World')).toBe('Hello World');
    });

    it('handles empty string', () => {
      expect(esc()('')).toBe('');
    });

    it('escapes a combined XSS payload', () => {
      const payload = '<img src=x onerror="alert(\'xss\')">';
      const result = esc()(payload);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('"');
      expect(result).not.toContain("'");
    });
  });

  // ===================================================================
  // escAttr
  // ===================================================================
  describe('escAttr()', () => {
    const esc = () => getUtils().escAttr;

    it('escapes & to &amp;', () => {
      expect(esc()('a & b')).toBe('a &amp; b');
    });

    it('escapes " to &quot;', () => {
      expect(esc()('val="x"')).toBe('val=&quot;x&quot;');
    });

    it("escapes ' to &#39;", () => {
      expect(esc()("a='b'")).toBe('a=&#39;b&#39;');
    });

    it('escapes < and >', () => {
      expect(esc()('<div>')).toBe('&lt;div&gt;');
    });

    it('returns empty string for null/undefined', () => {
      expect(esc()(null)).toBe('');
      expect(esc()(undefined)).toBe('');
    });

    it('converts numbers to strings', () => {
      expect(esc()(100)).toBe('100');
    });

    it('handles safe strings unchanged', () => {
      expect(esc()('hello-world')).toBe('hello-world');
    });
  });

  // ===================================================================
  // isValidKey
  // ===================================================================
  describe('isValidKey()', () => {
    const fn = () => getUtils().isValidKey;

    it('accepts alphanumeric keys', () => {
      expect(fn()('raum1')).toBe(true);
    });

    it('accepts hyphens', () => {
      expect(fn()('my-room')).toBe(true);
    });

    it('accepts underscores', () => {
      expect(fn()('my_room')).toBe(true);
    });

    it('rejects strings with spaces', () => {
      expect(fn()('my room')).toBe(false);
    });

    it('rejects strings with special characters', () => {
      expect(fn()('raum<script>')).toBe(false);
    });

    it('rejects strings with dots', () => {
      expect(fn()('raum.test')).toBe(false);
    });

    it('rejects non-string input', () => {
      expect(fn()(123)).toBe(false);
      expect(fn()(null)).toBe(false);
      expect(fn()(undefined)).toBe(false);
    });

    it('accepts empty string (matches regex)', () => {
      // The regex /^[a-zA-Z0-9_\-]+$/ requires at least one character due to +
      expect(fn()('')).toBe(false);
    });
  });

  // ===================================================================
  // completedTaskCount
  // ===================================================================
  describe('completedTaskCount()', () => {
    const fn = () => getUtils().completedTaskCount;

    it('returns 0 when room has no done map', () => {
      expect(fn()({ tasks: ['a', 'b'] })).toBe(0);
    });

    it('counts only truthy done entries', () => {
      const room = { done: { 0: true, 1: false, 2: true } };
      expect(fn()(room)).toBe(2);
    });

    it('returns 0 for empty done map', () => {
      expect(fn()({ done: {} })).toBe(0);
    });

    it('counts all done when all are true', () => {
      const room = { done: { 0: true, 1: true, 2: true } };
      expect(fn()(room)).toBe(3);
    });
  });

  // ===================================================================
  // taskProgress
  // ===================================================================
  describe('taskProgress()', () => {
    const fn = () => getUtils().taskProgress;

    it('returns 0% for room with no tasks', () => {
      const result = fn()({});
      expect(result).toEqual({ done: 0, total: 0, percent: 0 });
    });

    it('calculates correct progress for partial completion', () => {
      const room = { tasks: ['a', 'b', 'c'], done: { 0: true } };
      const result = fn()(room);
      expect(result).toEqual({ done: 1, total: 3, percent: 33 });
    });

    it('calculates 100% when all tasks done', () => {
      const room = { tasks: ['a', 'b'], done: { 0: true, 1: true } };
      const result = fn()(room);
      expect(result).toEqual({ done: 2, total: 2, percent: 100 });
    });

    it('rounds percent correctly', () => {
      // 1/3 = 33.33... => 33
      const room = { tasks: ['a', 'b', 'c'], done: { 0: true } };
      expect(fn()(room).percent).toBe(33);
    });

    it('handles null tasks array', () => {
      const room = { done: {} };
      const result = fn()(room);
      expect(result.total).toBe(0);
    });
  });

  // ===================================================================
  // generateKey
  // ===================================================================
  describe('generateKey()', () => {
    const fn = () => getUtils().generateKey;

    it('returns "raum" when no rooms exist', () => {
      expect(fn()({})).toBe('raum');
    });

    it('returns "raum1" when "raum" exists', () => {
      expect(fn()({ raum: {} })).toBe('raum1');
    });

    it('returns "raum3" when raum, raum1, raum2 exist', () => {
      expect(fn()({ raum: {}, raum1: {}, raum2: {} })).toBe('raum3');
    });

    it('skips gaps in numbering (raum exists, raum1 missing)', () => {
      // raum exists, raum1 is free
      expect(fn()({ raum: {}, raum2: {} })).toBe('raum1');
    });

    it('handles rooms object with unrelated keys', () => {
      expect(fn()({ kitchen: {} })).toBe('raum');
    });
  });

  // ===================================================================
  // deepClone
  // ===================================================================
  describe('deepClone()', () => {
    const fn = () => getUtils().deepClone;

    it('deep clones an object', () => {
      const obj = { a: 1, b: { c: 2 } };
      const clone = fn()(obj);
      expect(clone).toEqual(obj);
      expect(clone).not.toBe(obj);
      expect(clone.b).not.toBe(obj.b);
    });

    it('deep clones arrays', () => {
      const arr = [1, [2, 3]];
      const clone = fn()(arr);
      expect(clone).toEqual(arr);
      expect(clone[1]).not.toBe(arr[1]);
    });

    it('handles null', () => {
      expect(fn()(null)).toBe(null);
    });

    it('handles primitives', () => {
      expect(fn()(42)).toBe(42);
      expect(fn()('hello')).toBe('hello');
      expect(fn()(true)).toBe(true);
    });

    it('strips functions (JSON round-trip)', () => {
      const obj = { a: 1, fn: () => {} };
      const clone = fn()(obj);
      expect(clone).toEqual({ a: 1 });
    });
  });

  // ===================================================================
  // formatLastEdit
  // ===================================================================
  describe('formatLastEdit()', () => {
    const fn = () => getUtils().formatLastEdit;

    it('returns "Gerade eben" for recent timestamp', () => {
      const now = Date.now();
      expect(fn()(now)).toBe('Gerade eben');
    });

    it('returns minutes for timestamps within the last hour', () => {
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      const result = fn()(fiveMinAgo);
      expect(result).toMatch(/^Vor \d+ Min\.$/);
    });

    it('returns hours for timestamps within the last day', () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const result = fn()(twoHoursAgo);
      expect(result).toMatch(/^Vor \d+ Std\.$/);
    });

    it('returns a date string for older timestamps', () => {
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const result = fn()(twoDaysAgo);
      // Should be a German locale date string, not starting with "Vor"
      expect(result).not.toMatch(/^Vor/);
      // Should contain dots (German date format e.g. "18.5.2026")
      expect(result).toMatch(/\d+\.\d+\.\d+/);
    });

    it('handles exactly on the minute boundary', () => {
      const exactly60sAgo = Date.now() - 60000;
      const result = fn()(exactly60sAgo);
      // At exactly 60000ms, delta is NOT less than TIME_THRESHOLD_MINUTE (60000)
      // so it falls through to minutes display
      expect(result).toMatch(/Min\./);
    });
  });

  // ===================================================================
  // ensureRoomFields
  // ===================================================================
  describe('ensureRoomFields()', () => {
    const fn = () => getUtils().ensureRoomFields;

    it('adds missing comments array', () => {
      const room = { title: 'Test' };
      fn()(room);
      expect(room.comments).toEqual([]);
    });

    it('adds missing done map', () => {
      const room = { title: 'Test' };
      fn()(room);
      expect(room.done).toEqual({});
    });

    it('does not overwrite existing comments', () => {
      const room = { comments: ['hi'] };
      fn()(room);
      expect(room.comments).toEqual(['hi']);
    });

    it('does not overwrite existing done', () => {
      const room = { done: { 0: true } };
      fn()(room);
      expect(room.done).toEqual({ 0: true });
    });

    it('returns the room object', () => {
      const room = {};
      expect(fn()(room)).toBe(room);
    });
  });

  // ===================================================================
  // ensureAllRooms
  // ===================================================================
  describe('ensureAllRooms()', () => {
    const fn = () => getUtils().ensureAllRooms;

    it('ensures fields for all rooms', () => {
      const rooms = {
        r1: { title: 'A' },
        r2: { title: 'B', comments: ['x'] },
      };
      fn()(rooms);
      expect(rooms.r1.comments).toEqual([]);
      expect(rooms.r1.done).toEqual({});
      expect(rooms.r2.comments).toEqual(['x']);
      expect(rooms.r2.done).toEqual({});
    });
  });

  // ===================================================================
  // detectFloorId
  // ===================================================================
  describe('detectFloorId()', () => {
    const fn = () => getUtils().detectFloorId;

    it('returns "eg" for falsy input', () => {
      expect(fn()()).toBe('eg');
      expect(fn()(null)).toBe('eg');
      expect(fn()('')).toBe('eg');
    });

    it('returns "og" for "og"', () => {
      expect(fn()('og')).toBe('og');
    });

    it('returns "og" for strings starting with "og"', () => {
      expect(fn()('ogfloor')).toBe('og');
    });

    it('returns "og" for strings containing "-og"', () => {
      expect(fn()('floor-og')).toBe('og');
    });

    it('returns "og" for strings containing "_og"', () => {
      expect(fn()('floor_og')).toBe('og');
    });

    it('returns "eg" for unrecognized strings', () => {
      expect(fn()('basement')).toBe('eg');
    });

    it('is case-insensitive', () => {
      expect(fn()('OG')).toBe('og');
    });
  });

  // ===================================================================
  // getPointerPos
  // ===================================================================
  describe('getPointerPos()', () => {
    const fn = () => getUtils().getPointerPos;

    it('extracts x, y from mouse event', () => {
      const e = { clientX: 100, clientY: 200 };
      expect(fn()(e)).toEqual({ x: 100, y: 200 });
    });

    it('extracts x, y from touches array', () => {
      const e = { touches: [{ clientX: 50, clientY: 75 }], clientX: 0, clientY: 0 };
      expect(fn()(e)).toEqual({ x: 50, y: 75 });
    });

    it('falls back to changedTouches', () => {
      const e = { changedTouches: [{ clientX: 30, clientY: 40 }] };
      expect(fn()(e)).toEqual({ x: 30, y: 40 });
    });

    it('prefers touches over clientX', () => {
      const e = { touches: [{ clientX: 10, clientY: 20 }], clientX: 99, clientY: 99 };
      expect(fn()(e)).toEqual({ x: 10, y: 20 });
    });
  });
});
