/**
 * Grundriss Tool – App-Init & Zusammenschluss
 * =====================================================================
 * @module app
 * @description Initialisiert die Anwendung, registriert Keyboard-Shortcuts
 * und verbindet alle Module.
 */
window.GR = window.GR || {};

(function(App) {
  'use strict';

  const C = window.GR.constants;
  const S = window.GR.state;
  const St = window.GR.storage;
  const Rdr = window.GR.renderer;
  const UI = window.GR.ui;
  const I = window.GR.interaction;
  const PR = window.GR.placeRoom;
  const OR = window.GR.overviewRenderer;
  const Sync = window.GR.sync;

  // ===================================================================
  // Keyboard Shortcuts
  // ===================================================================
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (S.get('isPlacing')) {
        if (PR && PR.cancelPlaceNewRoom) PR.cancelPlaceNewRoom();
        return;
      }
      if (S.get('overview')) {
        S.set('overview', false);
        document.getElementById('btnOv')?.classList.remove('active');
        const sbBody = document.getElementById('sbBody');
        if (sbBody) sbBody.innerHTML = '<p class="hint">👆 Raum antippen</p>';
        Rdr.render();
      }
      if (S.get('editMode')) UI.setEditMode(false);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      UI.toggleEditMode();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      if (OR) OR.showOverview();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      St.saveData();
      UI.toast('💾 Gespeichert', 'success', 1500);
    }
  });

  // ===================================================================
  // Init
  // ===================================================================
  App.init = async function() {
    // Set up plan interaction: drawing new rooms via mousedown/touchstart
    const pwElements = document.querySelectorAll('.pw');
    pwElements.forEach(w => {
      w.addEventListener('mousedown', function(e) {
        if (PR && PR.startPlaceDraw) PR.startPlaceDraw(e);
      });
      w.addEventListener('touchstart', function(e) {
        if (PR && PR.startPlaceDraw) PR.startPlaceDraw(e);
      }, { passive: false });
    });

    try {
      await St.loadData();
    } catch (e) {
      console.error('[app] Fehler beim Laden der Daten:', e);
      UI.toast('⚠️ Fehler beim Laden – lokale Daten werden verwendet', 'error', 4000);
    }
    Rdr.render();

    // Sync indicator is already in HTML
    Sync.setSyncStatus('idle');
    Sync.startPolling();

    // Show intro if first visit
    if (!localStorage.getItem(C.INTRO_SEEN_KEY)) setTimeout(UI.showIntro, 500);

    // Sidebar default state
    S.set('sidebarOpen', false);
    document.getElementById('sb')?.classList.toggle('open', false);

    // Window resize handler
    window.addEventListener('resize', () => { Rdr.render(); });

    // Re-render on image load
    const pwImgs = document.querySelectorAll('.pw img');
    pwImgs.forEach(img => {
      if (img.complete) {
        Rdr.render();
        Sync.updateTabBadges();
      } else {
        img.addEventListener('load', () => {
          Rdr.render();
          Sync.updateTabBadges();
        });
      }
    });
  };
})(window.GR.app = window.GR.app || {});

// Auto-start when all modules are loaded
window.GR.app.init();