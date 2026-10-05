import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
	mkdir,
	readdir,
	readFile,
	rename,
	stat,
	unlink,
	utimes,
	writeFile
} from 'node:fs/promises';
import { join } from 'node:path';
import { imageSource, type ImageSource } from '$lib/images';
import { env } from '$env/dynamic/private';
import { IMAGES_DIR } from './config';

// Images from TMDB, IGDB and AniList are fetched by the server and kept on disk, so browsers
// only ever talk to hdtracker.

const DAY = 24 * 60 * 60 * 1000;

// How long a source allows its images to be kept, and whether an address can show a different
// image later. TMDB and IGDB addresses contain the ID of the image: a new poster has a new
// address, so a stored copy never goes out of date.
const SOURCES: Record<ImageSource, { limitDays: number; reusesAddresses: boolean }> = {
	// API terms of use: nothing may be cached for longer than 6 months.
	tmdb: { limitDays: 180, reusesAddresses: false },
	// No limit stated: the same as TMDB, to be on the safe side.
	igdb: { limitDays: 180, reusesAddresses: false },
	// No limit stated either. Older entries have addresses without an image ID.
	anilist: { limitDays: 180, reusesAddresses: true }
};

// A copy is loaded again a month before the limit (a week, if the limit is short or the
// address can change its image). If that fails, the old copy is used up to 5 days before the
// limit – the time in between is the buffer for outages of a service.
function limits(source: ImageSource) {
	const { limitDays, reusesAddresses } = SOURCES[source];
	const refreshDays = reusesAddresses ? 7 : limitDays >= 60 ? limitDays - 30 : limitDays - 7;
	return { refreshMs: refreshDays * DAY, maxMs: (limitDays - 5) * DAY };
}

// Images nobody asked for in this time are deleted to save space (search results, similar
// titles, ...). Posters of the library are asked for by the nightly refresh and stay.
const UNUSED_MS = 30 * DAY;

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
// At most this many downloads at once, so a page full of new posters stays polite.
const PARALLEL = 8;
// After a failed download the address is not tried again for a while.
const RETRY_MS = 10 * 60 * 1000;

export type Image = { body: Buffer; type: string };

// ---- Images for notifications ----

// A notification shows its picture without the app being open, so the device fetches it
// without the login cookie. Such an address carries a signature made with SECRET: it opens
// exactly this one image and nothing else (see hooks.server.ts).
function signatureOf(address: string) {
	return createHmac('sha256', env.SECRET ?? '')
		.update(`image:${address}`)
		.digest('base64url');
}

export function signedImagePath(address: string | null) {
	if (!address || !imageSource(address)) return null;
	return `/img?u=${encodeURIComponent(address)}&s=${signatureOf(address)}`;
}

// ---- Several posters in one picture (see collage.ts) ----

// Such an address names the posters and the layout; the picture is only put together when a
// device asks for it. It stops working after a week, so old notifications cannot keep the
// server busy forever.
const COLLAGE_DAYS = 7;
const collageSignature = (layout: string, expires: string, addresses: string[]) =>
	createHmac('sha256', env.SECRET ?? '')
		.update(`collage:${layout}:${expires}:${addresses.join('\n')}`)
		.digest('base64url');

export function signedCollagePath(addresses: string[], layout: string, now = Date.now()) {
	const expires = String(Math.floor(now / 1000) + COLLAGE_DAYS * 24 * 60 * 60);
	const query = new URLSearchParams({ l: layout, e: expires });
	for (const address of addresses) query.append('u', address);
	query.set('s', collageSignature(layout, expires, addresses));
	return `/img/collage?${query}`;
}

// The posters and the layout of a collage address – null if the signature is wrong, the
// address has expired or names an image from somewhere else.
export function readCollageAddress(url: URL, now = Date.now()) {
	const layout = url.searchParams.get('l') ?? '';
	const expires = url.searchParams.get('e') ?? '';
	const addresses = url.searchParams.getAll('u');
	if (!env.SECRET || addresses.length === 0 || addresses.length > 8) return null;
	const given = Buffer.from(url.searchParams.get('s') ?? '');
	const expected = Buffer.from(collageSignature(layout, expires, addresses));
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
	if (!(Number(expires) * 1000 > now)) return null;
	if (!addresses.every((address) => imageSource(address))) return null;
	return { layout, addresses };
}

export function isSignedImage(url: URL) {
	const address = url.searchParams.get('u');
	const given = Buffer.from(url.searchParams.get('s') ?? '');
	if (!address || !env.SECRET) return false;
	const expected = Buffer.from(signatureOf(address));
	return given.length === expected.length && timingSafeEqual(given, expected);
}

