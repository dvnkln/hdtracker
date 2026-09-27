import type { Messages } from './de';

// English texts of the user interface. Must have exactly the same structure as de.ts.
export const en: Messages = {
	locale: 'en-US',

	common: {
		close: 'Close',
		search: 'Search',
		logout: 'Log out',
		settings: 'Settings',
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
		hello: (name) => `Hello ${name}`
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
		removeConfirm: 'Really remove from library?'
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
			released: 'Released',
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
		nextEpisode: (n, date) => `Next episode (${n}) on ${date}`,
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
		save: 'Save',
		saved: 'Saved ✓',

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

		behavior: 'Behavior',
		autoStatus: 'Update status automatically',
		autoStatusHint:
			'First episode ticked → “Watching”. All episodes of a finished show watched → “Watched”.',

		account: 'Account',
		changePassword: 'Change password',
		currentPassword: 'Current password',
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
			}
		},
		enabled: 'Active',
		frequency: 'How often',
		frequencies: { hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' },
		time: 'Time',
		weekday: 'Weekday',
		hourlyHint: 'At the start of every hour.',
		monthlyHint: 'On the 1st of every month.',
		lastRun: (date) => `Last run: ${date}`,
		neverRun: 'Never run yet',
		nextRun: (date) => `Next run: ${date}`,
		off: 'Switched off',
		failed: 'Failed:',
		running: 'Running …',
		runNow: 'Run now',
		done: 'Done ✓',
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
		restoreHint: 'How to restore a backup is described in the README.'
	},

	units: {
		minutes: (n) => `${n} min`,
		hoursMinutes: (h, min) => (min ? `${h} h ${min} min` : `${h} h`)
	},

	footer: {
		tmdbBefore: 'Movie and series data from',
		tmdbAfter: '. This product uses the TMDB API but is not endorsed or certified by TMDB.',
		gamesBy: 'Game data from',
		animeBy: 'anime data from'
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
