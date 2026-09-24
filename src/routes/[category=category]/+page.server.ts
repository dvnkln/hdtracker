import { fail } from '@sveltejs/kit';
import type { Category } from '$lib/categories';
import { isStatusFor, type Status } from '$lib/status';
import {
	libraryStatusFor,
	listLibrary,
	parseItem,
	removeItem,
	saveItem,
	type LibraryItem
} from '$lib/server/library';
import { airedEpisodes, getShowDetails, hasEpisodes, setEpisodes } from '$lib/server/episodes';
import { ProviderError, type SearchResult } from '$lib/server/providers/types';
import { searchCategory } from '$lib/server/search';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const category = params.category as Category;
	const q = url.searchParams.get('q')?.trim() ?? '';

	// No search term: show the library.
	if (!q) {
		return { category, q, library: listLibrary(category), results: [], error: null };
	}

	let results: (SearchResult & { status: Status | null })[] = [];
	let error: string | null = null;
	try {
		const hits = await searchCategory(category, q);
		const statuses = libraryStatusFor(
			category,
			hits.map((h) => h.externalId)
		);
		results = hits.map((h) => ({ ...h, status: statuses.get(h.externalId) ?? null }));
	} catch (err) {
		console.error(`Search in ${category} failed`, err);
		error = err instanceof ProviderError ? err.message : 'Suche fehlgeschlagen.';
	}
	return { category, q, library: [] as LibraryItem[], results, error };
};

export const actions: Actions = {
	// Add to library or change status.
	save: async ({ params, request }) => {
		const category = params.category as Category;
		const data = await request.formData();
		const status = String(data.get('status') ?? '');
		if (!isStatusFor(category, status)) return fail(400, { error: 'Ungültiger Status' });

		let item: SearchResult;
		try {
			item = parseItem(category, String(data.get('item') ?? ''));
		} catch (err) {
			console.error('Invalid item data', err);
			return fail(400, { error: 'Ungültige Daten' });
		}
		saveItem(category, item, status);

		// "Gesehen" for a series/anime also ticks all aired episodes.
		if (status === 'completed' && hasEpisodes(category)) {
			try {
				const details = await getShowDetails(category, item.externalId);
				setEpisodes(category, details, airedEpisodes(details), true);
			} catch (err) {
				console.error('Could not mark episodes as watched', err);
			}
		}
		return { success: true };
	},

	remove: async ({ params, request }) => {
		const category = params.category as Category;
		const data = await request.formData();
		const externalId = String(data.get('externalId') ?? '');
		if (!externalId) return fail(400, { error: 'Ungültige Daten' });
		removeItem(category, externalId);
		return { success: true };
	}
};
