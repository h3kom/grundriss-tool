// Grundriss Tool – DOM-Rendering (Räume, Detail-Panel, Übersicht)
// =====================================================================
window.GR = window.GR || {};

(function(Rdr) {
  const C = window.GR.constants;
  const S = window.GR.state;
  const St = window.GR.storage;

  // Lazy references (modules loaded after renderer.js)
  function getUI() { return window.GR.ui; }
  function getI()  { return window.GR.interaction; }

  // ===================================================================
  // Scale Helpers
  // ===================================================================
  function detectFloorId(id) {
    if (!id) return 'eg';
    const lower = id.toLowerCase();
    if (lower === 'og' || lower.startsWith('og') || lower.includes('-og') || lower.includes('_og')) return 'og';
    return 'eg';
  }

  function getScale(wrapper) {
    if (!wrapper) return 1;
    const img = wrapper.querySelector('img');
    if (!img) return 1;
    const nativeWidth = C.NATIVE_WIDTHS[detectFloorId(wrapper.id)] || 1000;
    const displayWidth = img.getBoundingClientRect().width;
    return displayWidth > 0 && nativeWidth > 0 ? displayWidth / nativeWidth : 1;
  }

  // ===================================================================
  // Main Render
  // ===================================================================
  Rdr.render = function() {
    St.updateTabBadges();
    Rdr.renderFloor('eg');
    Rdr.renderFloor('og');
  };

  Rdr.renderFloor = function(floor) {
    const container = document.getElementById(`${floor}-r`);
    if (!container) return;
    container.innerHTML = '';

    const wrapper = document.getElementById(`${floor}-w`);
    const scale = getScale(wrapper);
    const rooms = S.get('rooms');

    for (const key of Object.keys(rooms)) {
      const room = rooms[key];
      if (room.floor !== floor) continue;
      container.appendChild(Rdr.createRoomElement(key, room, scale));
    }
  };

  Rdr.createRoomElement = function(key, room, scale) {
    const div = document.createElement('div');
    div.className = `ro${S.get('selectedRoom') === key ? ' sel' : ''}${S.get('editMode') ? ' em' : ''}`;
    div.style.left = `${Math.round(room.left * scale)}px`;
    div.style.top = `${Math.round(room.top * scale)}px`;
    div.style.width = `${Math.round(room.width * scale)}px`;
    div.style.height = `${Math.round(room.height * scale)}px`;
    div.setAttribute('data-key', key);

    div.addEventListener('click', (e) => {
      if (e.currentTarget._wasDragged) return;
      if (S.get('editMode')) {
        Rdr.selectRoomEdit(key);
        return;
      }
      Rdr.showRoom(key);
      if (window.innerWidth < 768) Rdr.openSidebar();
    });

    div.addEventListener('mousedown', (e) => {
      const I = getI();
      if (I) I.startDrag(e, key);
    });
    div.addEventListener('touchstart', (e) => {
      const I = getI();
      if (I) I.startDrag(e, key);
    }, { passive: true });

    // Label
    const label = document.createElement('div');
    label.className = 'rl';
    const progress = St.taskProgress(room);
    label.innerHTML = progress.total > 0
      ? `${St.escHtml(room.title)}<span class="pm">${progress.percent}%</span>`
      : St.escHtml(room.title);
    div.appendChild(label);

    // Selection dot
    const sdot = document.createElement('div');
    sdot.className = 'sd';
    div.appendChild(sdot);

    // Resize handles
    Rdr.createResizeHandles(div, key);

    return div;
  };

  Rdr.createResizeHandles = function(element, key) {
    const handleNames = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    for (const handle of handleNames) {
      const hdl = document.createElement('div');
      hdl.className = `rh ${handle}`;
      hdl.addEventListener('mousedown', (ev) => {
        const I = getI();
        if (I) I.startResize(ev, key, handle);
      });
      hdl.addEventListener('touchstart', (ev) => {
        const I = getI();
        if (I) I.startResize(ev, key, handle);
      }, { passive: false });
      hdl.addEventListener('click', (ev) => ev.stopPropagation());
      element.appendChild(hdl);
    }
  };

  // ===================================================================
  // Show Room & Scroll
  // ===================================================================
  Rdr.showRoom = function(key) {
    const room = S.get('rooms')[key];
    if (!room) return;
    if (room.floor !== S.get('activeFloor')) {
      const UI = getUI();
      if (UI) UI.switchFloor(room.floor);
    }
    S.set('selectedRoom', key);
    S.set('overview', false);
    document.getElementById('btnOv')?.classList.remove('active');
    Rdr.render();
    Rdr.renderDetail(key);
    Rdr.scrollToRoom(key);
    if (window.innerWidth < 768) Rdr.openSidebar();
  };

  Rdr.scrollToRoom = function(key) {
    const el = document.querySelector(`.ro[data-key="${key}"]`);
    if (!el) return;
    setTimeout(() => {
      const wrapper = el.closest('.pw');
      if (wrapper) {
        const mc = document.getElementById('mc');
        if (mc) {
          const wr = wrapper.getBoundingClientRect();
          const cr = mc.getBoundingClientRect();
          if (wr.bottom > cr.bottom + 20 || wr.top < cr.top - 20) {
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }, 100);
  };

  Rdr.selectRoomEdit = function(key) {
    S.set('selectedRoom', key);
    Rdr.render();
    if (S.get('rooms')[key]) {
      Rdr.renderDetail(key);
      if (window.innerWidth < 768) Rdr.openSidebar();
    }
  };

  // ===================================================================
  // Detail Panel
  // ===================================================================
  Rdr.renderDetail = function(key) {
    const room = S.get('rooms')[key];
    if (!room) return;

    const progress = St.taskProgress(room);
    const sbBody = document.getElementById('sbBody');
    if (!sbBody) return;

    let html = Rdr.buildDetailHeader(key, room);
    html += Rdr.buildProgressBar(progress);
    html += Rdr.buildTaskSection(key, room, progress);
    html += Rdr.buildNoteSection(key, room);
    html += Rdr.buildCommentSection(key, room);
    if (S.get('editMode')) html += Rdr.buildDeleteSection(key);
    html += Rdr.buildLastEditInfo();

    sbBody.innerHTML = html;
  };

  Rdr.buildDetailHeader = function(key, room) {
    return `<div class="rdh">
      <button class="bb" onclick="window.GR.renderer.showOverview()">←</button>
      <h3>${St.escHtml(room.title)}</h3>
      <button class="rb" onclick="window.GR.ui.openRenameModal('${key}')" title="Umbenennen">✏️</button>
      <span class="rk">${St.escHtml(key)}</span>
    </div>`;
  };

  Rdr.buildProgressBar = function(progress) {
    if (progress.total === 0) return '';
    return `<div style="font-size:13px;color:var(--muted);margin-bottom:2px;">
      ${progress.done}/${progress.total} Aufgaben (${progress.percent}%)
    </div>
    <div class="pbw"><div class="pbf" style="width:${progress.percent}%"></div></div>`;
  };

  Rdr.buildTaskSection = function(key, room, progress) {
    let html = `<div class="is">
      <h4>Aufgaben${progress.total > 0 ? ` <span class="cnt">${progress.done}/${progress.total}</span>` : ''}</h4>`;

    if (!room.tasks || room.tasks.length === 0) {
      html += '<p style="font-size:13px;color:var(--muted);margin:0;">Keine Aufgaben.</p>';
    } else {
      html += '<div>';
      for (let i = 0; i < room.tasks.length; i++) {
        const checked = (room.done || {})[i] || false;
        html += `<div class="ti${checked ? ' done' : ''}">
          <input type="checkbox"${checked ? ' checked' : ''} onchange="window.GR.rooms.toggleTask('${key}',${i},this.checked)">
          <label>${St.escHtml(room.tasks[i])}</label>
          ${S.get('editMode') ? `<button class="td" onclick="window.GR.rooms.deleteTask('${key}',${i})">×</button>` : ''}
        </div>`;
      }
      html += '</div>';
    }

    if (S.get('editMode')) {
      html += `<div class="atr">
        <input type="text" id="nti-${key}" placeholder="Neue Aufgabe…" onkeydown="if(event.key==='Enter')window.GR.rooms.addTask('${key}')">
        <button onclick="window.GR.rooms.addTask('${key}')">+</button>
      </div>`;
    }

    html += '</div>';
    return html;
  };

  Rdr.buildNoteSection = function(key, room) {
    let html = `<div class="is"><h4>Notiz</h4>`;
    if (S.get('editMode')) {
      html += `<textarea class="rne" onchange="window.GR.rooms.saveNote('${key}',this.value)">${St.escHtml(room.note || '')}</textarea>`;
    } else {
      html += `<p style="margin:0;font-size:14px;">${St.escHtml(room.note || 'Keine Notiz.')}</p>`;
    }
    html += '</div>';
    return html;
  };

  Rdr.buildCommentSection = function(key, room) {
    const commentCount = room.comments ? room.comments.length : 0;
    let html = `<div class="is">
      <h4>Kommentare${commentCount > 0 ? ` <span class="cnt">${commentCount}</span>` : ''}</h4>
      <div class="cl">`;

    if (room.comments && room.comments.length > 0) {
      for (let i = 0; i < room.comments.length; i++) {
        const timeStr = room.comments[i].time
          ? new Date(room.comments[i].time).toLocaleString('de-DE')
          : '';
        html += `<div class="ci">
          ${S.get('editMode') ? `<button class="cd" onclick="window.GR.rooms.deleteComment('${key}',${i})">×</button>` : ''}
          <div class="cm">${timeStr}</div>
          ${St.escHtml(room.comments[i].text)}
        </div>`;
      }
    } else {
      html += '<p style="font-size:13px;color:var(--muted);margin:0;">Keine Kommentare.</p>';
    }

    html += `</div>
      <div class="acr">
        <input type="text" id="nci-${key}" placeholder="Kommentar…" onkeydown="if(event.key==='Enter')window.GR.rooms.addComment('${key}')">
        <button onclick="window.GR.rooms.addComment('${key}')">Senden</button>
      </div>
    </div>`;

    return html;
  };

  Rdr.buildDeleteSection = function(key) {
    return `<div class="is"><button class="drb" onclick="window.GR.rooms.deleteRoom('${key}')">🗑 Löschen</button></div>`;
  };

  Rdr.buildLastEditInfo = function() {
    const delta = Date.now() - S.get('lastSaveTs');
    let text;
    if (delta < 60000) text = 'Gerade eben';
    else if (delta < 3600000) text = `Vor ${Math.round(delta / 60000)} Min.`;
    else if (delta < 86400000) text = `Vor ${Math.round(delta / 3600000)} Std.`;
    else text = new Date(S.get('lastSaveTs')).toLocaleDateString('de-DE');

    return text
      ? `<div style="margin-top:10px;font-size:11px;color:var(--muted);text-align:center;">${text}</div>`
      : '';
  };

  // ===================================================================
  // Overview
  // ===================================================================
  Rdr.showOverview = function() {
    if (S.get('overview')) return;
    S.set('overview', true);
    S.set('selectedRoom', null);
    document.getElementById('btnOv')?.classList.add('active');
    Rdr.render();
    const UI = getUI();
    if (UI) UI.openSidebar();

    const searchValue = (document.querySelector('.os')?.value || '').toLowerCase();

    let html = '<h3 style="margin:0 0 4px;font-size:16px;">📊 Übersicht</h3>';
    html += '<div class="osw"><span class="si">🔍</span>';
    html += `<input type="text" class="os" id="os" placeholder="Räume suchen…" value="${St.escHtml(searchValue)}" oninput="window.GR.renderer.debouncedSearch()">`;
    html += '</div><div class="orl">';

    const rooms = S.get('rooms');
    const roomEntries = Object.entries(rooms);
    const filtered = searchValue
      ? roomEntries.filter(([key, room]) =>
          room.title.toLowerCase().includes(searchValue) ||
          key.toLowerCase().includes(searchValue)
        )
      : roomEntries;

    if (filtered.length === 0) {
      html += '<p style="font-size:13px;color:var(--muted);text-align:center;padding:16px 0;">🔍 Keine Räume.</p>';
    } else {
      for (const [key, room] of filtered) {
        const progress = St.taskProgress(room);
        const floorLabel = room.floor === 'eg' ? 'EG' : 'OG';
        html += `<div class="ori" onclick="window.GR.renderer.showRoom('${key}')">
          <div class="nm">${St.escHtml(room.title)}<span style="font-size:11px;color:var(--muted);margin-left:4px;">(${floorLabel})</span></div>
          <div class="pt">${progress.done}/${progress.total} (${progress.percent}%)</div>
        </div>`;
      }
    }

    html += '</div>';
    const lastEdit = Rdr.buildLastEditInfo();
    if (lastEdit) html += lastEdit;

    document.getElementById('sbBody').innerHTML = html;
  };

  Rdr.debouncedSearch = function() {
    if (S.get('debounceTimer')) clearTimeout(S.get('debounceTimer'));
    S.set('debounceTimer', setTimeout(() => Rdr.showOverview(), 200));
  };

  // ===================================================================
  // Sidebar (quick access, delegates to ui if available)
  // ===================================================================
  Rdr.openSidebar = function() {
    const UI = getUI();
    if (UI) UI.openSidebar();
  };

  // ===================================================================
  // Expose helpers for interaction.js
  // ===================================================================
  Rdr.getScale = getScale;
  Rdr.detectFloorId = detectFloorId;
})(window.GR.renderer = window.GR.renderer || {});