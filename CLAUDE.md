# hdtracker – Projektregeln

Self-hosted Media-Tracker, Single-User, Deployment per Docker Compose.

## Zusammenarbeit

- Antworten auf Deutsch; jede Änderung in 1–2 Sätzen ohne Fachjargon erklären.
- In kleinen Schritten arbeiten, vor größeren Aufgaben zuerst einen Plan vorlegen.
- Nach jedem MVP-Punkt stoppen und erklären, wie man testet.
- **Seit v0.1.0 veröffentlicht:** Datenbank-Änderungen nur noch über neue Migrationen (`npm run db:generate`), die bestehende Daten erhalten – nie alte Migrationen ändern oder löschen, kein „Volume neu anlegen“ mehr. Alle bis v0.1.0 sind in `drizzle/0000_init.sql` zusammengefasst.

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

- In den Einstellungen ein-/ausblendbar (Setting `categories`, mindestens einer bleibt; `enabledCategories()` in `src/lib/server/settings.ts`). Ausgeblendet = weg aus Navigation, Suche, Dashboard; Direktaufruf leitet aufs Dashboard; Daten bleiben, aber kein Metadaten-Abgleich (Nachladen + nächtliche Aufgabe überspringen den Bereich). Gefahrenzone zeigt weiter alle Bereiche. Import fragt bei Titeln ausgeblendeter Bereiche nach (überspringen / trotzdem importieren / einblenden).

## Design

