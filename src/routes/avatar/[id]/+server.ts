import { error } from '@sveltejs/kit';
import { avatarOf } from '#lib/server/users.js';
import type { RequestHandler } from './$types';

// The profile picture of a user (only for logged-in users, see hooks.server.ts). Its address
// carries the picture's version, so it may be kept by the browser for a long time: a new
// picture has a new address.
export const GET: RequestHandler = ({ params }) => {
	const id = Number(params.id);
	const avatar = Number.isInteger(id) ? avatarOf(id) : null;
	if (!avatar) error(404);
	return new Response(new Uint8Array(avatar), {
		headers: {
			'Content-Type': 'image/jpeg',
			'Cache-Control': 'private, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
