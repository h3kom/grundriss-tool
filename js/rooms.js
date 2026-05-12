// Grundriss Tool – Raum-CRUD (Aufgaben, Kommentare, Notizen, Löschen)
// =====================================================================
window.GR = window.GR || {};

(function(R) {
  const St = window.GR.storage;
  const S = window.GR.state;

  // ===================================================================
  // Room Helpers
  // ===================================================================
  R.ensureRoomFields = function(room) {
    if (!room.comments) room.comments = [];
    if (!room.done) room.done = {};
    return room;
  };

  R.ensureAllRooms = function() {
    const rooms = S.get('rooms');
    for (const key of Object.keys(rooms)) {
      R.ensureRoomFields(rooms[key]);
    }
  };

  R.completedTaskCount = function(room) {
    if (!room.done) return 0;
    return Object.values(room.done).filter(Boolean).length;
  };

  R.taskProgress = function(room) {
    const done = R.completedTaskCount(room);
    const total = room.tasks ? room.tasks.length : 0;
    return { done, total, percent: total > 0 ? Math.round(done / total * 100) : 0 };
  };

  R.deepClone = function(obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  R.generateKey = function() {
    const rooms = S.get('rooms');
    const baseKey = 'raum';
    let key = baseKey;
    let i = 1;
    while (rooms[key]) {
      key = baseKey + i;
      i++;
    }
    return key;
  };

  // ===================================================================
  // Task Actions
  // ===================================================================
  R.toggleTask = function(key, idx, checked) {
    const room = S.get('rooms')[key];
    if (!room) return;
    if (!room.done) room.done = {};
    room.done[idx] = checked;
    St.saveData();
    const Renderer = window.GR.renderer;
    if (Renderer) Renderer.render();
    if (Renderer) Renderer.renderDetail(key);
    if (checked) St.toast('✅ Erledigt!', 'success', 2000);
  };

  R.addTask = function(key) {
    const input = document.getElementById(`nti-${key}`);
    const text = input?.value?.trim();
    if (!text) return;
    const rooms = S.get('rooms');
    if (!rooms[key].tasks) rooms[key].tasks = [];
    rooms[key].tasks.push(text);
    St.saveData();
    const Renderer = window.GR.renderer;
    if (Renderer) Renderer.renderDetail(key);
    input.value = '';
    input.focus();
    St.toast('Aufgabe hinzugefügt', 'success', 1500);
  };

  R.deleteTask = function(key, idx) {
    const room = S.get('rooms')[key];
    if (!room) return;
    if (!room.tasks) room.tasks = [];
    room.tasks.splice(idx, 1);
    const newDone = {};
    for (const k of Object.keys(room.done)) {
      if (!room.done.hasOwnProperty(k)) continue;
      const ki = parseInt(k);
      if (ki < idx) newDone[k] = room.done[k];
      else if (ki > idx) newDone[(ki - 1).toString()] = room.done[k];
    }
    room.done = newDone;
    St.saveData();
    const Renderer = window.GR.renderer;
    if (Renderer) Renderer.renderDetail(key);
  };

  // ===================================================================
  // Note Action
  // ===================================================================
  R.saveNote = function(key, value) {
    S.get('rooms')[key].note = value;
    St.saveData();
  };

  // ===================================================================
  // Comment Actions
  // ===================================================================
  R.addComment = function(key) {
    const input = document.getElementById(`nci-${key}`);
    const text = input?.value?.trim();
    if (!text) return;
    const rooms = S.get('rooms');
    if (!rooms[key].comments) rooms[key].comments = [];
    rooms[key].comments.push({ text, time: new Date().toISOString() });
    St.saveData();
    input.value = '';
    input.focus();
    const Renderer = window.GR.renderer;
    if (Renderer) Renderer.renderDetail(key);
    St.toast('Kommentar', 'success', 1500);
  };

  R.deleteComment = function(key, idx) {
    const rooms = S.get('rooms');
    if (!rooms[key].comments) rooms[key].comments = [];
    rooms[key].comments.splice(idx, 1);
    St.saveData();
    const Renderer = window.GR.renderer;
    if (Renderer) Renderer.renderDetail(key);
  };

  // ===================================================================
  // Delete Room
  // ===================================================================
  R.deleteRoom = function(key) {
    const rooms = S.get('rooms');
    if (!confirm(`"${rooms[key].title}" löschen?`)) return;
    const backupRoom = R.deepClone(rooms[key]);
    const backupKey = key;
    delete rooms[key];
    S.set('selectedRoom', null);
    St.saveData();
    const Renderer = window.GR.renderer;
    if (Renderer) Renderer.render();
    const sbBody = document.getElementById('sbBody');
    if (sbBody) sbBody.innerHTML = '<p class="hint">👆 Raum antippen</p>';
    St.toast(`"${backupRoom.title}" gelöscht`, 'warning', 6000, function() {
      rooms[backupKey] = backupRoom;
      St.saveData();
      if (Renderer) Renderer.render();
      if (Renderer) Renderer.showRoom(backupKey);
    });
  };
})(window.GR.rooms = window.GR.rooms || {});