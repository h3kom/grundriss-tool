# Grundriss-Tool — Architektur-Dokumentation

## Überblick

Das Grundriss-Tool ist eine **Vanilla-JS-Einzelanwendung** ohne Build-Tool. Es besteht aus 16 JavaScript-Modulen + 1 CSS-Datei, die über einen globalen Namespace (`window.GR`) miteinander kommunizieren. Die Module sind nach dem **IIFE-Pattern** (Immediately Invoked Function Expression) aufgebaut und werden über `<script>`-Tags in einer definierten Reihenfolge geladen.

Dank des **Event-Systems** sind die Module lose gekoppelt: Ein Modul muss andere Module nicht direkt aufrufen, sondern feuert ein Event auf dem State, woraufhin alle Abonnenten automatisch reagieren.

---

## Dateistruktur

```
grundriss-tool/
├── index.html              # Einstiegspunkt (verlinkt styles.css + alle JS-Skripte)
├── styles.css              # Alle CSS-Klassen (aus index.html ausgelagert)
├── EG.png                  # Grundriss-Bild Erdgeschoss
├── OG.png                  # Grundriss-Bild Obergeschoss
└── js/
    ├── constants.js        # Zentrale Konstanten
    ├── utils.js            # Gemeinsame Hilfsfunktionen
    ├── state.js            # State-Management + Event-System
    ├── cloud.js            # Supabase-Cloud-API
    ├── sync.js             # Sync-Manager (Polling + Status)
    ├── storage.js          # Lokale Datenpersistenz (localStorage)
    ├── rooms.js            # Raum-CRUD (Tasks, Comments, Notes, Delete)
    ├── drag.js             # Drag-Interaktion (Räume verschieben)
    ├── resize.js           # Resize-Interaktion (Räume skalieren)
    ├── place-room.js       # Neue Räume auf Grundriss platzieren
    ├── interaction.js      # Brückenmodul (Rückwärtskompatibilität)
    ├── renderer.js         # Core-Renderer (Grundriss-Zeichnung)
    ├── detail-renderer.js  # Detail-Panel-Renderer (Sidebar)
    ├── overview-renderer.js# Übersichts-Renderer (Sidebar)
    ├── ui.js               # UI-Komponenten (Toast, Sidebar, Modals, etc.)
    └── app.js              # App-Init + Keyboard-Shortcuts
```

---

## Modulbeschreibungen

### 1. `constants.js` — Konstanten

**Namespace:** `window.GR.constants`

Zentrale Sammlung aller Konfigurationswerte, API-Keys und Event-Namen.

| Konstante | Typ | Beschreibung |
|-----------|-----|-------------|
| `SUPABASE_URL` | `string` | Supabase-Projekt-URL |
| `SUPABASE_ANON_KEY` | `string` | Anonymer Supabase-API-Key |
| `NATIVE_WIDTHS` | `{eg: 1000, og: 800}` | Native Breiten der Grundriss-Bilder |
| `FLOORS` | `['eg', 'og']` | Liste der Etagen-Kürzel |
| `MAX_UNDO` | `20` | Maximale Anzahl von Undo-Schritten |
| `SYNC_INTERVAL` | `3000` | Polling-Intervall in ms |
| `LOCAL_STORAGE_KEY` | `'gR'` | localStorage-Key für Raumdaten |
| `INTRO_SEEN_KEY` | `'gd'` | localStorage-Key für Intro-Flag |
| `SUPABASE_TABLE` | `'rooms'` | Supabase-Tabellenname |
| `SUPABASE_ROW_ID` | `1` | Supabase-Zeilen-ID |
| `EVT_ROOMS_CHANGED` | `'roomsChanged'` | Event bei Raum-Änderungen |
| `EVT_SELECTION_CHANGED` | `'selectionChanged'` | Event bei Auswahl-Änderung |
| `EVT_EDIT_MODE_CHANGED` | `'editModeChanged'` | Event bei Edit-Mode-Wechsel |
| `EVT_FLOOR_CHANGED` | `'floorChanged'` | Event bei Etagen-Wechsel |
| `EVT_SYNC_STATUS_CHANGED` | `'syncStatusChanged'` | Event bei Sync-Status-Änderung |

---

