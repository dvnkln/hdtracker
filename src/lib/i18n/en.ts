import type { Messages } from './de';

// English texts of the user interface. Must have exactly the same structure as de.ts.
export const en: Messages = {
	locale: 'en-US',

	common: {
		close: 'Close',
		search: 'Search',
		logout: 'Log out',
		settings: 'Settings',
		showPassword: 'Show password',
		hidePassword: 'Hide password',
		tba: 'TBA',
		earlyAccess: 'Early Access',
		tbaHint: 'Release date not announced yet',
		loadingDetails: 'Loading details',
		home: 'Home',
		more: 'Show more',
		less: 'Show less',
		notFound: 'Not found',
		loadFailed: 'Loading failed.',
		invalidData: 'Invalid data',
		invalidStatus: 'Invalid status'
	},

	categories: { movies: 'Movies', series: 'Series', anime: 'Anime', games: 'Games' },

	statusLabels: {
		movies: { planned: 'Planned', completed: 'Watched', dropped: 'Dropped' },
		series: {
			active: 'Watching',
			paused: 'Paused',
			planned: 'Planned',
			completed: 'Watched',
			dropped: 'Dropped'
		},
		anime: {
			active: 'Watching',
			paused: 'Paused',
			planned: 'Planned',
			completed: 'Watched',
			dropped: 'Dropped'
		},
		games: {
			active: 'Playing',
			paused: 'Paused',
			planned: 'Planned',
			completed: 'Completed',
			dropped: 'Dropped'
		}
	},

	auth: {
		loginTitle: 'Log in',
		setupTitle: 'Setup',
		welcome: 'Welcome! Create your admin account.',
		username: 'Username',
		password: 'Password',
		passwordMin: (n) => `Password (min. ${n} characters)`,
		passwordRepeat: 'Repeat password',
		login: 'Log in',
		createAccount: 'Create account',
		wrongCredentials: 'Wrong username or password',
		tooManyAttempts: (seconds) => `Too many failed attempts. Please wait ${seconds} s.`,
		usernameRule: 'Username: 3–32 characters, only letters, digits, _ . -',
		passwordTooShort: (n) => `Password must be at least ${n} characters long`,
		passwordsDiffer: 'Passwords do not match'
	},

	home: {
		recent: 'Recently released',
		recentHint: '4 weeks',
		upcoming: 'Coming up',
		noRecent: 'Nothing new was released in the last 4 weeks.',
		noUpcoming: 'No upcoming dates known.',
		emptyLibrary:
			'New episodes, cinema dates and releases of everything you plan to watch or are currently watching or playing show up here. Add titles to your library via the areas below.',
		dateOpen: 'Date not announced',
		order: {
			recent: { desc: 'Newest first', asc: 'Oldest first' },
			upcoming: { asc: 'Next first', desc: 'Latest first' },
			reverse: 'reverse order'
		},
		kinds: {
			cinema: 'In cinemas',
			home: 'Home release',
			release: 'Release',
			earlyAccess: 'Early Access',
			fullRelease: 'Release'
		},
		episodeCode: (season, episode) =>
			`S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`,
		animeEpisodes: (from, to) => (from === to ? `Episode ${from}` : `Episodes ${from}–${to}`),
		seriesStart: 'Series premiere',
		seasonStart: 'Season premiere',
		animeStart: 'Premiere'
	},

	library: {
		searchPlaceholder: (category) => `Search ${category.toLowerCase()}…`,
		results: (count, query) => `${count} results for “${query}”`,
		toLibrary: 'Back to library',
		noResults: 'No results.',
		empty: 'Your library is still empty. Search for a title above and tap it to add it.',
		searchFailed: 'Search failed.'
	},

	sheet: {
		details: 'Details',
		detailsAndEpisodes: 'Details & episodes',
		remove: 'Remove from library',
		removeConfirm: 'Really remove from library?',
		notReleased: 'Not released yet – double-tap to set it anyway'
	},

	detail: {
		addToLibrary: 'Add to library',
		whereToWatch: 'Where to watch',
		flatrate: 'Stream',
		rent: 'Rent',
		buy: 'Buy',
		noOffers: 'Currently not available from any provider.',
		streamingDataBy: 'Streaming data by',
		streaming: 'Streaming',
		animeLinksNote: 'Official links from AniList – availability in your region is not guaranteed.',
		episodes: 'Episodes',
		similar: 'Similar titles',
		seasons: (n) => `${n} ${n === 1 ? 'season' : 'seasons'}`,
		episodeCount: (n) => `${n} episodes`,
		perEpisode: (minutes) => `approx. ${minutes} min per episode`,
		facts: {
			cinema: 'In cinemas',
			home: 'Home release (digital/disc)',
			network: 'Network',
			episodes: 'Episodes',
			firstAired: 'First aired',
			studio: 'Studio',
			earlyAccess: 'Early Access',
			fullRelease: 'Release',
			platforms: 'Platforms',
			developer: 'Developer'
		},
		formats: {
			TV: 'TV series',
			TV_SHORT: 'TV series (short)',
			MOVIE: 'Movie',
			SPECIAL: 'Special',
			OVA: 'OVA',
			ONA: 'ONA',
			MUSIC: 'Music video'
		}
	},

	episodes: {
		watched: 'episodes watched',
		notYetAired: (n) => `(${n} not aired yet)`,
		allWatched: 'Watched all',
		reset: 'Reset',
		resetConfirm: 'Mark all episodes as unwatched?',
		nextEpisode: (episode, date) => `Next episode (${episode}) on ${date}`,
		noneKnown: 'No episodes known yet.',
		announced: 'Announced',
		startsOn: (date) => `Starts ${date}`,
		dateOpen: 'Date not announced',
		seasonWatched: 'Watched whole season',
		seasonUnwatch: 'Mark season as unwatched',
		specialsNote: 'Specials do not count towards progress.',
		airsOn: (date) => `airs ${date}`,
		episode: (n) => `Episode ${n}`,
		season: (n) => `Season ${n}`,
		specials: 'Specials'
	},

	settings: {
		general: 'General',
		title: 'Settings',
		groupPersonal: 'Personal',
		groupAdmin: 'Administration',
		generalHint: 'Language, display, areas',
		accountHint: 'Username, password, devices',
		data: 'Data',
		dataHint: 'Import, clear library',
		server: 'Server',
		serverHint: 'Content language, region',
		maintenanceHint: 'Background tasks, backups',
		aboutHint: 'Version, links, data sources',
		content: 'Content',
		changeUsername: 'Change username',
		newUsername: 'New username',
		usernameChanged: 'Username changed ✓',
		usernameTaken: 'This username is already taken.',
		save: 'Save',
		saved: 'Saved ✓',

		appearance: 'Appearance',
		appearanceHint: 'Colour theme of the interface',
		theme: 'Theme',
		themeHint:
			'Applies to your account on all devices – and to the login page of this device. “System” follows the light/dark setting of the device.',
		themes: {
			system: 'System',
			dark: 'Dark',
			light: 'Light',
			tokyonight: 'Tokyo Night',
			dracula: 'Dracula',
			synthwave: "SynthWave '84",
			cyberpunk: 'Cyberpunk',
			retro95: 'Retro 95',
			terminal: 'Terminal',
			c64: 'Breadbin'
		},
		display: 'Display',
		uiLanguage: 'Interface language',
		contentLanguage: 'Content language',
		contentLanguageHint:
			'Titles and descriptions of movies and series (TMDB). Titles already in your library keep their current language for now.',
		region: 'Region',
		regionHint: 'Used for streaming providers and release dates.',
		listsUnavailable: 'TMDB is not reachable right now – the lists are incomplete.',
		animeTitle: 'Anime titles',
		animeTitleEnglish: 'English title on top, Romaji below',
		animeTitleRomaji: 'Romaji on top, English title below',

		hideSpoilers: 'Spoiler protection',
		hideSpoilersHint: 'Images and descriptions of episodes you have not watched yet are blurred.',

		areas: 'Areas',
		areasHint: 'Hidden areas disappear from navigation, search and the dashboard.',
		areaHiddenData: (n) =>
			`${n} ${n === 1 ? 'entry is' : 'entries are'} kept, but no longer updated, and there are no notifications for ${n === 1 ? 'it' : 'them'}. Delete in the danger zone if needed.`,
		areasMin: 'At least one area has to stay visible.',

		behavior: 'Behavior',
		autoStatus: 'Update status automatically',
		autoStatusHint:
			'First episode ticked → “Watching”. All episodes of a finished show watched → “Watched”.',

		account: 'Account',
		changePassword: 'Change password',
		currentPassword: 'Current password',
		currentPasswordConfirm: 'Current password to confirm',
		newPassword: (n) => `New password (min. ${n} characters)`,
		repeatPassword: 'Repeat new password',
		wrongPassword: 'The current password is wrong.',
		passwordChanged: 'Password changed ✓ All other devices have been logged out.',
		otherDevices: 'Other devices',
		otherDevicesHint: 'Logs out all browsers and devices – except this one.',
		logoutOthers: 'Log out all other devices',
		loggedOutOthers: (n) =>
			n === 0
				? 'No other device was logged in ✓'
				: `${n} ${n === 1 ? 'device' : 'devices'} logged out ✓`,

		danger: 'Danger zone',
		clearLibrary: 'Clear library',
		clearHint: 'Deletes all entries including watched episodes. This cannot be undone.',
		clearWhat: 'What should be deleted?',
		clearAll: 'All areas',
		confirmWord: 'DELETE',
		confirmPrompt: (word) => `Type “${word}” to confirm`,
		confirmWrong: (word) => `Please type exactly “${word}”.`,
		clearButton: 'Delete permanently',
		cleared: (n) => `${n} ${n === 1 ? 'entry' : 'entries'} deleted ✓`
	},

	maintenance: {
		title: 'Maintenance',
		intro: (timeZone) =>
			`These tasks run automatically in the background. Times are in the server's time zone (${timeZone}).`,
		tasks: {
			backup: {
				name: 'Backup',
				description: 'Saves a copy of the database in the folder /data/backups.'
			},
			metadata: {
				name: 'Refresh metadata',
				description:
					'Reloads details, release dates and images of all entries in your library and keeps them ready, so the dashboard and detail pages open instantly. Watched movies and anime and completed games are only refreshed once a week, dropped titles once a month.'
			},
			optimize: {
				name: 'Database care',
				description: 'Tidies up the database and makes the file more compact.'
			},
			sessions: {
				name: 'Delete expired logins',
				description: 'Removes logins that are no longer valid anyway.'
			},
			cache: {
				name: 'Clean up cache',
				description: 'Removes outdated answers from TMDB, IGDB and AniList from memory.'
			},
			images: {
				name: 'Clean up images',
				description:
					'Deletes stored posters and images that were not needed for 30 days or are too old – all others stay stored. Cannot be switched off, because the data sources limit how long images may be kept.'
			}
		},
		frequency: 'How often',
		frequencies: { hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' },
		time: 'Time',
		weekday: 'Weekday',
		hourlyHint: 'At the start of every hour.',
		monthlyHint: 'On the 1st of every month.',
		lastRun: (date) => `Last run: ${date}`,
		neverRun: 'Never run yet',
		nextRun: (date) => `Next run: ${date}`,
		freed: (size) => `${size} freed`,
		stored: {
			images: (size, count) => `Stored: ${count} ${count === 1 ? 'image' : 'images'} (${size})`,
			metadata: (size, count) =>
				`Preloaded: details of ${count} ${count === 1 ? 'title' : 'titles'} (${size})`,
			optimize: (size) => `Database size: ${size}`,
			backup: (size) => `All backups: ${size}`
		},
		off: 'Switched off',
		failed: 'Failed:',
		running: 'Running …',
		runNow: 'Run now',
		done: 'Done ✓',
		stillRunning: 'Still running in the background – reload the page later to see the result.',
		apiHint:
			'This task sends many requests to TMDB, IGDB or AniList. Please do not start it by hand too often, or the services may block the app for a while.',
		keep: 'How many backups to keep',
		volumeHint:
			'Do you back up the whole Docker volume instead? Then copy it while the container is stopped – or always copy the three files hdtracker.db, hdtracker.db-wal and hdtracker.db-shm together. Otherwise the copy of the database may be incomplete.',
		backups: 'Existing backups',
		noBackups: 'No backups yet.',
		download: 'Download',
		delete: 'Delete',
		deleteAll: 'Delete all',
		deleteAllConfirm: 'Really delete all?',
		refreshFailed: (failed, total) => `${failed} of ${total} entries could not be refreshed.`,
		restoreHint: 'How to restore a backup is described in the documentation:',
		restoreLink: 'Backups and restore'
	},

	exportData: {
		title: 'Export',
		intro:
			'Downloads your whole library as a CSV file: statuses, watched episodes and anime progress. The file has the format of Yamtrack and can be imported there – and here – again.',
		download: 'Download library',
		animeLoading: (n) =>
			`${n} anime ${n === 1 ? 'is' : 'are'} still loading and ${n === 1 ? 'is' : 'are'} missing from the file until then.`,
		animeUnknown: (n) =>
			`${n} anime ${n === 1 ? 'has' : 'have'} no entry at MyAnimeList and ${n === 1 ? 'is' : 'are'} therefore missing from the file (Yamtrack only knows anime through it).`
	},

	importData: {
		title: 'Import',
		intro:
			'Takes over your library from Yamtrack: movies, series with watched episodes, anime with progress and games – each with its status.',
		file: 'CSV export from Yamtrack',
		start: 'Import',
		notes:
			'Titles already in your library are skipped. Posters, descriptions and release dates are loaded in the background afterwards – with many titles this takes a few minutes.',
		done: 'Import finished ✓',
		imported: 'Imported',
		episodes: (n) => `${n} watched ${n === 1 ? 'episode' : 'episodes'}`,
		existing: (n) =>
			`${n} ${n === 1 ? 'title was' : 'titles were'} already in the library and left unchanged`,
		skipped: (n) => `Skipped (${n})`,
		reasons: {
			manual: 'added by hand in Yamtrack, no database entry',
			unsupported: 'media type not supported',
			notFound: 'not found'
		},
		loading: (n, minutes) =>
			`Loading details: ${n} ${n === 1 ? 'title' : 'titles'} left${minutes > 1 ? `, about ${minutes} min` : ''} …`,
		loadingHint:
			'You can keep using hdtracker meanwhile. Titles without details show “…”; the areas show the new state when you reopen them.',
		loaded: 'All details loaded',
		hiddenFound: (list) => `The file contains ${list} – these areas are hidden.`,
		hiddenSkip: 'Skip',
		hiddenImport: 'Import anyway',
		hiddenEnable: 'Show and import',
		hiddenSkipped: (n, area) => `${n} × ${area} skipped (area hidden)`,
		noFile: 'Please choose a file.',
		invalidFile: 'This is not a CSV export from Yamtrack.',
		failed: 'Import failed:'
	},

	units: {
		minutes: (n) => `${n} min`,
		hoursMinutes: (h, min) => (min ? `${h} h ${min} min` : `${h} h`)
	},

	about: {
		title: 'About',
		tagline:
			'Self-hosted tracker for movies, series, anime and games – made for watching together on the couch.',
		version: (v) => `Version: v${v}`,
		docs: 'Documentation (wiki)',
		source: 'Source code on GitHub',
		versionHint: 'What’s new in this version?',
		links: 'Links',
		issues: 'Report a bug or suggest an idea',
		license: 'License: GNU AGPL v3',
		dataSources: 'Data sources',
		tmdb: 'Movie and series data. This product uses the TMDB API but is not endorsed or certified by TMDB.',
		justwatch: 'Streaming offers (via TMDB)',
		igdb: 'Game data',
		anilist: 'Anime data',
		wikidata: 'Direct links to titles on streaming services',
		palettes: 'Some themes use free colour palettes:',
		ai: 'Built with the help of AI (Claude Code).'
	},

	errors: {
		missingKey: (name) => `${name} is missing in .env – see .env.example.`,
		unreachable: (source) => `${source} is not reachable right now.`,
		badCredentials: (source) => `${source}: invalid credentials – please check .env.`,
		httpError: (source, status) => `${source} responded with error ${status}.`,
		igdbBadClient: 'IGDB: invalid client ID or secret – please check .env.',
		animeNotFound: 'Anime not found.',
		gameNotFound: 'Game not found.'
	}
};
