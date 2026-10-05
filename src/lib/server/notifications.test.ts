import { createECDH, randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addItem } from '../../tests/helpers';
import { getDb } from './db';
import {
	itemDetails,
	libraryItems,
	notificationsSent,
	pushSubscriptions,
	releases,
	users,
	watchedEpisodes
} from './db/schema';
import { isSignedImage, readCollageAddress } from './images';
import {
	buildMessages,
	dueEvents,
	notifyUser,
	sampleMessage,
	savePrefs,
	sendDueNotifications
} from './notifications';
import { addDevice, listDevices, setDeviceEnabled } from './push';
import { setSettings } from './settings';
import { TASKS, isRequired } from './tasks/scheduler';

const TODAY = '2026-10-05';
const at = (hour: number) => new Date(`${TODAY}T${String(hour).padStart(2, '0')}:30:00`);
const day = (offset: number) => {
	const date = new Date(`${TODAY}T12:00:00`);
	date.setDate(date.getDate() + offset);
	return date.toLocaleDateString('sv-SE');
};

let me: number;
let n = 0;
type Kind = (typeof releases.$inferInsert)['kind'];
// A title with its dates: [kind, date, season, episode]
function title(
	values: Partial<typeof libraryItems.$inferInsert>,
	dates: [Kind, string, number?, number?][]
) {
	const item = addItem({ externalId: String(++n), ...values });
	if (dates.length) {
		getDb()
			.insert(releases)
			.values(
				dates.map(([kind, date, season, episode]) => ({
					itemId: item.id,
					kind,
					date,
					season: season ?? null,
					episode: episode ?? null
				}))
			)
			.run();
	}
	return item;
}
function device(userId: number, name: string) {
	const ecdh = createECDH('prime256v1');
	ecdh.generateKeys();
	addDevice(
		userId,
		{
			endpoint: `https://fcm.googleapis.com/fcm/send/${name}`,
			keys: {
				p256dh: ecdh.getPublicKey().toString('base64url'),
				auth: randomBytes(16).toString('base64url')
			}
		},
		''
	);
}
const accept = () =>
	vi.mocked(fetch).mockImplementation(async () => new Response(null, { status: 201 }));
const labels = (userId = me) => dueEvents(userId, TODAY).map((d) => d.entry.title);

beforeEach(() => {
	const db = getDb();
	for (const table of [notificationsSent, pushSubscriptions, releases, watchedEpisodes]) {
		db.delete(table).run();
	}
	db.delete(libraryItems).run();
	db.delete(users).run();
	me = db.insert(users).values({ username: 'me', passwordHash: 'x' }).returning().get().id;
	setSettings({
		notifyMode: 'single',
		notifyHour: '9',
		notifyFrom: '',
		uiLanguage: 'en',
		categories: 'movies,series,anime,games',
		animeTitle: 'english'
	});
});

describe('dueEvents', () => {
	it('takes what came out today or in the last two days, nothing older or still to come', () => {
		title({ title: 'Today' }, [['cinema', day(0)]]);
		title({ title: 'Two days ago' }, [['home', day(-2)]]);
		title({ title: 'Three days ago' }, [['cinema', day(-3)]]);
		title({ title: 'Tomorrow' }, [['cinema', day(1)]]);
		title({ title: 'No date' }, []);
		expect(labels()).toEqual(['Today', 'Two days ago']);
	});

	it('follows the rules of the dashboard', () => {
		title({ title: 'Dropped', status: 'dropped' }, [['cinema', day(0)]]);
		title({ title: 'Watched movie', status: 'completed' }, [['home', day(0)]]);
		title({ title: 'Hidden game', category: 'games', source: 'igdb' }, [['release', day(0)]]);
		// A watched show: only seasons after the last one watched
		const show = title({ title: 'Watched show', category: 'series', status: 'completed' }, [
			['episode', day(0), 1, 9],
			['episode', day(0), 2, 1]
		]);
		getDb().insert(watchedEpisodes).values({ itemId: show.id, season: 1, episode: 8 }).run();
		// An episode that is ticked off already
		const running = title({ title: 'Running show', category: 'series', status: 'active' }, [
			['episode', day(-1), 3, 4],
			['episode', day(0), 3, 5]
		]);
		getDb().insert(watchedEpisodes).values({ itemId: running.id, season: 3, episode: 4 }).run();
		setSettings({ categories: 'movies,series,anime' });

		const due = dueEvents(me, TODAY);
		expect(due.map((d) => d.entry.title)).toEqual(['Running show', 'Watched show']);
		expect(due[0].entry).toMatchObject({ season: 3, episode: 5, lastEpisode: 5 });
		expect(due[1].entry).toMatchObject({ season: 2, episode: 1 });
	});

	it('leaves out titles muted with the bell', () => {
		title({ title: 'Loud' }, [['cinema', day(0)]]);
		title({ title: 'Muted', notify: false }, [['cinema', day(0)]]);
		expect(labels()).toEqual(['Loud']);
	});

	it('starts on the day the messages were switched on', () => {
		title({ title: 'Yesterday' }, [['cinema', day(-1)]]);
		title({ title: 'Today' }, [['cinema', day(0)]]);
		setSettings({ notifyFrom: TODAY });
		expect(labels()).toEqual(['Today']);
	});
});

