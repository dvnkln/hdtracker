// German texts of the user interface. en.ts must have exactly the same structure.

// Soft hyphen: invisible, but long words may break there (with a dash) when space is tight.
const SHY = '­';
const DROPPED = `Abge${SHY}brochen`;

export const de = {
	locale: 'de-DE',

	common: {
		close: 'Schließen',
		cancel: 'Abbrechen',
		search: 'Suchen',
		logout: 'Abmelden',
		settings: 'Einstellungen',
		accountMenu: 'Konto-Menü',
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
		tooManyAttempts: (seconds: number) =>
			`Zu viele Fehlversuche. Bitte ${seconds >= 120 ? `${Math.ceil(seconds / 60)} min` : `${seconds} s`} warten.`,
		usernameRule: 'Benutzername: 3–32 Zeichen, nur Buchstaben, Zahlen, _ . -',
		passwordTooShort: (n: number) => `Passwort muss mindestens ${n} Zeichen lang sein`,
		passwordsDiffer: 'Passwörter stimmen nicht überein',
		passwordMissing: (n: number) => (n === 1 ? 'noch 1 Zeichen' : `noch ${n} Zeichen`),
		passwordLongEnough: 'lang genug',
		passwordsMatch: 'stimmt überein',
		passwordsNoMatchYet: 'stimmt noch nicht überein',
		accountLocked: 'Dieses Konto ist gesperrt. Wende dich an den Admin.',
		newPasswordTitle: 'Eigenes Passwort wählen',
		newPasswordIntro:
			'Du hast dich mit einem Übergangspasswort angemeldet. Wähle jetzt ein Passwort, das nur du kennst.',
		saveNewPassword: 'Passwort speichern'
	},
	inbox: {
		title: 'Mitteilungen',
		// The bell in the header
		open: (n: number) => (n === 0 ? 'Mitteilungen' : `Mitteilungen – ${n} neu`),
		news: 'Neuigkeiten',
		unread: 'neu',
		accepted: (name: string) => `${name} hat deine Einladung angenommen`,
		declined: (name: string) => `${name} hat deine Einladung abgelehnt`,
		left: (name: string) => `${name} trackt das nicht mehr mit dir`,
		emptyTitle: 'Nichts Neues',
		emptyHint: 'Neuerscheinungen und Einladungen landen hier.',
		pushSettings: 'Auch als Push-Meldung'
	},
	share: {
		// Invitations, as the inbox lists them
		incoming: 'Einladungen für dich',
		outgoing: 'Warten auf Antwort',
		fromWithStatus: (name: string, status: string) => `${name} lädt dich ein · ${status}`,
		waitingFor: (name: string) => `Eingeladen: ${name}`,
		title: 'Gemeinsam tracken',
		// The symbol on a title's page, in its three states
		alone: 'Gemeinsam tracken – jemanden einladen',
		invited: 'Gemeinsam tracken – Einladung noch offen',
		together: (names: string) => `Gemeinsam mit ${names}`,
		with: 'Gemeinsam mit',
		invite: 'Einladen',
		inviteAction: 'Einladen',
		inviteName: (name: string) => `${name} einladen`,
		pending: 'Eingeladen – noch keine Antwort',
		withdraw: 'Zurückziehen',
		withdrawName: (name: string) => `Einladung für ${name} zurückziehen`,
		inviteHint:
			'Wer annimmt, übernimmt deinen Status und deine gesehenen Folgen. Ab dann pflegt ihr beides gemeinsam.',
		leave: 'Nicht mehr gemeinsam tracken',
		leaveHint:
			'Du behältst den Titel mit dem jetzigen Status und den gesehenen Folgen als eigene Kopie. Die anderen behalten ihren Stand.',
		leaveNow: 'Allein weiter tracken',
		// An invitation waiting on the page of its title
		invitedBy: (name: string) => `${name} lädt dich ein, das gemeinsam zu tracken`,
		theirStatus: (status: string) => `Status dort: ${status}`,
		replaces: 'Dein eigener Status und deine gesehenen Folgen werden dadurch ersetzt.',
		accept: 'Annehmen',
		decline: 'Ablehnen',
		short: 'Gemeinsam',
		pendingShort: 'Eingeladen',
		endSelection: 'Auswahl beenden',
		// Selecting several titles in the library
		select: 'Auswählen',
		selected: (n: number) => (n === 1 ? '1 Titel ausgewählt' : `${n} Titel ausgewählt`),
		inviteSelected: 'Einladen …',
		chooseWho: 'Wen einladen?',
		sent: (n: number, name: string) =>
			n === 0
				? `Keine neue Einladung für ${name}.`
				: n === 1
					? `1 Einladung an ${name} verschickt.`
					: `${n} Einladungen an ${name} verschickt.`,
		sentAlready: (n: number) =>
			n === 1
				? '1 Titel war schon geteilt oder angefragt.'
				: `${n} Titel waren schon geteilt oder angefragt.`,
		errors: {
			notYours: 'Dieser Titel ist nicht in deiner Bibliothek.',
			unknown: 'Das geht nicht mehr – bitte die Seite neu laden.',
			self: 'Du kannst dich nicht selbst einladen.',
			member: 'Ihr trackt das schon gemeinsam.',
			alone: 'Du trackst diesen Titel allein.'
		} as Record<string, string>
	},
	profile: {
		title: 'Profil',
		upload: 'Bild hochladen',
		remove: 'Bild entfernen',
		newColor: 'Neue Farbe',
		uploadFailed: 'Hochladen fehlgeschlagen. Versuche es erneut.',
		displayName: 'Anzeigename',
		displayNameHint: 'So sehen dich die anderen. Leer: dein Benutzername.'
	},
	users: {
		title: 'Benutzer',
		navHint: 'Konten, Rollen',
		accounts: 'Konten',
		you: 'du',
		roles: { admin: 'Admin', user: 'Benutzer' } as Record<string, string>,
		titles: (n: number) => (n === 1 ? '1 Titel' : `${n} Titel`),
		locked: 'gesperrt',
		temporary: 'Übergangspasswort',
		lastLogin: (date: string) => `zuletzt angemeldet ${date}`,
		neverLoggedIn: 'noch nie angemeldet',
		add: 'Benutzer anlegen',
		create: 'Anlegen',
		createHint:
			'Ein neues Konto bekommt ein Übergangspasswort. Beim ersten Anmelden muss ein eigenes gewählt werden.',
		passwordFor: (name: string) => `Für ${name} – gib es persönlich weiter.`,
		temporaryHint:
			'Wird nur jetzt angezeigt. Nach dem Anmelden damit muss ein eigenes Passwort gewählt werden.',
		admin: 'Admin',
		adminHint: 'Darf Konten verwalten und alles unter „Verwaltung“ ändern.',
		lock: 'Gesperrt',
		lockHint: 'Anmelden geht nicht mehr. Bibliothek und Einstellungen bleiben erhalten.',
		reset: 'Passwort zurücksetzen',
		resetHint: 'Zurücksetzen vergibt ein neues Übergangspasswort und meldet das Konto überall ab.',
		delete: 'Konto löschen',
		deleteWarning: (name: string, titles: number) =>
			`${name} wird mit Bibliothek (${titles} Titel), Einstellungen und Geräten gelöscht. Das lässt sich nicht rückgängig machen.`,
		confirmLabel: (name: string) => `Zur Bestätigung „${name}“ eintippen`,
		confirmWrong: (name: string) => `Bitte genau „${name}“ eintippen.`,
		deleteNow: 'Endgültig löschen',
		deleted: (name: string) => `${name} gelöscht ✓`,
		rights: 'Rechte',
		customTargets: 'Webhook und ntfy für alle',
		customTargetsHint:
			'Aus: nur Admins. Solche Ziele lassen den Server Adressen deiner Wahl aufrufen – auch im eigenen Netz.',
		errors: {
			username: 'Benutzername: 3–32 Zeichen, nur Buchstaben, Zahlen, _ . -',
			taken: 'Diesen Benutzernamen gibt es schon.',
			unknown: 'Dieses Konto gibt es nicht (mehr).',
			lastAdmin: 'Es muss mindestens ein Admin bleiben, der sich anmelden kann.',
			self: 'Das eigene Konto lässt sich hier nicht sperren oder löschen.',
			displayName: 'Der Anzeigename darf höchstens 30 Zeichen haben.',
			nameTaken: 'Unter diesem Namen ist schon jemand zu sehen.',
			picture: 'Das ließ sich nicht als Bild lesen (oder es ist zu groß).'
		} as Record<string, string>
	},

	home: {
		recent: 'Kürzlich erschienen',
		recentHint: '4 Wochen',
		upcoming: 'Demnächst',
		noRecent: 'In den letzten 4 Wochen ist nichts Neues erschienen.',
		noUpcoming: 'Keine anstehenden Termine bekannt.',
		emptyTitle: 'Noch nichts los',
		emptyHint: 'Füge Titel über die Bereiche unten hinzu.',
		dateOpen: 'Datum offen',
		order: {
			recent: { desc: 'Neueste zuerst', asc: 'Älteste zuerst' },
			upcoming: { asc: 'Nächste zuerst', desc: 'Späteste zuerst' },
			reverse: 'Reihenfolge umkehren'
		},
		kinds: {
			cinema: 'Kinostart',
			home: 'Heimkino-Start',
			release: 'Erscheinungstermin',
			earlyAccess: 'Early Access',
			fullRelease: 'Release'
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
		noResults: 'Keine Treffer',
		noResultsHint: 'Probier eine andere Schreibweise.',
		emptyTitle: {
			movies: 'Noch keine Filme',
			series: 'Noch keine Serien',
			anime: 'Noch keine Anime',
			games: 'Noch keine Spiele'
		},
		emptyHint: 'Suche oben nach einem Titel.',
		searchFailed: 'Suche fehlgeschlagen.'
	},

	sheet: {
		notifyOn: 'Benachrichtigen',
		notifyOff: 'Stumm',
		details: 'Details',
		detailsAndEpisodes: 'Details & Folgen',
		remove: 'Aus Bibliothek entfernen',
		removeConfirm: 'Wirklich aus der Bibliothek entfernen?',
		notReleased: 'Noch nicht erschienen – Doppeltipp setzt den Status trotzdem'
	},

	detail: {
		trailer: 'Trailer',
		watchedKept: (n: number) =>
			n === 1
				? '1 Folge ist als gesehen gespeichert.'
				: `${n} Folgen sind als gesehen gespeichert.`,
		sourceMissingNoCopy: (source: string) =>
			`${source} kennt diesen Titel nicht (mehr), und es wurde nichts dazu gespeichert. Dein Status bleibt erhalten.`,
		sourceMissing: (source: string) =>
			`${source} kennt diesen Titel nicht mehr. Du siehst den gespeicherten Stand; er wird nicht mehr aktualisiert.`,
		addToLibrary: 'Zur Bibliothek',
		whereToWatch: "Wo läuft's?",
		flatrate: 'Im Abo',
		rent: 'Leihen',
		buy: 'Kaufen',
		noOffers: 'Aktuell bei keinem Anbieter verfügbar.',
		noStreamingKnown: 'Keine Streaming-Angebote bekannt.',
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
			earlyAccess: 'Early Access',
			fullRelease: 'Release',
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
		accountHint: 'Name, Passwort, Geräte',
		data: 'Daten',
		dataHint: 'Import, Export, Leeren',
		server: 'Server',
		serverHint: 'Übersicht, Inhalte, Proxy',
		maintenanceHint: 'Aufgaben, Speicher, Backups',
		aboutHint: 'Version, Links, Datenquellen',
		content: 'Inhalte',
		changeUsername: 'Benutzernamen ändern',
		newUsername: 'Neuer Benutzername',
		usernameChanged: 'Benutzername geändert ✓',
		usernameTaken: 'Dieser Benutzername ist schon vergeben.',
		save: 'Speichern',
		saved: 'Gespeichert ✓',

		appearance: 'Design',
		appearanceHint: 'Farbschema der Oberfläche',
		theme: 'Farbschema',
		themeHint:
			'Gilt für dein Konto auf allen Geräten – und für die Anmeldeseite dieses Geräts. „System“ folgt der Hell/Dunkel-Einstellung des Geräts.',
		themes: {
			system: 'System',
			dark: 'Dunkel',
			light: 'Hell',
			tokyonight: 'Tokyo Night',
			dracula: 'Dracula',
			synthwave: "SynthWave '84",
			cyberpunk: 'Cyberpunk',
			retro95: 'Retro 95',
			terminal: 'Terminal',
			c64: 'Brotkasten'
		},
		display: 'Darstellung',
		uiLanguage: 'Sprache der Oberfläche',
		contentLanguage: 'Sprache der Inhalte',
		contentLanguageHint:
			'Titel und Beschreibungen von Filmen und Serien (TMDB). Nach dem Speichern wird die Bibliothek im Hintergrund in der neuen Sprache geladen.',
		animeEpisodeTitles: 'Folgentitel für Anime',
		animeEpisodeTitlesHint:
			'Titel, Bilder und Texte der Folgen von TMDB – auf Englisch, wie alles zu Anime.',
		region: 'Region',
		regionHint: 'Für Streaming-Anbieter und Erscheinungsdaten.',
		overview: 'Übersicht',
		allFine: 'Alles in Ordnung',
		needsAttention: (n: number) =>
			n === 1 ? '1 Punkt braucht Aufmerksamkeit' : `${n} Punkte brauchen Aufmerksamkeit`,
		fix: 'Beheben',
		checks: {
			https: {
				ok: (_n: number, _names: string[]) => 'Über HTTPS geöffnet',
				hint: (_n: number, _names: string[]) => 'Ohne HTTPS geöffnet',
				action: (_n: number, _names: string[]) => ''
			},
			proxy: {
				ok: (_n: number, _names: string[]) => 'Geräte werden einzeln erkannt',
				hint: (_n: number, _names: string[]) => 'Alle Besucher teilen sich eine Adresse',
				action: (_n: number, _names: string[]) => 'Reverse Proxy nicht bestätigt'
			},
			sources: {
				ok: (_n: number, _names: string[]) => 'Datenquellen eingerichtet',
				hint: (_n: number, _names: string[]) => '',
				action: (_n: number, names: string[]) => `Schlüssel fehlt: ${names.join(', ')}`
			},
			tasks: {
				ok: (_n: number, _names: string[]) => 'Hintergrundaufgaben laufen ohne Fehler',
				hint: (_n: number, _names: string[]) => '',
				action: (n: number, _names: string[]) =>
					n === 1
						? '1 Hintergrundaufgabe fehlgeschlagen'
						: `${n} Hintergrundaufgaben fehlgeschlagen`
			},
			library: {
				ok: (_n: number, _names: string[]) => 'Alle Titel geladen',
				hint: (n: number, _names: string[]) =>
					n === 1 ? '1 Titel wird noch geladen' : `${n} Titel werden noch geladen`,
				action: (_n: number, _names: string[]) => ''
			},
			missing: {
				ok: (_n: number, _names: string[]) => 'Alle Titel bei ihrer Datenquelle bekannt',
				hint: (n: number, _names: string[]) =>
					n === 1
						? '1 Titel bei der Datenquelle nicht mehr gefunden:'
						: `${n} Titel bei der Datenquelle nicht mehr gefunden:`,
				action: (_n: number, _names: string[]) => ''
			},
			logins: {
				ok: (_n: number, _names: string[]) => 'Keine Adresse wegen falscher Passwörter gesperrt',
				hint: (n: number, _names: string[]) =>
					n === 1
						? '1 Adresse ist wegen falscher Passwörter gesperrt'
						: `${n} Adressen sind wegen falscher Passwörter gesperrt`,
				action: (_n: number, _names: string[]) => ''
			}
		},
		infoVersion: 'Version',
		infoRunning: 'Läuft seit',
		infoTitles: 'Titel',
		infoStorage: 'Belegter Speicher',
		connection: 'Verbindung',
		direct: 'Direkt verbunden',
		directHint: 'Mit Reverse Proxy? Öffne diese Seite über ihn, um ihn zu bestätigen.',
		proxyConfirmed: 'Reverse Proxy bestätigt',
		ownBlock: 'Falsche Passwörter sperren nur das Gerät, von dem sie kamen.',
		sharedWhy:
			'Docker gibt allen Besuchern dieselbe Adresse: Fünf falsche Passwörter sperren die Anmeldung für alle. Über einen bestätigten Reverse Proxy wird jedes Gerät einzeln erkannt.',
		proxyPending: 'Reverse Proxy nicht bestätigt',
		pendingWhy:
			'hdtracker verwendet die gemeldete Adresse erst, wenn der Proxy bestätigt ist – behaupten könnte sie jeder. Bis dahin zählen alle Besucher als ein Gerät.',
		recognisedAs: 'Erkannt als',
		proxyReports: 'Proxy meldet',
		notUsedYet: '(noch nicht verwendet)',

		confirmedBy: 'Bestätigt über',
		byAddress: 'Adresse',
		byKey: 'Schlüssel',
		confirmProxy: 'Reverse Proxy bestätigen',
		keyStep1: 'Schlüssel erzeugen',
		keyStep2: 'Diese Zeile bei deinem Proxy eintragen',
		keyStep3: 'Diese Seite neu laden',
		manageKey: 'Schlüssel verwalten',
		snippetWhere: {
			npm: 'Edit Proxy Host → Custom Locations → Add Location „/“ → Zahnrad daneben',
			caddy: 'Caddyfile, im reverse_proxy-Block',
			traefik: 'Labels des hdtracker-Containers',
			nginx: 'Im location-Block mit proxy_pass'
		},
		createKey: 'Schlüssel erzeugen',
		newKey: 'Neuer Schlüssel',
		removeKey: 'Entfernen',
		copy: 'Kopieren',
		copied: 'Kopiert',
		showKey: 'Schlüssel anzeigen',
		hideKey: 'Schlüssel verbergen',
		trustedProxies: 'Erweitert: mehrere Proxys oder Adressbereiche',
		trustedProxiesHint:
			'Nur nötig, wenn sich die Adresse deines Proxys ändert (Docker: den Bereich seines Netzes eintragen) oder bei mehreren Proxys hintereinander. Mit Komma trennen.',
		proxiesInvalid: (entries: string) => `Keine Adresse und kein Bereich: ${entries}`,
		learnMore: 'Mehr dazu',
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

	notifications: {
		title: 'Benachrichtigungen',
		navHint: 'Neuerscheinungen, Ziele',
		learnMore: 'Wie das funktioniert und wer was sieht',
		// What and when
		releases: 'Neuerscheinungen',
		mode: 'Melden',
		modes: {
			off: 'Aus',
			single: 'Einzeln – eine Nachricht je Titel',
			digest: 'Gesammelt – eine Nachricht am Tag'
		},
		hour: 'Ab wann',
		oclock: (hour: number) => `${hour} Uhr`,
		what: 'Gemeldet wird am Erscheinungstag, was im Dashboard unter „Kürzlich erschienen“ auftaucht.',
		// Where to: the list of targets
		targets: 'Ziele',
		noTargets: 'Noch kein Ziel',
		addTarget: 'Ziel hinzufügen',
		kinds: {
			device: 'Dieses Gerät',
			pushover: 'Pushover',
			ntfy: 'ntfy',
			webhook: 'Webhook'
		} as Record<string, string>,
		kindHints: {
			device: 'Push-Nachrichten direkt aus der App, ohne weiteren Dienst',
			pushover: 'Über dein Pushover-Konto, an alle oder einzelne Geräte',
			ntfy: 'An ein Thema bei ntfy.sh oder auf deinem eigenen ntfy-Server',
			webhook: 'An eine Adresse deiner Wahl, z. B. Gotify oder Home Assistant'
		} as Record<string, string>,
		here: 'dieses Gerät',
		switchLabel: (name: string) => `${name} benachrichtigen`,
		lastReached: (date: string) => `zuletzt erreicht ${date}`,
		neverReached: 'noch keine Nachricht',
		lastError: (reason: string) => `Fehler: ${reason}`,
		// This device
		blocked: 'Im Browser blockiert',
		blockedHint:
			'Du hast Benachrichtigungen für diese Seite abgelehnt. Erlaube sie in den Einstellungen des Browsers und lade die Seite neu.',
		needsHttps: 'Braucht HTTPS',
		needsHttpsHint:
			'Push-Nachrichten gibt es nur über eine https://-Adresse. Öffne hdtracker über deinen Reverse Proxy.',
		unsupported: 'Hier nicht möglich',
		unsupportedHint:
			'Dieser Browser kann keine Push-Nachrichten. Auf iPhone und iPad geht es nur in der installierten App (Teilen → Zum Home-Bildschirm).',
		notReady: 'App-Dateien noch nicht bereit – lade die Seite neu.',
		failed: 'Hinzufügen fehlgeschlagen. Versuche es erneut.',
		refused: 'Dieses Gerät wurde nicht angenommen (unbekannter Push-Dienst oder zu viele Geräte).',
		// Fields of a target
		name: 'Name',
		token: 'App-Token',
		tokenHint: 'Von deiner eigenen Anwendung bei pushover.net („Create an Application“).',
		user: 'Benutzerschlüssel',
		userHint: 'Steht oben rechts auf pushover.net („Your User Key“).',
		kept: 'gespeichert',
		keptHint: 'Gespeichert. Leer lassen, um ihn zu behalten.',
		paused: 'Meldungen sind aus – die Ziele bekommen gerade nichts (ein Test geht trotzdem).',
		openLink: 'In hdtracker öffnen',
		devices: 'Nur an diese Geräte',
		devicesHint:
			'Leer = alle Geräte. Mehrere mit Komma. Ein falsch geschriebener Name heißt bei Pushover: an alle.',
		known: 'Deine Geräte bei Pushover:',
		picture: 'Bild anhängen',
		pictureHint: 'Das Bild des Titels kommt als Anhang mit.',
		url: 'Adresse',
		urlHint: 'Dorthin wird jede Nachricht geschickt (POST).',
		body: 'Inhalt',
		bodyHint: (placeholders: string) => `Platzhalter: ${placeholders}`,
		header: 'Kopfzeile (optional)',
		headerHint: 'Für einen Schlüssel, z. B. „Authorization: Bearer …“.',
		clearHeader: 'Gespeicherte Kopfzeile entfernen',
		templates: 'Vorlagen für Gotify und andere',
		server: 'Server',
		topic: 'Thema',
		topicHint: 'Dasselbe Thema abonnierst du in der ntfy-App. Wer den Namen kennt, kann mitlesen.',
		ntfyGuide: 'Anleitung',
		ntfyToken: 'Zugangsschlüssel (optional)',
		ntfyTokenHint: 'Nur für geschützte Themen („tk_…“).',
		clearToken: 'Gespeicherten Schlüssel entfernen',
		icon: 'Icon-Adresse (optional)',
		iconHint: 'Leer = das Icon dieses hdtracker. Das Handy lädt es selbst von dieser Adresse.',
		ntfyPictureHint: 'Das Bild des Titels wird zu ntfy hochgeladen.',
		save: 'Speichern',
		test: 'Test',
		remove: 'Entfernen',
		removed: 'Entfernt ✓',
		testSent: 'Gesendet ✓',
		testFailed: (reason: string) => `Nicht zugestellt: ${reason}`,
		gone: 'Dieses Gerät ist beim Push-Dienst nicht mehr angemeldet und wurde entfernt.',
		unreachable: 'Der Dienst ist gerade nicht erreichbar.',
		rejected: (reason: string) => `Pushover lehnt die Angaben ab: ${reason}`,
		channelErrors: {
			notAllowed: 'Webhook und ntfy sind den Admins vorbehalten.',
			unknown: 'Dieses Ziel gibt es nicht (mehr).',
			tooMany: 'Mehr als 10 Ziele dieser Art gehen nicht.',
			name: 'Bitte einen Namen angeben (höchstens 40 Zeichen).',
			keys: 'App-Token und Benutzerschlüssel haben je 30 Zeichen (Buchstaben und Ziffern).',
			unreachable: 'Pushover ist gerade nicht erreichbar – nichts gespeichert.',
			url: 'Die Adresse muss mit http:// oder https:// beginnen.',
			body: 'Der Inhalt darf nicht leer sein (höchstens 4000 Zeichen).',
			header: 'Die Kopfzeile braucht die Form „Name: Wert“.',
			topic: 'Das Thema darf nur Buchstaben, Ziffern, - und _ enthalten (höchstens 64 Zeichen).',
			ntfyToken: 'Der Zugangsschlüssel enthält unerlaubte Zeichen.',
			icon: 'Die Icon-Adresse muss mit http:// oder https:// beginnen.'
		} as Record<string, string>,
		// The bell on the page of a title
		bell: 'Benachrichtigungen zu diesem Titel',
		mute: 'Benachrichtigungen zu diesem Titel ausschalten',
		unmute: 'Benachrichtigungen zu diesem Titel einschalten',
		// Texts of the messages themselves
		testMark: 'Test',
		testTitle: 'hdtracker',
		testBody: 'Das ist eine Testnachricht. Es funktioniert ✓',
		digestTitle: (titles: number) =>
			titles === 1 ? 'Heute neu: 1 Titel' : `Heute neu: ${titles} Titel`,
		more: (count: number) => `… und ${count} weitere`
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
					'Lädt für alle Einträge der Bibliothek Details, Erscheinungstermine und Bilder neu und hält sie vor, damit Dashboard und Detailseiten sofort da sind. Gesehene Filme und Anime sowie durchgespielte Spiele kommen nur einmal pro Woche dran, Abgebrochenes einmal im Monat.'
			},
			optimize: {
				name: 'Datenbank-Pflege',
				description: 'Räumt die Datenbank auf und macht die Datei kompakter.'
			},
			sessions: {
				name: 'Abgelaufene Anmeldungen löschen',
				description: 'Entfernt Anmeldungen, die ohnehin nicht mehr gültig sind.'
			},
			notifications: {
				name: 'Benachrichtigungen senden',
				description:
					'Schickt Push-Nachrichten über Neuerscheinungen an alle, die sie eingeschaltet haben – jeweils ab der Uhrzeit, die dort gewählt ist. Läuft immer; hat niemand Meldungen eingeschaltet, passiert nichts.'
			},
			cache: {
				name: 'Zwischenspeicher aufräumen',
				description: 'Wirft veraltete Antworten von TMDB, IGDB und AniList aus dem Arbeitsspeicher.'
			},
			images: {
				name: 'Bilder aufräumen',
				description:
					'Löscht gespeicherte Poster und Bilder, die 30 Tage nicht gebraucht wurden oder zu alt sind – alle anderen bleiben gespeichert. Lässt sich nicht ausschalten, weil die Datenquellen begrenzen, wie lange Bilder aufbewahrt werden dürfen.'
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
		resetSchedule: 'Zurück zum Standard-Zeitplan',
		hourlyHint: 'Immer zur vollen Stunde.',
		monthlyHint: 'Immer am 1. des Monats.',
		lastRun: (date: string) => `Zuletzt: ${date}`,
		neverRun: 'Noch nie ausgeführt',
		nextRun: (date: string) => `Nächster Lauf: ${date}`,
		freed: (size: string) => `${size} freigegeben`,
		// What a task looks after takes this much space (not: what a run would free)
		stored: {
			images: (size: string, count: number) =>
				`Gespeichert: ${count} ${count === 1 ? 'Bild' : 'Bilder'} (${size})`,
			metadata: (size: string, count: number) =>
				`Vorgeladen: Details zu ${count} ${count === 1 ? 'Titel' : 'Titeln'} (${size})`,
			optimize: (size: string) => `Größe der Datenbank: ${size}`,
			backup: (size: string) => `Backups gesamt: ${size}`
		},
		off: 'Ausgeschaltet',
		failed: 'Fehlgeschlagen:',
		running: 'Läuft gerade …',
		runNow: 'Jetzt ausführen',
		done: 'Erledigt ✓',
		stillRunning:
			'Läuft im Hintergrund weiter – das Ergebnis steht nach dem Neuladen der Seite hier.',
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

	exportData: {
		title: 'Export',
		intro:
			'Lädt deine ganze Bibliothek als CSV-Datei herunter: Status, gesehene Folgen und Anime-Fortschritt. Die Datei hat das Format von Yamtrack und lässt sich dort – und hier – wieder importieren.',
		download: 'Bibliothek herunterladen',
		animeLoading: (n: number) =>
			`${n} Anime ${n === 1 ? 'wird' : 'werden'} noch geladen und ${n === 1 ? 'fehlt' : 'fehlen'} bis dahin in der Datei.`,
		animeUnknown: (n: number) =>
			`${n} Anime ${n === 1 ? 'hat' : 'haben'} keinen Eintrag bei MyAnimeList und ${n === 1 ? 'fehlt' : 'fehlen'} deshalb in der Datei (Yamtrack kennt Anime nur darüber).`
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
		wikidata: 'Direktlinks zu Titeln bei Streaming-Diensten',
		anibridge: 'Zuordnung von Anime zu TMDB für die Folgentitel (MIT-Lizenz)',
		palettes: 'Einige Farbschemata nutzen freie Farbpaletten:',
		libraryIcons: 'Icons',
		libraryFont: 'Schriftzug',
		ai: 'Entwickelt mit Unterstützung von KI (Claude Code).'
	},

	// Errors from the external APIs (created on the server).
	errorPage: {
		notFound: 'Seite nicht gefunden',
		notFoundHint: 'Diese Adresse gibt es nicht (mehr).',
		failed: 'Etwas ist schiefgelaufen',
		failedHint: 'Bitte versuch es gleich noch einmal.',
		home: 'Zum Dashboard'
	},
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