- Themes (Einstellungen → eigener persönlicher Bereich „Design“, `/settings/appearance`; Standard „System“ = folgt dem Gerät; „Dunkel“ ist das ursprüngliche Schema; dazu Hell, die bekannten Paletten Tokyo Night/Dracula/SynthWave '84 – im Reiter „Über“ genannt –, Cyberpunk (nach den Menüs des Spiels: fast alles in Korallenrot auf Schwarz mit rotem Schein, Cyan für Nebensächliches, Gelb nur als Tupfer; eckig, Knöpfe/Karten mit abgeschnittener Ecke, Versalien) sowie Retro 95 (erhabene Knöpfe/Fenster, vertiefte Felder, blaue Titelleiste), Terminal (grüner Leuchtschirm nach dem Pip-Boy aus Fallout 3: Leuchten, Bildzeilen, hellere Mitte) und „Brotkasten“/„Breadbin“ (Schlüssel `c64`: Hellblau auf Dunkelblau, Versalien, am PC mit Bildschirmrahmen) mit eckigen Kanten und eigener, lokal vorhandener Schrift). Namen der Themes vermeiden Marken (Spitznamen wie „Brotkasten“, Gattungsnamen wie „Cyberpunk“, „Terminal“). Vorlagen für solche Themes als Bild ansehen (Screenshot herunterladen und mit dem Lese-Werkzeug öffnen), nicht aus dem Gedächtnis bauen. Für solche Extras gibt es wenige Haken-Klassen, die in normalen Themes nichts bewirken: `ui-btn` an allem, was ein Knopf ist (Knopf-Konstanten in `SubmitButton.svelte`, Status-Kacheln, Folgen-Kacheln, Knöpfe der Detailseite, Theme-Kacheln), zusätzlich `ui-keep`, wenn der Knopf seine eigene Farbe behalten soll (aktueller Status, gesehene Folge); `ui-card` an Karten (`ui.card` in `src/lib/ui.ts`, Folgen-Karten, Hinweisboxen) und `data-chrome="header"`. **Neue Knöpfe und Karten bekommen diese Klassen**, sonst fallen sie in Retro 95 und Cyberpunk aus dem Rahmen; Hauptknöpfe tragen zusätzlich `ui-primary`. Damit bekannte Themes erkennbar sind, kann ein Theme neben der Grauskala Erkennungsfarben setzen: `--ui-heading` (Überschriften `h1`–`h3`, optional `--ui-heading-glow`), `--ui-primary`/`--ui-on-primary` (Hauptknopf), `--ui-link` (unterstrichene Textlinks) sowie die Statusfarben (`--color-emerald-*`, `--color-red-*`, `--color-amber-400`); ohne diese Angaben gilt die Grauskala. Echte Überschriften deshalb als `h1`–`h3` auszeichnen; runde Elemente (`rounded-full`) folgen der Variable `--round`. „System“ folgt dem Gerät: Werte von Dunkel, per `@media (prefers-color-scheme: light)` die von Hell – dieser Block ist ein Duplikat der hellen Werte und muss mit ihnen gepflegt werden. Jedes Theme muss bei neuen Oberflächenteilen mitgeprüft werden (Test: alle Themes durchschalten, Kontrast messen). Technik: Ein Theme tauscht die Grauskala aus, mit der die ganze Oberfläche gezeichnet ist – `[data-theme='…']`-Blöcke in `src/routes/layout.css` belegen `--color-zinc-*` neu (bei Bedarf auch `color-scheme`, einzelne Statusfarben, Eckenradien, Schrift); Liste in `src/lib/themes.ts`. **Neue Oberflächenteile deshalb nur über die `zinc`-Klassen einfärben, keine festen Grau-/Hex-Werte**; die Akzentfarben der vier Bereiche sind in jedem Theme dieselben Farben (`--accent-movies` usw. in `layout.css`; helle Themes nutzen nur eine dunklere Stufe für die Lesbarkeit) – in Komponenten per CSS verwenden (`style`), nicht als SVG-Attribut. Theme-Extras (z. B. dunkelblaue Kopfzeile bei Retro 95 über `data-chrome="header"`) stehen als wenige Regeln im Theme-Block, nie in den Seiten. Neues Theme = Eintrag in `themes.ts` + Block in `layout.css` + Name in `de.ts`/`en.ts`. Das Attribut wirkt auf jedem Element (Vorschau-Kacheln: `ThemePreview.svelte`). Welches Theme gilt, entscheidet `themeFor()` in `src/lib/server/theme.ts` und wird in `hooks.server.ts` direkt ins HTML geschrieben (kein Aufblitzen): angemeldet → persönliche Einstellung `theme` (wandert bei Mehrbenutzer zum Benutzer); abgemeldet (Login-Seite) → Cookie `hdtracker_theme` des Geräts (nur der Theme-Name, gesetzt beim Speichern und bei der Anmeldung) → sonst Theme der Installation (später Admin-Standard).
- Hover-Effekte (nur Maus) für alles Klickbare; Poster: Rahmen + Titel in Akzentfarbe, Bild leicht abgedunkelt, kein Zoom; kurze Übergänge (~100 ms), damit es direkt reagiert.
- Standard für neue Installationen: Oberfläche Englisch, Inhalte `en-US`, Region `US` (umstellbar in den Einstellungen).
- Navigation: Leiste unten (Handy), mit Icon + Label je Bereich.
- Breite: Kopfzeile + Poster-Seiten nutzen große Bildschirme (Utility `app-width` in `layout.css`: max. 140rem, am PC immer ~6,5 % Rand je Seite ≈ ¾ Poster; Poster-Raster `auto-fill`, am Handy 3 Spalten). Abschnitte der Bibliothek ohne Trennlinie. Detailseite `max-w-screen-xl`, Einstellungen `max-w-screen-md`; Dashboard und Leiste unten bleiben schmal.
- Gemeinsame Mittelachse am PC: Suchfeld (Kopfzeile als 3-Spalten-Raster mit gleich breiten Außenspalten), Inhalt und Leiste unten liegen mittig. Einstellungen ab xl: Inhalt mittig, Seitenleiste direkt links daneben.
- Suche in der Kopfzeile (bleibt beim Scrollen oben): am PC Suchfeld mit Icon des aktiven Bereichs (Klick öffnet Menü zum Umschalten; Taste `/` fokussiert), am Handy Lupe → Suchleiste gleitet von oben herein. Bereich = aktuelle Kategorie-Seite, sonst der zuletzt benutzte.
- Akzentfarbe je Bereich (neutraler Hintergrund): Filme rot, Serien blau, Anime pink, Spiele grün. Definiert in `src/lib/categories.ts`.
- Als App installierbar (PWA): `static/manifest.webmanifest`, Icons in `static/icons/` + `static/apple-touch-icon.png` (aus dem Logo erzeugt, dunkler Hintergrund mit Pink/Blau-Schimmer), Safari-Meta-Tags in `src/app.html`, `src/service-worker.ts` cacht nur App-Dateien (keine Seiten/Daten). Installation im Browser nur über HTTPS.
- Logo: Couch von vorne mit zwei Personen (links Schneidersitz/pink, rechts angewinkeltes Knie/blau). `src/lib/components/Logo.svelte`, auch als Favicon.
- Schriftzug „hdtracker“: Schrift Outfit (self-hosted via `@fontsource/outfit`, Tailwind-Klasse `font-brand`), „hd“ mit Verlauf pink→blau. `src/lib/components/Brand.svelte`.
- Poster-Raster für Suche und Bibliothek, aber nicht zu minimalistisch (kein reines Watcharr-Raster): Bibliothek braucht sichtbare Unterteilung in Abschnitte.

## Einstellungen (Aufbau)

- PC: Seitenleiste links, Handy: `/settings` zeigt eine gruppierte Liste, jeder Bereich hat „← Einstellungen“. Bereiche in `src/lib/settingsNav.ts` (neuer Bereich = eine Zeile + Seite unter `src/routes/settings/`). Überschrift „Einstellungen“ nur `sr-only`.
- **Persönlich** (je Benutzer): Allgemein (`/settings/general`: Oberflächensprache, Anime-Titel, Spoiler-Schutz, Auto-Status, Bereiche) · Design (`/appearance`: Farbschema) · Konto (`/account`: Benutzername, Passwort, andere Geräte) · Daten (`/data`: Import, später Export, Bibliothek leeren) · später Benachrichtigungen.
- **Verwaltung** (ganze Installation, Route-Gruppe `(admin)`): Server (`/server`: Inhaltssprache, Region) · Wartung (`/maintenance`) · später Benutzer. Geschützt über `isAdmin()`/`requireAdmin()` in `src/lib/server/auth.ts` (heute immer true, einziges Konto = Admin); Form-Actions und Endpunkte der Admin-Seiten rufen `requireAdmin` selbst auf.
- **Über** für alle, zuletzt.

## Datenquellen

- TMDB: Filme, Serien inkl. Staffeln/Episoden, Watch Providers (Region DE). Attribution TMDB + JustWatch: im Reiter „Über“ (`/settings/about`, Version verlinkt auf die Release-Notes, GitHub, Issues, Lizenz) und JustWatch zusätzlich bei den Streaming-Angeboten der Detailseite.
- IGDB via Twitch OAuth: Spiele.
- AniList GraphQL: Anime.
- Wikidata: Direktlinks zu Titeln bei Streaming-Diensten (Detailseite Filme/Serien); im Reiter „Über“ mit aufgeführt.

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

   Noch nicht erschienene Titel (Spalte `release_date` = erstes Erscheinen irgendwo, in der Zukunft oder leer) lassen nur „Geplant“ zu: Regel in `isReleased()`/`allowedStatuses()` (`src/lib/status.ts`), geprüft im Auswahl-Fenster (`ItemSheet.svelte`) und in der `save`-Aktion. Gesperrte Kacheln sind ausgegraut; Antippen lässt Jahr/„TBA“ rot aufleuchten, ein echter Doppeltipp (~0,4 s) setzt den Status trotzdem (`force=1`, Ausweg bei falschen Daten). Das Datum wird nur gespeichert – angezeigt wird weiter nur das Jahr. Titel, deren Details noch laden, sind nicht gesperrt; bestehende unlogische Status werden nicht automatisch geändert.

   Spiele im Early Access (IGDB `release_dates` mit Art, ausgewertet in `releaseState()` in `providers/igdb.ts`): Es zählt immer nur der aktuelle Stand. Solange nur Early Access verfügbar ist: „· Early Access“ neben dem Jahr (Spalte `early_access`), Detailseite „Early Access“ + „Release“ (nur mit Datum), Dashboard-Termine `earlyAccess`/`fullRelease`. Ist die Vollversion erschienen, taucht Early Access nirgends mehr auf. Begriffe für Spiele überall nur „Early Access“ und „Release“ (= fertige Version, egal ob vorher Early Access; die Arten `release` und `fullRelease` heißen bei Spielen beide „Release“), Filme behalten „Erscheinungstermin“.

5. ✅ Serien/Anime: Staffeln und Episoden sehen; ganze Serie, einzelne Staffel oder einzelne Episode als gesehen markieren. Progress pro Staffel und Episode.
   - Serien (TMDB): Staffeln mit Folgenliste (Titel, Datum). Specials (Staffel 0) unten, zählen nicht zum Fortschritt.
   - Anime (AniList): keine Staffeln/Folgentitel verfügbar → Raster mit Folgennummern. Jede Anime-Staffel ist ein eigener Eintrag.
   - Auto-Status: erste Folge abgehakt → „Schaue ich“; alle Folgen einer beendeten Serie gesehen → „Gesehen“. Später in Settings abschaltbar (Punkt 7).
6. ✅ Detailseite mit Streaming-Anbietern DE (Flatrate/Leihen/Kaufen), Attribution TMDB + JustWatch. Plus „Ähnliche Titel“ (TMDB recommendations, AniList recommendations, IGDB similar_games).
7. ✅ Einstellungen – in drei Etappen, nach jeder kurz berichten/testen lassen:
   - **A ✅ Struktur:** englische URLs/Keys, mehrere ORIGINs, Oberfläche zweisprachig (i18n), Hover-Effekte, Standard Englisch.
   - **B ✅ Seite `/settings`** (Zahnrad oben rechts neben Abmelden), Werte in Tabelle `settings`:
     - Darstellung: Sprache der Oberfläche (de/en), Sprache der Inhalte (TMDB), Region als Liste mit Ländernamen (Regionen von TMDB `/watch/providers/regions`, Namen via `Intl.DisplayNames`), Anime-Titel (Englisch als Haupttitel + Romaji darunter; Schalter für umgekehrt), Spoiler-Schutz (Standard an: Bilder + Beschreibungen ungesehener Folgen unscharf).
     - Verhalten: Auto-Status an/aus (`episodes.ts` muss das respektieren).
     - Konto: Passwort ändern (altes + 2× neues), alle anderen Geräte abmelden.
     - Gefahrenzone: Bibliothek leeren (pro Kategorie oder alles), Bestätigung durch Eintippen von „LÖSCHEN“/„DELETE“.
     - Nach Speichern Bestätigung „Gespeichert ✓“. Alle Texte in de.ts + en.ts.
   - **C ✅ Hintergrundaufgaben + Wartung** (Reiter „Wartung“ unter `/settings/maintenance`, Backups standardmäßig aus): Zeitplaner in der App (kein Cron), letzte Ausführung in DB, holt Verpasstes nach Neustart nach. Aufgaben: DB-Backup nach `/data/backups`, DB-Pflege (optimize/VACUUM), abgelaufene Sessions löschen, In-Memory-Cache aufräumen. In den Einstellungen feintunbar: Backups an/aus, Anzahl behalten, wie oft; pro Aufgabe wann/wie oft; „Jetzt ausführen“ (mit Hinweis auf API-Limits); Backups zum Herunterladen. Metadaten-Aktualisierung kommt erst mit Punkt 8.
8. ✅ Dashboard (Startseite) statt Kategorie-Kacheln. Zeigt Einträge mit Status „Geplant“ und „Schaue/Spiele ich“ (inkl. neuer Folgen laufender Serien/Anime) in zwei Bereichen, jeweils mit Datum:
   - Kürzlich erschienen (letzte 4 Wochen)
   - Demnächst

   Jede der beiden Listen lässt sich über den Kalender-Pfeil-Knopf in ihrer Überschrift umdrehen (Standard: Neueste zuerst / Nächste zuerst; „Datum offen“ bleibt am Ende). Gemerkt als persönliche Einstellung `dashboardRecent`/`dashboardUpcoming` (Tabelle `settings`, wandert bei Mehrbenutzer zum Benutzer – nicht im Browser speichern); Sortierung in `src/lib/dashboardOrder.ts`, Form-Aktion `order` der Startseite.

   Keine harte Trennung nach Kategorie, sondern Kategorie-Icon/Akzentfarbe pro Eintrag. Filme: Kinostart DE und Heimkino-Start DE (digital/Disc) als eigene Termine. Neue Staffel einer (teilweise) gesehenen Serie (z. B. S2 gesehen, S3 angekündigt/erschienen) landet automatisch im Dashboard. Braucht Erscheinungsdaten in der DB, die regelmäßig aktualisiert werden.

9. ✅ Import von Yamtrack-Exporten (CSV), damit die bestehende Bibliothek nicht manuell übertragen werden muss.
   - Reiter „Import“ unter `/settings/import`. Filme/Serien (TMDB), Spiele (IGDB) direkt über die ID; Anime kommen als MyAnimeList-IDs und werden über AniList (`idMal_in`) zugeordnet.
   - Serien: gesehene Folgen aus den `episode`-Zeilen, Anime: Folgen 1…`progress`. Titel, die schon in der Bibliothek sind, bleiben unverändert; doppelte Zeilen im Export werden ignoriert; `manual`-Einträge und andere Medientypen werden mit Grund übersprungen.
   - Poster, Beschreibung und Termine werden danach im Hintergrund nachgeladen (gebremst wegen API-Limits).

## Roadmap

- Was bis v1.0.0 geplant ist, steht öffentlich in `ROADMAP.md` (Englisch, Checkliste, aus Nutzersicht). Auf „was steht noch an?“ daraus antworten.
- Pflege: neue Idee des Users für später → dort eintragen; umgesetzt → abhaken (`- [x]`); abgehakte Punkte bleiben bis zum Release von v1.0.0 stehen (erst dann entfernen, nicht bei Zwischen-Releases). Kein GitHub-Milestone – bewusst, damit der User nichts von Hand pflegen muss.
- Technische Notizen zu den Punkten (nicht in der Roadmap):
  - Benachrichtigungen (Pushover): persönlicher Bereich „Benachrichtigungen“ in den Einstellungen.
  - Streaming-Übersicht: Anbieter ohne Treffer ausblenden. Offen: eigener Menüpunkt oder Teil des Dashboards.
  - Anime-Hybrid: AniList bleibt Quelle, Zuordnung AniList→TMDB über Community-Mapping-Listen. Watcharr nutzt übrigens nur TMDB für Anime.
  - Mehrbenutzer: Bereich „Verwaltung → Benutzer“; `isAdmin()` wird dann eine echte Prüfung, persönliche Einstellungen/Bibliothek je Benutzer. Details noch offen.
- Nicht geplant: eingebautes HTTPS – das Projekt geht von einem Reverse Proxy aus (Wiki: „HTTPS and installing as an app“).

## Dokumentation (Wiki)

- Anleitungen für Nutzer stehen im GitHub-Wiki (eigenes Git-Repo, Arbeitskopie: `/opt/projects/hdtracker.wiki`, Englisch): Installation, HTTPS + als App installieren, Updating, Backups and restore, Import from Yamtrack, Export, Privacy and security, Reset your password, Development, `_Sidebar`. Die README bleibt Schaufenster (Wordmark + Mockup, direkt darunter die Links ins Wiki, dann Features – nur was hdtracker auszeichnet, keine Selbstverständlichkeiten –, Screenshots, kurzer Quick start, Datenquellen; kein Inhaltsverzeichnis, kein Development-Abschnitt; **Built with AI und License bleiben in der README**).
- Ändert sich etwas an Installation, `.env`, Update, Backup, Import oder Rettungswegen: Wiki-Seite mit anpassen und pushen (Wiki-Commits wie Code-Commits erst nach Okay).
- Datenschutz: Die Wiki-Seite „Privacy and security“ listet **jede** Verbindung nach außen (Server: TMDB, Twitch/IGDB, AniList, Wikidata und deren Bildserver; Browser: nichts – er spricht nur mit hdtracker) und wie Daten gespeichert sind. Kommt eine Verbindung dazu oder ändert sich etwas daran (neuer Dienst, neue Bildquelle, Pushover, Cookies/Speicherung, Login-Schutz), die Seite mit anpassen. Keine Telemetrie, keine Update-Prüfung, keine fremden Skripte/Schriften einbauen.
- Bilder: Der Browser lädt Bilder nie direkt von den Diensten. Jede Bild-Adresse geht in der Oberfläche durch `img()` (`src/lib/images.ts`) → `/img?u=…` (`src/routes/img/+server.ts`, nur angemeldet); der Server holt das Bild (`src/lib/server/images.ts`), prüft per Dateianfang, dass es ein Bild ist, und speichert es unter `DATA_DIR/images`. Fristen je Quelle in der Tabelle `SOURCES` dort (TMDB: max. 6 Monate laut Nutzungsbedingungen; IGDB/AniList ohne Angabe → gleich behandelt): Auffrischen 1 Monat vor der Frist (bei kurzer Frist 7 Tage davor; AniList alle 7 Tage, weil dort eine Adresse ein anderes Bild bekommen kann), schlägt das fehl, gilt die alte Kopie bis 5 Tage vor der Frist. Neues Poster bei TMDB/IGDB = neue Adresse → kommt mit der nächsten Metadaten-Aktualisierung. `refreshItem()` hält die Poster der Bibliothek vorrätig. Die nicht abschaltbare Aufgabe `images` („Bilder aufräumen“, `required` in `scheduler.ts`) löscht, was 30 Tage nicht angefragt wurde oder über der Frist liegt. Erlaubte Quellen stehen als feste Liste in `src/lib/images.ts` (neue Bildquelle = dort und in `SOURCES` eintragen, nie beliebige Adressen zulassen). Wartungsseite zeigt belegten Speicher (Bilder, Datenbank, Backups) und nach einem Lauf den freigegebenen (`tasks.last_freed_bytes`). In der DB bleiben die Original-Adressen. Die Kopfzeile CSP `img-src 'self' data:` (`vite.config.ts`) verhindert direkte Bilder.
- Vorladen: Für jeden Bibliothekstitel hält `refreshItem()` (`src/lib/server/releases.ts`) alles vor, was die Detailseite zeigt – Details und Folgenliste als JSON in der Tabelle `item_details` (`src/lib/server/itemDetails.ts`), dazu Poster, Banner und Anbieter-Logos im Bild-Speicher (≈ 0,2 MB je Titel). Folgenbilder und die Poster der „Ähnlichen Titel“ werden bewusst nicht vorgeladen (viel Platz, liegen weiter unten auf der Seite) – sie kommen beim Ansehen und bleiben dann gespeichert. Läuft direkt nach Hinzufügen/Import (Warteschlange), jede Nacht (Aufgabe `metadata`, ohne ausgeblendete Bereiche; Rhythmus je Titel siehe „Sparsam abfragen“) und nach Änderung von Inhaltssprache/Region. Regel „Bibliothek = vorgehalten, sonst live“ steht an einer Stelle: `detailsFor()` in `itemDetails.ts` (Detailseite + Folgen-Aktionen); Stand älter als 1 h wird gezeigt und im Hintergrund aufgefrischt (`refreshSoon()`). „Ausgestrahlt“ wird beim Lesen anhand des Datums nachgezogen. Ausgeblendete Bereiche: gespeicherte Details werden beim nächtlichen Lauf gelöscht und nach dem Einblenden neu geladen. Anime: alles (Folgen, Termine, Detailseite) kommt aus **einer** AniList-Abfrage (`ANIME_QUERY`/`fetchAnime()` in `providers/anilist.ts`, für einen oder bis zu 25 Titel; AniList erlaubt nur ~30 Abfragen/Minute) – neue Felder dort ergänzen, keine zweite Abfrage je Titel einführen. „Jetzt ausführen“ wartet höchstens 10 s, lange Läufe laufen im Hintergrund weiter.
- Sparsam abfragen (die Dienste bitten darum): Je Titel genau **eine** Abfrage pro Dienst – `loadMovie()`/`loadTv()` (`providers/tmdb.ts`; Serien holen Detailseite + Staffeln 0–16 in einer Abfrage, nur längere brauchen weitere), `loadGame()` (`igdb.ts`), `loadAnime()` (`anilist.ts`); Termine, Folgen und Detailseite werden daraus abgeleitet. Neue Felder dort ergänzen statt eine zweite Abfrage einzuführen. Im Hintergrund (Warteschlange nach Hinzufügen/Import, nächtliche Aufgabe) werden Anime und Spiele **im Paket** geholt: `preloadAnime()` (25 je Abfrage) und `preloadGames()` (50 je Abfrage) legen die Antworten in den Zwischenspeicher, `refreshItem()` arbeitet danach ohne eigene Abfrage (`refreshBatch()` in `releases.ts`; scheitert ein Paket, fragt jeder Titel wie früher einzeln; TMDB kennt keine Paket-Abfrage). Wikidata (Direktlinks zu Streaming-Diensten, „Linked Data Interface“ `Special:EntityData`, User-Agent mit Version + Kontakt): Antwort 30 Tage in Tabelle `wikidata_links`, nur bei Titeln mit Streaming-Angebot. Rhythmus der nächtlichen Aufgabe (`isDue()` in `releases.ts`): Geplant/Schaue/Pausiert und gesehene, noch laufende **Serien** jede Nacht; gesehene Filme und Anime, gesehene beendete/abgesetzte Serien (`ended` in den gespeicherten Details, `endedShowIds()`) sowie durchgespielte Spiele einmal pro Woche; Abgebrochenes einmal im Monat (damit nichts Gespeichertes älter wird als die 6 Monate, die TMDB erlaubt). „Jetzt ausführen“ folgt derselben Regel; beim Öffnen einer Detailseite wird ein älterer Stand ohnehin im Hintergrund aufgefrischt. Hintergrund-Abfragen laufen nacheinander mit Pause je Dienst (`PAUSE_MS` in `providers/types.ts`: TMDB 0,1 s, IGDB 0,3 s, AniList 3 s, Wikidata 1 s) und warten bei „zu viele Anfragen“.
- Export (`src/lib/server/export/yamtrack.ts`, Download unter `/settings/data/export`): schreibt die ganze Bibliothek als CSV im Format von Yamtracks eigenem Export (gleiche Spalten/Reihenfolge wie die Vorlage in `data/yamtrack_*.csv`; Serien als `tv` + `season` + `episode`-Zeilen), sodass Yamtrack und der eigene Import sie lesen. **Rein lokal – ein Export fragt nie eine API.** Dafür wird die MyAnimeList-Kennung jedes Anime (AniList-Feld `idMal`) beim normalen Laden mitgespeichert (`library_items.mal_id`, `SearchResult.malId`); Anime ohne Kennung fehlen in der Datei, die Daten-Seite nennt ihre Zahl. Getestet gegen echtes Yamtrack: alle Zeilen und Status kommen an; `created_at`, Film-/Staffel-`progress` und Staffelbild setzt Yamtrack selbst. Bei Änderungen am Import das Gegenstück im Export mitdenken (Hin-und-zurück-Test: Export → leere Instanz → gleiche Bibliothek).
- Passwort vergessen: `reset-password.js` im Projektstamm (ins Image kopiert) setzt ein Übergangspasswort und meldet alle Geräte ab; schreibt dasselbe Hash-Format wie `hashPassword()` in `auth.ts` – beide zusammen ändern.

## Changelog & Releases

- `CHANGELOG.md` (Englisch, Emoji-Stil): Jede für Nutzer sichtbare Änderung sofort unter `## Upcoming release` eintragen (die Überschrift gibt es nur, solange es solche Änderungen gibt: bei der ersten Änderung nach einem Release oben anlegen, direkt nach einem Release steht sie nicht da), in `### ✨ New` / `### 🔧 Improved` / `### 🐛 Fixed` / `### 🗑️ Removed`. Aus Nutzersicht formulieren („Search is now in the header“), nicht technisch. Rein interne Änderungen (CI, Aufräumen, Tests) und Änderungen an README/Wiki gehören nicht hinein – nur, was sich in der App selbst für Nutzer ändert (z. B. ein neuer Link in der App, nicht der Umbau der Doku).
- Versionen bis 1.0: neue Funktionen → `0.X.0`, nur Fehlerbehebungen → `0.X.Y`.
- Release: Changelog-Text vorher dem User zeigen. Dann `## Upcoming release` → `## X.Y.Z – JJJJ-MM-TT` (leere Unterabschnitte weg, Wichtigstes zuerst, ein kurzer Einleitungssatz, am Ende `### ⬆️ Updating` mit dem, was Nutzer beim Update tun müssen) – kein neuer leerer `## Upcoming release`-Abschnitt; Version in `package.json` (`npm version X.Y.Z --no-git-tag-version`); Commit, Tag `vX.Y.Z`, Push.
- Die GitHub Action baut das Image und stellt danach den Release-Text in ihre Zusammenfassung: Abschnitt der Version aus `CHANGELOG.md` + Image-Zeile + „Full Changelog“-Link zum vorigen Tag (ohne Abschnitt schlägt sie fehl). **Das GitHub-Release legt der User selbst an**, damit er als Autor erscheint – bewusst ohne Personal Access Token (Sicherheit). Nach dem Tag-Push den fertigen Text im Chat mitgeben.

## Befehle

- `npm run dev` – Dev-Server (http://localhost:5173)
- `npm run check` – Typprüfung
- `npm run build` / `npm start` – Production-Build starten
- `npm run db:generate` – nach Schema-Änderung neue Migration in `drizzle/` erzeugen (mit committen!)
- `docker compose up -d` – veröffentlichtes Image von GHCR starten (wie auf einem Server)
- `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build` – Image lokal aus dem Quellcode bauen und starten
- Release: siehe „Changelog & Releases“; Tag `vX.Y.Z` pushen → GitHub Action baut Multi-Arch-Image nach GHCR; die Release-Seite legt der User mit dem vorbereiteten Text an