describe('buildMessages', () => {
	const library = () => {
		title(
			{
				title: 'Show',
				category: 'series',
				status: 'active',
				externalId: '77',
				posterUrl: 'https://image.tmdb.org/t/p/w342/show.jpg'
			},
			[
				['episode', day(-1), 2, 3],
				['episode', day(0), 2, 4]
			]
		);
		title({ title: 'Movie', externalId: '88' }, [
			['cinema', day(0)],
			['home', day(0)]
		]);
		title({ title: 'Anime', category: 'anime', source: 'anilist', originalTitle: 'Anime JP' }, [
			['episode', day(0), 1, 1]
		]);
	};

	it('one by one: a message per title that opens the title, with symbol and picture', () => {
		library();
		const messages = buildMessages(dueEvents(me, TODAY), 'single', TODAY);
		expect(messages.map((m) => [m.title, m.body, m.url])).toEqual([
			['Anime', 'Episode 1 · Premiere', `/anime/${n}`],
			['Movie', 'In cinemas · Home release', '/movies/88'],
			['Show', 'S02E03–E04', '/series/77']
		]);
		expect(new Set(messages.map((m) => m.tag)).size).toBe(3);
		// Small picture: always the calendar
		expect(new Set(messages.map((m) => m.icon))).toEqual(new Set(['/icons/notify.png']));
		// Large picture: the film card of the title, from this server, with a signature that
		// opens just this picture; nothing for a title without poster
		const big = new URL(messages[2].image!, 'https://tracker.example');
		expect(readCollageAddress(big)).toEqual({
			layout: 'banner',
			addresses: ['https://image.tmdb.org/t/p/w342/show.jpg']
		});
		expect(messages[1].image).toBeUndefined();
	});

	it('the film card is made of the poster alone; the backdrop only stands in without one', () => {
		const posterUrl = 'https://image.tmdb.org/t/p/w342/poster.jpg';
		const backdropUrl = 'https://image.tmdb.org/t/p/w1280/backdrop.jpg';
		const details = (itemId: number) =>
			getDb()
				.insert(itemDetails)
				.values({ itemId, info: { backdropUrl } as never, fetchedAt: new Date() })
				.run();
		const picture = (path: string) => new URL(path, 'https://tracker.example');

		details(title({ title: 'Movie', posterUrl }, [['cinema', day(0)]]).id);
		const [message] = buildMessages(dueEvents(me, TODAY), 'single', TODAY);
		expect(readCollageAddress(picture(message.image!))).toEqual({
			layout: 'banner',
			addresses: [posterUrl]
		});
		// A summary with this one title shows the same picture
		const [digest] = buildMessages(dueEvents(me, TODAY), 'digest', TODAY);
		expect(readCollageAddress(picture(digest.image!))?.addresses).toEqual([posterUrl]);

		// Without a poster: the backdrop as it is
		details(title({ title: 'No poster' }, [['cinema', day(0)]]).id);
		const plain = picture(buildMessages(dueEvents(me, TODAY), 'single', TODAY)[1].image!);
		expect(plain.pathname).toBe('/img');
		expect(plain.searchParams.get('u')).toBe(backdropUrl);
		expect(isSignedImage(plain)).toBe(true);
		plain.searchParams.set('u', 'https://image.tmdb.org/t/p/w1280/other.jpg');
		expect(isSignedImage(plain)).toBe(false);
	});

	it('together: one message that lists the titles and opens the dashboard', () => {
		library();
		const [message, ...rest] = buildMessages(dueEvents(me, TODAY), 'digest', TODAY);
		expect(rest).toEqual([]);
		expect(message).toMatchObject({
			title: 'New today: 3 titles',
			url: '/',
			tag: `digest-${TODAY}`
		});
		expect(message.body.split('\n')).toEqual([
			'Anime – Episode 1 · Premiere',
			'Movie – In cinemas',
			'Movie – Home release',
			'Show – S02E03–E04'
		]);
	});

	it('together: the large picture shows the posters of the day side by side', () => {
		const poster = (name: string) => `https://image.tmdb.org/t/p/w342/${name}.jpg`;
		for (const name of ['a', 'b', 'c', 'd', 'e']) {
			title({ title: `Movie ${name}`, posterUrl: poster(name) }, [['cinema', day(0)]]);
		}
		title({ title: 'No poster' }, [['cinema', day(0)]]);
		const [message] = buildMessages(dueEvents(me, TODAY), 'digest', TODAY);
		const posters = (path: string) =>
			readCollageAddress(new URL(path, 'https://tracker.example'))?.addresses;
		// A calendar as the small picture, up to four posters in the large one
		expect(message.icon).toBe('/icons/notify.png');
		expect(posters(message.image!)).toEqual(['a', 'b', 'c', 'd'].map(poster));
	});

	it('a long digest names the first titles and counts the rest', () => {
		for (let i = 1; i <= 9; i++) title({ title: `Movie ${i}` }, [['cinema', day(0)]]);
		const [message] = buildMessages(dueEvents(me, TODAY), 'digest', TODAY);
		expect(message.title).toBe('New today: 9 titles');
		expect(message.body.split('\n')).toHaveLength(7);
		expect(message.body).toContain('… and 3 more');
	});

	it('uses the language and the anime title the user chose', () => {
		library();
		setSettings({ uiLanguage: 'de', animeTitle: 'romaji' });
		const messages = buildMessages(dueEvents(me, TODAY), 'single', TODAY);
		expect(messages.map((m) => [m.title, m.body])).toContainEqual(['Anime JP', 'Folge 1 · Start']);
		expect(messages.map((m) => m.body)).toContain('Kinostart · Heimkino-Start');
	});
});

