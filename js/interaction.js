// Grundriss Tool – Interaktionen (Drag, Resize, Neue Räume platzieren)
// =====================================================================
window.GR = window.GR || {};

(function(I) {
  const S = window.GR.state;
  const St = window.GR.storage;
  const Rdr = window.GR.renderer;

  // ===================================================================
  // Pointer Helper
  // ===================================================================
  function getPointerPos(e) {
    const touch = e.touches;
    return touch && touch.length > 0
      ? { x: touch[0].clientX, y: touch[0].clientY }
      : { x: e.clientX, y: e.clientY };
  }

  // ===================================================================
  // Drag
  // ===================================================================
  I.startDrag = function(e, key) {
    if (!S.get('editMode')) return;
    const raw = getPointerPos(e);
    const wrapper = e.currentTarget.closest('.pw');
    const scale = Rdr.getScale(wrapper);
    const rooms = S.get('rooms');

    S.set('dragState', {
      key,
      wrapper,
      startX: raw.x,
      startY: raw.y,
      origLeft: rooms[key].left,
      origTop: rooms[key].top,
      element: e.currentTarget,
      isDragging: false,
      saved: false
    });

    e.currentTarget._wasDragged = false;

    document.addEventListener('mousemove', I.onDragMove);
    document.addEventListener('mouseup', I.onDragEnd);
    document.addEventListener('touchmove', I.onDragMoveTouch, { passive: false });
    document.addEventListener('touchend', I.onDragEndTouch, { passive: false });
  };

  I.onDragMove = function(e) {
    const ds = S.get('dragState');
    if (!ds) return;
    const raw = getPointerPos(e);
    const dx = raw.x - ds.startX;
    const dy = raw.y - ds.startY;

    if (!ds.isDragging) {
      if (Math.sqrt(dx * dx + dy * dy) < 3) return;
      ds.isDragging = true;
      e.preventDefault();
      if (ds.element) {
        ds.element.classList.add('dg');
        ds.element._wasDragged = true;
      }
    } else {
      if (ds.isDragging) e.preventDefault();
    }

    const el = document.querySelector(`.ro[data-key="${ds.key}"]`);
    if (el) {
      const scale = Rdr.getScale(ds.wrapper);
      el.style.left = `${Math.round(ds.origLeft * scale + dx)}px`;
      el.style.top = `${Math.round(ds.origTop * scale + dy)}px`;
    }
  };

  I.onDragMoveTouch = function(e) {
    I.onDragMove(e);
    const ds = S.get('dragState');
    if (ds && ds.isDragging) e.preventDefault();
  };

  function onDragEndCleanup() {
    const ds = S.get('dragState');
    if (!ds) return;
    document.removeEventListener('mousemove', I.onDragMove);
    document.removeEventListener('mouseup', I.onDragEnd);
    document.removeEventListener('touchmove', I.onDragMoveTouch);
    document.removeEventListener('touchend', I.onDragEndTouch);

    if (ds.element) ds.element.classList.remove('dg');

    if (!ds.isDragging || ds.saved) {
      S.set('dragState', null);
      return;
    }

    const el = document.querySelector(`.ro[data-key="${ds.key}"]`);
    if (!el) {
      S.set('dragState', null);
      return;
    }

    const scale = Rdr.getScale(ds.wrapper);
    const newLeft = Math.round(parseInt(el.style.left) / scale);
    const newTop = Math.round(parseInt(el.style.top) / scale);

    const rooms = S.get('rooms');
    if (newLeft !== ds.origLeft || newTop !== ds.origTop) {
      rooms[ds.key].left = newLeft;
      rooms[ds.key].top = newTop;
      ds.saved = true;
      St.saveData();
      Rdr.render();
      if (S.get('selectedRoom') && rooms[S.get('selectedRoom')]) {
        Rdr.renderDetail(S.get('selectedRoom'));
      }
    }
    S.set('dragState', null);
  }

  I.onDragEnd = function() { onDragEndCleanup(); };
  I.onDragEndTouch = function() { onDragEndCleanup(); };

  // ===================================================================
  // Resize
  // ===================================================================
  I.startResize = function(e, key, handle) {
    if (!S.get('editMode')) return;
    e.preventDefault();
    e.stopPropagation();

    const raw = getPointerPos(e);
    const wrapper = e.currentTarget.closest('.pw');
    const scale = Rdr.getScale(wrapper);
    const room = S.get('rooms')[key];

    S.set('resizeState', {
      key,
      handle,
      wrapper,
      startX: raw.x,
      startY: raw.y,
      origLeft: room.left,
      origTop: room.top,
      origWidth: room.width,
      origHeight: room.height,
      scale,
      saved: false
    });

    const el = e.currentTarget.closest('.ro');
    if (el) el.classList.add('rs');

    document.addEventListener('mousemove', I.onResizeMove);
    document.addEventListener('mouseup', I.onResizeEnd);
    document.addEventListener('touchmove', I.onResizeMoveTouch, { passive: false });
    document.addEventListener('touchend', I.onResizeEndTouch, { passive: false });
  };

  I.onResizeMove = function(e) {
    const rs = S.get('resizeState');
    if (!rs) return;
    const raw = getPointerPos(e);
    const scale = Rdr.getScale(rs.wrapper);
    const dx = raw.x - rs.startX;
    const dy = raw.y - rs.startY;
    const dl = dx / scale;
    const dt = dy / scale;

    const handle = rs.handle;
    let nl = rs.origLeft;
    let nt = rs.origTop;
    let nw = rs.origWidth;
    let nh = rs.origHeight;

    if (handle.indexOf('e') >= 0) nw = Math.max(20, rs.origWidth + dl);
    if (handle.indexOf('w') >= 0) {
      nw = Math.max(20, rs.origWidth - dl);
      nl = rs.origLeft + rs.origWidth - nw;
    }
    if (handle.indexOf('s') >= 0) nh = Math.max(20, rs.origHeight + dt);
    if (handle.indexOf('n') >= 0) {
      nh = Math.max(20, rs.origHeight - dt);
      nt = rs.origTop + rs.origHeight - nh;
    }

    const el = document.querySelector(`.ro[data-key="${rs.key}"]`);
    if (el) {
      el.style.left = `${Math.round(nl * scale)}px`;
      el.style.top = `${Math.round(nt * scale)}px`;
      el.style.width = `${Math.round(nw * scale)}px`;
      el.style.height = `${Math.round(nh * scale)}px`;
    }
  };

  I.onResizeMoveTouch = function(e) {
    e.preventDefault();
    I.onResizeMove(e);
  };

  function onResizeEndCleanup() {
    const rs = S.get('resizeState');
    if (!rs) return;

    document.removeEventListener('mousemove', I.onResizeMove);
    document.removeEventListener('mouseup', I.onResizeEnd);
    document.removeEventListener('touchmove', I.onResizeMoveTouch);
    document.removeEventListener('touchend', I.onResizeEndTouch);

    const el = document.querySelector(`.ro[data-key="${rs.key}"]`);
    if (el) el.classList.remove('rs');

    const room = S.get('rooms')[rs.key];
    if (!el || !room || rs.saved) {
      S.set('resizeState', null);
      return;
    }

    const scale = Rdr.getScale(rs.wrapper);
    const nl = Math.round(parseInt(el.style.left) / scale);
    const nt = Math.round(parseInt(el.style.top) / scale);
    const nw = Math.round(parseInt(el.style.width) / scale);
    const nh = Math.round(parseInt(el.style.height) / scale);

    if (!isNaN(nl)) room.left = nl;
    if (!isNaN(nt)) room.top = nt;
    if (!isNaN(nw)) room.width = Math.max(20, nw);
    if (!isNaN(nh)) room.height = Math.max(20, nh);

    rs.saved = true;
    St.saveData();
    Rdr.render();
    if (S.get('selectedRoom') && S.get('rooms')[S.get('selectedRoom')]) {
      Rdr.renderDetail(S.get('selectedRoom'));
    }
    S.set('resizeState', null);
  }

  I.onResizeEnd = function() { onResizeEndCleanup(); };
  I.onResizeEndTouch = function() { onResizeEndCleanup(); };

  // ===================================================================
  // Place New Room – Interactive Draw on Plan
  // ===================================================================
  I.enablePlaceNewRoom = function(floor) {
    if (!S.get('editMode')) return;
    S.set('isPlacing', true);
    S.set('placeFloor', floor);
    document.querySelectorAll('.pw').forEach(w => { w.style.cursor = 'crosshair'; });
    const UI = window.GR.ui;
    if (UI) UI.closeSidebar();
    const sbBody = document.getElementById('sbBody');
    if (sbBody) {
      sbBody.innerHTML = `<p class="hint"><strong>Neuen Raum platzieren</strong><br/>
        👆 Auf den Grundriss tippen & ziehen um die Größe festzulegen.<br/>
        <button onclick="window.GR.interaction.cancelPlaceNewRoom()" style="margin-top:8px;background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:var(--rs);cursor:pointer;font-size:14px;">Abbrechen</button>
      </p>`;
    }
  };

  I.cancelPlaceNewRoom = function() {
    I.removePlacePreview();
    S.set('isPlacing', false);
    S.set('placeFloor', null);
    S.set('placeState', null);
    document.querySelectorAll('.pw').forEach(w => { w.style.cursor = ''; });
    const sbBody = document.getElementById('sbBody');
    if (sbBody) sbBody.innerHTML = '<p class="hint">👆 Raum antippen</p>';
  };

  I.removePlacePreview = function() {
    const prev = document.getElementById('place-preview');
    if (prev) prev.remove();
  };

  I.startPlaceDraw = function(e) {
    if (!S.get('isPlacing')) return;
    e.preventDefault();

    const raw = getPointerPos(e);
    const wrapper = e.currentTarget.closest('.pw');
    if (!wrapper) return;

    const pi = wrapper.querySelector('.pi');
    const rect = pi.getBoundingClientRect();

    S.set('placeState', {
      startX: raw.x,
      startY: raw.y,
      relStartX: raw.x - rect.left,
      relStartY: raw.y - rect.top,
      wrapper,
      pi,
      floor: Rdr.detectFloorId(wrapper.id),
      endX: null,
      endY: null,
      relEndX: null,
      relEndY: null
    });

    // Create a visual preview rectangle
    I.removePlacePreview();
    const preview = document.createElement('div');
    preview.id = 'place-preview';
    preview.style.cssText = 'position:absolute;border:2px dashed var(--blue);background:rgba(59,130,246,0.12);z-index:100;pointer-events:none;border-radius:4px;';
    preview.style.left = `${S.get('placeState').relStartX}px`;
    preview.style.top = `${S.get('placeState').relStartY}px`;
    preview.style.width = '0px';
    preview.style.height = '0px';
    pi.appendChild(preview);

    document.addEventListener('mousemove', I.onPlaceDrawMove);
    document.addEventListener('mouseup', I.onPlaceDrawEnd);
    document.addEventListener('touchmove', I.onPlaceDrawMoveTouch, { passive: false });
    document.addEventListener('touchend', I.onPlaceDrawEndTouch, { passive: false });
  };

  I.onPlaceDrawMove = function(e) {
    const ps = S.get('placeState');
    if (!ps) return;
    e.preventDefault();

    const raw = getPointerPos(e);
    const piRect = ps.pi.getBoundingClientRect();
    const relX = raw.x - piRect.left;
    const relY = raw.y - piRect.top;

    ps.endX = raw.x;
    ps.endY = raw.y;
    ps.relEndX = relX;
    ps.relEndY = relY;

    const preview = document.getElementById('place-preview');
    if (!preview) return;

    const sx = ps.relStartX;
    const sy = ps.relStartY;

    const left = Math.min(sx, relX);
    const top = Math.min(sy, relY);
    const width = Math.abs(relX - sx);
    const height = Math.abs(relY - sy);

    preview.style.left = `${left}px`;
    preview.style.top = `${top}px`;
    preview.style.width = `${width}px`;
    preview.style.height = `${height}px`;
  };

  I.onPlaceDrawMoveTouch = function(e) {
    I.onPlaceDrawMove(e);
  };

  function onPlaceDrawEndCleanup() {
    const ps = S.get('placeState');
    if (!ps) return;
    document.removeEventListener('mousemove', I.onPlaceDrawMove);
    document.removeEventListener('mouseup', I.onPlaceDrawEnd);
    document.removeEventListener('touchmove', I.onPlaceDrawMoveTouch);
    document.removeEventListener('touchend', I.onPlaceDrawEndTouch);
  }

  I.onPlaceDrawEnd = function() { onPlaceDrawEndCleanup(); I.finishPlaceDraw(); };
  I.onPlaceDrawEndTouch = function() { onPlaceDrawEndCleanup(); I.finishPlaceDraw(); };

  I.finishPlaceDraw = function() {
    const ps = S.get('placeState');
    if (!ps) return;

    // Read the preview position before removing it
    const preview = document.getElementById('place-preview');
    let finalLeft = ps.relStartX;
    let finalTop = ps.relStartY;
    let finalWidth = 1;
    let finalHeight = 1;

    if (preview) {
      finalLeft = parseFloat(preview.style.left) || ps.relStartX;
      finalTop = parseFloat(preview.style.top) || ps.relStartY;
      finalWidth = Math.max(20, parseFloat(preview.style.width) || 1);
      finalHeight = Math.max(20, parseFloat(preview.style.height) || 1);
      preview.remove();
    } else if (ps.relEndX !== null) {
      const sx = ps.relStartX;
      const sy = ps.relStartY;
      const ex = ps.relEndX;
      const ey = ps.relEndY;
      finalLeft = Math.min(sx, ex);
      finalTop = Math.min(sy, ey);
      finalWidth = Math.max(20, Math.abs(ex - sx));
      finalHeight = Math.max(20, Math.abs(ey - sy));
    }

    // Convert display pixels to native coordinates
    const scale = Rdr.getScale(ps.wrapper);
    const nativeLeft = Math.round(finalLeft / scale);
    const nativeTop = Math.round(finalTop / scale);
    const nativeWidth = Math.round(finalWidth / scale);
    const nativeHeight = Math.round(finalHeight / scale);

    // Build a unique key
    const R = window.GR.rooms;
    const key = R.generateKey();

    // Create the room with a default name
    const rooms = S.get('rooms');
    rooms[key] = {
      title: 'Neuer Raum',
      floor: ps.floor,
      tasks: [],
      done: {},
      note: '',
      comments: [],
      left: Math.max(0, nativeLeft),
      top: Math.max(0, nativeTop),
      width: Math.max(20, nativeWidth),
      height: Math.max(20, nativeHeight)
    };

    St.saveData();
    S.set('isPlacing', false);
    S.set('placeState', null);
    S.set('placeFloor', null);
    document.querySelectorAll('.pw').forEach(w => { w.style.cursor = ''; });
    Rdr.render();
    Rdr.showRoom(key);
    // Open rename popup so the user can name the room right away
    const UI = window.GR.ui;
    if (UI) UI.openRenameModal(key);
  };
})(window.GR.interaction = window.GR.interaction || {});