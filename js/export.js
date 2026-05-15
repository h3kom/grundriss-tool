/**
 * Grundriss Tool – Export / Import
 * =====================================================================
 * @module export
 * @description Exportiert Projektdaten als JSON und importiert sie wieder.
 * Floor-IDs werden beim Import automatisch auf das Zielprojekt gemappt.
 */import { LOCAL_STORAGE_KEY } from './constants.js';
import * as S from './state.js';
import { escHtml, escAttr } from './utils.js';
import { updateTabBadges } from './sync.js';
// Uses window.GR.storage (lazy)

/** Aktuelle Export-Version */
  var EXPORT_VERSION = 1;

  // ===================================================================
  // Export
  // ===================================================================

  export function exportProject() {
    var proj = S.get('currentProject');
    var floors = S.get('currentProjectFloors') || [];
    var rooms = S.get('rooms') || {};

    if (!proj) {
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('Kein Projekt geöffnet', 'error', 2000);
      return;
    }

    var exportData = {
      version: EXPORT_VERSION,
      exportDate: new Date().toISOString(),
      appName: 'Grundriss Tool',
      project: {
        name: proj.name || 'Unbenanntes Projekt',
        floors: floors.map(function(f) {
          return { id: f.id, name: f.name, sortOrder: f.sortOrder };
        }),
        rooms: JSON.parse(JSON.stringify(rooms))
      }
    };

    var json = JSON.stringify(exportData, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);

    var safeName = (proj.name || 'grundriss')
      .replace(/[^a-zA-Z0-9äöüÄÖÜß\s\-_]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    var filename = safeName + '_' + new Date().toISOString().slice(0, 10) + '.json';

    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    var roomCount = Object.keys(rooms).length;
    var floorCount = floors.length;
    var UI2 = window.GR.ui;
    if (UI2 && UI2.toast) {
      UI2.toast('📦 Export: ' + floorCount + ' Stockwerk(e), ' + roomCount + ' Raum/Räume', 'success', 3000);
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
  export function _mapFloorIds(importedRooms, importedFloors) {
    var currentFloors = S.get('currentProjectFloors') || [];
    if (currentFloors.length === 0) return importedRooms;

    var floorMap = {};

    if (importedFloors && importedFloors.length > 0) {
      var sortedImported = importedFloors.slice().sort(function(a, b) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
      var sortedCurrent = currentFloors.slice().sort(function(a, b) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
      for (var i = 0; i < sortedImported.length && i < sortedCurrent.length; i++) {
        floorMap[sortedImported[i].id] = sortedCurrent[i].id;
      }
    } else {
      // Kein Floor-Info im Import → Räume auf Floor 1 des Projekts setzen
      if (currentFloors.length > 0) {
        var allFloorIds = Object.keys(importedRooms).map(function(k) { return importedRooms[k].floor; });
        var uniqueFloors = [];
        allFloorIds.forEach(function(f) { if (f && uniqueFloors.indexOf(f) === -1) uniqueFloors.push(f); });
        uniqueFloors.sort();
        for (var j = 0; j < uniqueFloors.length && j < currentFloors.length; j++) {
          floorMap[uniqueFloors[j]] = currentFloors[j].id;
        }
      }
    }

    // Floor-IDs in Räumen umschreiben
    var mappedRooms = JSON.parse(JSON.stringify(importedRooms));
    var keys = Object.keys(mappedRooms);
    for (var k = 0; k < keys.length; k++) {
      var room = mappedRooms[keys[k]];
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
   */export async function _applyImport(data, toast) {
    var roomCount = Object.keys(data.project.rooms).length;
    var mappedRooms = _mapFloorIds(data.project.rooms, data.project.floors);

    S.set('rooms', mappedRooms);

    if (saveData) await saveData();

    var Rdr = window.GR.renderer;
    if (Rdr && Rdr.render) Rdr.render();

    if (Sync && updateTabBadges) updateTabBadges();

    toast('✅ Import erfolgreich! ' + roomCount + ' Raum/Räume importiert', 'success', 3000);
  };

  // ===================================================================
  // Validierung
  // ===================================================================

  export function _validateImportData(data) {
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
    var roomKeys = Object.keys(data.project.rooms);
    if (roomKeys.length === 0) {
      return { valid: false, error: 'Keine Räume in der Datei enthalten' };
    }
    if (roomKeys.length > 500) {
      return { valid: false, error: 'Zu viele Räume (max. 500). Datei: ' + roomKeys.length };
    }
    // Validate each room has required properties with correct types
    var requiredProps = ['title', 'left', 'top', 'width', 'height', 'floor'];
    for (var i = 0; i < roomKeys.length; i++) {
      var room = data.project.rooms[roomKeys[i]];
      if (!room || typeof room !== 'object') {
        return { valid: false, error: 'Raum "' + roomKeys[i] + '" ist kein gültiges Objekt' };
      }
      for (var j = 0; j < requiredProps.length; j++) {
        var prop = requiredProps[j];
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
      for (var f = 0; f < data.project.floors.length; f++) {
        var floor = data.project.floors[f];
        if (!floor || typeof floor !== 'object' || !floor.id) {
          return { valid: false, error: 'Floor-Eintrag ' + f + ' fehlt "id"' };
        }
      }
    }
    return { valid: true };
  };

  // ===================================================================
  // Project Settings Modal (Drag & Drop Import)
  // ===================================================================

  var _pendingImport = null;

  export function openProjectSettings() {
    _pendingImport = null;
    var modal = document.getElementById('projectSettingsModal');
    if (!modal) return;

    var dropZone = document.getElementById('psDropZone');
    var preview = document.getElementById('psPreview');
    var importBtn = document.getElementById('psImportBtn');
    if (dropZone) {
      dropZone.classList.remove('has-file');
      var icon = dropZone.querySelector('.ps-dropzone-icon');
      var text = dropZone.querySelector('.ps-dropzone-text');
      var sub = dropZone.querySelector('.ps-dropzone-sub');
      if (icon) icon.textContent = '📂';
      if (text) text.textContent = 'JSON-Datei hier ablegen oder klicken';
      if (sub) sub.style.display = '';
    }
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    if (importBtn) importBtn.disabled = true;

    if (!_psInit) {
      _setupProjectSettingsEvents();
      _psInit = true;
    }

    modal.classList.add('open');
  };

  export function closeProjectSettings() {
    var modal = document.getElementById('projectSettingsModal');
    if (modal) modal.classList.remove('open');
    _pendingImport = null;
  };

  export function _setupProjectSettingsEvents() {
    var dropZone = document.getElementById('psDropZone');
    var fileInput = document.getElementById('psFileInput');
    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', function(e) {
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.remove('dragover');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) _handlePsFile(files[0]);
    });
    dropZone.addEventListener('click', function(e) {
      e.preventDefault();
      fileInput.value = '';
      fileInput.click();
    });
    fileInput.addEventListener('change', function() {
      if (fileInput.files && fileInput.files.length > 0) _handlePsFile(fileInput.files[0]);
    });
  };

  export function _handlePsFile(file) {
    if (!file) return;
    var dropZone = document.getElementById('psDropZone');
    var preview = document.getElementById('psPreview');
    var importBtn = document.getElementById('psImportBtn');

    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        var validation = _validateImportData(data);

        if (validation.valid) {
          _pendingImport = data;
          if (dropZone) {
            dropZone.classList.add('has-file');
            var icon = dropZone.querySelector('.ps-dropzone-icon');
            var textEl = dropZone.querySelector('.ps-dropzone-text');
            var sub = dropZone.querySelector('.ps-dropzone-sub');
            if (icon) icon.textContent = '✅';
            if (textEl) textEl.textContent = file.name;
            if (sub) sub.style.display = 'none';
          }
          if (preview) {
            var roomCount = Object.keys(data.project.rooms).length;
            var floorCount = data.project.floors ? data.project.floors.length : 0;
            var floorNames = data.project.floors ? data.project.floors.map(function(f) { return f.name; }).join(', ') : '';
            var html = '<div class="ps-preview-title">📋 ' + escHtml(data.project.name || 'Unbenanntes Projekt') + '</div>';
            html += '<div class="ps-preview-info">';
            html += 'Räume: <span>' + roomCount + '</span><br>';
            html += 'Stockwerke: <span>' + floorCount + '</span>';
            if (floorNames) html += ' (' + escHtml(floorNames) + ')';
            html += '</div>';
            preview.innerHTML = html;
            preview.style.display = '';
          }
          if (importBtn) importBtn.disabled = false;
        } else {
          _pendingImport = null;
          if (preview) {
            preview.innerHTML = '<div class="ps-preview-error">❌ ' + escHtml(validation.error) + '</div>';
            preview.style.display = '';
          }
          if (importBtn) importBtn.disabled = true;
        }
      } catch (err) {
        _pendingImport = null;
        if (preview) {
          preview.innerHTML = '<div class="ps-preview-error">❌ Ungültige JSON: ' + escHtml(err.message) + '</div>';
          preview.style.display = '';
        }
        if (importBtn) importBtn.disabled = true;
      }
    };
    reader.readAsText(file);
  };

  var _importConfirmed = false;
export async function doProjectSettingsImport() {
    if (!_pendingImport) {
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('❌ Keine Datei ausgewählt', 'error', 2000);
      return;
    }

    var data = _pendingImport;
    var proj = S.get('currentProject');
    if (!proj) {
      var UI2 = window.GR.ui;
      if (UI2 && UI2.toast) UI2.toast('❌ Kein Projekt geöffnet', 'error', 2000);
      return;
    }

    // Two-step confirmation instead of native confirm()
    var importBtn = document.getElementById('psImportBtn');
    if (!_importConfirmed) {
      _importConfirmed = true;
      var roomCount = Object.keys(data.project.rooms).length;
      if (importBtn) {
        importBtn.textContent = '⚠️ Bestätigen: ' + roomCount + ' Räume überschreiben';
        importBtn.classList.add('confirm-warn');
      }
      // Auto-reset after 5 seconds if not confirmed
      setTimeout(function() {
        _importConfirmed = false;
        if (importBtn) {
          importBtn.textContent = '📥 Importieren';
          importBtn.classList.remove('confirm-warn');
        }
      }, 5000);
      return;
    }

    // Second click – execute import
    _importConfirmed = false;
    if (importBtn) {
      importBtn.textContent = '📥 Importieren';
      importBtn.classList.remove('confirm-warn');
    }

    var UI3 = window.GR.ui;
    var toast = UI3 && UI3.toast ? UI3.toast : function() {};

    await _applyImport(data, toast);

    closeProjectSettings();
    _pendingImport = null;
  };