describe('notifyUser', () => {
	it('waits for the chosen hour, sends once and never again', async () => {
		title({ title: 'Movie' }, [['cinema', day(0)]]);
		device(me, 'phone');
		accept();
		expect(await notifyUser(me, at(8))).toBe(0);
		expect(fetch).not.toHaveBeenCalled();
		expect(await notifyUser(me, at(9))).toBe(1);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(await notifyUser(me, at(10))).toBe(0);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('announces what appears later the same day', async () => {
		title({ title: 'Movie' }, [['cinema', day(0)]]);
		device(me, 'phone');
		accept();
		await notifyUser(me, at(9));
		title({ title: 'Added later' }, [['home', day(0)]]);
		expect(await notifyUser(me, at(15))).toBe(1);
	});

	it('tries again when no device could be reached', async () => {
		title({ title: 'Movie' }, [['cinema', day(0)]]);
		device(me, 'phone');
		vi.mocked(fetch).mockImplementation(async () => new Response('later', { status: 503 }));
		expect(await notifyUser(me, at(9))).toBe(0);
		accept();
		expect(await notifyUser(me, at(10))).toBe(1);
	});

	it('a device that is switched off gets nothing, and counts as nobody there', async () => {
		title({ title: 'Movie' }, [['cinema', day(0)]]);
		device(me, 'phone');
		const [phone] = listDevices(me);
		setDeviceEnabled(me, phone.id, false);
		accept();
		expect(await notifyUser(me, at(9))).toBe(0);
		expect(fetch).not.toHaveBeenCalled();
		// ... and nothing was saved up for when it is switched on again
		setDeviceEnabled(me, phone.id, true);
		expect(await notifyUser(me, at(10))).toBe(0);
	});

	it('does nothing when switched off, and saves nothing up without a device', async () => {
		title({ title: 'Movie' }, [['cinema', day(0)]]);
		accept();
		setSettings({ notifyMode: 'off' });
		device(me, 'phone');
		expect(await notifyUser(me, at(12))).toBe(0);
		expect(fetch).not.toHaveBeenCalled();

		// Switched on, but no device: nothing is kept for the day one is added
		setSettings({ notifyMode: 'single' });
		getDb().delete(pushSubscriptions).run();
		expect(await notifyUser(me, at(12))).toBe(0);
		device(me, 'phone');
		expect(await notifyUser(me, at(13))).toBe(0);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('a digest is one message for everything', async () => {
		title({ title: 'Movie' }, [['cinema', day(0)]]);
		title({ title: 'Other' }, [['home', day(0)]]);
		device(me, 'phone');
		device(me, 'laptop');
		accept();
		setSettings({ notifyMode: 'digest' });
		expect(await notifyUser(me, at(9))).toBe(1);
		// One message, to both devices
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(await notifyUser(me, at(10))).toBe(0);
	});
});

describe('sampleMessage (test button)', () => {
	const today = () => new Date().toLocaleDateString('sv-SE');
	it('looks like a real message in the chosen form, marked as a test', () => {
		// Nothing in the dashboard: a plain sentence
		expect(sampleMessage(me)).toMatchObject({ title: 'hdtracker', tag: 'test', test: true });
		title({ title: 'Older', externalId: '5' }, [['cinema', '2000-01-01']]);
		title({ title: 'Newest', externalId: '6' }, [['home', today()]]);
		title({ title: 'Also new', externalId: '7' }, [['cinema', today()]]);
		const single = sampleMessage(me);
		expect(single).toMatchObject({ tag: 'test' });
		expect(single.title).toMatch(/^Test · (Newest|Also new)$/);
		// Also when the messages are still switched off
		setSettings({ notifyMode: 'off' });
		expect(sampleMessage(me)?.title).toMatch(/^Test · /);
		setSettings({ notifyMode: 'digest' });
		const digest = sampleMessage(me);
		expect(digest.title).toBe('Test · New today: 2 titles');
		expect(digest.url).toBe('/');
		// Nothing is remembered as announced
		expect(getDb().select().from(notificationsSent).all()).toEqual([]);
	});
});

describe('switching on and the task', () => {
	it('the task cannot be switched off in the maintenance settings', () => {
		expect(isRequired('notifications')).toBe(true);
		expect(TASKS.notifications.defaults.enabled).toBe(true);
	});

	it('switching on starts today; changing the form later keeps that day', () => {
		setSettings({ notifyMode: 'off', notifyFrom: '' });
		vi.useFakeTimers({ now: at(12), toFake: ['Date'] });
		savePrefs(me, 'single', 7);
		vi.setSystemTime(new Date(`${day(3)}T12:00:00`));
		savePrefs(me, 'digest', 8);
		vi.useRealTimers();
		title({ title: 'Before switching on' }, [['cinema', day(-1)]]);
		title({ title: 'Since then' }, [['cinema', day(0)]]);
		expect(labels()).toEqual(['Since then']);
	});

	it('the task serves every user and survives a failing one', async () => {
		title({ title: 'Movie' }, [['cinema', day(0)]]);
		const other = getDb()
			.insert(users)
			.values({ username: 'other', passwordHash: 'x' })
			.returning()
			.get().id;
		device(me, 'mine');
		device(other, 'theirs');
		accept();
		await sendDueNotifications(at(9));
		const sentTo = vi.mocked(fetch).mock.calls.map(([url]) => String(url).split('/').pop());
		expect(sentTo.sort()).toEqual(['mine', 'theirs']);
	});
});
