import type { Messages } from './de';

// English texts of the user interface. Must have exactly the same structure as de.ts.
export const en: Messages = {
	locale: 'en-US',

	common: {
		close: 'Close',
		search: 'Search',
		logout: 'Log out',
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
