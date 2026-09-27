# hdtracker – Projektregeln

Self-hosted Media-Tracker, Single-User, Deployment per Docker Compose.

## Zusammenarbeit

- Antworten auf Deutsch; jede Änderung in 1–2 Sätzen ohne Fachjargon erklären.
- In kleinen Schritten arbeiten, vor größeren Aufgaben zuerst einen Plan vorlegen.
- Nach jedem MVP-Punkt stoppen und erklären, wie man testet.
- **Vor dem ersten Release (v0.1.0):** keine Übergangs-Migrationen oder Umleitungen für verworfene Zwischenstände – die Test-Instanz darf man einfach neu aufsetzen (Volume löschen). Vor `v0.1.0` alle Migrationen zu einer einzigen Initial-Migration zusammenfassen.

## Stack

SvelteKit (adapter-node, Svelte 5 Runes), TypeScript, Drizzle ORM, better-sqlite3, Tailwind v4. Mobile-first.

- `better-sqlite3` bleibt auf v12 (v13 hat keine Prebuilt-Binaries mehr → bräuchte Compiler).
- Server-Code liegt unter `src/lib/server/` (nie im Browser-Bundle).
- DB wird lazy über `getDb()` geöffnet; Migrationen laufen automatisch beim Start (`src/hooks.server.ts`).
- Code, URLs und DB-Werte auf Englisch (`/movies`, `/series`, `/anime`, `/games`; Kategorie-Keys ebenso).
- Oberfläche zweisprachig (Deutsch/Englisch): **alle** sichtbaren Texte in `src/lib/i18n/de.ts` + `en.ts` (gleiche Struktur, TypeScript prüft das). Im Browser `m.xyz` aus `$lib/i18n/index.svelte`, auf dem Server `serverMessages()`. Server liefert Werte (Minuten, ISO-Datum), formatiert wird in der Oberfläche.
- Start über `start.js`: `ORIGIN` darf mehrere Adressen (kommagetrennt) enthalten; eigene Origin-Prüfung in `hooks.server.ts` ersetzt SvelteKits CSRF-Check.

## Kategorien

Optisch getrennte Bereiche (keine Filter): **Filme, Serien, Anime, Spiele**.

## Design

- Immer dunkel (kein Light-Mode).
- Hover-Effekte (nur Maus) für alles Klickbare; Poster: leichter Zoom, Rahmen + Titel in Akzentfarbe.
- Standard für neue Installationen: Oberfläche Englisch, Inhalte `en-US`, Region `US` (umstellbar in den Einstellungen).
- Navigation: Leiste unten (Handy), mit Icon + Label je Bereich.
- Akzentfarbe je Bereich (neutraler Hintergrund): Filme rot, Serien blau, Anime pink, Spiele grün. Definiert in `src/lib/categories.ts`.
- Logo: Couch von vorne mit zwei Personen (links Schneidersitz/pink, rechts angewinkeltes Knie/blau). `src/lib/components/Logo.svelte`, auch als Favicon.
- Schriftzug „hdtracker“: Schrift Outfit (self-hosted via `@fontsource/outfit`, Tailwind-Klasse `font-brand`), „hd“ mit Verlauf pink→blau. `src/lib/components/Brand.svelte`.
- Poster-Raster für Suche und Bibliothek, aber nicht zu minimalistisch (kein reines Watcharr-Raster): Bibliothek braucht sichtbare Unterteilung in Abschnitte.

## Datenquellen

- TMDB: Filme, Serien inkl. Staffeln/Episoden, Watch Providers (Region DE). Attribution TMDB + JustWatch anzeigen.
- IGDB via Twitch OAuth: Spiele.
- AniList GraphQL: Anime.

## Config

- Nur Secrets in `.env`: `SECRET`, `TMDB_API_TOKEN` (Read Access Token, als Bearer-Header), `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`, `TZ`, plus `ORIGIN` (Pflicht: exakte Adresse, über die die App aufgerufen wird; ohne ORIGIN nimmt adapter-node https an und Formulare scheitern mit 403). `.env` ist in `.gitignore`.
- Alle anderen Einstellungen (Region, Sprache, …) liegen in der DB (Tabelle `settings`), editierbar über die Settings-Seite.
- Persistente Daten unter `DATA_DIR` (Container: `/data`, lokal: `./data`).

## MVP

