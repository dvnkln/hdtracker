import { avatarUrl } from './avatar';

// Pictures of push notifications (used by the service worker, src/service-worker/index.ts).
// The device loads them when a notification arrives – often away from home, where the
// hdtracker server cannot be reached. So the app's own icons come from the files the service
// worker keeps anyway, and profile pictures the app has shown are kept on the device too
// (wherever the service worker runs: the installed app, or a browser tab on https).

// Where the installed app keeps the profile pictures it has shown (one per person, the latest
// version). Survives updates of the app; emptied when a login ends (forgetPictures).
export const PICTURE_CACHE = 'hdtracker-pictures';

// The key a profile picture is kept under: `/avatar/<id>?v=<version>`, whatever else its address
// carries (a notification's address is signed and expires, the app's own is not). Null: not a
// profile picture.
export function avatarKey(address: string): string | null {
	let url: URL;
	try {
		url = new URL(address, 'http://x');
	} catch {
		return null;
	}
	const id = /^\/avatar\/(\d+)$/.exec(url.pathname)?.[1];
	const version = url.searchParams.get('v');
	if (!id || !version || !/^\d+$/.test(version)) return null;
	return avatarUrl({ id: Number(id), picture: Number(version) });
}

// The person a kept picture belongs to (to drop older versions of their picture).
export const avatarOwner = (key: string) => key.slice(0, key.indexOf('?'));

// Empties the kept photos (the next person on this device must not find them): on logout, and
// whenever a page is shown without a login – after a login that ended elsewhere (expired,
// locked, logged out from another device) that is the next time the app is opened here. The
// service worker is told too, so a photo still on its way is not kept after all. Without
// https there is no such storage.
export const FORGET_PICTURES = 'forget-pictures';
export function forgetPictures() {
	if (typeof navigator !== 'undefined') {
		navigator.serviceWorker?.controller?.postMessage(FORGET_PICTURES);
	}
	if (typeof caches !== 'undefined') caches.delete(PICTURE_CACHE).catch(() => {});
}
