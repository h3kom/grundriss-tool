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

  var S = window.GR.state;
  var U = window.GR.utils;

  /** Aktuelle Export-Version */
  var EXPORT_VERSION = 1;

  // ===================================================================
  // Export
  // ===================================================================

  Exp.exportProject = function() {
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
  Exp._mapFloorIds = function(importedRooms, importedFloors) {
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
      } else if (!room.floor || !floorMap[room.floor]) {
        // Fallback: ersten Floor setzen
        if (currentFloors.length > 0) room.floor = currentFloors[0].id;
      }
    }

    return mappedRooms;
  };

  /**
   * Zentrale Import-Funktion: Mappt Floors, setzt Räume, speichert, rendert.
   */
  Exp._applyImport = async function(data, toast) {
    var roomCount = Object.keys(data.project.rooms).length;
    var mappedRooms = Exp._mapFloorIds(data.project.rooms, data.project.floors);

    S.set('rooms', mappedRooms);

    var St = window.GR.storage;
    if (St && St.saveData) await St.saveData();

    var Rdr = window.GR.renderer;
    if (Rdr && Rdr.render) Rdr.render();

    var Sync = window.GR.sync;
    if (Sync && Sync.updateTabBadges) Sync.updateTabBadges();

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
    var roomKeys = Object.keys(data.project.rooms);
    if (roomKeys.length === 0) {
      return { valid: false, error: 'Keine Räume in der Datei enthalten' };
    }
    var sampleRoom = data.project.rooms[roomKeys[0]];
    if (!sampleRoom || typeof sampleRoom.title === 'undefined') {
      return { valid: false, error: 'Raum-Objekte haben nicht das erwartete Format' };
    }
    return { valid: true };
  };

  // ===================================================================
  // Project Settings Modal (Drag & Drop Import)
  // ===================================================================

  var _pendingImport = null;

  Exp.openProjectSettings = function() {
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

    if (!Exp._psInit) {
      Exp._setupProjectSettingsEvents();
      Exp._psInit = true;
    }

    modal.classList.add('open');
  };

  Exp.closeProjectSettings = function() {
    var modal = document.getElementById('projectSettingsModal');
    if (modal) modal.classList.remove('open');
    _pendingImport = null;
  };

  Exp._setupProjectSettingsEvents = function() {
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
      if (files && files.length > 0) Exp._handlePsFile(files[0]);
    });
    dropZone.addEventListener('click', function(e) {
      e.preventDefault();
      fileInput.value = '';
      fileInput.click();
    });
    fileInput.addEventListener('change', function() {
      if (fileInput.files && fileInput.files.length > 0) Exp._handlePsFile(fileInput.files[0]);
    });
  };

  Exp._handlePsFile = function(file) {
    if (!file) return;
    var dropZone = document.getElementById('psDropZone');
    var preview = document.getElementById('psPreview');
    var importBtn = document.getElementById('psImportBtn');

    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        var validation = Exp._validateImportData(data);

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
            var html = '<div class="ps-preview-title">📋 ' + U.escHtml(data.project.name || 'Unbenanntes Projekt') + '</div>';
            html += '<div class="ps-preview-info">';
            html += 'Räume: <span>' + roomCount + '</span><br>';
            html += 'Stockwerke: <span>' + floorCount + '</span>';
            if (floorNames) html += ' (' + U.escHtml(floorNames) + ')';
            html += '</div>';
            preview.innerHTML = html;
            preview.style.display = '';
          }
          if (importBtn) importBtn.disabled = false;
        } else {
          _pendingImport = null;
          if (preview) {
            preview.innerHTML = '<div class="ps-preview-error">❌ ' + U.escHtml(validation.error) + '</div>';
            preview.style.display = '';
          }
          if (importBtn) importBtn.disabled = true;
        }
      } catch (err) {
        _pendingImport = null;
        if (preview) {
          preview.innerHTML = '<div class="ps-preview-error">❌ Ungültige JSON: ' + U.escHtml(err.message) + '</div>';
          preview.style.display = '';
        }
        if (importBtn) importBtn.disabled = true;
      }
    };
    reader.readAsText(file);
  };

  Exp.doProjectSettingsImport = async function() {
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

    var roomCount = Object.keys(data.project.rooms).length;
    var confirmMsg = 'Alle bestehenden Räume überschreiben?\n\n';
    confirmMsg += roomCount + ' Raum/Räume\n';
    confirmMsg += '\nStockwerke und Grundriss-Bilder bleiben erhalten.';
    confirmMsg += '\n\nDieser Vorgang kann nicht rückgängig gemacht werden!';

    if (!confirm(confirmMsg)) return;

    var UI3 = window.GR.ui;
    var toast = UI3 && UI3.toast ? UI3.toast : function() {};

    await Exp._applyImport(data, toast);

    Exp.closeProjectSettings();
    _pendingImport = null;
  };

})(window.GR.exportMod = window.GR.exportMod || {});