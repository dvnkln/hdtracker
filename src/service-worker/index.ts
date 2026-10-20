// Makes the app installable ("add to home screen") and keeps the app's own files (scripts,
// styles, fonts, icons) cached, so it starts faster. Pages and data always come from the
// server. The one personal thing kept on the device: the profile pictures the app has shown
// (for notifications, see notificationPictures.ts) – emptied when logging out.
// (Type-checked with its own tsconfig.json next to it: a service worker has other globals than
// a page.)
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self as sw } from '$app/service-worker';
import {
	FORGET_PICTURES,
	PICTURE_CACHE,
	avatarKey,
	avatarOwner
} from '#lib/notificationPictures.js';

const CACHE = `hdtracker-${version}`;
// The manifest names the files relative to the app's root; the fetch handler below compares
// with the path of a request
const ASSETS = new Set(
	[...immutable, ...assets].map(({ path }) => new URL(path, sw.registration.scope).pathname)
);

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...ASSETS])));
	sw.skipWaiting();
});

// Remove caches of older versions.
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k !== CACHE && k !== PICTURE_CACHE).map((k) => caches.delete(k))
				)
			)
			.then(() => sw.clients.claim())
	);
});

// ---- Pictures of notifications (see notificationPictures.ts) ----

// The device loads the pictures of a notification when it shows – away from home the server is
// often out of reach (the text arrives anyway, through the push service). So they are handed
// over as data: addresses: the app's own symbols from its files, profile photos from those the
// app has shown (kept by the fetch handler below), anything else fetched now, briefly.
async function asData(response: Response) {
	const type = response.headers.get('content-type') ?? 'image/png';
	const bytes = new Uint8Array(await response.arrayBuffer());
	let text = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return `data:${type};base64,${btoa(text)}`;
}

// A real picture – not the login page a redirect led to, not an error page
const isPicture = (response: Response) =>
	response.ok &&
	!response.redirected &&
	(response.headers.get('content-type')?.startsWith('image/') ?? false);

// The kept photos – without creating the storage when there is none (after a logout it must
// stay gone; only keepPicture() starts it again)
const keptPhotos = async () =>
	(await caches.has(PICTURE_CACHE)) ? caches.open(PICTURE_CACHE) : null;

// The photo kept for a person (any version), with its key
async function keptOf(owner: string) {
	const kept = await keptPhotos();
	if (!kept) return null;
	for (const request of await kept.keys()) {
		const key = avatarKey(request.url);
		if (key && avatarOwner(key) === owner) return { kept, request, key };
	}
	return null;
}

// Changes to the kept photos happen one after the other (two versions of one person arriving
// at once must not both stay). A forget (logout) drops photos whose request started before it.
let photoQueue: Promise<unknown> = Promise.resolve();
let forgottenAt = 0;
const inTurn = <T>(task: () => Promise<T>) => {
	const run = photoQueue.then(task, task);
	photoQueue = run.catch(() => {});
	return run;
};

// Keeps a photo the app has shown: one per person, the newest replaces the one before
function keepPicture(key: string, response: Response, started: number) {
	return inTurn(async () => {
		if (started < forgottenAt) return;
		const kept = await caches.open(PICTURE_CACHE);
		if (await kept.match(key)) return;
		const before = await keptOf(avatarOwner(key));
		if (before) await before.kept.delete(before.request);
		await kept.put(key, response);
	});
}

sw.addEventListener('message', (event) => {
	if (event.data !== FORGET_PICTURES) return;
	forgottenAt = Date.now();
	event.waitUntil(inTurn(() => caches.delete(PICTURE_CACHE)));
});

// What an address of a notification is: one of the app's own files, a profile photo, or else
type Address = { url: URL; own: boolean; avatar: string | null };
function addressOf(address: string): Address | null {
	try {
		const url = new URL(address, sw.registration.scope);
		const own = url.origin === sw.location.origin;
		return { url, own, avatar: own ? avatarKey(url.pathname + url.search) : null };
	} catch {
		return null;
	}
}

// A picture from the device only: the app's own files, or the kept photo of exactly this
// version. Undefined: not there.
async function onDevice(address: Address | null): Promise<string | undefined> {
	if (!address) return undefined;
	const { url, own, avatar } = address;
	if (own && ASSETS.has(url.pathname)) {
		const hit = await caches.match(url.pathname);
		if (hit) return asData(hit);
	}
	if (avatar) {
		const hit = await (await keptPhotos())?.match(avatar);
		if (hit) return asData(hit);
	}
	return undefined;
}

// Fetched from the server, briefly. (Nothing fetched here is kept: a push may still arrive for
// somebody who logged out on this device.) Null: the server answered, but not with a picture;
// undefined: out of reach.
async function fetched(address: Address, wait: number): Promise<string | null | undefined> {
	try {
		const response = await fetch(address.url, { signal: AbortSignal.timeout(wait) });
		return isPicture(response) ? await asData(response) : null;
	} catch {
		return undefined;
	}
}

