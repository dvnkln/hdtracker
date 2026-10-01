# Changelog

All notable changes to hdtracker. Each version is also published as a [GitHub release](https://github.com/dvnkln/hdtracker/releases) with a ready-to-use Docker image.

<!-- Changes since the last release are collected under "## Upcoming release" right below this
     comment – the heading only exists while there are such changes. On release it becomes
     "## X.Y.Z – date". Sections (leave out empty ones): ### ✨ New, ### 🔧 Improved, ### 🐛 Fixed,
     ### 🗑️ Removed, and on release ### ⬆️ Updating (what users have to do when updating). -->

## Upcoming release

### ✨ New

- **Reset a forgotten password** (or username) with a command in the container: `docker exec hdtracker node reset-password.js` – see the wiki

### 🔧 Improved

- Settings → About links to the [documentation](https://github.com/dvnkln/hdtracker/wiki)

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
