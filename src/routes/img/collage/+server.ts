import { error } from '@sveltejs/kit';
import { cached } from '$lib/server/cache';
import { composePosters, isLayout } from '$lib/server/collage';
import { getImage, readCollageAddress } from '$lib/server/images';
import type { RequestHandler } from './$types';

const KEEP_MS = 10 * 60 * 1000;

// The large picture of a notification (film card of a title, or posters side by side).
// Nothing is prepared or stored: the picture is put together when a device asks for it –
// outside the server's own thread, which keeps answering meanwhile – and kept in memory for a few
// minutes, because several devices ask for the same one. Only works with a
// signed address (see signedCollagePath), also for logged-in users.
export const GET: RequestHandler = async ({ url }) => {
	const address = readCollageAddress(url);
	if (!address || !isLayout(address.layout)) error(404);
	const { layout, addresses } = address;

	const body = await cached(`collage:${layout}:${addresses.join('|')}`, KEEP_MS, async () => {
		const posters = await Promise.all(addresses.map((a) => getImage(a).catch(() => null)));
		return composePosters(
			posters.map((p) => p?.body ?? null),
			layout
		);
	});
	if (!body) error(404);
	return new Response(new Uint8Array(body), {
		headers: {
			'Content-Type': 'image/jpeg',
			'Cache-Control': 'private, max-age=604800',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
