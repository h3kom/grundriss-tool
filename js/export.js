/**
 * Grundriss Tool – Export / Import
 * =====================================================================
 * @module export
 * @description Exportiert Projektdaten als JSON und importiert sie wieder.
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

  /**
   * Exportiert das aktuelle Projekt als JSON-Datei.
   * Sammelt Projekt-Metadaten, Stockwerke und Räume.
   */
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
          return {
            id: f.id,
            name: f.name,
            imageUrl: f.imageUrl,
            nativeWidth: f.nativeWidth,
            sortOrder: f.sortOrder
          };
        }),
        rooms: JSON.parse(JSON.stringify(rooms))
      }
    };

    var json = JSON.stringify(exportData, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);

    // Dateinamen aus Projektnamen ableiten (sicher machen)
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

    // Zusammenfassung
    var roomCount = Object.keys(rooms).length;
    var floorCount = floors.length;
    var UI2 = window.GR.ui;
    if (UI2 && UI2.toast) {
      UI2.toast('📦 Export: ' + floorCount + ' Stockwerk(e), ' + roomCount + ' Raum/Räume', 'success', 3000);
    }
  };

  // ===================================================================
  // Import
  // ===================================================================

  /** Referenz auf das versteckte File-Input-Element */
  var _fileInput = null;

  /**
   * Öffnet den Datei-Dialog zum Importieren einer JSON-Datei.
   */
  Exp.importProject = function() {
    if (!_fileInput) {
      _fileInput = document.createElement('input');
      _fileInput.type = 'file';
      _fileInput.accept = '.json,application/json';
      _fileInput.style.display = 'none';
      document.body.appendChild(_fileInput);
      _fileInput.addEventListener('change', Exp._handleFileSelect);
    }
    _fileInput.value = '';
    _fileInput.click();
  };

  /**
   * Verarbeitet die ausgewählte JSON-Datei.
   * @param {Event} e - Change-Event des File-Inputs
   */
  Exp._handleFileSelect = function(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        Exp._processImport(data);
      } catch (err) {
        var UI = window.GR.ui;
        if (UI && UI.toast) UI.toast('❌ Ungültige JSON-Datei: ' + err.message, 'error', 4000);
      }
    };
    reader.onerror = function() {
      var UI2 = window.GR.ui;
      if (UI2 && UI2.toast) UI2.toast('❌ Fehler beim Lesen der Datei', 'error', 3000);
    };
    reader.readAsText(file);
  };

  /**
   * Verarbeitet die importierten Daten und wendet sie auf das aktuelle Projekt an.
   * @param {Object} data - Die geparsten JSON-Daten
   */
  Exp._processImport = function(data) {
    var UI = window.GR.ui;
    var toast = UI && UI.toast ? UI.toast : function() {};

    // Validierung
    if (!data || !data.project || typeof data.project !== 'object') {
      toast('❌ Ungültiges Export-Format: "project" fehlt', 'error', 4000);
      return;
    }
    if (!data.project.rooms || typeof data.project.rooms !== 'object') {
      toast('❌ Ungültiges Export-Format: "rooms" fehlt', 'error', 4000);
      return;
    }

    var proj = S.get('currentProject');
    if (!proj) {
      toast('❌ Kein Projekt geöffnet', 'error', 2000);
      return;
    }

    // Bestätigung einholen
    var roomCount = Object.keys(data.project.rooms).length;
    var floorInfo = '';
    if (data.project.floors && data.project.floors.length > 0) {
      floorInfo = data.project.floors.length + ' Stockwerk(e)';
    }
    var confirmMsg = 'Daten aus "' + (data.project.name || 'Unbekannt') + '" importieren?\n\n';
    confirmMsg += roomCount + ' Raum/Räume';
    if (floorInfo) confirmMsg += ', ' + floorInfo;
    confirmMsg += '\n\nAchtung: Bestehende Räume werden ersetzt!';

    if (!confirm(confirmMsg)) return;

    // Räume importieren
    var importedRooms = data.project.rooms;

    // Stockwerke importieren – bestehende Bilder beibehalten!
    if (data.project.floors && data.project.floors.length > 0 && proj.id !== 'legacy') {
      var existingFloors = S.get('currentProjectFloors') || [];
      var existingMap = {};
      for (var fi = 0; fi < existingFloors.length; fi++) {
        existingMap[existingFloors[fi].id] = existingFloors[fi];
      }
      var importedFloors = data.project.floors.map(function(f) {
        var existing = existingMap[f.id];
        return {
          id: f.id,
          name: f.name || 'Stockwerk',
          imageUrl: (existing && existing.imageUrl) ? existing.imageUrl : (f.imageUrl || ''),
          nativeWidth: (existing && existing.nativeWidth) ? existing.nativeWidth : (f.nativeWidth || 1000),
          sortOrder: f.sortOrder || 0
        };
      });
      S.set('currentProjectFloors', importedFloors);

      var Proj = window.GR.projects;
      if (Proj && Proj.buildFloorUI) Proj.buildFloorUI(importedFloors);
    }

    // Räume setzen
    S.set('rooms', importedRooms);

    // Speichern
    var St = window.GR.storage;
    if (St && St.saveData) St.saveData();

    // Neu rendern
    var Rdr = window.GR.renderer;
    if (Rdr && Rdr.render) Rdr.render();

    var Sync = window.GR.sync;
    if (Sync && Sync.updateTabBadges) Sync.updateTabBadges();

    // Floor auf erstes Stockwerk setzen
    var floors = S.get('currentProjectFloors') || [];
    if (floors.length > 0) {
      var UI2 = window.GR.ui;
      if (UI2 && UI2.switchFloor) UI2.switchFloor(floors[0].id);
      else S.set('activeFloor', floors[0].id);
    }

    toast('✅ Import erfolgreich! ' + roomCount + ' Raum/Räume importiert', 'success', 3000);
  };

  // ===================================================================
  // Project Settings Modal
  // ===================================================================

  /** Parsed data awaiting import confirmation */
  var _pendingImport = null;

  /**
   * Öffnet das Projekteinstellungs-Modal.
   */
  Exp.openProjectSettings = function() {
    _pendingImport = null;
    var modal = document.getElementById('projectSettingsModal');
    if (!modal) return;

    // Reset UI
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

    // Setup drag & drop (only once)
    if (!Exp._psInit) {
      Exp._setupProjectSettingsEvents();
      Exp._psInit = true;
    }

    modal.classList.add('open');
  };

  /**
   * Schließt das Projekteinstellungs-Modal.
   */
  Exp.closeProjectSettings = function() {
    var modal = document.getElementById('projectSettingsModal');
    if (modal) modal.classList.remove('open');
    _pendingImport = null;
  };

  /**
   * Setup für Drag & Drop und File-Input-Events (einmalig).
   */
  Exp._setupProjectSettingsEvents = function() {
    var dropZone = document.getElementById('psDropZone');
    var fileInput = document.getElementById('psFileInput');

    if (!dropZone || !fileInput) return;

    // Drag & Drop
    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        Exp._handlePsFile(files[0]);
      }
    });

    // Click opens file dialog
    dropZone.addEventListener('click', function(e) {
      e.preventDefault();
      fileInput.value = '';
      fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', function() {
      if (fileInput.files && fileInput.files.length > 0) {
        Exp._handlePsFile(fileInput.files[0]);
      }
    });
  };

  /**
   * Verarbeitet eine ausgewählte Datei im Projekt-Settings-Modal.
   */
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

          // Update dropzone
          if (dropZone) {
            dropZone.classList.add('has-file');
            var icon = dropZone.querySelector('.ps-dropzone-icon');
            var text = dropZone.querySelector('.ps-dropzone-text');
            var sub = dropZone.querySelector('.ps-dropzone-sub');
            if (icon) icon.textContent = '✅';
            if (text) text.textContent = file.name;
            if (sub) sub.style.display = 'none';
          }

          // Show preview
          if (preview) {
            var roomCount = Object.keys(data.project.rooms).length;
            var floorCount = data.project.floors ? data.project.floors.length : 0;
            var floorNames = '';
            if (data.project.floors) {
              floorNames = data.project.floors.map(function(f) { return f.name; }).join(', ');
            }

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

          // Show error in preview
          if (preview) {
            preview.innerHTML = '<div class="ps-preview-error">❌ ' + U.escHtml(validation.error) + '</div>';
            preview.style.display = '';
          }
          if (importBtn) importBtn.disabled = true;
        }
      } catch (err) {
        _pendingImport = null;
        if (preview) {
          preview.innerHTML = '<div class="ps-preview-error">❌ Ungültige JSON-Datei: ' + U.escHtml(err.message) + '</div>';
          preview.style.display = '';
        }
        if (importBtn) importBtn.disabled = true;
      }
    };
    reader.readAsText(file);
  };

  /**
   * Validiert die Import-Daten.
   * @returns {{ valid: boolean, error?: string }}
   */
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
    // Check at least one room has required fields
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

  /**
   * Führt den Import aus (wird vom "Importieren"-Button aufgerufen).
   */
  Exp.doProjectSettingsImport = function() {
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

    // Bestätigung
    var roomCount = Object.keys(data.project.rooms).length;
    var floorCount = data.project.floors ? data.project.floors.length : 0;
    var confirmMsg = 'Alle bestehenden Räume und Stockwerke überschreiben?\n\n';
    confirmMsg += roomCount + ' Raum/Räume';
    if (floorCount) confirmMsg += ', ' + floorCount + ' Stockwerk(e)';
    confirmMsg += '\n\nDieser Vorgang kann nicht rückgängig gemacht werden!';

    if (!confirm(confirmMsg)) return;

    // Import ausführen (bestehende _processImport Logik)
    var importedRooms = data.project.rooms;

    // Stockwerke importieren – bestehende Bilder beibehalten!
    if (data.project.floors && data.project.floors.length > 0 && proj.id !== 'legacy') {
      var existingFloors = S.get('currentProjectFloors') || [];
      var existingMap = {};
      for (var fi = 0; fi < existingFloors.length; fi++) {
        existingMap[existingFloors[fi].id] = existingFloors[fi];
      }
      var importedFloors = data.project.floors.map(function(f) {
        var existing = existingMap[f.id];
        return {
          id: f.id,
          name: f.name || 'Stockwerk',
          imageUrl: (existing && existing.imageUrl) ? existing.imageUrl : (f.imageUrl || ''),
          nativeWidth: (existing && existing.nativeWidth) ? existing.nativeWidth : (f.nativeWidth || 1000),
          sortOrder: f.sortOrder || 0
        };
      });
      S.set('currentProjectFloors', importedFloors);

      var Proj = window.GR.projects;
      if (Proj && Proj.buildFloorUI) Proj.buildFloorUI(importedFloors);
    }

    // Räume setzen
    S.set('rooms', importedRooms);

    // Speichern
    var St = window.GR.storage;
    if (St && St.saveData) St.saveData();

    // Neu rendern
    var Rdr = window.GR.renderer;
    if (Rdr && Rdr.render) Rdr.render();

    var Sync = window.GR.sync;
    if (Sync && Sync.updateTabBadges) Sync.updateTabBadges();

    // Floor auf erstes Stockwerk setzen
    var floors = S.get('currentProjectFloors') || [];
    if (floors.length > 0) {
      var UI3 = window.GR.ui;
      if (UI3 && UI3.switchFloor) UI3.switchFloor(floors[0].id);
      else S.set('activeFloor', floors[0].id);
    }

    // Modal schließen
    Exp.closeProjectSettings();

    var UI4 = window.GR.ui;
    if (UI4 && UI4.toast) UI4.toast('✅ Import erfolgreich! ' + roomCount + ' Raum/Räume importiert', 'success', 3000);

    _pendingImport = null;
  };

})(window.GR.exportMod = window.GR.exportMod || {});