### 2. `utils.js` — Gemeinsame Hilfsfunktionen

**Namespace:** `window.GR.utils`

Stellt duplikatsfreie Utility-Funktionen für alle Module bereit. Enthält die Helfer, die früher doppelt in `rooms.js` und `storage.js` existierten.

| Funktion | Beschreibung |
|----------|-------------|
| `ensureRoomFields(room)` | Stellt sicher, dass ein Raum-Objekt `comments` und `done`-Felder hat |
| `ensureAllRooms(rooms)` | Ruft `ensureRoomFields` für alle Räume auf |
| `completedTaskCount(room)` | Zählt erledigte Aufgaben eines Raums |
| `taskProgress(room)` | Berechnet `{done, total, percent}` für einen Raum |
| `deepClone(obj)` | Tiefenkopie via `JSON.parse(JSON.stringify(...))` |
| `escHtml(str)` | Escaped HTML-Sonderzeichen sicher |
| `generateKey(rooms)` | Generiert eindeutigen Raumschlüssel (`raum`, `raum1`, …) |
| `detectFloorId(id)` | Erkennt Etagen-ID aus String (`'eg'` oder `'og'`) |
| `getScale(wrapper)` | Berechnet Skalierungsfaktor zwischen Display und nativen Koordinaten |

---

### 3. `state.js` — State-Management + Event-System

**Namespace:** `window.GR.state`

Verwaltet den gesamten Anwendungszustand in einem privaten `_state`-Objekt und stellt ein **Publish/Subscribe-Event-System** bereit.

**State-Felder:**

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `rooms` | `Object` | Alle Räume `{key: roomData}` |
| `selectedRoom` | `string|null` | Aktuell selektierter Raumschlüssel |
| `editMode` | `boolean` | Edit-Mode aktiv? |
| `overview` | `boolean` | Übersicht aktiv? |
| `sidebarOpen` | `boolean` | Sidebar offen? |
| `sidebarWasManuallyOpened` | `boolean` | Wurde Sidebar manuell geöffnet? |
| `dragState` | `Object|null` | Aktueller Drag-Zustand |
| `resizeState` | `Object|null` | Aktueller Resize-Zustand |
| `isPlacing` | `boolean` | Platzierungs-Modus aktiv? |
| `placeFloor` | `string|null` | Etage für Platzierung |
| `placeState` | `Object|null` | Aktueller Platzierungs-Zustand |
| `debounceTimer` | `number|null` | Timer für Debounce |
| `lastSaveTs` | `number` | Letzter Speicherzeitpunkt (ms) |
| `undoStack` | `Array` | Stack von Undo-Callbacks |
| `syncStatus` | `string` | `'idle'|'syncing'|'synced'|'error'` |
| `serverStamp` | `number` | Server-Timestamp |
| `pollInterval` | `number|null` | Polling-Interval-ID |
| `isSyncing` | `boolean` | Sync läuft gerade? |
| `saveTimeout` | `number|null` | Debounce-Timeout für Save |
| `activeFloor` | `string` | Aktive Etage (`'eg'|'og'`) |

**Öffentliche Funktionen:**

| Funktion | Beschreibung |
|----------|-------------|
| `get(key?)` | Gibt State-Wert oder gesamtes State-Objekt zurück |
| `set(key, value)` | Setzt Wert + feuert automatisch Events bei bekannten Schlüsseln |
| `merge(obj)` | Merged mehrere Werte auf einmal (ohne Events) |
| `subscribe(event, callback)` | Abonniert ein Event, gibt `unsubscribe`-Funktion zurück |
| `notify(event, data)` | Feuert ein Event an alle Abonnenten |
| `notifyRoomsChanged()` | Kurzform für `notify('roomsChanged')` |
| `pushUndo(callback)` | Fügt Undo-Callback zum Stack hinzu (max `MAX_UNDO`) |
| `getUndo(key)` | Holt Undo-Callback per Index |
| `clearUndo(key)` | Markiert Undo-Callback als verbraucht |

**Automatische Events bei `set()`:**

```javascript
S.set('editMode', value)     → feuert EVT_EDIT_MODE_CHANGED
S.set('activeFloor', value)  → feuert EVT_FLOOR_CHANGED
S.set('selectedRoom', value) → feuert EVT_SELECTION_CHANGED
S.set('syncStatus', value)   → feuert EVT_SYNC_STATUS_CHANGED
```

