<p align="center">
  <img src="src/lib/assets/favicon.svg" width="96" alt="hdtracker logo" />
</p>

<h1 align="center">hdtracker</h1>

<p align="center">
  Self-hosted tracker for <b>movies, series, anime and games</b> – made for watching together on the couch.<br />
  Mobile-first, dark, one Docker container. User interface in German or English.
</p>

## Features

- **Four separate areas** – movies, series, anime, games – each with search and a library grouped by status (watching, paused, planned, completed, dropped)
- **Episode tracking** – tick off single episodes, whole seasons or entire shows; upcoming episodes and announced seasons with dates
- **Where to watch** – streaming, rent and buy offers for your region (via JustWatch), with direct links where possible
- **Detail pages** – runtime, genres, rating, release dates and similar titles
- **Private** – runs on your own server, single account, data stays in one SQLite file

## Quick start

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

**Port:** change the left side of `3000:3000` (e.g. `8080:3000`) and adjust `ORIGIN` accordingly.
**Update:** `docker compose pull && docker compose up -d`. Your data lives in the `hdtracker-data` volume.

## Data sources

Movie and series data from [TMDB](https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability by [JustWatch](https://www.justwatch.com). Game data from [IGDB](https://www.igdb.com), anime data from [AniList](https://anilist.co).

## Development

```bash
npm install
npm run dev
```

SvelteKit, TypeScript, Drizzle ORM with SQLite, Tailwind CSS. Build the Docker image from source with
`docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`.

## License

[MIT](LICENSE) – fork it, copy it, change it however you like. This is a personal project, provided as-is without support or guarantees; if it's useful to you too, even better.
