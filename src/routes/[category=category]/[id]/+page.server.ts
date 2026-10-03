import { error, fail } from '@sveltejs/kit';
import type { Category } from '$lib/categories';
import type { Status } from '$lib/status';
import {
	airedEpisodes,
	findItem,
	hasEpisodes,
	setEpisodes,
	watchedKeys
} from '$lib/server/episodes';
import { detailsFor } from '$lib/server/itemDetails';
import { libraryStatusFor } from '$lib/server/library';
import { ProviderError, type Details, type ShowDetails } from '$lib/server/providers/types';
import { serverMessages } from '$lib/server/i18n';
import { getSetting } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

const ID_PATTERN = /^\d{1,12}$/;

// Turns API errors into a readable error page.
function failLoading(err: unknown): never {
	console.error('Loading details failed', err);
	const t = serverMessages().common;
	if (err instanceof ProviderError && err.status === 404) error(404, t.notFound);
	error(502, err instanceof ProviderError ? err.message : t.loadFailed);
}

// Episode list of a series/anime (used by the episode form actions).
async function loadDetails(params: { category: string; id: string }) {
	const category = params.category as Category;
	if (!hasEpisodes(category) || !ID_PATTERN.test(params.id))
		error(404, serverMessages().common.notFound);
	let show: ShowDetails | null;
	try {
		({ show } = await detailsFor(category, params.id));
	} catch (err) {
		failLoading(err);
	}
	if (!show) error(404, serverMessages().common.notFound);
	return { category, details: show };
}

export const load: PageServerLoad = async ({ params }) => {
	const category = params.category as Category;
	if (!ID_PATTERN.test(params.id)) error(404, serverMessages().common.notFound);

	try {
		// Titles of the library come from the database, everything else from the API.
		const { info, show } = await detailsFor(category, params.id);
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
			// The data source no longer knows this title: what is shown is the stored copy
			sourceMissing: !!item?.sourceMissingSince,
			placeholder: false,
			watched: [...watchedKeys(item?.id)],
			similarStatus: Object.fromEntries(similarStatus),
			hideSpoilers: getSetting('hideSpoilers') === 'on'
		};
	} catch (err) {
		// A title of the library that its data source no longer knows and that has no stored
		// details (e.g. imported with a dead ID): show what the library has instead of an error.
		const item = findItem(category, params.id);
		if (item && err instanceof ProviderError && err.status === 404) return placeholderFor(item);
		failLoading(err);
	}
};

const SOURCE_LABELS = { tmdb: 'TMDB', igdb: 'IGDB', anilist: 'AniList' } as const;

// A detail page made of the little the library row holds (title, maybe poster and year).
function placeholderFor(item: NonNullable<ReturnType<typeof findItem>>) {
	const info: Details = {
		item: {
			source: item.source,
			externalId: item.externalId,
			title: item.title,
			originalTitle: item.originalTitle,
			year: item.year,
			// Unknown, not "unreleased": the status must stay changeable (see isReleased)
			releaseDate: item.releaseDate ?? '1900-01-01',
			earlyAccess: item.earlyAccess,
			malId: item.malId,
			posterUrl: item.posterUrl,
			overview: item.overview
		},
		externalUrl: '',
		sourceLabel: SOURCE_LABELS[item.source],
		backdropUrl: null,
		genres: [],
		rating: null,
		runtime: null,
		seasonCount: null,
		episodeCount: null,
		episodeRuntime: null,
		format: null,
		facts: [],
		watch: null,
		links: [],
		similar: []
	};
	return {
		category: item.category,
		info,
		show: null,
		status: item.status,
		watched: [...watchedKeys(item.id)],
		similarStatus: {} as Record<string, Status>,
		hideSpoilers: getSetting('hideSpoilers') === 'on',
		sourceMissing: true,
		placeholder: true
	};
}

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
