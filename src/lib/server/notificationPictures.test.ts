import { beforeEach, expect, it, vi } from 'vitest';
import { getDb } from './db';
import { users } from './db/schema';
import { setUserSettings } from './settings';

// The tool that builds pictures is loaded once per process, so every case starts with
// freshly loaded modules.
async function fresh() {
	vi.resetModules();
	const collage = await import('./collage');
	const notifications = await import('./notifications');
	return { ...collage, ...notifications };
}
let me: number;
beforeEach(() => {
	getDb().delete(users).run();
	me = getDb().insert(users).values({ username: 'me', passwordHash: 'x' }).returning().get().id;
});

it('at start, the picture tool is only loaded when notifications are switched on', async () => {
	setUserSettings(me, { notifyMode: 'off' });
	const off = await fresh();
	off.prepareNotificationPictures();
	expect(off.picturesPrepared()).toBe(false);

	setUserSettings(me, { notifyMode: 'digest' });
	const on = await fresh();
	on.prepareNotificationPictures();
	expect(on.picturesPrepared()).toBe(true);
	expect(await on.preparePictures()).toBe(true);
});

it('switching notifications on loads it, changing them later does nothing new', async () => {
	setUserSettings(me, { notifyMode: 'off' });
	const { savePrefs, picturesPrepared } = await fresh();
	savePrefs(me, 'off', 8);
	expect(picturesPrepared()).toBe(false);
	savePrefs(me, 'single', 8);
	expect(picturesPrepared()).toBe(true);
});

it('nobody there yet (fresh installation): nothing is loaded', async () => {
	getDb().delete(users).run();
	const { prepareNotificationPictures, picturesPrepared } = await fresh();
	prepareNotificationPictures();
	expect(picturesPrepared()).toBe(false);
});
