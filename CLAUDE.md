# hdtracker – Projektregeln

Self-hosted Media-Tracker, Single-User, Deployment per Docker Compose.

## Zusammenarbeit

- Der Nutzer kann nur wenig JavaScript: jede Änderung in 1–2 Sätzen erklären (auf Deutsch).
- In kleinen Schritten arbeiten, vor größeren Aufgaben zuerst einen Plan vorlegen.
- Nach jedem MVP-Punkt stoppen und erklären, wie man testet.

## Stack

SvelteKit (adapter-node, Svelte 5 Runes), TypeScript, Drizzle ORM, better-sqlite3, Tailwind v4. Mobile-first.

- `better-sqlite3` bleibt auf v12 (v13 hat keine Prebuilt-Binaries mehr → bräuchte Compiler).
- Server-Code liegt unter `src/lib/server/` (nie im Browser-Bundle).
- DB wird lazy über `getDb()` geöffnet; Migrationen laufen automatisch beim Start (`src/hooks.server.ts`).

## Kategorien

Optisch getrennte Bereiche (keine Filter): **Filme, Serien, Anime, Spiele**.

## Design

- Immer dunkel (kein Light-Mode).
- Navigation: Leiste unten (Handy), mit Icon + Label je Bereich.
- Akzentfarbe je Bereich (neutraler Hintergrund): Filme rot, Serien blau, Anime pink, Spiele grün. Definiert in `src/lib/categories.ts`.
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
7. Settings-Seite (Region, Sprache, Auto-Status an/aus usw. in DB), plus „Bibliothek leeren“ (mit deutlicher Rückfrage)
8. Dashboard (Startseite) statt Kategorie-Kacheln. Zeigt Einträge mit Status „Geplant“ und „Schaue/Spiele ich“ (inkl. neuer Folgen laufender Serien/Anime) in zwei Bereichen, jeweils mit Datum:
   - Kürzlich erschienen (letzte 4 Wochen)
   - Demnächst

   Keine harte Trennung nach Kategorie, sondern Kategorie-Icon/Akzentfarbe pro Eintrag. Filme: Kinostart DE und Heimkino-Start DE (digital/Disc) als eigene Termine. Neue Staffel einer (teilweise) gesehenen Serie (z. B. S2 gesehen, S3 angekündigt/erschienen) landet automatisch im Dashboard. Braucht Erscheinungsdaten in der DB, die regelmäßig aktualisiert werden.

## Später (nach MVP)

- Pushover-Benachrichtigungen (z. B. neue Staffel/Folge, Release eines geplanten Titels).
- Import von Yamtrack-Exporten (CSV), damit die bestehende Bibliothek nicht manuell übertragen werden muss.
- Anime-Hybrid: AniList bleibt Quelle, zusätzlich Folgentitel/-beschreibungen von TMDB einblenden, wo eine Zuordnung AniList→TMDB bekannt ist (Community-Mapping-Listen). Watcharr nutzt übrigens nur TMDB für Anime.
- README für GitHub aufhübschen: kurz und verständlich für Dritte mit etwas Docker-Erfahrung. Was ist das (1–2 Sätze, Screenshot), `docker-compose.yml` als Codeblock, darunter erklärt, was man anpassen muss (.env-Werte, ORIGIN, Port). Keine lange README.

## Befehle

- `npm run dev` – Dev-Server (http://localhost:5173)
- `npm run check` – Typprüfung
- `npm run build` / `npm start` – Production-Build starten
- `npm run db:generate` – nach Schema-Änderung neue Migration in `drizzle/` erzeugen (mit committen!)
- `docker compose up --build` – Container lokal bauen und starten
