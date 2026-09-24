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
import { getDetails } from '$lib/server/details';
import { libraryStatusFor } from '$lib/server/library';
import { ProviderError } from '$lib/server/providers/types';
import type { Actions, PageServerLoad } from './$types';

const ID_PATTERN = /^\d{1,12}$/;

// Turns API errors into a readable error page.
function failLoading(err: unknown): never {
	console.error('Loading details failed', err);
	if (err instanceof ProviderError && err.status === 404) error(404, 'Nicht gefunden');
	error(502, err instanceof ProviderError ? err.message : 'Laden fehlgeschlagen.');
}

// Episode list of a series/anime (used by the episode form actions).
async function loadDetails(params: { category: string; id: string }) {
	const category = params.category as Category;
	if (!hasEpisodes(category) || !ID_PATTERN.test(params.id)) error(404, 'Nicht gefunden');
	try {
		return { category, details: await getShowDetails(category, params.id) };
	} catch (err) {
		failLoading(err);
	}
}

export const load: PageServerLoad = async ({ params }) => {
	const category = params.category as Category;
	if (!ID_PATTERN.test(params.id)) error(404, 'Nicht gefunden');

	try {
		// Details and (for series/anime) the episode list are loaded in parallel.
		const [info, show] = await Promise.all([
			getDetails(category, params.id),
			hasEpisodes(category) ? getShowDetails(category, params.id) : null
		]);
		const item = findItem(category, info.item.externalId);
		const similarStatus = libraryStatusFor(
			category,
			info.similar.map((s) => s.externalId)
		);
		return {
			category,
			info,
			show,
			status: item?.status ?? null,
			watched: [...watchedKeys(item?.id)],
			similarStatus: Object.fromEntries(similarStatus)
		};
	} catch (err) {
		failLoading(err);
	}
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
