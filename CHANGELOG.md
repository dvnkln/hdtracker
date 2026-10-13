# Changelog

All notable changes to hdtracker. Each version is also published as a [GitHub release](https://github.com/dvnkln/hdtracker/releases) with a ready-to-use Docker image.

<!-- Changes since the last release are collected under "## Upcoming release" right below this
     comment – the heading only exists while there are such changes. On release it becomes
     "## X.Y.Z – date". Sections (leave out empty ones): ### ✨ New, ### 🔧 Improved, ### 🐛 Fixed,
     ### 🗑️ Removed, and on release ### ⬆️ Updating (what users have to do when updating). -->

## Upcoming release

### 🔧 Improved

- In the window that changes the status of a title, the bell and the symbol for tracking together now look and sit like on the page of the title: round, right below title and year
- Invitations are tidier, in the inbox and on the page of a title: “Accept”, “Decline” and the trailer are one row of round buttons, and the inbox shows a bigger poster and the whole title
- The line that describes hdtracker under Settings → About now speaks of tracking together, not watching

### 🐛 Fixed

- On the dashboard, a title tracked with more people than there is room for pictures now shows “+2” for the rest instead of leaving them out
- In settings that save at once, a second choice made right after the first could flip back by itself and get lost
- In the library, Ctrl+A or a Shift+click right after unfolding a section could miss the titles in it

## 0.9.0 – 2026-10-12

Track a title together with somebody: one state for both, an inbox for what is new, and a link to the trailer.

### ✨ New

- **Track together:** on the page of a title in your library, the new symbol next to the bell invites another user. Who accepts takes over your status and watched episodes – from then on both of you keep them up to date, and the symbol shows who tracks along. Anybody can go on alone again and keeps the state as a copy of their own. Invitations wait in the inbox until they are answered, and you can get a push message when you are invited, when your invitation is answered or when somebody stops tracking along – each with a switch of its own under Settings → Notifications. In the library and on the dashboard, small profile pictures on a poster show who tracks along. To invite somebody to several titles at once, hold a poster in the library and tap the others; on a computer a right click or Ctrl+click starts it, Shift+click takes a whole range and Ctrl+A everything you see
- **Inbox:** the bell in the header collects what is new for you, with a number while something is unread – releases of titles you track (the same ones the dashboard lists as recently released, whether or not you use push messages), invitations, and what others did with titles you track together. Opening it marks everything as read, a look at the dashboard marks the releases; what you have read disappears after a week
- **Trailer:** the page of a title links to its trailer where the data source knows one – also right in an invitation, to have a look before answering. It is a link to the video site (YouTube); nothing is loaded from there before you tap it. Titles already in your library get their link shortly after the update

### 🔧 Improved

- On a computer the dashboard shows what was released and what is coming up as posters, like the library, instead of one narrow list in the middle – each with what happens and when. Phones keep the list by day
- The window that changes the status of a title now also holds its bell and the invitations – no detour to the page of the title
- The bell on the page of a title is always there for titles of your library: switched off, you hear nothing about this title – neither in the inbox nor as a push message
- Settings → Maintenance is tidier: the tasks are one list – each row says when the task runs and how its last run went, a tap unfolds its description, schedule and “Run now”. The switch of a task now saves at once
- On a computer the scrollbar now floats over the page as a slim handle in the style of the theme, instead of taking a strip at the right edge – header and navigation reach the edge of the window. It shows while you scroll and can be dragged
- After an update of the server, an app that was left open (a tab, the installed app) notices the new version and loads itself afresh on the next change of page – before, it kept showing the old interface until it was reloaded by hand

### ⬆️ Updating

Just pull the new image. Shortly after the first start, hdtracker loads the titles of your library once more in the background to get their trailer links. Tracking together needs a second account: [Users](https://github.com/dvnkln/hdtracker/wiki/Users#tracking-together).

## 0.8.0 – 2026-10-12

hdtracker is no longer for one person only: an admin can add accounts, and everybody gets a library of their own.

### ✨ New

- **Several users:** an admin creates accounts under Settings → Users – nobody can register themselves. A new account gets a temporary password that is shown once; on the first login its owner chooses their own. Everybody has a library, a dashboard and settings of their own (language, theme, shown areas, notifications, …); what is set for the whole installation (content language, region, connection, maintenance) stays with the admins. Accounts can be made admin, locked (keeps everything, login refused) or deleted. The admin sees how many titles somebody tracks, never which
- **Profile:** under Settings → Account everybody can choose a display name – what others see instead of the name used to log in – and a profile picture. Without a picture of your own, the first letter of your name stands on a colour (roll another one if you do not like it). An uploaded photo is cut to a small square and stored without the data the camera wrote into the file

### 🔧 Improved

- Your profile picture now sits at the top right instead of the gear and the log-out icon: a tap opens a small menu that shows who is logged in and leads to the settings and to logging out
- An empty library, an empty dashboard and a search without results show a small pictogram and a few words instead of a paragraph of text
- Choosing a password tells you while typing whether it is long enough and whether both entries match
- The login page of a device now also remembers the language last used there (as it already did the theme)
- Webhook and ntfy targets for notifications are reserved for admins unless an admin allows them for everybody (Settings → Users) – they make the server call an address of the user's choice

### ⬆️ Updating

**Make a backup first** (Settings → Maintenance → Backups → Run now, then download it): this version restructures the database on the first start, and going back to 0.7.0 afterwards is only possible with that backup. Then just pull the new image. Your account becomes the admin and keeps its library and settings. How to add others: [Users](https://github.com/dvnkln/hdtracker/wiki/Users).

## 0.7.0 – 2026-10-06

hdtracker can now tell you when something from your library comes out.

### ✨ New

- **Push notifications:** hdtracker tells you on your phone or computer when something from your library comes out – new episodes and seasons, cinema and home releases, game releases (what shows up under “Recently released” on the dashboard). No extra app or account: switch it on per device under Settings → Notifications (needs HTTPS; on iPhone and iPad hdtracker must be installed to the home screen). Choose one message per title or one summary a day and the hour they are sent from; opened up, a message shows the poster of the title, a summary the posters of the day side by side. The bell on a title's page mutes that title
- **More ways to be notified:** besides your own devices, messages can go to [Pushover](https://pushover.net) (with your own application token, optionally only to some of your devices, with the picture attached), to [ntfy](https://ntfy.sh) (ntfy.sh or your own server, with picture and icon) and to a **webhook** – an address of your choice with content you write yourself, using placeholders like `{{title}}` (works with Gotify, Home Assistant and similar). All of them are one list of targets under Settings → Notifications: each has a name, a switch that keeps its settings when off, and its own test button; several of a kind are possible

### 🔧 Improved

- Settings are saved the moment you choose: General, Notifications and the anime switch under Server no longer need a “Save” button (content language and region keep theirs, because changing them loads the whole library again)
- Settings → About names the icon set (Lucide) and the font of the wordmark (Outfit)

### ⬆️ Updating

Just pull the new image – the database is updated on start. Notifications are off until you switch them on; how to set them up, and who can read a message with each kind of target: [Notifications](https://github.com/dvnkln/hdtracker/wiki/Notifications).

## 0.6.1 – 2026-10-04

Three small corrections.

### 🔧 Improved

- Series with a single season show their progress once (at the top) instead of twice
- Anime without any known streaming offer say so instead of showing nothing

### 🐛 Fixed

- Settings → Server: the hint for the content language said titles in your library keep their language – they are loaded again in the new language

### ⬆️ Updating

Just pull the new image – nothing else to do.

## 0.6.0 – 2026-10-03

Anime catch up with series: episode titles and where to watch in your region.

### ✨ New

- **Episode titles for anime:** the detail page shows the episode list with titles, images and descriptions like for series. They come from TMDB, in English like everything else about anime; which TMDB season belongs to an anime is looked up in the community list [anibridge-mappings](https://github.com/anibridge/anibridge-mappings) and checked against the air date. Anime without a reliable match keep the grid of episode numbers. Can be switched off under Settings → Server
- **Where to watch anime:** matched anime show the streaming offers of their season for your region (via JustWatch) instead of AniList's links, which are not checked for any region

### 🔧 Improved

- Loading details after an import or after changing language or region is about four times faster: the direct links to streaming services are looked up for many titles at once instead of one by one
- Wrong passwords and blocked addresses are written to the container log (never the password itself), so attacks become visible and tools like fail2ban can react; the server overview shows how many addresses are blocked right now
- The dashboard opens much faster with very large libraries (thousands of titles)
- The dashboard has a main heading for screen readers

### ⬆️ Updating

Just pull the new image – the database is updated automatically on start, your library stays as it is.

- **Anime:** on the first start, hdtracker downloads the mapping list and loads your anime again, so episode titles and streaming offers appear within a minute or so – nothing to do.
- **If you restrict outgoing connections:** hdtracker now also talks to `github.com` and `release-assets.githubusercontent.com` (the mapping list, once a week) and `query.wikidata.org` (direct links for many titles at once). Without them everything else keeps working. Details: [Privacy and security](https://github.com/dvnkln/hdtracker/wiki/Privacy-and-security).

## 0.5.1 – 2026-10-03

A round of hardening and polish: better login protection behind a reverse proxy, a server overview, and fewer requests to the data sources.

### 🔧 Improved

- **Login protection:** repeated wrong passwords now block an address for longer each time (1, 5, then 15 minutes). Behind a reverse proxy, hdtracker can now tell visitors apart: Settings → Server → Connection shows how your request arrived and lets you confirm the proxy – with one click, or with a key where Docker hides the addresses (ready-made lines for Nginx Proxy Manager, Caddy, Traefik and nginx; the key stays hidden until you ask to see it)
- **Server overview** (Settings → Server): shows at a glance whether everything is fine – HTTPS, reverse proxy, data source keys, background tasks, titles still loading – and a few facts such as version, running since and storage used
- **Hardened against attacks from other websites:** hdtracker now tells the browser to load and run only what comes from your own server, and not to let other pages embed it
- **Even fewer requests to the data sources:** anime and games are now loaded in batches (up to 25 anime or 50 games with a single request) – after an import, a large anime library is ready in seconds instead of minutes. Watched series that have ended are only checked once a week instead of every night
- Titles that were removed at TMDB, IGDB or AniList are no longer retried and reported as errors every night: they keep what is stored, show a note on their page and are listed in the server overview
- Errors (a page that does not exist, a data source that is not reachable) now show a proper page in the look of the app, in your language and theme
- Settings: “Save” and similar buttons stay greyed out until there is something to save or send (a changed value, a chosen file, all fields filled in)
- Maintenance: a small arrow next to “How often” puts a task back to its default schedule – it only appears when the schedule was changed

### ⬆️ Updating

Just pull the new image – the database is updated automatically on start, your library stays as it is.

- **Behind a reverse proxy:** open Settings → Server → Connection through the proxy once and confirm it there. Until then everything works as before, but all visitors share one block after wrong passwords. Details: [HTTPS and installing as an app](https://github.com/dvnkln/hdtracker/wiki/HTTPS-and-installing-as-an-app).

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