---

### 4. `cloud.js` — Supabase-Cloud-API

**Namespace:** `window.GR.cloud`

Kapselt sämtliche Supabase-Fetch-Operationen. Keine Logik, nur API-Aufrufe.

| Funktion | Beschreibung |
|----------|-------------|
| `fetchData()` | Lädt Raumdaten von Supabase → `{data, updatedAt}` oder `null` |
| `saveData(rooms)` | Schreibt Raumdaten per Upsert nach Supabase → `{ok, updatedAt}` |

---

### 5. `sync.js` — Sync-Manager

**Namespace:** `window.GR.sync`

Überwacht Cloud-Änderungen via Polling, aktualisiert den lokalen State und steuert die Sync-Status-Anzeige.

| Funktion | Beschreibung |
|----------|-------------|
| `startPolling()` | Startet Intervall-Polling (alle `SYNC_INTERVAL` ms) |
| `applyCloudData(data, timestamp)` | Wendet Cloud-Daten auf lokalen State an + feuert `roomsChanged` |
| `saveToCloud()` | Speichert lokale Daten asynchron in die Cloud |
| `setSyncStatus(status)` | Setzt Sync-Status + aktualisiert UI-Indikator |
| `updateTabBadges()` | Aktualisiert Raum-Anzahl-Badges in den Etagen-Tabs |

---

### 6. `storage.js` — Lokale Datenpersistenz

**Namespace:** `window.GR.storage`

Lädt und speichert Raumdaten lokal (localStorage) und delegiert Cloud-Operationen an `cloud.js` und `sync.js`.

| Funktion | Beschreibung |
|----------|-------------|
| `loadData()` | Lädt Daten: zuerst Cloud, dann localStorage als Fallback |
| `loadFromCloud()` | Lädt Daten aus der Cloud → `boolean` |
| `saveData()` | Speichert lokal + triggert debounced Cloud-Sync + feuert `roomsChanged` |
| `saveToLocal()` | Speichert nur lokal (ohne Cloud) |
| `toast()` | Stub – wird von `ui.js` überschrieben |

---

### 7. `rooms.js` — Raum-CRUD

**Namespace:** `window.GR.rooms`

Operationen auf Raum-Daten (Tasks, Comments, Notes, Delete). Enthält **kein Rendering** – kommuniziert via State und Storage.

| Funktion | Beschreibung |
|----------|-------------|
| `toggleTask(key, idx, checked)` | Schaltet Aufgabe um (erledigt/nicht) |
| `addTask(key)` | Fügt neue Aufgabe aus Input-Feld hinzu |
| `deleteTask(key, idx)` | Löscht Aufgabe + passt `done`-Indizes an |
| `saveNote(key, value)` | Speichert Notiz-Text |
| `addComment(key)` | Fügt Kommentar mit Zeitstempel hinzu |
| `deleteComment(key, idx)` | Löscht Kommentar |
| `deleteRoom(key)` | Löscht Raum mit Undo-Unterstützung (Toast mit "Rückgängig") |

---

### 8. `drag.js` — Drag-Interaktion

**Namespace:** `window.GR.drag`

Ermöglicht das Verschieben von Räumen per Maus/Touch im Edit-Mode.

| Funktion | Beschreibung |
|----------|-------------|
| `startDrag(e, key)` | Startet Drag-Vorgang (prüft auf editMode) |
| `onDragMove(e)` | Bewegt Raum visuell während Drag |
| `onDragMoveTouch(e)` | Touch-Variante von onDragMove |
| `onDragEnd()` | Beendet Drag + speichert finale Position |
| `onDragEndTouch()` | Touch-Variante von onDragEnd |
| `getPointerPos(e)` | Ermittelt Pointer-Position aus Mouse- oder Touch-Event |

**Drag-Ablauf:**

1. `startDrag` setzt `dragState` mit Startposition und Original-Koordinaten
2. `onDragMove` aktualisiert CSS-Position live (display-Koordinaten)
3. `onDragEnd` berechnet finale native Koordinaten via Scale und speichert via `St.saveData()`

---

### 9. `resize.js` — Resize-Interaktion