// Tells the image type from the first bytes, so only real images are stored and served.
function typeOf(body: Buffer) {
	const ascii = (from: number, to: number) => body.subarray(from, to).toString('latin1');
	if (body[0] === 0xff && body[1] === 0xd8) return 'image/jpeg';
	if (ascii(1, 4) === 'PNG') return 'image/png';
	if (ascii(0, 4) === 'GIF8') return 'image/gif';
	if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
	if (ascii(4, 12) === 'ftypavif') return 'image/avif';
	return null;
}

// File name: source + hash of the address. Its change time is the day of the download, its
// access time the last time somebody asked for the image.
function fileFor(source: ImageSource, address: string) {
	return join(IMAGES_DIR, `${source}-${createHash('sha256').update(address).digest('hex')}`);
}

let running = 0;
const waiting: (() => void)[] = [];

async function limited<T>(work: () => Promise<T>) {
	if (running >= PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
	running++;
	try {
		return await work();
	} finally {
		running--;
		waiting.shift()?.();
	}
}

async function download(file: string, address: string): Promise<Image | null> {
	// No redirects: a redirect could lead to an address outside the allowed sources.
	const res = await fetch(address, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
	if (!res.ok || Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) return null;
	const body = Buffer.from(await res.arrayBuffer());
	const type = typeOf(body);
	if (!type || body.length > MAX_BYTES) return null;

	// Write to a temporary file first, so a half-written image is never served.
	await mkdir(IMAGES_DIR, { recursive: true });
	await writeFile(`${file}.tmp`, body);
	await rename(`${file}.tmp`, file);
	return { body, type };
}

// Requests for the same image that arrive together share one download.
const loading = new Map<string, Promise<Image | null>>();
const failedAt = new Map<string, number>();

function load(file: string, address: string) {
	if ((failedAt.get(address) ?? 0) > Date.now() - RETRY_MS) return Promise.resolve(null);
	let pending = loading.get(address);
	if (!pending) {
		pending = limited(() => download(file, address))
			.catch((err) => {
				console.error(`Loading image failed: ${address}`, err);
				return null;
			})
			.then((image) => {
				if (image) failedAt.delete(address);
				else failedAt.set(address, Date.now());
				return image;
			})
			.finally(() => loading.delete(address));
		loading.set(address, pending);
	}
	return pending;
}

// The stored copy, marked as "asked for" (at most once a day, to avoid a write per request).
async function stored(file: string, info: { atimeMs: number; mtime: Date }) {
	const body = await readFile(file);
	const type = typeOf(body);
	if (!type) return null;
	if (info.atimeMs < Date.now() - DAY) await utimes(file, new Date(), info.mtime).catch(() => {});
	return { body, type };
}

// The image behind an address of an allowed source: from disk while the copy is fresh, otherwise
// downloaded and stored. null if the address is not allowed or the image could not be loaded.
export async function getImage(address: string): Promise<Image | null> {
	const source = imageSource(address);
	if (!source) return null;
	const file = fileFor(source, address);
	const { refreshMs, maxMs } = limits(source);

	const info = await stat(file).catch(() => null);
	const age = info ? Date.now() - info.mtimeMs : Infinity;
	if (info && age < refreshMs) {
		const image = await stored(file, info).catch(() => null);
		if (image) return image;
	}
	const fresh = await load(file, address);
	if (fresh) return fresh;
	// The service cannot be reached: the old copy still does, as long as it may be kept.
	if (info && age < maxMs) return stored(file, info).catch(() => null);
	return null;
}

// How much space the stored images take.
export async function imageStats() {
	const names = await readdir(IMAGES_DIR).catch(() => [] as string[]);
	let bytes = 0;
	for (const name of names)
		bytes += (await stat(join(IMAGES_DIR, name)).catch(() => null))?.size ?? 0;
	return { count: names.length, bytes };
}

// Deletes stored images nobody asked for in 30 days and images that may not be kept any longer,
// plus leftovers of interrupted downloads. Returns the freed bytes.
export async function pruneImages() {
	const names = await readdir(IMAGES_DIR).catch(() => [] as string[]);
	const now = Date.now();
	let freed = 0;
	for (const name of names) {
		const file = join(IMAGES_DIR, name);
		const info = await stat(file).catch(() => null);
		if (!info) continue; // removed meanwhile
		const source = name.split('-')[0] as ImageSource;
		const known = Object.hasOwn(SOURCES, source) && !name.endsWith('.tmp');
		const expired = known
			? now - info.atimeMs > UNUSED_MS || now - info.mtimeMs > limits(source).maxMs
			: now - info.mtimeMs > DAY / 24; // leftover: gone after an hour
		if (!expired) continue;
		await unlink(file).catch(() => {});
		freed += info.size;
	}
	return freed;
}
