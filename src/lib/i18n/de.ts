// German texts of the user interface. en.ts must have exactly the same structure.

// Soft hyphen: invisible, but long words may break there (with a dash) when space is tight.
const SHY = '­';
const DROPPED = `Abge${SHY}brochen`;

export const de = {
	locale: 'de-DE',

	common: {
		close: 'Schließen',
		search: 'Suchen',
		logout: 'Abmelden',
		settings: 'Einstellungen',
		home: 'Startseite',
		more: 'Mehr anzeigen',
		less: 'Weniger',
		notFound: 'Nicht gefunden',
		loadFailed: 'Laden fehlgeschlagen.',
		invalidData: 'Ungültige Daten',
		invalidStatus: 'Ungültiger Status'
	},

	categories: { movies: 'Filme', series: 'Serien', anime: 'Anime', games: 'Spiele' },

	// Status names per area. A missing entry means the status is not used there (see status.ts).
	statusLabels: {
		movies: { planned: 'Geplant', completed: 'Gesehen', dropped: DROPPED },
		series: {
			active: 'Schaue ich',
			paused: 'Pausiert',
			planned: 'Geplant',
			completed: 'Gesehen',
			dropped: DROPPED
		},
		anime: {
			active: 'Schaue ich',
			paused: 'Pausiert',
			planned: 'Geplant',
			completed: 'Gesehen',
			dropped: DROPPED
		},
		games: {
			active: 'Spiele ich',
			paused: 'Pausiert',
			planned: 'Geplant',
			completed: `Durch${SHY}gespielt`,
			dropped: DROPPED
		}
	} as Record<string, Record<string, string>>,

	auth: {
		loginTitle: 'Anmelden',
		setupTitle: 'Einrichtung',
		welcome: 'Willkommen! Lege dein Admin-Konto an.',
		username: 'Benutzername',
		password: 'Passwort',
		passwordMin: (n: number) => `Passwort (min. ${n} Zeichen)`,
		passwordRepeat: 'Passwort wiederholen',
		login: 'Anmelden',
		createAccount: 'Konto anlegen',
		wrongCredentials: 'Benutzername oder Passwort falsch',
		tooManyAttempts: (seconds: number) => `Zu viele Fehlversuche. Bitte ${seconds} s warten.`,
		usernameRule: 'Benutzername: 3–32 Zeichen, nur Buchstaben, Zahlen, _ . -',
		passwordTooShort: (n: number) => `Passwort muss mindestens ${n} Zeichen lang sein`,
		passwordsDiffer: 'Passwörter stimmen nicht überein'
	},

	home: {
		hello: (name: string) => `Hallo ${name}`
	},

	library: {
		searchPlaceholder: (category: string) => `${category} suchen…`,
		results: (count: number, query: string) => `${count} Treffer für „${query}“`,
		toLibrary: 'Zur Bibliothek',
		noResults: 'Keine Treffer.',
		empty:
			'Deine Bibliothek ist noch leer. Suche oben nach einem Titel und tippe ihn an, um ihn hinzuzufügen.',
		searchFailed: 'Suche fehlgeschlagen.'
	},

	sheet: {
		details: 'Details',
		detailsAndEpisodes: 'Details & Folgen',
		remove: 'Aus Bibliothek entfernen',
		removeConfirm: 'Wirklich aus der Bibliothek entfernen?'
	},

	detail: {
		addToLibrary: 'Zur Bibliothek',
		whereToWatch: "Wo läuft's?",
		flatrate: 'Im Abo',
		rent: 'Leihen',
		buy: 'Kaufen',
		noOffers: 'Aktuell bei keinem Anbieter verfügbar.',
		streamingDataBy: 'Streaming-Daten von',
		streaming: 'Streaming',
		animeLinksNote:
			'Offizielle Links laut AniList – Verfügbarkeit in deiner Region nicht garantiert.',
		episodes: 'Folgen',
		similar: 'Ähnliche Titel',
		seasons: (n: number) => `${n} ${n === 1 ? 'Staffel' : 'Staffeln'}`,
		episodeCount: (n: number) => `${n} Folgen`,
		perEpisode: (minutes: number) => `ca. ${minutes} Min. pro Folge`,
		facts: {
			cinema: 'Kinostart',
			home: 'Heimkino (digital/Disc)',
			network: 'Sender',
			episodes: 'Folgen',
			firstAired: 'Erstausstrahlung',
			studio: 'Studio',
			released: 'Erschienen',
			platforms: 'Plattformen',
			developer: 'Entwickler'
		},
		formats: {
			TV: 'TV-Serie',
			TV_SHORT: 'TV-Serie (kurz)',
			MOVIE: 'Film',
			SPECIAL: 'Special',
			OVA: 'OVA',
			ONA: 'ONA',
			MUSIC: 'Musikvideo'
		} as Record<string, string>
	},

	episodes: {
		watched: 'Folgen gesehen',
		notYetAired: (n: number) => `(${n} noch nicht erschienen)`,
		allWatched: 'Alles gesehen',
		reset: 'Zurücksetzen',
		resetConfirm: 'Alle Folgen als ungesehen markieren?',
		nextEpisode: (n: number, date: string) => `Nächste Folge (${n}) am ${date}`,
		noneKnown: 'Noch keine Folgen bekannt.',
		announced: 'Angekündigt',
		startsOn: (date: string) => `Start am ${date}`,
		dateOpen: 'Termin noch offen',
		seasonWatched: 'Ganze Staffel gesehen',
		seasonUnwatch: 'Staffel als ungesehen markieren',
		specialsNote: 'Specials zählen nicht zum Fortschritt.',
		airsOn: (date: string) => `erscheint am ${date}`,
		episode: (n: number) => `Folge ${n}`,
		season: (n: number) => `Staffel ${n}`,
		specials: 'Specials'
	},

	settings: {
		title: 'Einstellungen',
		save: 'Speichern',
		saved: 'Gespeichert ✓',

		display: 'Darstellung',
		uiLanguage: 'Sprache der Oberfläche',
		contentLanguage: 'Sprache der Inhalte',
		contentLanguageHint:
			'Titel und Beschreibungen von Filmen und Serien (TMDB). Titel, die schon in der Bibliothek sind, bleiben vorerst in ihrer bisherigen Sprache.',
		region: 'Region',
		regionHint: 'Für Streaming-Anbieter und Erscheinungsdaten.',
		listsUnavailable: 'TMDB ist gerade nicht erreichbar – die Auswahllisten sind unvollständig.',
		animeTitle: 'Anime-Titel',
		animeTitleEnglish: 'Englischer Titel oben, Romaji darunter',
		animeTitleRomaji: 'Romaji oben, englischer Titel darunter',

		behavior: 'Verhalten',
		autoStatus: 'Status automatisch anpassen',
		autoStatusHint:
			'Erste Folge abgehakt → „Schaue ich“. Alle Folgen einer beendeten Serie gesehen → „Gesehen“.',

		account: 'Konto',
		changePassword: 'Passwort ändern',
		currentPassword: 'Aktuelles Passwort',
		newPassword: (n: number) => `Neues Passwort (min. ${n} Zeichen)`,
		repeatPassword: 'Neues Passwort wiederholen',
		wrongPassword: 'Das aktuelle Passwort ist falsch.',
		passwordChanged: 'Passwort geändert ✓ Alle anderen Geräte wurden abgemeldet.',
		otherDevices: 'Andere Geräte',
		otherDevicesHint: 'Meldet alle Browser und Geräte ab – außer diesem hier.',
		logoutOthers: 'Alle anderen Geräte abmelden',
		loggedOutOthers: (n: number) =>
			n === 0
				? 'Es war kein anderes Gerät angemeldet ✓'
				: `${n} ${n === 1 ? 'Gerät' : 'Geräte'} abgemeldet ✓`,

		danger: 'Gefahrenzone',
		clearLibrary: 'Bibliothek leeren',
		clearHint:
			'Löscht alle Einträge samt gesehener Folgen. Das lässt sich nicht rückgängig machen.',
		clearWhat: 'Was soll gelöscht werden?',
		clearAll: 'Alle Bereiche',
		confirmWord: 'LÖSCHEN',
		confirmPrompt: (word: string) => `Zur Bestätigung „${word}“ eintippen`,
		confirmWrong: (word: string) => `Bitte genau „${word}“ eintippen.`,
		clearButton: 'Endgültig löschen',
		cleared: (n: number) => `${n} ${n === 1 ? 'Eintrag' : 'Einträge'} gelöscht ✓`
	},

	units: {
		minutes: (n: number) => `${n} Min.`,
		hoursMinutes: (h: number, min: number) => (min ? `${h} Std. ${min} Min.` : `${h} Std.`)
	},

	footer: {
		tmdbBefore: 'Film- und Seriendaten von',
		tmdbAfter:
			'. Dieses Produkt nutzt die TMDB-API, wird aber nicht von TMDB unterstützt oder zertifiziert.',
		gamesBy: 'Spieldaten von',
		animeBy: 'Animedaten von'
	},

	// Errors from the external APIs (created on the server).
	errors: {
		missingKey: (name: string) => `${name} fehlt in der .env – siehe .env.example.`,
		unreachable: (source: string) => `${source} ist gerade nicht erreichbar.`,
		badCredentials: (source: string) => `${source}: Zugangsdaten ungültig – bitte .env prüfen.`,
		httpError: (source: string, status: number) => `${source} antwortet mit Fehler ${status}.`,
		igdbBadClient: 'IGDB: Client-ID oder Secret ungültig – bitte .env prüfen.',
		animeNotFound: 'Anime nicht gefunden.',
		gameNotFound: 'Spiel nicht gefunden.'
	}
};

export type Messages = typeof de;