**Namespace:** `window.GR.resize`

Ermöglicht das Skalieren von Räumen über 8 Anfasspunkte (nw, n, ne, e, se, s, sw, w) im Edit-Mode.

| Funktion | Beschreibung |
|----------|-------------|
| `startResize(e, key, handle)` | Startet Resize-Vorgang mit Handle-Name |
| `onResizeMove(e)` | Berechnet neue Position/Größe basierend auf Handle |
| `onResizeMoveTouch(e)` | Touch-Variante von onResizeMove |
| `onResizeEnd()` | Beendet Resize + speichert finale Position/Größe |
| `onResizeEndTouch()` | Touch-Variante von onResizeEnd |
| `getPointerPos(e)` | Ermittelt Pointer-Position |

**Resize-Logik pro Handle:**

| Handle | Betroffene Werte |
|--------|-----------------|
| `e` (east) | width |
| `w` (west) | width + left |
| `s` (south) | height |
| `n` (north) | height + top |
| `ne` | width + height + top |
| `nw` | width + height + left + top |
| `se` | width + height |
| `sw` | width + height + left |

---

### 10. `place-room.js` — Neue Räume platzieren

**Namespace:** `window.GR.placeRoom`

Ermöglicht das interaktive Platzieren neuer Räume per Maus-/Touch-Draw auf dem Grundriss.

| Funktion | Beschreibung |
|----------|-------------|
| `enablePlaceNewRoom(floor)` | Aktiviert Platzierungs-Modus für eine Etage |
| `cancelPlaceNewRoom()` | Bricht Platzierungs-Modus ab |
| `removePlacePreview()` | Entfernt die gestrichelte Vorschau |
| `startPlaceDraw(e)` | Startet Zeichen-Vorgang auf dem Grundriss |
| `onPlaceDrawMove(e)` | Zeichnet Vorschau-Rechteck während Draw |
| `onPlaceDrawMoveTouch(e)` | Touch-Variante von onPlaceDrawMove |
| `onPlaceDrawEnd()` | Beendet Draw + ruft `finishPlaceDraw` auf |
| `onPlaceDrawEndTouch()` | Touch-Variante von onPlaceDrawEnd |
| `finishPlaceDraw()` | Erstellt neuen Raum aus finalen Koordinaten + öffnet Umbenennen-Dialog |
| `getPointerPos(e)` | Ermittelt Pointer-Position |

**Platzierungs-Ablauf:**

1. `enablePlaceNewRoom` → setzt `isPlacing = true`, zeigt Hinweis in Sidebar
2. `startPlaceDraw` → erfasst Startposition auf dem Bild, erzeugt gestricheltes Vorschau-`<div>`
3. `onPlaceDrawMove` → aktualisiert Vorschau live
4. `finishPlaceDraw` → wandelt Display-Pixel in native Koordinaten um, erzeugt Raum-Objekt mit `generateKey()`, speichert, feuert `roomsChanged`, öffnet Umbenennen-Modal

---

### 11. `interaction.js` — Brückenmodul

**Namespace:** `window.GR.interaction`

Rückwärtskompatibilitäts-Brücke. Alle `onclick`-Attribute im HTML verweisen auf `window.GR.interaction.*`. Dieses Modul delegiert an die spezialisierten Module `drag`, `resize` und `placeRoom`.

| Funktion | Delegiert an |
|----------|-------------|
| `startDrag(e, key)` | `drag.startDrag` |
| `onDragMove(e)` | `drag.onDragMove` |
| `onDragMoveTouch(e)` | `drag.onDragMoveTouch` |
| `onDragEnd()` | `drag.onDragEnd` |
| `onDragEndTouch()` | `drag.onDragEndTouch` |
| `startResize(e, key, handle)` | `resize.startResize` |
| `onResizeMove(e)` | `resize.onResizeMove` |
| `onResizeMoveTouch(e)` | `resize.onResizeMoveTouch` |
| `onResizeEnd()` | `resize.onResizeEnd` |
| `onResizeEndTouch()` | `resize.onResizeEndTouch` |
| `enablePlaceNewRoom(floor)` | `placeRoom.enablePlaceNewRoom` |
| `cancelPlaceNewRoom()` | `placeRoom.cancelPlaceNewRoom` |
| `startPlaceDraw(e)` | `placeRoom.startPlaceDraw` |
| `onPlaceDrawMove(e)` | `placeRoom.onPlaceDrawMove` |
| `onPlaceDrawMoveTouch(e)` | `placeRoom.onPlaceDrawMoveTouch` |
| `onPlaceDrawEnd()` | `placeRoom.onPlaceDrawEnd` |
| `onPlaceDrawEndTouch()` | `placeRoom.onPlaceDrawEndTouch` |
| `finishPlaceDraw()` | `placeRoom.finishPlaceDraw` |
| `getPointerPos(e)` | Eigene Implementierung (Fallback) |

