/**
 * Grundriss Tool – Export / Import
 * =====================================================================
 * @module export
 * @description Exportiert Projektdaten als JSON und importiert sie wieder.
 * Floor-IDs werden beim Import automatisch auf das Zielprojekt gemappt.
 */
window.GR = window.GR || {};

(function(Exp) {
  'use strict';

  const S = window.GR.state;
  const C = window.GR.constants;
  const U = window.GR.utils;
  const UI = window.GR.ui;

  /** Aktuelle Export-Version */
  const EXPORT_VERSION = 1;

  // ===================================================================
  // Export
  // ===================================================================

  Exp.exportProject = function() {
    const proj = S.get('currentProject');
    const floors = S.get('currentProjectFloors') || [];
    const rooms = S.get('rooms') || {};

    if (!proj) {
      if (UI && UI.toast) UI.toast('Kein Projekt geöffnet', 'error', 2000);
      return;
    }

    const exportData = {
      version: EXPORT_VERSION,
      exportDate: new Date().toISOString(),
      appName: 'Grundriss Tool',
      project: {
        name: proj.name || 'Unbenanntes Projekt',
        floors: floors.map(function(f) {
          return { id: f.id, name: f.name, sortOrder: f.sortOrder };
        }),
        rooms: U.deepClone(rooms)
      }
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const safeName = (proj.name || 'grundriss')
      .replace(/[^a-zA-Z0-9äöüÄÖÜß\s\-_]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    const filename = safeName + '_' + new Date().toISOString().slice(0, 10) + '.json';

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const roomCount = Object.keys(rooms).length;
    const floorCount = floors.length;
    if (UI && UI.toast) {
      UI.toast('📦 Export: ' + floorCount + ' Stockwerk(e), ' + roomCount + ' Raum/Räume', 'success', 3000);
    }
  };

  // ===================================================================
  // Import: Floor-ID Mapping
  // ===================================================================

  /**
   * Mappt Floor-IDs aus dem Import auf die tatsächlichen Floor-IDs des Projekts.
   * JSON hat z.B. floor:"eg", Cloud-Projekt nutzt UUIDs.
   * Strategie: nach sortOrder (Position im Array).
   */
  Exp._mapFloorIds = function(importedRooms, importedFloors) {
    const currentFloors = S.get('currentProjectFloors') || [];
    if (currentFloors.length === 0) return importedRooms;

    const floorMap = {};

    if (importedFloors && importedFloors.length > 0) {
      const sortedImported = importedFloors.slice().sort(function(a, b) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
      const sortedCurrent = currentFloors.slice().sort(function(a, b) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
      for (let i = 0; i < sortedImported.length && i < sortedCurrent.length; i++) {
        floorMap[sortedImported[i].id] = sortedCurrent[i].id;
      }
    } else {
      // Kein Floor-Info im Import → Räume auf Floor 1 des Projekts setzen
      if (currentFloors.length > 0) {
        const allFloorIds = Object.keys(importedRooms).map(function(k) { return importedRooms[k].floor; });
        const uniqueFloors = [];
        allFloorIds.forEach(function(f) { if (f && uniqueFloors.indexOf(f) === -1) uniqueFloors.push(f); });
        uniqueFloors.sort();
        for (let j = 0; j < uniqueFloors.length && j < currentFloors.length; j++) {
          floorMap[uniqueFloors[j]] = currentFloors[j].id;
        }
      }
    }

    // Floor-IDs in Räumen umschreiben
    const mappedRooms = U.deepClone(importedRooms);
    const keys = Object.keys(mappedRooms);
    for (let k = 0; k < keys.length; k++) {
      const room = mappedRooms[keys[k]];
      if (room.floor && floorMap[room.floor]) {
        room.floor = floorMap[room.floor];
      } else {
        // Fallback: Floor-ID nicht im Mapping → ersten Floor setzen
        if (currentFloors.length > 0) room.floor = currentFloors[0].id;
      }
    }

    return mappedRooms;
  };

  /**
   * Zentrale Import-Funktion: Mappt Floors, setzt Räume, speichert, rendert.
   */
  Exp._applyImport = async function(data, toast) {
    const roomCount = Object.keys(data.project.rooms).length;
    const mappedRooms = Exp._mapFloorIds(data.project.rooms, data.project.floors);

    S.set('rooms', mappedRooms);

    const St = window.GR.storage;
    if (St && St.saveData) await St.saveData();

    const Rdr = window.GR.renderer;
    if (Rdr && Rdr.render) Rdr.render();

    toast('✅ Import erfolgreich! ' + roomCount + ' Raum/Räume importiert', 'success', 3000);
  };

  // ===================================================================
  // Validierung
  // ===================================================================

  Exp._validateImportData = function(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Datei ist leer oder kein JSON-Objekt' };
    }
    if (!data.project || typeof data.project !== 'object') {
      return { valid: false, error: '"project" Objekt fehlt' };
    }
    if (!data.project.rooms || typeof data.project.rooms !== 'object') {
      return { valid: false, error: '"project.rooms" Objekt fehlt' };
    }
    if (Array.isArray(data.project.rooms)) {
      return { valid: false, error: '"project.rooms" muss ein Objekt sein, kein Array' };
    }
    const roomKeys = Object.keys(data.project.rooms);
    if (roomKeys.length === 0) {
      return { valid: false, error: 'Keine Räume in der Datei enthalten' };
    }
    if (roomKeys.length > C.MAX_IMPORT_ROOMS) {
      return { valid: false, error: 'Zu viele Räume (max. ' + C.MAX_IMPORT_ROOMS + '). Datei: ' + roomKeys.length };
    }
    // Validate each room has required properties with correct types
    const requiredProps = ['title', 'left', 'top', 'width', 'height', 'floor'];
    for (let i = 0; i < roomKeys.length; i++) {
      const room = data.project.rooms[roomKeys[i]];
      if (!room || typeof room !== 'object') {
        return { valid: false, error: 'Raum "' + roomKeys[i] + '" ist kein gültiges Objekt' };
      }
      for (let j = 0; j < requiredProps.length; j++) {
        const prop = requiredProps[j];
        if (!(prop in room)) {
          return { valid: false, error: 'Raum "' + roomKeys[i] + '" fehlt Eigenschaft "' + prop + '"' };
        }
      }
      if (typeof room.title !== 'string') {
        return { valid: false, error: 'Raum "' + roomKeys[i] + '": title muss ein String sein' };
      }
      if (typeof room.left !== 'number' || typeof room.top !== 'number' ||
          typeof room.width !== 'number' || typeof room.height !== 'number') {
        return { valid: false, error: 'Raum "' + roomKeys[i] + '": Position/Größe müssen Zahlen sein' };
      }
      if (room.width <= 0 || room.height <= 0) {
        return { valid: false, error: 'Raum "' + roomKeys[i] + '": Breite/Höhe müssen > 0 sein' };
      }
    }
    // Validate floors array if present
    if (data.project.floors) {
      if (!Array.isArray(data.project.floors)) {
        return { valid: false, error: '"project.floors" muss ein Array sein' };
      }
      for (let f = 0; f < data.project.floors.length; f++) {
        const floor = data.project.floors[f];
        if (!floor || typeof floor !== 'object' || !floor.id) {
          return { valid: false, error: 'Floor-Eintrag ' + f + ' fehlt "id"' };
        }
      }
    }
    return { valid: true };
  };

})(window.GR.exportMod = window.GR.exportMod || {});