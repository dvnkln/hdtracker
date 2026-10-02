import { error } from '@sveltejs/kit';
import { getImage } from '$lib/server/images';
import type { RequestHandler } from './$types';

// Serves a poster or other image of TMDB, IGDB or AniList from our own server (only for
// logged-in users, see hooks.server.ts). Browsers may keep it for 30 days.
export const GET: RequestHandler = async ({ url }) => {
	const image = await getImage(url.searchParams.get('u') ?? '');
	if (!image) error(404);
	return new Response(new Uint8Array(image.body), {
		headers: {
			'Content-Type': image.type,
			'Cache-Control': 'private, max-age=2592000, immutable',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