---

### 12. `renderer.js` — Core-Renderer

**Namespace:** `window.GR.renderer`

Zeichnet die Raum-Elemente auf den Grundriss und erstellt die Resize-Handles. Reagiert auf `roomsChanged`-Events.

| Funktion | Beschreibung |
|----------|-------------|
| `render()` | Rendert alle Etagen neu + aktualisiert Badges |
| `renderFloor(floor)` | Rendert eine einzelne Etage (`'eg'|'og'`) |
| `createRoomElement(key, room, scale)` | Erzeugt DOM-Element für einen Raum (inkl. Label, Selection-Dot, Click/Drag-Handler) |
| `createResizeHandles(element, key)` | Erzeugt 8 Resize-Griffe (nw, n, ne, e, se, s, sw, w) |
| `showRoom(key)` | Selektiert Raum + rendert Detail-Panel + scrollt |
| `scrollToRoom(key)` | Scrollt im Viewport zum Raum |
| `selectRoomEdit(key)` | Selektiert Raum im Edit-Mode |

**Abonnierte Events:**

- `EVT_ROOMS_CHANGED` → `render()`
- `EVT_SELECTION_CHANGED` → `render()` + `detailRenderer.renderDetail()`

---

### 13. `detail-renderer.js` — Detail-Panel-Renderer

**Namespace:** `window.GR.detailRenderer`

Rendert das Detail-Panel in der Sidebar für einen selektierten Raum.

| Funktion | Beschreibung |
|----------|-------------|
| `renderDetail(key)` | Rendert komplette Detail-Ansicht in `#sbBody` |
| `buildDetailHeader(key, room)` | Header mit Zurück-Button, Titel, Umbenennen-Button, Key |
| `buildProgressBar(progress)` | Fortschrittsbalken für Aufgaben |
| `buildTaskSection(key, room, progress)` | Aufgabenliste mit Checkboxen + Input für neue Aufgaben (nur im Edit-Mode) |
| `buildNoteSection(key, room)` | Notiz-Textarea (Edit-Mode) oder Readonly-Text |
| `buildCommentSection(key, room)` | Kommentarliste + Input für neue Kommentare |
| `buildDeleteSection(key)` | Löschen-Button (nur im Edit-Mode) |
| `buildLastEditInfo()` | "Zuletzt bearbeitet"-Info |

---

### 14. `overview-renderer.js` — Übersichts-Renderer

**Namespace:** `window.GR.overviewRenderer`

Rendert die Übersichts-Ansicht mit Suchfunktion in der Sidebar.

| Funktion | Beschreibung |
|----------|-------------|
| `showOverview()` | Aktiviert Overview-Ansicht + rendert Inhalt |
| `renderOverviewContent()` | Baut komplette Übersicht mit Suchfeld + gefilterter Raumliste |
| `debouncedSearch()` | Sucht mit 200ms Debounce |
| `buildLastEditInfo()` | "Zuletzt bearbeitet"-Info |

---

### 15. `ui.js` — UI-Komponenten

**Namespace:** `window.GR.ui`

Toast-Benachrichtigungen, Sidebar-Steuerung, Etagen-Wechsel, Edit-Mode, Umbenennen-Modal und Intro-Dialog. Reagiert auf State-Events.

**Toast-System:**

| Funktion / Variable | Beschreibung |
|---------------------|-------------|
| `toast(message, type, duration, undoCallback?)` | Zeigt Toast-Notification an (Typen: `success`, `error`, `warning`, `info`) |
| `dismissToast(element)` | Schließt Toast mit Fade-Out-Animation |
| `executeUndo()` | Führt Undo-Callback des letzten Toasts aus |

