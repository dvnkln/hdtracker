import { fail } from '@sveltejs/kit';
import type { Person } from '$lib/avatar';
import type { Category } from '$lib/categories';
import { allowedStatuses, isReleased, isStatusFor, type Status } from '$lib/status';
import {
	findItem,
	libraryStatusFor,
	listLibrary,
	parseItem,
	removeItem,
	saveItem,
	type LibraryItem
} from '$lib/server/library';
import { airedEpisodes, getShowDetails, hasEpisodes, setEpisodes } from '$lib/server/episodes';
import { ProviderError, today, type SearchResult } from '$lib/server/providers/types';
import { searchCategory } from '$lib/server/search';
import { refreshPending } from '$lib/server/releases';
import { serverMessages } from '$lib/server/i18n';
import { companionsByItem, inviteMany, outgoing, shareablePeople } from '$lib/server/sharing';
import type { Actions, PageServerLoad } from './$types';

function pendingByItem(userId: number) {
	const pending: Record<number, Record<number, number>> = {};
	for (const invitation of outgoing(userId)) {
		(pending[invitation.item.id] ??= {})[invitation.to.id] = invitation.id;
	}
	return pending;
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
		people: [] as Person[],
		pending: {} as Record<number, Record<number, number>>,
		results,
		error
	};
};

export const actions: Actions = {
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
