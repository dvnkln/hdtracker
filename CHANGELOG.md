# Changelog

All notable changes to hdtracker. Each version is also published as a [GitHub release](https://github.com/dvnkln/hdtracker/releases) with a ready-to-use Docker image.

<!-- Changes since the last release are collected under "## Upcoming release" right below this
     comment – the heading only exists while there are such changes. On release it becomes
     "## X.Y.Z – date". Sections (leave out empty ones): ### ✨ New, ### 🔧 Improved, ### 🐛 Fixed,
     ### 🗑️ Removed, and on release ### ⬆️ Updating (what users have to do when updating). -->

## Upcoming release

### 🔧 Improved

- **Server overview** (Settings → Server): shows at a glance whether everything is fine – HTTPS, reverse proxy, data source keys, background tasks, titles still loading – and a few facts such as version, running since and storage used
- Even fewer requests to the data sources: anime and games are now loaded in batches (up to 25 anime or 50 games with a single request) – after an import, a large anime library is ready in seconds instead of minutes. Watched series that have ended are only checked once a week instead of every night
- Hardened against attacks from other websites: hdtracker now tells the browser to load and run only what comes from your own server, and not to let other pages embed it
- Login protection: repeated wrong passwords now block an address for longer each time (1, 5, then 15 minutes). Behind a reverse proxy, hdtracker can now tell visitors apart: Settings → Server → Connection shows how your request arrived and lets you confirm the proxy – with one click, or with a key where Docker hides the addresses (ready-made lines for Nginx Proxy Manager, Caddy, Traefik and nginx; the key stays hidden until you ask to see it)

## 0.5.0 – 2026-10-02

Themes, an export, and a library that opens without waiting.

### ✨ New

- **Themes** (Settings → Appearance): choose how hdtracker looks – “System” follows your device (the new default), or pick dark (as before) or light; the well-known palettes Tokyo Night, Dracula and SynthWave '84; and the character themes Cyberpunk, Retro 95, Terminal and Breadbin. A small preview shows each theme; the login page follows the theme last used on the device
- **Export your library** (Settings → Data): downloads everything as a CSV file – statuses, watched episodes and anime progress. The file has the format of Yamtrack and can be imported there or into hdtracker again
- **Dashboard order**: both lists can be reversed with one tap on the calendar button next to their heading (newest or oldest first, next or latest first); your choice is remembered on all your devices

### 🔧 Improved

- **Titles in your library open instantly**: details and images of a title are loaded in the background as soon as you add it and refreshed every night, so detail pages no longer wait for TMDB, IGDB or AniList
- The nightly refresh is much gentler on the data sources: one request per title instead of two or three; watched movies and anime and completed games are refreshed once a week, dropped titles once a month (they were never refreshed before); direct streaming links (Wikidata) are only looked up once a month
- Maintenance shows how many titles are preloaded; a long “Run now” keeps running in the background instead of blocking the page
- Settings → About lists Wikidata as a data source

### 🐛 Fixed

- Anime that have not started yet and have no exact start date were treated as already released: they were missing on the dashboard and their statuses were not locked

### ⬆️ Updating

Just pull the new image – the database is updated automatically on start, your library stays as it is. Two things you will notice:

- **The look may change:** hdtracker now follows the light/dark setting of your device. If your device is set to light and you prefer the old look, choose “Dark” under Settings → Appearance.
- **After the first start,** hdtracker loads details and images for your whole library once in the background. This takes a few minutes for large libraries (anime take the longest); you can keep using the app meanwhile.

## 0.4.0 – 2026-10-02

Your browser now only talks to your own hdtracker: images are fetched and stored by the server.

### ✨ New

- **Images are loaded through your own server**: posters, episode images and logos are fetched and stored by hdtracker – your browser no longer contacts TMDB, IGDB or AniList at all. The posters of your library are kept ready, so they show up right away
- **Clean up images**: a new maintenance task removes stored images that were not needed for 30 days or are too old. It cannot be switched off, because the data sources limit how long images may be kept

### 🔧 Improved

- Maintenance shows how much space images, database and backups use, and how much a clean-up freed
- Games: dates are now simply called “Early Access” and “Release”, on the dashboard and on the detail page

### ⬆️ Updating

Just pull the new image – the database is updated automatically on start, your library stays as it is. Images are now stored in the folder `/data/images` inside the volume (roughly 50 kB per poster); it fills up as you use the app and does not need to be backed up. If you restrict outgoing connections of the server, allow `image.tmdb.org`, `images.igdb.com` and `s4.anilist.co` – see [Privacy and security](https://github.com/dvnkln/hdtracker/wiki/Privacy-and-security).

## 0.3.0 – 2026-10-01

Early access games are marked, statuses only make sense for titles that are out, and a forgotten password can be reset.

### ✨ New

- **Early access games are marked**: “Early Access” next to the year and on the detail page, and the full release shows up on the dashboard once it has a date. As soon as the full version is out, the mark disappears
- **Reset a forgotten password** (or username) with a command in the container: `docker exec hdtracker node reset-password.js` – see the [wiki](https://github.com/dvnkln/hdtracker/wiki/Reset-your-password)

### 🔧 Improved

- **Titles that are not out yet can only be set to “Planned”** – the other statuses are greyed out. If a release date is wrong, double-tap the greyed-out status to set it anyway
- Maintenance: the tasks used most come first, switched-off tasks are listed last
- Settings → About links to the [documentation](https://github.com/dvnkln/hdtracker/wiki)

### ⬆️ Updating

Just pull the new image – the database is updated automatically on start, your library stays as it is. After the first start, hdtracker reloads release dates for your games and for recent titles once in the background; this takes a moment for large libraries.

## 0.2.0 – 2026-09-29

A tidier settings area, the option to hide what you don't track, and a much more reliable import.

### ✨ New

- **Hide areas** you don't track (e.g. anime or games): they disappear from navigation, search and the dashboard; their data is kept but no longer refreshed. The import asks what to do with titles of hidden areas
- **Change your username** (Settings → Account)
- **About page** in the settings: version (click it to see what's new in that release), links to GitHub, issues and license, and the data sources

### 🔧 Improved

- **Settings reorganized**: a sidebar on computers and a list on phones, with the areas General, Account, Data, Server, Maintenance and About. The import is now under Settings → Data
- **Faster, gentler background loading**: movies/series, games and anime load at the same time; requests are spaced out per service and retried when a service asks to slow down
- After an import, titles still loading show a pulsing “…”, and the import page shows how many are left
- Titles without a release year show “TBA” instead of a dash
- Dashboard: titles without a date are collapsed under “Date not announced”
- Search field, content and bottom navigation are aligned on one centre axis on large screens

### 🐛 Fixed

- After an import, loading posters, descriptions and release dates continues after a restart instead of waiting for the nightly refresh
- Game search finds titles made only of very common words, such as the _We Were Here_ series, and shows exact name matches first

### ⬆️ Updating

Just pull the new image – the database is updated automatically on start, your library stays as it is.

## 0.1.0 – 2026-09-27

First release.

### ✨ New

- **Four separate areas** – movies, series, anime and games, each with search and a library grouped by status
- **Dashboard** – recently released and upcoming: new episodes, new seasons, cinema and home releases, game releases
- **Episode tracking** – single episodes, whole seasons or entire shows, with upcoming air dates
- **Spoiler protection** – images and descriptions of unwatched episodes are blurred (optional)
- **Where to watch** – streaming, rent and buy offers for your region via JustWatch
- **Import from Yamtrack** – statuses, watched episodes and anime progress from a CSV export
- **Installable as an app** – add it to your home screen (requires HTTPS)
- **Maintenance built in** – nightly refresh of release dates, optional scheduled database backups
- **English and German** interface, adjustable content language and region
