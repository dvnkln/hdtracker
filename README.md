<!-- Logo with wordmark; GitHub picks the variant matching its light or dark theme -->
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/wordmark-dark.png" />
    <img src="docs/brand/wordmark-light.png" width="380" alt="hdtracker" />
  </picture>
</p>

<p align="center">
  <a href="https://github.com/dvnkln/hdtracker/releases"><img src="https://img.shields.io/github/v/release/dvnkln/hdtracker?label=version&style=for-the-badge&color=ec4899" alt="Version" /></a>
  <a href="https://github.com/dvnkln/hdtracker/pkgs/container/hdtracker"><img src="https://img.shields.io/github/actions/workflow/status/dvnkln/hdtracker/release.yml?label=docker%20image&style=for-the-badge&logo=docker&logoColor=white" alt="Docker image" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-3b82f6?style=for-the-badge" alt="License: AGPL-3.0" /></a>
</p>

<p align="center">
  Self-hosted tracker for <b>movies</b>, <b>series</b>, <b>anime</b> and <b>games</b> – made for watching together on the couch.
</p>

<p align="center">
  <img src="docs/screenshots/devices.jpg" alt="hdtracker on a desktop screen and two phones" />
</p>

## 📑 Contents

- [Features](#-features)
- [Screenshots](#-screenshots)
- [Quick start](#-quick-start)
- [Import from Yamtrack](#-import-from-yamtrack)
- [Backups](#-backups)
- [Data sources](#-data-sources)
- [Development](#-development)
- [Built with AI](#-built-with-ai)
- [License](#-license)
- [Changelog](CHANGELOG.md)

## ✨ Features

- 🎬 **Four separate areas** – movies, series, anime and games, each with a library grouped by status (watching, paused, planned, completed, dropped). Don't track games or anime? Hide the areas you don't need.
- 📅 **Dashboard** – what was released recently and what is coming up: new episodes, new seasons, cinema and home releases, game releases.
- 📺 **Episode tracking** – tick off single episodes, whole seasons or entire shows; see upcoming episodes and announced seasons with dates.
- 🙈 **Spoiler protection** – images and descriptions of episodes you have not watched yet are blurred (can be switched off).
- 🍿 **Where to watch** – streaming, rent and buy offers for your region (via JustWatch), with direct links where possible.
- 🔎 **Quick search** – always at the top of the screen; on a computer, press <kbd>/</kbd> to start typing.
- 📄 **Detail pages** – runtime, genres, rating, release dates and similar titles.
- 📥 **Import from Yamtrack** – take over your library including statuses, watched episodes and anime progress.
- 🛠️ **Maintenance built in** – release dates refresh nightly; optional scheduled database backups you can download.
- 📲 **Installable as an app** – add it to your home screen (Chrome, Edge, Safari) and it opens full screen with its own icon.
- 🌍 **Two languages** – interface in English or German; content language and region are adjustable.
- 🔒 **Private** – runs on your own server, single account, all data in one SQLite file.

## 📱 Screenshots

|                                Dashboard                                 |                                 Library                                  |                               Search                               |
| :----------------------------------------------------------------------: | :----------------------------------------------------------------------: | :----------------------------------------------------------------: |
| <img src="docs/screenshots/dashboard.jpg" alt="Dashboard" width="260" /> | <img src="docs/screenshots/anime.jpg" alt="Anime library" width="260" /> | <img src="docs/screenshots/search.jpg" alt="Search" width="260" /> |

|                         Details & where to watch                         |                     Episodes (spoiler protection)                      |                                 Maintenance                                  |
| :----------------------------------------------------------------------: | :--------------------------------------------------------------------: | :--------------------------------------------------------------------------: |
| <img src="docs/screenshots/details.jpg" alt="Detail page" width="260" /> | <img src="docs/screenshots/episodes.jpg" alt="Episodes" width="260" /> | <img src="docs/screenshots/maintenance.jpg" alt="Maintenance" width="260" /> |

<p align="center"><sub>Screenshots with a demo library. Posters and data from TMDB, AniList and IGDB.</sub></p>

## 🐳 Quick start

1. Create a folder with this `docker-compose.yml`:

   ```yaml
   services:
     hdtracker:
       image: ghcr.io/dvnkln/hdtracker:latest
       container_name: hdtracker
       restart: unless-stopped
       ports:
         - '3000:3000'
       env_file: .env
       volumes:
         - hdtracker-data:/data

   volumes:
     hdtracker-data:
   ```

2. Next to it, create a `.env` file (template: [`.env.example`](.env.example)):

   ```env
   SECRET=
   TMDB_API_TOKEN=
   IGDB_CLIENT_ID=
   IGDB_CLIENT_SECRET=
   TZ=Europe/Berlin
   ORIGIN=http://192.168.1.50:3000
   ```

   | Variable                                | What to put in                                                                                                                                                                                     |
   | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `SECRET`                                | Random string, at least 32 characters: `openssl rand -hex 32`                                                                                                                                      |
   | `TMDB_API_TOKEN`                        | [themoviedb.org](https://www.themoviedb.org/settings/api) → Settings → API → **API Read Access Token** (the long one)                                                                              |
   | `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` | [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) → Register Your Application (Redirect URL `http://localhost`, Client Type _Confidential_)                                         |
   | `TZ`                                    | Your [time zone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)                                                                                                                     |
   | `ORIGIN`                                | **Exactly** the address you open the app with – otherwise login fails. E.g. `http://192.168.1.50:3000` or `https://tracker.example.com` behind a reverse proxy. Several addresses: comma-separated |

   Anime (AniList) needs no key. Without TMDB or IGDB keys only those areas are unavailable.

3. Start it and open the `ORIGIN` address. On first start you create your account.

   ```bash
   docker compose up -d
   ```

**Install as an app:** open hdtracker on your phone and choose _Install app_ (Chrome/Edge) or _Share → Add to Home Screen_ (Safari). Browsers only install web apps from **HTTPS** addresses (on plain `http://` Safari still adds it to the home screen, Chrome only creates a bookmark).

**HTTPS:** hdtracker itself speaks plain HTTP and currently expects a **reverse proxy** in front of it for HTTPS (e.g. Nginx Proxy Manager, Caddy or Traefik). Put the HTTPS address into `ORIGIN`.

**Port:** change the left side of `3000:3000` (e.g. `8080:3000`) and adjust `ORIGIN` accordingly.
**Update:** `docker compose pull && docker compose up -d`. Your data lives in the `hdtracker-data` volume.

## 📥 Import from Yamtrack

Coming from [Yamtrack](https://github.com/FuzzyGrim/Yamtrack)? Export your library there as CSV and upload it under **Settings → Data**.

- Movies, series, anime and games are taken over with their status and dates.
- Series keep every watched episode, anime their progress (MyAnimeList IDs are matched via AniList).
- Titles already in your library are left unchanged, so importing twice is safe.
- Entries created by hand in Yamtrack have no database ID and are listed as skipped.
- If the file contains titles of areas you have hidden, you are asked whether to skip them, import them anyway or show the area again.

Posters, descriptions and release dates are loaded in the background afterwards – the import page shows how many are left, and loading continues even if the container restarts in between.

## 💾 Backups

Under **Settings → Maintenance** hdtracker can back up its database on a schedule (off by default). The copies are stored in `/data/backups` inside the volume and can also be downloaded there.

**Backing up the whole volume instead?** Copy it while the container is stopped, or always copy `hdtracker.db`, `hdtracker.db-wal` and `hdtracker.db-shm` together. Otherwise the copy may be incomplete.

**Restoring a backup:**

```bash
docker compose stop
# Volume name: see `docker volume ls` (usually <folder>_hdtracker-data).
# Backup from the volume: /data/backups/<file>. Downloaded backup in the current folder: /in/<file>
docker run --rm -v <folder>_hdtracker-data:/data -v "$PWD":/in alpine sh -c '
  cp /data/backups/hdtracker-2026-09-27_030000.db /data/hdtracker.db &&
  rm -f /data/hdtracker.db-wal /data/hdtracker.db-shm &&
  chown 1000:1000 /data/hdtracker.db'
docker compose start
```

## 🙏 Data sources

Movie and series data from [TMDB](https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability by [JustWatch](https://www.justwatch.com). Game data from [IGDB](https://www.igdb.com), anime data from [AniList](https://anilist.co).

## 💻 Development

```bash
npm install
npm run dev
```

SvelteKit, TypeScript, Drizzle ORM with SQLite, Tailwind CSS. Build the Docker image from source with
`docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`.

## 🤖 Built with AI

hdtracker is heavily AI-assisted, and I want to be upfront about that. Most of the code was written by [Claude Code](https://claude.com/claude-code), Anthropic's AI coding assistant.

My part is the product side: what hdtracker should do, how it should look and feel, and how it should behave – from the layout and hover effects to things like loading data from the different services in parallel. I describe ideas and decisions, review and test every change in a running instance, and decide what goes into a release. The AI turns that into code, tests it and documents it.

If you find a bug or something that looks odd in the code, please open an [issue](https://github.com/dvnkln/hdtracker/issues) – that helps.

## 📜 License

[GNU AGPL v3](LICENSE) – you may use, change and share hdtracker freely. If you distribute a modified version or offer it to others over a network, you have to publish your changes under the same license. This is a personal project, provided as-is without support or guarantees; if it's useful to you too, even better.
