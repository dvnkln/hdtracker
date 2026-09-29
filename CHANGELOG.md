# Changelog

All notable changes to hdtracker. Each version is also published as a [GitHub release](https://github.com/dvnkln/hdtracker/releases) with a ready-to-use Docker image.

## Upcoming release

<!-- Collect changes here as they are made; on release this becomes "## X.Y.Z – date".
     Sections (leave out empty ones): ### ✨ New, ### 🔧 Improved, ### 🐛 Fixed, ### 🗑️ Removed -->

### 🔧 Improved

- Dashboard: titles without a date are collapsed under “Date not announced” by default
- Titles without a release year show “TBA” instead of a dash
- After an import, titles whose details are still loading show a pulsing “…”, and the import page shows how many are left
- Loading details in the background is faster and gentler on the APIs: movies/series, games and anime load at the same time, requests are spaced out per service and retried when a service asks to slow down

### 🐛 Fixed

- After an import, loading posters, descriptions and release dates now continues after a restart instead of waiting for the nightly refresh
- Game search now finds titles made only of very common words, such as the _We Were Here_ series, and shows exact name matches first

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
