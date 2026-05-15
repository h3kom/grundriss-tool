/**
 * Grundriss Tool – Gemeinsame Hilfsfunktionen
 * =====================================================================
 * @module utils
 * @description Stellt duplikatsfreie Utility-Funktionen für alle Module bereit.
 */
import { SCALE_CACHE_TTL, NATIVE_WIDTHS, TIME_THRESHOLD_MINUTE, TIME_THRESHOLD_HOUR, TIME_THRESHOLD_DAY } from './constants.js';

export function ensureRoomFields(room) {
  if (!room.comments) room.comments = [];
  if (!room.done) room.done = {};
  return room;
}

export function ensureAllRooms(rooms) {
  for (const key of Object.keys(rooms)) {
    ensureRoomFields(rooms[key]);
  }
}

export function completedTaskCount(room) {
  if (!room.done) return 0;
  return Object.values(room.done).filter(Boolean).length;
}

export function taskProgress(room) {
  const done = completedTaskCount(room);
  const total = room.tasks ? room.tasks.length : 0;
  return { done, total, percent: total > 0 ? Math.round(done / total * 100) : 0 };
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, function(ch) {
    return { '&': '\x26amp;', '<': '\x26lt;', '>': '\x26gt;', '"': '\x26quot;', "'": '\x26#39;' }[ch];
  });
}

export function escAttr(str) {
  if (str == null) return '';
  return String(str).replace(/[&"'<>]/g, function(ch) {
    return { '&': '\x26amp;', '"': '\x26quot;', "'": '\x26#39;', '<': '\x26lt;', '>': '\x26gt;' }[ch];
  });
}

export function isValidKey(key) {
  return typeof key === 'string' && /^[a-zA-Z0-9_\-]+$/.test(key);
}

export function formatLastEdit(lastSaveTs) {
  const delta = Date.now() - lastSaveTs;
  if (delta < TIME_THRESHOLD_MINUTE) return 'Gerade eben';
  if (delta < TIME_THRESHOLD_HOUR) return 'Vor ' + Math.round(delta / TIME_THRESHOLD_MINUTE) + ' Min.';
  if (delta < TIME_THRESHOLD_DAY) return 'Vor ' + Math.round(delta / TIME_THRESHOLD_HOUR) + ' Std.';
  return new Date(lastSaveTs).toLocaleDateString('de-DE');
}

export function generateKey(rooms) {
  const baseKey = 'raum';
  let key = baseKey;
  let i = 1;
  while (rooms[key]) {
    key = baseKey + i;
    i++;
  }
  return key;
}

export function detectFloorId(id) {
  if (!id) return 'eg';
  const lower = id.toLowerCase();
  if (lower === 'og' || lower.startsWith('og') || lower.includes('-og') || lower.includes('_og')) return 'og';
  return 'eg';
}

const _scaleCache = new Map();

export function _resetScaleCache() {
  _scaleCache.clear();
}

export function getScale(wrapper) {
  if (!wrapper) return 1;
  const cached = _scaleCache.get(wrapper);
  const now = Date.now();
  if (cached && (now - cached.stamp) < SCALE_CACHE_TTL) return cached.value;
  const img = wrapper.querySelector('img');
  if (!img) return 1;
  const nativeWidth = NATIVE_WIDTHS[detectFloorId(wrapper.id)] || 1000;
  const displayWidth = img.getBoundingClientRect().width;
  const value = displayWidth > 0 && nativeWidth > 0 ? displayWidth / nativeWidth : 1;
  _scaleCache.set(wrapper, { value, stamp: now });
  return value;
}

export function getPointerPos(e) {
  const touch = e.touches;
  if (touch && touch.length > 0) {
    return { x: touch[0].clientX, y: touch[0].clientY };
  }
  if (e.changedTouches && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

export function getDeviceId() {
  const KEY = 'gr_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = 'd' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
    localStorage.setItem(KEY, id);
  }
  return id;
}