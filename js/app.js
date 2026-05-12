// Grundriss Tool – App-Init & Zusammenschluss
// =====================================================================
window.GR = window.GR || {};

(function(App) {
  const S = window.GR.state;
  const St = window.GR.storage;
  const Rdr = window.GR.renderer;
  const UI = window.GR.ui;
  const I = window.GR.interaction;

  // ===================================================================
  // Keyboard Shortcuts
  // ===================================================================
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (S.get('isPlacing')) {
        I.cancelPlaceNewRoom();
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
      Rdr.showOverview();
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
    document.querySelectorAll('.pw').forEach(w => {
      w.addEventListener('mousedown', I.startPlaceDraw);
      w.addEventListener('touchstart', I.startPlaceDraw, { passive: false });
    });

    await St.loadData();
    Rdr.render();

    // Ensure sync indicator exists
    let el = document.getElementById('syncI');
    if (!el) {
      el = document.createElement('div');
      el.id = 'syncI';
      document.body.appendChild(el);
    }
    St.setSyncStatus('idle');
    St.startPolling();

    // Show intro if first visit
    if (!localStorage.getItem('gd')) setTimeout(UI.showIntro, 500);

    // Sidebar default state
    S.set('sidebarOpen', false);
    document.getElementById('sb')?.classList.toggle('open', false);

    // Window resize handler
    window.addEventListener('resize', () => { Rdr.render(); });

    // Re-render on image load
    document.querySelectorAll('.pw img').forEach(img => {
      if (img.complete) {
        Rdr.render();
        St.updateTabBadges();
      } else {
        img.addEventListener('load', () => {
          Rdr.render();
          St.updateTabBadges();
        });
      }
    });
  };
})(window.GR.app = window.GR.app || {});

// Auto-start when all modules are loaded
window.GR.app.init();