// Instead of a profile photo the device does not have: an older one of the same person (still
// them), else the two figures of the logo – never the letter Chrome would draw.
async function standIn(address: Address) {
	const before = address.avatar ? await keptOf(avatarOwner(address.avatar)) : null;
	const hit = before && (await before.kept.match(before.request));
	return hit ? asData(hit) : onDevice(addressOf('/icons/share.png'));
}

// ---- Push notifications (see src/lib/server/push.ts) ----

// The server sends { title, body, url, tag, icon, image }; show it. Messages with the same tag replace
// each other, so a title never piles up several notifications.
// Android draws the badge as a small symbol in the status bar and next to the app name –
// always in one colour: it must be a white shape on transparent, a colourful icon becomes a
// white box. The icon is the picture of the notification; without one, Chrome on Android
// draws a letter (the first one of the address) in its place.
sw.addEventListener('push', (event) => {
	let message: {
		title?: string;
		body?: string;
		url?: string;
		tag?: string;
		icon?: string;
		image?: string;
	} = {};
	try {
		message = event.data?.json() ?? {};
	} catch {
		// not ours: show a plain notification below
	}
	// The text is there at once; the notification shows right away with what the device has.
	// What has to come from the server (a photo the app has not shown yet, the large picture,
	// which is made for this notification) is fetched afterwards, and the notification is
	// replaced quietly (same tag) once it is there – away from home that may take long or fail.
	const tag = message.tag ?? `hdtracker-${Date.now()}`;
	const show = (pictures: { icon?: string; badge?: string; image?: string }) =>
		sw.registration.showNotification(message.title ?? 'hdtracker', {
			body: message.body ?? '',
			icon: pictures.icon ?? message.icon ?? '/icons/icon-192.png',
			badge: pictures.badge ?? '/icons/badge-96.png',
			tag,
			data: { url: message.url ?? '/' },
			// Large picture below the text; not in TypeScript's list of options yet
			...(pictures.image ? { image: pictures.image } : {})
		});
	event.waitUntil(
		(async () => {
			const iconAddress = addressOf(message.icon ?? '/icons/icon-192.png');
			const imageAddress = message.image ? addressOf(message.image) : null;
			let pictures: { icon?: string; badge?: string; image?: string } = {};
			try {
				const [icon, badge] = await Promise.all([
					onDevice(iconAddress),
					onDevice(addressOf('/icons/badge-96.png'))
				]);
				pictures = {
					icon: icon ?? (iconAddress?.avatar ? await standIn(iconAddress) : undefined),
					badge
				};
			} catch {
				// whatever the device could not read: the plain addresses below
			}
			await show(pictures);

			const missingPhoto = iconAddress?.avatar && !(await onDevice(iconAddress).catch(() => null));
			if (!missingPhoto && !imageAddress) return;
			const [photo, image] = await Promise.all([
				missingPhoto && iconAddress ? fetched(iconAddress, 8000) : undefined,
				imageAddress ? fetched(imageAddress, 15000) : undefined
			]);
			if (photo === undefined && !image) return;
			// A photo the server no longer has was removed on purpose: then not the older one
			const icon =
				photo ?? (photo === null ? await onDevice(addressOf('/icons/share.png')) : pictures.icon);
			await show({ ...pictures, icon, image: image ?? undefined });
		})().catch(() => show({}))
	);
});

sw.addEventListener('pushsubscriptionchange', (event) => {
	const change = event as ExtendableEvent & { oldSubscription?: PushSubscription | null };
	const key = change.oldSubscription?.options.applicationServerKey;
	if (!key) return;
	change.waitUntil(
		sw.registration.pushManager
			.subscribe({ userVisibleOnly: true, applicationServerKey: key })
			.then((subscription) => {
				const body = new FormData();
				body.set('subscription', JSON.stringify(subscription));
				// The old address is dead now: its entry in the list becomes this one
				body.set('replaces', change.oldSubscription?.endpoint ?? '');
				return fetch('/settings/notifications?/subscribe', {
					method: 'POST',
					body,
					headers: { 'x-sveltekit-action': 'true' }
				});
			})
			.catch(() => null)
	);
});

// Tapped: bring an open window of the app to the page, or open a new one.
sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = new URL(String(event.notification.data?.url ?? '/'), sw.location.origin);
	if (url.origin !== sw.location.origin) return;
	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
			const open = windows[0];
			if (!open) return void (await sw.clients.openWindow(url.href));
			await open.focus();
			if ('navigate' in open) await open.navigate(url.href).catch(() => null);
		})
	);
});

sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== sw.location.origin) return;
	// A profile picture the app shows (logged in, not a notification's signed address): keep a
	// copy, so a notification from this person can show it away from home
	const key = avatarKey(url.pathname + url.search);
	if (key && !url.searchParams.has('s')) {
		const started = Date.now();
		event.respondWith(
			fetch(event.request).then((response) => {
				if (isPicture(response)) {
					event.waitUntil(keepPicture(key, response.clone(), started).catch(() => {}));
				}
				return response;
			})
		);
		return;
	}
	if (!ASSETS.has(url.pathname)) return; // everything else: straight to the server
	event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(event.request)));
});
