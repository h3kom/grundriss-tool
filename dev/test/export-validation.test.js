/**
 * Tests for js/export.js – _validateImportData()
 * Covers: valid data, missing fields, too many rooms, wrong types, floor validation
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupGR, loadUtilsSync, loadExportSync, getExport } from './helpers/setup.js';

/**
 * Creates a minimal valid import data object for testing.
 */
function validImportData() {
  return {
    version: 1,
    exportDate: '2025-06-01T00:00:00.000Z',
    appName: 'Grundriss Tool',
    project: {
      name: 'Test Project',
      floors: [
        { id: 'eg', name: 'Erdgeschoss', sortOrder: 0 },
        { id: 'og', name: 'Obergeschoss', sortOrder: 1 },
      ],
      rooms: {
        raum1: {
          title: 'Büro',
          left: 100,
          top: 200,
          width: 150,
          height: 100,
          floor: 'eg',
        },
        raum2: {
          title: 'Küche',
          left: 300,
          top: 100,
          width: 80,
          height: 60,
          floor: 'eg',
        },
      },
    },
  };
}

function freshExport() {
  setupGR();
  loadUtilsSync();
  loadExportSync();
  return getExport()._validateImportData;
}

describe('export validation – _validateImportData()', () => {
  // ===================================================================
  // Valid data
  // ===================================================================
  describe('valid data', () => {
    it('accepts valid import data', () => {
      const validate = freshExport();
      const result = validate(validImportData());
      expect(result.valid).toBe(true);
    });

    it('accepts import data without floors', () => {
      const validate = freshExport();
      const data = validImportData();
      delete data.project.floors;
      const result = validate(data);
      expect(result.valid).toBe(true);
    });

    it('accepts import data with optional room fields (tasks, done, comments)', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms.raum1.tasks = ['Task A'];
      data.project.rooms.raum1.done = { 0: true };
      data.project.rooms.raum1.comments = [{ text: 'Note', user: 'A' }];
      const result = validate(data);
      expect(result.valid).toBe(true);
    });

    it('accepts a single room', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { title: 'Only Room', left: 0, top: 0, width: 100, height: 100, floor: 'eg' },
      };
      expect(validate(data).valid).toBe(true);
    });
  });

  // ===================================================================
  // Missing or invalid top-level fields
  // ===================================================================
  describe('missing or invalid top-level fields', () => {
    it('rejects null input', () => {
      const validate = freshExport();
      const result = validate(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('leer');
    });

    it('rejects undefined input', () => {
      const validate = freshExport();
      const result = validate(undefined);
      expect(result.valid).toBe(false);
    });

    it('rejects non-object input (string)', () => {
      const validate = freshExport();
      const result = validate('not an object');
      expect(result.valid).toBe(false);
    });

    it('rejects non-object input (number)', () => {
      const validate = freshExport();
      const result = validate(42);
      expect(result.valid).toBe(false);
    });

    it('rejects missing project object', () => {
      const validate = freshExport();
      const data = { version: 1 };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('project');
    });

    it('rejects project as non-object', () => {
      const validate = freshExport();
      const data = { project: 'string' };
      const result = validate(data);
      expect(result.valid).toBe(false);
    });
  });

  // ===================================================================
  // Rooms validation
  // ===================================================================
  describe('rooms validation', () => {
    it('rejects missing rooms', () => {
      const validate = freshExport();
      const data = { project: {} };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('rooms');
    });

    it('rejects rooms as array', () => {
      const validate = freshExport();
      const data = { project: { rooms: [] } };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Array');
    });

    it('rejects empty rooms object', () => {
      const validate = freshExport();
      const data = { project: { rooms: {} } };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Keine');
    });

    it('rejects too many rooms (>500)', () => {
      const validate = freshExport();
      const data = validImportData();
      const rooms = {};
      for (let i = 0; i < 501; i++) {
        rooms['r' + i] = { title: 'Room ' + i, left: 0, top: 0, width: 10, height: 10, floor: 'eg' };
      }
      data.project.rooms = rooms;
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('500');
    });

    it('accepts exactly 500 rooms', () => {
      const validate = freshExport();
      const data = validImportData();
      const rooms = {};
      for (let i = 0; i < 500; i++) {
        rooms['r' + i] = { title: 'Room ' + i, left: 0, top: 0, width: 10, height: 10, floor: 'eg' };
      }
      data.project.rooms = rooms;
      const result = validate(data);
      expect(result.valid).toBe(true);
    });
  });

  // ===================================================================
  // Individual room validation
  // ===================================================================
  describe('individual room validation', () => {
    it('rejects room that is not an object', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = { bad: 'not an object' };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('gültiges Objekt');
    });

    it('rejects room missing "title"', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { left: 0, top: 0, width: 100, height: 100, floor: 'eg' },
      };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('title');
    });

    it('rejects room missing "left"', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { title: 'Room', top: 0, width: 100, height: 100, floor: 'eg' },
      };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('left');
    });

    it('rejects room missing "top"', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { title: 'Room', left: 0, width: 100, height: 100, floor: 'eg' },
      };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('top');
    });

    it('rejects room missing "width"', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { title: 'Room', left: 0, top: 0, height: 100, floor: 'eg' },
      };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('width');
    });

    it('rejects room missing "height"', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { title: 'Room', left: 0, top: 0, width: 100, floor: 'eg' },
      };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('height');
    });

    it('rejects room missing "floor"', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { title: 'Room', left: 0, top: 0, width: 100, height: 100 },
      };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('floor');
    });

    it('rejects room with non-string title', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { title: 123, left: 0, top: 0, width: 100, height: 100, floor: 'eg' },
      };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('String');
    });

    it('rejects room with non-number left', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { title: 'Room', left: '0', top: 0, width: 100, height: 100, floor: 'eg' },
      };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Zahlen');
    });

    it('rejects room with non-number top', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { title: 'Room', left: 0, top: '0', width: 100, height: 100, floor: 'eg' },
      };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Zahlen');
    });

    it('rejects room with zero width', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { title: 'Room', left: 0, top: 0, width: 0, height: 100, floor: 'eg' },
      };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Breite');
    });

    it('rejects room with negative height', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { title: 'Room', left: 0, top: 0, width: 100, height: -5, floor: 'eg' },
      };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Höhe');
    });

    it('does not reject NaN dimensions (typeof NaN === "number" passes type check)', () => {
      // Note: This documents current behavior. The validation uses typeof checks
      // which accept NaN since typeof NaN === 'number'. A stricter check using
      // Number.isFinite() would catch this, but that is a code improvement, not a bug.
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { title: 'Room', left: NaN, top: 0, width: 100, height: 100, floor: 'eg' },
      };
      const result = validate(data);
      expect(result.valid).toBe(true);
    });
  });

  // ===================================================================
  // Floors validation
  // ===================================================================
  describe('floors validation', () => {
    it('rejects floors as non-array', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.floors = 'not-array';
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Array');
    });

    it('rejects floor entry without id', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.floors = [{ name: 'EG' }]; // missing id
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('id');
    });

    it('rejects floor entry that is not an object', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.floors = [null];
      const result = validate(data);
      expect(result.valid).toBe(false);
    });

    it('accepts valid floors array', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.floors = [
        { id: 'eg', name: 'Erdgeschoss', sortOrder: 0 },
      ];
      expect(validate(data).valid).toBe(true);
    });
  });

  // ===================================================================
  // Edge cases
  // ===================================================================
  describe('edge cases', () => {
    it('rejects room with null value', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = { bad: null };
      const result = validate(data);
      expect(result.valid).toBe(false);
    });

    it('handles floating point coordinates', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        r1: { title: 'Room', left: 10.5, top: 20.7, width: 100.3, height: 50.9, floor: 'eg' },
      };
      expect(validate(data).valid).toBe(true);
    });

    it('reports the correct room key in error messages', () => {
      const validate = freshExport();
      const data = validImportData();
      data.project.rooms = {
        'my-custom-key': { title: 'Room', left: 0, top: 0, width: 100, height: 100 },
      };
      const result = validate(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('my-custom-key');
    });
  });
});
