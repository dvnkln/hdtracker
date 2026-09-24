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
4. Bibliothek pro Kategorie, Kategorie-Seite unterteilt in Abschnitte nach Status. Intern 5 feste Status, Label je Kategorie:
   | intern    | Serien / Anime | Spiele        | Filme       |
   | --------- | -------------- | ------------- | ----------- |
   | active    | Schaue ich     | Spiele ich    | –           |
   | paused    | Pausiert       | Pausiert      | –           |
   | planned   | Geplant        | Geplant       | Geplant     |
   | completed | Gesehen        | Durchgespielt | Gesehen     |
   | dropped   | Abgebrochen    | Abgebrochen   | Abgebrochen |
5. Serien/Anime: Staffeln, Episoden, Progress pro Staffel und Episode
6. Detailseite mit Streaming-Anbietern DE (Flatrate/Leihen/Kaufen), Attribution TMDB + JustWatch
7. Settings-Seite (Region, Sprache usw. in DB)
8. Dashboard (Startseite) statt Kategorie-Kacheln, zeigt Einträge mit Status „Geplant“ und „Schaue/Spiele ich“ (inkl. neuer Folgen laufender Serien/Anime) in zwei Bereichen, jeweils mit Datum. Filme: Kinostart DE und Heimkino-Start DE (digital/Disc) als eigene Termine.
   - Kürzlich erschienen (letzte 4 Wochen)
   - Demnächst
     Keine harte Trennung nach Kategorie, sondern Kategorie-Icon/Akzentfarbe pro Eintrag. Braucht Erscheinungsdaten in der DB, die regelmäßig aktualisiert werden.

## Befehle

- `npm run dev` – Dev-Server (http://localhost:5173)
- `npm run check` – Typprüfung
- `npm run build` / `npm start` – Production-Build starten
- `npm run db:generate` – nach Schema-Änderung neue Migration in `drizzle/` erzeugen (mit committen!)
- `docker compose up --build` – Container lokal bauen und starten
