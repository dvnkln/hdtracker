import { fail } from '@sveltejs/kit';
import type { Person } from '#lib/avatar.js';
import type { Category } from '#lib/categories.js';
import { allowedStatuses, isReleased, isStatusFor, type Status } from '#lib/status.js';
import {
	findItem,
	libraryStatusFor,
	listLibrary,
	parseItem,
	removeItem,
	saveItem,
	setNotify,
	type LibraryItem
} from '#lib/server/library.js';
import { airedEpisodes, getShowDetails, hasEpisodes, setEpisodes } from '#lib/server/episodes.js';
import { ProviderError, today, type SearchResult } from '#lib/server/providers/types.js';
import { searchCategory } from '#lib/server/search.js';
import { refreshPending } from '#lib/server/releases.js';
import { recentFacts } from '#lib/server/providers/anilist.js';
import { trackSeries } from '#lib/server/animeSeasons.js';
import { serverMessages } from '#lib/server/i18n.js';
import { animeFactsOf, filterFactsOf } from '#lib/server/itemDetails.js';
import type { AnimeFacts } from '#lib/animeSeries.js';
import {
	companionsByItem,
	inviteMany,
	pendingByItem,
	shareablePeople
} from '#lib/server/sharing.js';
import type { Actions, PageServerLoad } from './$types';

// What each anime of the library is and what it belongs with (stored with its details). A title
// whose details are still loading – just added – takes it from a recent search, so a series stands
// as one stack right away.
async function animeFactsFor(library: LibraryItem[]) {
	const facts = animeFactsOf(library.map((item) => item.id));
	const waiting = library.filter((item) => !facts.has(item.id));
	const recent = await recentFacts(waiting.map((item) => item.externalId));
	for (const item of waiting) {
		const found = recent.get(item.externalId);
		if (found) facts.set(item.id, found);
	}
	return Object.fromEntries(facts) as Record<number, AnimeFacts>;
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const me = locals.user!.id;
	const category = params.category as Category;
	const q = url.searchParams.get('q')?.trim() ?? '';

	// No search term: show the library.
	if (!q) {
		const library = listLibrary(me, category);
		// Who tracks along (profile pictures on the posters), and whom one could invite
		const companions = companionsByItem(me);
		const together = Object.fromEntries(
			library.flatMap((item) =>
				companions.has(item.id) ? [[item.id, companions.get(item.id)!]] : []
			)
		) as Record<number, Person[]>;
		return {
			category,
			q,
			library,
			together,
			// Genres, streaming services, stores, platforms of the titles, for the filter (stored details)
			facts: filterFacts(library.map((item) => item.id)),
			// Anime: what each one is and what it belongs with, to show series as one
			anime: category === 'anime' ? await animeFactsFor(library) : {},
			people: shareablePeople(me),
			// The user's open invitations: title -> (invited user -> invitation)
			pending: pendingByItem(me),
			results: [],
			error: null
		};
	}

	let results: (SearchResult & { status: Status | null })[] = [];
	let error: string | null = null;
	try {
		const hits = await searchCategory(category, q);
		const statuses = libraryStatusFor(
			me,
			category,
			hits.map((h) => h.externalId)
		);
		results = hits.map((h) => ({ ...h, status: statuses.get(h.externalId) ?? null }));
	} catch (err) {
		console.error(`Search in ${category} failed`, err);
		error = err instanceof ProviderError ? err.message : serverMessages().library.searchFailed;
	}
	return {
		category,
		q,
		library: [] as LibraryItem[],
		together: {} as Record<number, Person[]>,
		facts: {} as ReturnType<typeof filterFacts>,
		anime: {} as Record<number, AnimeFacts>,
		people: [] as Person[],
		pending: {} as Record<number, Record<number, number>>,
		results,
		error
	};
};

export const actions: Actions = {
	// The bell of several titles at once (the seasons of an anime series, see SeriesSheet).
	// Only the user's own titles change (setNotify).
	notifyMany: async ({ request, locals }) => {
		const data = await request.formData();
		const ids = data.getAll('id').map(Number);
		if (ids.length === 0 || ids.length > 500 || !ids.every((n) => Number.isInteger(n) && n > 0)) {
			return fail(400, { error: serverMessages().common.invalidData });
		}
		const on = data.get('notify') === '1';
		for (const id of ids) setNotify(locals.user!.id, id, on);
		return { notify: on };
	},

	// Tracking together: invite one person to the titles selected in the library.
	invite: async ({ request, locals }) => {
		const data = await request.formData();
		const ids = data.getAll('id').map(Number);
		const to = Number(data.get('to'));
		const whole = (n: number) => Number.isInteger(n) && n > 0;
		if (ids.length === 0 || ids.length > 500 || !ids.every(whole) || !whole(to)) {
			return fail(400, { error: serverMessages().common.invalidData });
		}
		const result = inviteMany(locals.user!.id, ids, to);
		if (!result.ok) return fail(400, { error: serverMessages().share.errors[result.error] });
		return { invited: result.invited, already: result.already, to };
	},

	// Add to library or change status.
	save: async ({ params, request, locals }) => {
		const me = locals.user!.id;
		const category = params.category as Category;
		const data = await request.formData();
		const status = String(data.get('status') ?? '');
		if (!isStatusFor(category, status))
			return fail(400, { error: serverMessages().common.invalidStatus });

		let item: SearchResult;
		try {
			item = parseItem(category, String(data.get('item') ?? ''));
		} catch (err) {
			console.error('Invalid item data', err);
			return fail(400, { error: serverMessages().common.invalidData });
		}
		// Not released yet: only "planned" – unless the user insisted (second tap on a locked
		// status), for the case that the release date from the API is wrong.
		const existing = findItem(me, category, item.externalId);
		const released = isReleased(item, today()) || (!!existing && isReleased(existing, today()));
		if (!allowedStatuses(category, released).includes(status) && data.get('force') !== '1') {
			return fail(400, { error: serverMessages().common.invalidStatus });
		}
		saveItem(me, category, item, status);
		refreshPending(); // new titles: load release dates for the dashboard

		// A new anime season brings the other seasons of its series along (animeSeasons.ts). If
		// AniList fails, the title is saved anyway – just without the others.
		if (category === 'anime' && !existing) {
			try {
				await trackSeries(me, item.externalId, status);
			} catch (err) {
				console.error('Could not add the other seasons', err);
			}
		}

		// "Gesehen" for a series/anime also ticks all aired episodes.
		if (status === 'completed' && hasEpisodes(category)) {
			try {
				const details = await getShowDetails(category, item.externalId);
				setEpisodes(me, category, details, airedEpisodes(details), true);
			} catch (err) {
				console.error('Could not mark episodes as watched', err);
			}
		}
		return { success: true };
	},

	remove: async ({ params, request, locals }) => {
		const category = params.category as Category;
		const data = await request.formData();
		const externalId = String(data.get('externalId') ?? '');
		if (!externalId) return fail(400, { error: serverMessages().common.invalidData });
		removeItem(locals.user!.id, category, externalId);
		return { success: true };
	}
};

// What the filter needs of each title, by its ID
function filterFacts(ids: number[]) {
	return Object.fromEntries(filterFactsOf(ids));
}
