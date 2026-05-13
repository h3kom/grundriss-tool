/**
 * Grundriss Tool – Onboarding-Wizard
 * =====================================================================
 * @module onboarding
 * @description Wizard zum Erstellen neuer Projekte: Name, Stockwerke,
 * Grundriss-Upload, flexible Benennung.
 */
window.GR = window.GR || {};

(function(OB) {
  'use strict';

  var C = window.GR.constants;
  var S = window.GR.state;
  var U = window.GR.utils;

  /** @type {Array<{name: string, imageFile: File|null, imageUrl: string, nativeWidth: number}>} */
  var _wizardFloors = [];
  var _wizardStep = 1;

  /**
   * Öffnet den Onboarding-Wizard.
   */
  OB.openWizard = function() {
    _wizardStep = 1;
    _wizardFloors = [];
    // Standard: 2 Stockwerke
    OB.addFloor('Erdgeschoss', '', 1000);
    OB.addFloor('Obergeschoss', '', 800);
    OB.renderWizard();
    var el = document.getElementById('onboarding');
    if (el) el.classList.add('open');
  };

  /**
   * Schließt den Wizard.
   */
  OB.closeWizard = function() {
    var el = document.getElementById('onboarding');
    if (el) el.classList.remove('open');
    _wizardFloors = [];
  };

  /**
   * Fügt ein Stockwerk zum Wizard hinzu.
   * @param {string} name
   * @param {string} imageUrl
   * @param {number} nativeWidth
   */
  OB.addFloor = function(name, imageUrl, nativeWidth) {
    _wizardFloors.push({
      name: name || 'Stockwerk ' + (_wizardFloors.length + 1),
      imageFile: null,
      imageUrl: imageUrl || '',
      nativeWidth: nativeWidth || 1000
    });
  };

  /**
   * Entfernt ein Stockwerk aus dem Wizard.
   * @param {number} index
   */
  OB.removeFloor = function(index) {
    if (_wizardFloors.length <= 1) return; // Mindestens 1 Stockwerk
    _wizardFloors.splice(index, 1);
    OB.renderFloorList();
  };

  /**
   * Rendert den Wizard-Inhalt.
   */
  OB.renderWizard = function() {
    var body = document.getElementById('obBody');
    if (!body) return;

    if (_wizardStep === 1) {
      OB.renderStep1(body);
    } else {
      OB.renderStep2(body);
    }
  };

  /**
   * Schritt 1: Projektname.
   */
  OB.renderStep1 = function(body) {
    body.innerHTML =
      '<div class="ob-step">' +
        '<div class="ob-icon">🏗️</div>' +
        '<h3>Neues Projekt erstellen</h3>' +
        '<p>Wie heißt das Gebäude?</p>' +
        '<input type="text" id="obProjectName" placeholder="z.B. Bürogebäude München" class="ob-input" />' +
        '<div class="ob-actions">' +
          '<button data-action="ob-cancel" class="ob-btn-cancel">Abbrechen</button>' +
          '<button data-action="ob-next" class="ob-btn-primary">Weiter →</button>' +
        '</div>' +
      '</div>';

    setTimeout(function() {
      var input = document.getElementById('obProjectName');
      if (input) input.focus();
    }, 100);
  };

  /**
   * Schritt 2: Stockwerke konfigurieren.
   */
  OB.renderStep2 = function(body) {
    var projectName = (document.getElementById('obProjectName')?.value || '').trim() || 'Unbenanntes Projekt';

    body.innerHTML =
      '<div class="ob-step">' +
        '<div class="ob-step-header">' +
          '<button data-action="ob-back" class="ob-btn-back">← Zurück</button>' +
          '<h3>Stockwerke</h3>' +
        '</div>' +
        '<p class="ob-subtitle">Für "' + U.escHtml(projectName) + '"</p>' +
        '<div id="obFloorList" class="ob-floor-list"></div>' +
        '<button data-action="ob-add-floor" class="ob-btn-add">+ Stockwerk hinzufügen</button>' +
        '<p class="ob-hint">ℹ️ Du kannst Grundriss-Bilder hochladen oder das Projekt zuerst ohne Bilder erstellen.</p>' +
        '<div class="ob-actions">' +
          '<button data-action="ob-cancel" class="ob-btn-cancel">Abbrechen</button>' +
          '<button data-action="ob-create" class="ob-btn-primary">Projekt erstellen ✨</button>' +
        '</div>' +
      '</div>';

    OB.renderFloorList();
  };

  /**
   * Rendert die Liste der Stockwerke.
   */
  OB.renderFloorList = function() {
    var container = document.getElementById('obFloorList');
    if (!container) return;

    var html = '';
    for (var i = 0; i < _wizardFloors.length; i++) {
      var f = _wizardFloors[i];
      var hasImage = f.imageFile || f.imageUrl;
      html +=
        '<div class="ob-floor-item" data-floor-index="' + i + '">' +
          '<div class="ob-floor-header">' +
            '<span class="ob-floor-num">' + (i + 1) + '</span>' +
            '<input type="text" class="ob-floor-name" data-floor-index="' + i + '" value="' + U.escAttr(f.name) + '" placeholder="Name des Stockwerks" />' +
            (_wizardFloors.length > 1 ? '<button data-action="ob-remove-floor" data-floor-index="' + i + '" class="ob-btn-remove" title="Entfernen">✕</button>' : '') +
          '</div>' +
          '<div class="ob-floor-upload">' +
            '<label class="ob-file-label' + (hasImage ? ' has-file' : '') + '">' +
              '<input type="file" accept="image/*" data-action-change="ob-upload-floor" data-floor-index="' + i + '" class="ob-file-input" />' +
              '<span>' + (hasImage ? '✅ Bild ausgewählt' : '📁 Grundriss hochladen') + '</span>' +
            '</label>' +
            '<input type="number" class="ob-width-input" data-floor-index="' + i + '" value="' + (f.nativeWidth || 1000) + '" placeholder="Breite (px)" min="100" max="5000" />' +
            '<span class="ob-width-label">px Breite</span>' +
          '</div>' +
        '</div>';
    }
    container.innerHTML = html;

    // Event: Floor-Name ändern
    container.querySelectorAll('.ob-floor-name').forEach(function(input) {
      input.addEventListener('input', function() {
        var idx = parseInt(this.dataset.floorIndex);
        _wizardFloors[idx].name = this.value;
      });
    });

    // Event: Breite ändern
    container.querySelectorAll('.ob-width-input').forEach(function(input) {
      input.addEventListener('input', function() {
        var idx = parseInt(this.dataset.floorIndex);
        _wizardFloors[idx].nativeWidth = parseInt(this.value) || 1000;
      });
    });
  };

  /**
   * Verarbeitet den Datei-Upload für ein Stockwerk.
   * @param {number} index
   * @param {File} file
   */
  OB.handleFloorUpload = function(index, file) {
    if (index < 0 || index >= _wizardFloors.length) return;
    _wizardFloors[index].imageFile = file;
    OB.renderFloorList();
  };

  /**
   * Erstellt das Projekt aus den Wizard-Daten.
   */
  OB.createProjectFromWizard = async function() {
    var projectName = (document.getElementById('obProjectName')?.value || '').trim() || 'Unbenanntes Projekt';

    // Floor-Namen aus Inputs lesen (falls zwischenzeitlich geändert)
    var nameInputs = document.querySelectorAll('.ob-floor-name');
    nameInputs.forEach(function(input) {
      var idx = parseInt(input.dataset.floorIndex);
      if (idx >= 0 && idx < _wizardFloors.length) {
        _wizardFloors[idx].name = input.value || 'Stockwerk ' + (idx + 1);
      }
    });

    var widthInputs = document.querySelectorAll('.ob-width-input');
    widthInputs.forEach(function(input) {
      var idx = parseInt(input.dataset.floorIndex);
      if (idx >= 0 && idx < _wizardFloors.length) {
        _wizardFloors[idx].nativeWidth = parseInt(input.value) || 1000;
      }
    });

    var Proj = window.GR.projects;
    if (!Proj) return;

    // Button disablen
    var createBtn = document.querySelector('[data-action="ob-create"]');
    if (createBtn) {
      createBtn.disabled = true;
      createBtn.textContent = '⏳ Erstelle...';
    }

    var result = await Proj.createProject(projectName, _wizardFloors);

    if (result.ok) {
      OB.closeWizard();
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('✅ Projekt "' + projectName + '" erstellt!', 'success', 3000);

      // Projekt öffnen
      await Proj.openProject(result.projectId);

      // View wechseln zum Editor
      var App = window.GR.app;
      if (App && App.showView) App.showView('editor');
    } else {
      if (createBtn) {
        createBtn.disabled = false;
        createBtn.textContent = 'Projekt erstellen ✨';
      }
      var UI = window.GR.ui;
      if (UI && UI.toast) UI.toast('❌ Fehler: ' + (result.error || 'Unbekannt'), 'error', 4000);
    }
  };

})(window.GR.onboarding = window.GR.onboarding || {});