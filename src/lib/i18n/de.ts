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
		showPassword: 'Passwort anzeigen',
		hidePassword: 'Passwort verbergen',
		tba: 'TBA',
		earlyAccess: 'Early Access',
		tbaHint: 'Erscheinungsdatum noch nicht angekündigt',
		loadingDetails: 'Details werden geladen',
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
		recent: 'Kürzlich erschienen',
		recentHint: 'Letzte 4 Wochen',
		upcoming: 'Demnächst',
		noRecent: 'In den letzten 4 Wochen ist nichts Neues erschienen.',
		noUpcoming: 'Keine anstehenden Termine bekannt.',
		emptyLibrary:
			'Hier erscheinen neue Folgen, Kinostarts und Releases von allem, was du geplant hast oder gerade schaust bzw. spielst. Füge dazu Titel über die Bereiche unten zur Bibliothek hinzu.',
		dateOpen: 'Datum offen',
		kinds: {
			cinema: 'Kinostart',
			home: 'Heimkino-Start',
			release: 'Erscheinungstermin',
			earlyAccess: 'Early Access',
			fullRelease: 'Vollversion'
		} as Record<string, string>,
		episodeCode: (season: number, episode: number) =>
			`S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`,
		animeEpisodes: (from: number, to: number) =>
			from === to ? `Folge ${from}` : `Folgen ${from}–${to}`,
		seriesStart: 'Serienstart',
		seasonStart: 'Staffelstart',
		animeStart: 'Start'
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
		removeConfirm: 'Wirklich aus der Bibliothek entfernen?',
		notReleased: 'Noch nicht erschienen – Doppeltipp setzt den Status trotzdem'
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
			earlyAccess: 'Early Access',
			fullRelease: 'Vollversion',
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
		nextEpisode: (episode: string, date: string) => `Nächste Folge (${episode}) am ${date}`,
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
		general: 'Allgemein',
		title: 'Einstellungen',
		groupPersonal: 'Persönlich',
		groupAdmin: 'Verwaltung',
		generalHint: 'Sprache, Anzeige, Bereiche',
		accountHint: 'Benutzername, Passwort, Geräte',
		data: 'Daten',
		dataHint: 'Import, Bibliothek leeren',
		server: 'Server',
		serverHint: 'Sprache der Inhalte, Region',
		maintenanceHint: 'Hintergrundaufgaben, Backups',
		aboutHint: 'Version, Links, Datenquellen',
		content: 'Inhalte',
		changeUsername: 'Benutzernamen ändern',
		newUsername: 'Neuer Benutzername',
		usernameChanged: 'Benutzername geändert ✓',
		usernameTaken: 'Dieser Benutzername ist schon vergeben.',
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

		hideSpoilers: 'Spoiler-Schutz',
		hideSpoilersHint:
			'Bilder und Beschreibungen noch nicht gesehener Folgen werden unscharf angezeigt.',

		areas: 'Bereiche',
		areasHint: 'Ausgeblendete Bereiche verschwinden aus Navigation, Suche und Dashboard.',
		areaHiddenData: (n: number) =>
			`${n} ${n === 1 ? 'Eintrag bleibt' : 'Einträge bleiben'} erhalten, ${n === 1 ? 'wird' : 'werden'} aber nicht mehr aktualisiert, und es gibt keine Benachrichtigungen dazu. Bei Bedarf in der Gefahrenzone löschen.`,
		areasMin: 'Mindestens ein Bereich muss eingeblendet bleiben.',

		behavior: 'Verhalten',
		autoStatus: 'Status automatisch anpassen',
		autoStatusHint:
			'Erste Folge abgehakt → „Schaue ich“. Alle Folgen einer beendeten Serie gesehen → „Gesehen“.',

		account: 'Konto',
		changePassword: 'Passwort ändern',
		currentPassword: 'Aktuelles Passwort',
		currentPasswordConfirm: 'Aktuelles Passwort zur Bestätigung',
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

	maintenance: {
		title: 'Wartung',
		intro: (timeZone: string) =>
			`Diese Aufgaben laufen automatisch im Hintergrund. Uhrzeiten gelten in der Zeitzone des Servers (${timeZone}).`,
		tasks: {
			backup: {
				name: 'Backup',
				description: 'Speichert eine Kopie der Datenbank im Ordner /data/backups.'
			},
			metadata: {
				name: 'Metadaten aktualisieren',
				description:
					'Holt Titel, Poster und Erscheinungstermine aller Einträge neu (für das Dashboard). Abgebrochene Titel werden übersprungen.'
			},
			optimize: {
				name: 'Datenbank-Pflege',
				description: 'Räumt die Datenbank auf und macht die Datei kompakter.'
			},
			sessions: {
				name: 'Abgelaufene Anmeldungen löschen',
				description: 'Entfernt Anmeldungen, die ohnehin nicht mehr gültig sind.'
			},
			cache: {
				name: 'Zwischenspeicher aufräumen',
				description: 'Wirft veraltete Antworten von TMDB, IGDB und AniList aus dem Arbeitsspeicher.'
			}
		} as Record<string, { name: string; description: string }>,
		frequency: 'Wie oft',
		frequencies: {
			hourly: 'Stündlich',
			daily: 'Täglich',
			weekly: 'Wöchentlich',
			monthly: 'Monatlich'
		} as Record<string, string>,
		time: 'Uhrzeit',
		weekday: 'Wochentag',
		hourlyHint: 'Immer zur vollen Stunde.',
		monthlyHint: 'Immer am 1. des Monats.',
		lastRun: (date: string) => `Zuletzt: ${date}`,
		neverRun: 'Noch nie ausgeführt',
		nextRun: (date: string) => `Nächster Lauf: ${date}`,
		off: 'Ausgeschaltet',
		failed: 'Fehlgeschlagen:',
		running: 'Läuft gerade …',
		runNow: 'Jetzt ausführen',
		done: 'Erledigt ✓',
		apiHint:
			'Diese Aufgabe stellt viele Anfragen an TMDB, IGDB bzw. AniList. Bitte nicht zu oft von Hand starten, sonst sperren die Dienste die App vorübergehend.',
		keep: 'Wie viele Backups behalten',
		volumeHint:
			'Sicherst du stattdessen das ganze Docker-Volume? Dann kopiere es bei gestopptem Container – oder immer die drei Dateien hdtracker.db, hdtracker.db-wal und hdtracker.db-shm zusammen. Sonst kann die Kopie der Datenbank unvollständig sein.',
		backups: 'Vorhandene Backups',
		noBackups: 'Noch keine Backups vorhanden.',
		download: 'Herunterladen',
		delete: 'Löschen',
		deleteAll: 'Alle löschen',
		deleteAllConfirm: 'Wirklich alle löschen?',
		refreshFailed: (failed: number, total: number) =>
			`${failed} von ${total} Einträgen konnten nicht aktualisiert werden.`,
		restoreHint: 'Wie man ein Backup zurückspielt, steht in der Dokumentation:',
		restoreLink: 'Backups and restore'
	},

	importData: {
		title: 'Import',
		intro:
			'Übernimmt deine Bibliothek aus Yamtrack: Filme, Serien mit gesehenen Folgen, Anime mit Fortschritt und Spiele – jeweils mit Status.',
		file: 'CSV-Export aus Yamtrack',
		start: 'Importieren',
		notes:
			'Titel, die schon in deiner Bibliothek sind, werden übersprungen. Poster, Beschreibungen und Termine lädt die App danach im Hintergrund nach – bei vielen Titeln dauert das einige Minuten.',
		done: 'Import abgeschlossen ✓',
		imported: 'Übernommen',
		episodes: (n: number) => `${n} gesehene ${n === 1 ? 'Folge' : 'Folgen'}`,
		existing: (n: number) =>
			`${n} ${n === 1 ? 'Titel war' : 'Titel waren'} schon in der Bibliothek und ${n === 1 ? 'blieb' : 'blieben'} unverändert`,
		skipped: (n: number) => `Übersprungen (${n})`,
		reasons: {
			manual: 'in Yamtrack von Hand angelegt, ohne Datenbank-Eintrag',
			unsupported: 'Medientyp wird nicht unterstützt',
			notFound: 'nicht gefunden'
		} as Record<string, string>,
		loading: (n: number, minutes: number) =>
			`Details werden geladen: noch ${n} Titel${minutes > 1 ? `, ca. ${minutes} Min.` : ''} …`,
		loadingHint:
			'Du kannst hdtracker währenddessen normal benutzen. Titel ohne Details zeigen „…“; die Bereiche zeigen den neuen Stand, sobald du sie neu öffnest.',
		loaded: 'Alle Details geladen',
		hiddenFound: (list: string) => `Die Datei enthält ${list} – diese Bereiche sind ausgeblendet.`,
		hiddenSkip: 'Überspringen',
		hiddenImport: 'Trotzdem importieren',
		hiddenEnable: 'Einblenden und importieren',
		hiddenSkipped: (n: number, area: string) =>
			`${n} × ${area} übersprungen (Bereich ausgeblendet)`,
		noFile: 'Bitte eine Datei auswählen.',
		invalidFile: 'Das ist keine CSV-Exportdatei aus Yamtrack.',
		failed: 'Import fehlgeschlagen:'
	},

	units: {
		minutes: (n: number) => `${n} Min.`,
		hoursMinutes: (h: number, min: number) => (min ? `${h} Std. ${min} Min.` : `${h} Std.`)
	},

	about: {
		title: 'Über',
		tagline:
			'Selbst gehosteter Tracker für Filme, Serien, Anime und Spiele – gemacht fürs gemeinsame Schauen auf der Couch.',
		version: (v: string) => `Version: v${v}`,
		docs: 'Dokumentation (Wiki)',
		source: 'Quellcode auf GitHub',
		versionHint: 'Was ist neu in dieser Version?',
		links: 'Links',
		issues: 'Fehler melden oder Ideen vorschlagen',
		license: 'Lizenz: GNU AGPL v3',
		dataSources: 'Datenquellen',
		tmdb: 'Film- und Seriendaten. Dieses Produkt nutzt die TMDB-API, wird aber nicht von TMDB unterstützt oder zertifiziert.',
		justwatch: 'Streaming-Angebote (über TMDB)',
		igdb: 'Spieldaten',
		anilist: 'Animedaten',
		ai: 'Entwickelt mit Unterstützung von KI (Claude Code).'
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
