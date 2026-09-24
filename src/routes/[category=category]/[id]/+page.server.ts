import { error, fail } from '@sveltejs/kit';
import type { Category } from '$lib/categories';
import {
	airedEpisodes,
	findItem,
	getShowDetails,
	hasEpisodes,
	setEpisodes,
	watchedKeys
} from '$lib/server/episodes';
import { ProviderError } from '$lib/server/providers/types';
import type { Actions, PageServerLoad } from './$types';

// Checks the URL and loads the show from the API. Only series and anime have this page (for now).
async function loadDetails(params: { category: string; id: string }) {
	const category = params.category as Category;
	if (!hasEpisodes(category) || !/^\d{1,12}$/.test(params.id)) error(404, 'Nicht gefunden');
	try {
		return { category, details: await getShowDetails(category, params.id) };
	} catch (err) {
		console.error('Loading show details failed', err);
		if (err instanceof ProviderError && err.status === 404) error(404, 'Nicht gefunden');
		error(502, err instanceof ProviderError ? err.message : 'Laden fehlgeschlagen.');
	}
}

export const load: PageServerLoad = async ({ params }) => {
	const { category, details } = await loadDetails(params);
	const item = findItem(category, details.item.externalId);
	return {
		category,
		details,
		status: item?.status ?? null,
		watched: [...watchedKeys(item?.id)]
	};
};

function readInt(data: FormData, name: string) {
	const value = Number(data.get(name));
	return Number.isInteger(value) && value >= 0 ? value : null;
}

export const actions: Actions = {
	// Tap on a single episode: watched <-> not watched.
	toggle: async ({ params, request }) => {
		const { category, details } = await loadDetails(params);
		const data = await request.formData();
		const season = readInt(data, 'season');
		const episode = readInt(data, 'episode');
		if (season === null || episode === null) return fail(400);

		const item = findItem(category, details.item.externalId);
		const isWatched = watchedKeys(item?.id).has(`${season}:${episode}`);
		setEpisodes(category, details, [{ season, episode }], !isWatched);
	},

	// Whole season watched / not watched.
	season: async ({ params, request }) => {
		const { category, details } = await loadDetails(params);
		const data = await request.formData();
		const season = readInt(data, 'season');
		if (season === null) return fail(400);
		setEpisodes(category, details, airedEpisodes(details, season), data.get('watched') === '1');
	},

	// Whole show (without specials) watched / not watched.
	all: async ({ params, request }) => {
		const { category, details } = await loadDetails(params);
		const data = await request.formData();
		setEpisodes(category, details, airedEpisodes(details), data.get('watched') === '1');
	}
};