1. Scaffold, Dockerfile (multi-stage, ein Container, Daten unter /data), Migrationen beim Start, `/health`, docker-compose.yml, .env.example, GitHub Action (multi-arch amd64/arm64 → GHCR bei Tag `v*`) ✅
2. First-Run-Wizard (Admin anlegen) + Login ✅
3. Suche pro Kategorie ✅
4. ✅ Bibliothek pro Kategorie, Kategorie-Seite unterteilt in Abschnitte nach Status. Abschnitte alphabetisch sortiert (deutsch, `localeCompare('de')`); „Gesehen/Durchgespielt“ und „Abgebrochen“ standardmäßig zugeklappt. Intern 5 feste Status, Label je Kategorie (siehe `src/lib/status.ts`):

   | intern    | Serien / Anime | Spiele        | Filme       |
   | --------- | -------------- | ------------- | ----------- |
   | active    | Schaue ich     | Spiele ich    | –           |
   | paused    | Pausiert       | Pausiert      | –           |
   | planned   | Geplant        | Geplant       | Geplant     |
   | completed | Gesehen        | Durchgespielt | Gesehen     |
   | dropped   | Abgebrochen    | Abgebrochen   | Abgebrochen |

5. ✅ Serien/Anime: Staffeln und Episoden sehen; ganze Serie, einzelne Staffel oder einzelne Episode als gesehen markieren. Progress pro Staffel und Episode.
   - Serien (TMDB): Staffeln mit Folgenliste (Titel, Datum). Specials (Staffel 0) unten, zählen nicht zum Fortschritt.
   - Anime (AniList): keine Staffeln/Folgentitel verfügbar → Raster mit Folgennummern. Jede Anime-Staffel ist ein eigener Eintrag.
   - Auto-Status: erste Folge abgehakt → „Schaue ich“; alle Folgen einer beendeten Serie gesehen → „Gesehen“. Später in Settings abschaltbar (Punkt 7).
6. ✅ Detailseite mit Streaming-Anbietern DE (Flatrate/Leihen/Kaufen), Attribution TMDB + JustWatch. Plus „Ähnliche Titel“ (TMDB recommendations, AniList recommendations, IGDB similar_games).
7. Settings-Seite (Region, Sprache, Auto-Status an/aus usw. in DB), plus „Bibliothek leeren“ (mit deutlicher Rückfrage). Extras: Passwort ändern, alle anderen Geräte abmelden. Anime-Titel: Englisch als Haupttitel, japanischer (Romaji-)Titel abgesetzt dazu.
8. Dashboard (Startseite) statt Kategorie-Kacheln. Zeigt Einträge mit Status „Geplant“ und „Schaue/Spiele ich“ (inkl. neuer Folgen laufender Serien/Anime) in zwei Bereichen, jeweils mit Datum:
   - Kürzlich erschienen (letzte 4 Wochen)
   - Demnächst

   Keine harte Trennung nach Kategorie, sondern Kategorie-Icon/Akzentfarbe pro Eintrag. Filme: Kinostart DE und Heimkino-Start DE (digital/Disc) als eigene Termine. Neue Staffel einer (teilweise) gesehenen Serie (z. B. S2 gesehen, S3 angekündigt/erschienen) landet automatisch im Dashboard. Braucht Erscheinungsdaten in der DB, die regelmäßig aktualisiert werden.

## Später (nach MVP)

- Pushover-Benachrichtigungen (z. B. neue Staffel/Folge, Release eines geplanten Titels).
- Import von Yamtrack-Exporten (CSV), damit die bestehende Bibliothek nicht manuell übertragen werden muss.
- Anime-Hybrid: AniList bleibt Quelle, zusätzlich Folgentitel/-beschreibungen von TMDB einblenden, wo eine Zuordnung AniList→TMDB bekannt ist (Community-Mapping-Listen). Watcharr nutzt übrigens nur TMDB für Anime.
- Streaming-Übersicht: alle geplanten Titel nach verfügbaren Streaming-Anbietern gruppiert (z. B. „Netflix“ antippen → alles Geplante, was dort läuft). Anbieter ohne Treffer ausblenden. Offen: eigener Menüpunkt oder Teil des Dashboards.

## Befehle

- `npm run dev` – Dev-Server (http://localhost:5173)
- `npm run check` – Typprüfung
- `npm run build` / `npm start` – Production-Build starten
- `npm run db:generate` – nach Schema-Änderung neue Migration in `drizzle/` erzeugen (mit committen!)
- `docker compose up -d` – veröffentlichtes Image von GHCR starten (wie auf einem Server)
- `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build` – Image lokal aus dem Quellcode bauen und starten
- Release: Tag `vX.Y.Z` pushen → GitHub Action baut Multi-Arch-Image nach GHCR