**Sidebar:**

| Funktion | Beschreibung |
|----------|-------------|
| `toggleSidebar()` | Öffnet/schließt Sidebar |
| `openSidebar()` | Öffnet Sidebar, falls geschlossen |
| `closeSidebar()` | Schließt Sidebar, falls offen |

**Etagen-Wechsel:**

| Funktion | Beschreibung |
|----------|-------------|
| `switchFloor(floor)` | Wechselt zwischen EG (`'eg'`) und OG (`'og'`) + aktualisiert Tabs + Badges |

**Edit-Mode:**

| Funktion | Beschreibung |
|----------|-------------|
| `setEditMode(enabled)` | Aktiviert/deaktiviert Edit-Mode + aktualisiert UI-Elemente |
| `toggleEditMode()` | Schaltet Edit-Mode um |

**Modals:**

| Funktion | Beschreibung |
|----------|-------------|
| `openRenameModal(key)` | Öffnet Umbenennen-Dialog mit aktuellem Raum-Namen |
| `closeRenameModal()` | Schließt Umbenennen-Dialog |
| `confirmRename()` | Speichert neuen Namen + schließt Dialog |
| `showIntro()` | Zeigt Intro-Dialog (beim ersten Besuch) |
| `closeIntro()` | Schließt Intro-Dialog + setzt localStorage-Flag |

**Abonnierte Events:**

- `EVT_EDIT_MODE_CHANGED` → Re-rendert Detail-Panel falls nötig

---

### 16. `app.js` — App-Init & Keyboard-Shortcuts

**Namespace:** `window.GR.app`

Initialisiert die Anwendung, registriert globale Keyboard-Shortcuts und verbindet alle Module.

| Funktion / Handler | Beschreibung |
|--------------------|-------------|
| `init()` | Asynchrone Init: lädt Daten, rendert, startet Polling, prüft Intro, registriert Resize-Handler |
| Keyboard `Escape` | Bricht Platzierung ab → schließt Übersicht → deaktiviert Edit-Mode |
| Keyboard `Ctrl+E` | Togglet Edit-Mode |
| Keyboard `Ctrl+O` | Öffnet Übersicht |
| Keyboard `Ctrl+S` | Speichert + zeigt "💾 Gespeichert"-Toast |

**Init-Reihenfolge:**

1. Registriert `mousedown`/`touchstart` auf `.pw`-Elementen für Raum-Platzierung
2. `St.loadData()` → lädt Daten (Cloud → localStorage → leer)
3. `Rdr.render()` → zeichnet alle Räume auf den Grundriss
4. Erstellt Sync-Indikator (`#syncI`)
5. `Sync.startPolling()` → beginnt Cloud-Polling
6. Prüft auf ersten Besuch → zeigt Intro
7. Setzt Sidebar-Status (geschlossen)
8. Registriert `resize`-Handler für Neu-Rendering
9. Wartet auf Bild-Lade-Ereignisse für Neu-Rendering

---

## Event-Fluss (Beispiel: Raum löschen)

```
rooms.deleteRoom('raum1')
  → St.saveData()
    → St.saveToLocal()
    → Sync.updateTabBadges()
    → S.notify('roomsChanged')
      → renderer: Abonnent ruft Rdr.render() auf
  → UI.toast("gelöscht", ...) mit Undo-Callback

User klickt "Rückgängig" im Toast
  → UI.executeUndo()
    → Callback: rooms[key] = backupRoom, St.saveData()
      → wieder roomsChanged-Event → Neu-Rendering
```

---

## Ladereihenfolge im HTML

Die `<script>`-Tags in `index.html` sind strikt nach Abhängigkeiten geordnet:

1. **Basismodule**: `constants.js` → `utils.js` → `state.js`
2. **Infrastruktur**: `cloud.js` → `sync.js` → `storage.js`
3. **Domänenlogik**: `rooms.js`
4. **Interaktion**: `drag.js` → `resize.js` → `place-room.js` → `interaction.js`
5. **Rendering**: `renderer.js` → `detail-renderer.js` → `overview-renderer.js`
6. **UI**: `ui.js`
7. **App**: `app.js` (startet automatisch per `init()` am Ende)