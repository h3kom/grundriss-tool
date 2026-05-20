# Grundriss-Tool

Browserbasierter Grundriss-Editor zum Planen von Gebaeuden, Definieren von Raeumen und Verwalten von Projekten. UI komplett auf Deutsch.

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JavaScript (kein Framework, kein Bundler)
- **State Management:** Custom Pub/Sub in `js/state.js` (window.GR Namespace, IIFE-Pattern)
- **Backend:** Supabase (Auth, PostgreSQL, Realtime/Presentity) via CDN
- **Persistence:** localStorage (offline) + Supabase Cloud Sync
- **Deployment:** GitHub Pages via GitHub Actions (`main` → `/prod/`, `dev` → `/dev/`)
- **Build:** Kein Build-Step - statische Website

## Architektur

- Alle JS-Module attachen an `window.GR` via IIFEs
- Skripte werden in spezifischer Reihenfolge in `index.html` geladen
- Drei Views: Auth (Login), Dashboard (Projektliste), Editor (Grundriss)
- Raeume: drag, resize, snap-to-grid (8px), Undo (20 Level)
- Raumtypen: Buero, Besprechung, Flur, Kueche, WC/Bad, Lager, Serverraum, Empfang, Pausenraum, Sonstige

## Agenten-Setup

### Projektleiter (zentrale Steuerung)

`@projektleiter` ist der Orchestrator. Er analysiert Anfragen, zerlegt sie in Teilaufgaben, verteilt sie an die Fach-Agenten und laesst sie miteinander interagieren.

```
@projektleiter baue ein Maengelmanagement-Feature
```

Er nutzt TeamCreate, Tasks, und SendMessage um Agenten parallel oder sequentiell arbeiten zu lassen, und fuehrt die Ergebnisse zusammen.

### Fach-Agenten (werden vom Projektleiter gesteuert)

| Agent | Mission | Aufruf (einzeln) |
|-------|---------|--------|
| `@product-construction` | Reale Baustellenprobleme loesen, Feature-Priorisierung, Baupraxis | `"@product-construction priorisiere die Features fuer Mangelmanagement"` |
| `@ux-cx` | Maximal intuitiv, Mobile-first, minimale Klicks | `"@ux-cx optimiere den User Flow fuer Mangelerfassung"` |
| `@frontend-plan` | Grundriss-Rendering, Annotationen, Zooming, Performance | `"@frontend-plan implementiere Marker-Annotations auf dem Plan"` |
| `@backend-realtime` | Skalierbare Echtzeit-Architektur, Sync, Permissions | `"@backend-realtime entwerfe das Datenmodell fuer Kollaboration"` |
| `@lean-code` | Code einfach halten, Refactoring, Standards, technische Qualitaet | `"@lean-code refactore state.js"` |

### Workflow-Beispiel

1. User: `@projektleiter baue Maengelmanagement`
2. Projektleiter erstellt Team + Tasks
3. Delegiert an @product-construction (Workflow definieren)
4. @product-construction liefert Ergebnis → Projektleiter reicht es an @ux-cx (Flow designen)
5. @ux-cx liefert Flow → Projektleiter reicht es an @frontend-plan + @backend-realtime (parallel implementieren)
6. @lean-code reviewed das Ergebnis
7. Projektleiter fuehrt zusammen und meldet an User

## Konventionen

- window.GR Namespace, IIFE-Pattern
- Keine Frameworks, kein npm, kein Build-Step
- UI-Sprache: Deutsch
- Prettier fuer Code-Formatierung
- Supabase Credentials: `config.local.js` (gitignored) oder GitHub Secrets (CI/CD)

## Key Dateien

- `js/app.js` - Haupteinstiegspunkt (893 Zeilen)
- `js/ui.js` - UI-Orchestrierung (580 Zeilen)
- `js/state.js` - Zentrales State Management mit Pub/Sub + Undo
- `js/cloud.js` - Supabase Cloud Layer
- `js/rooms.js` - Raum CRUD
- `js/renderer.js` - Raum-Rendering auf Grundriss-Bildern
- `js/drag.js` / `js/resize.js` - Drag & Drop + Resize
- `js/collaboration.js` - Echtzeit-Zusammenarbeit via Supabase
