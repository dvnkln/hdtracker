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
import { findTitle, libraryStatusFor, setNotify } from '$lib/server/library';
import { prefsFor } from '$lib/server/notifications';
import { ProviderError, type Details, type ShowDetails } from '$lib/server/providers/types';
import { serverMessages } from '$lib/server/i18n';
import { getUserSetting } from '$lib/server/settings';
import {
	accept,
	companions,
	decline,
	incoming,
	invitable,
	invite,
	leaveShared,
	withdraw,
	type SharingError
} from '$lib/server/sharing';
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

export const load: PageServerLoad = async ({ params, locals }) => {
	const category = params.category as Category;
	if (!ID_PATTERN.test(params.id)) error(404, serverMessages().common.notFound);

	try {
		// Titles of the library come from the database, everything else from the API.
		const { info, show } = await detailsFor(category, params.id);
		const item = findItem(locals.user!.id, category, info.item.externalId);
		const similarStatus = libraryStatusFor(
			locals.user!.id,
			category,
			info.similar.map((s) => s.externalId)
		);
		return {
			category,
			info,
			show,
			status: item?.status ?? null,
			sharing: item ? sharingOf(locals.user!.id, item.id) : null,
			invitations: invitationsFor(locals.user!.id, category, info.item.externalId),
			// The data source no longer knows this title: what is shown is the stored copy
			sourceMissing: !!item?.sourceMissingSince,
			placeholder: false,
			// The bell: only for titles of the library, and only while notifications are on
			notify: item && prefsFor(locals.user!.id).mode !== 'off' ? item.notify : null,
			watched: [...watchedKeys(item?.trackingId)],
			similarStatus: Object.fromEntries(similarStatus),
			hideSpoilers: getUserSetting(locals.user!.id, 'hideSpoilers') === 'on'
		};
	} catch (err) {
		// A title of the library that its data source no longer knows and that has no stored
		// details (e.g. imported with a dead ID): show what the library has instead of an error.
		const item = findItem(locals.user!.id, category, params.id);
		if (item && err instanceof ProviderError && err.status === 404) {
			return placeholderFor(item, getUserSetting(locals.user!.id, 'hideSpoilers') === 'on');
		}
		failLoading(err);
	}
};

// Tracking together: who shares the user's state of this title and who could be invited.
// Null while there is nobody to share with (an installation with one account never sees it).
function sharingOf(userId: number, itemId: number) {
	const together = companions(userId, itemId);
	const candidates = invitable(userId, itemId);
	return together.length + candidates.length > 0 ? { companions: together, candidates } : null;
}

// Invitations for this title that wait for the user's answer.
function invitationsFor(userId: number, category: Category, externalId: string) {
	const title = findTitle(category, externalId);
	if (!title) return [];
	return incoming(userId)
		.filter((invitation) => invitation.item.id === title.id)
		.map(({ id, from, status }) => ({ id, from, status }));
}

const SOURCE_LABELS = { tmdb: 'TMDB', igdb: 'IGDB', anilist: 'AniList' } as const;

// A detail page made of the little the library row holds (title, maybe poster and year).
function placeholderFor(item: NonNullable<ReturnType<typeof findItem>>, hideSpoilers: boolean) {
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
		watched: [...watchedKeys(item.trackingId)],
		similarStatus: {} as Record<string, Status>,
		hideSpoilers,
		sourceMissing: true,
		placeholder: true,
		sharing: null as ReturnType<typeof sharingOf>,
		invitations: [] as ReturnType<typeof invitationsFor>,
		notify: null as boolean | null
	};
}

function readInt(data: FormData, name: string) {
	const value = Number(data.get(name));
	return Number.isInteger(value) && value >= 0 ? value : null;
}

// What went wrong, in the user's language.
const refused = (error: SharingError) => fail(400, { error: serverMessages().share.errors[error] });

export const actions: Actions = {
	// Tracking together: invite somebody to the state the user has for this title.
	invite: async ({ params, request, locals }) => {
		const item = findItem(locals.user!.id, params.category as Category, params.id);
		const to = readInt(await request.formData(), 'to');
		if (!item || to === null) return fail(400, { error: serverMessages().common.invalidData });
		const result = invite(locals.user!.id, item.id, to);
		return result.ok ? { shared: true } : refused(result.error);
	},

	// Take back an invitation, or answer one.
	withdraw: async ({ request, locals }) => {
		const id = readInt(await request.formData(), 'id');
		if (id === null) return fail(400, { error: serverMessages().common.invalidData });
		const result = withdraw(locals.user!.id, id);
		return result.ok ? { shared: true } : refused(result.error);
	},
	accept: async ({ request, locals }) => {
		const id = readInt(await request.formData(), 'id');
		if (id === null) return fail(400, { error: serverMessages().common.invalidData });
		const result = accept(locals.user!.id, id);
		return result.ok ? { shared: true } : refused(result.error);
	},
	decline: async ({ request, locals }) => {
		const id = readInt(await request.formData(), 'id');
		if (id === null) return fail(400, { error: serverMessages().common.invalidData });
		const result = decline(locals.user!.id, id);
		return result.ok ? { shared: true } : refused(result.error);
	},

	// Go on alone, with a copy of the shared state.
	leave: async ({ params, locals }) => {
		const item = findItem(locals.user!.id, params.category as Category, params.id);
		if (!item) return fail(400, { error: serverMessages().common.invalidData });
		const result = leaveShared(locals.user!.id, item.id);
		return result.ok ? { shared: true } : refused(result.error);
	},

	// The bell: notifications about this title on or off.
	notify: async ({ params, request, locals }) => {
		const item = findItem(locals.user!.id, params.category as Category, params.id);
		if (!item) return fail(400, { error: serverMessages().common.invalidData });
		const on = (await request.formData()).get('notify') === '1';
		setNotify(locals.user!.id, item.id, on);
		return { notify: on };
	},

	// Tap on a single episode: watched <-> not watched.
	toggle: async ({ params, request, locals }) => {
		const me = locals.user!.id;
		const { category, details } = await loadDetails(params);
		const data = await request.formData();
		const season = readInt(data, 'season');
		const episode = readInt(data, 'episode');
		if (season === null || episode === null) return fail(400);

		const item = findItem(me, category, details.item.externalId);
		const isWatched = watchedKeys(item?.trackingId).has(`${season}:${episode}`);
		setEpisodes(me, category, details, [{ season, episode }], !isWatched);
	},

	// Whole season watched / not watched.
	season: async ({ params, request, locals }) => {
		const { category, details } = await loadDetails(params);
		const data = await request.formData();
		const season = readInt(data, 'season');
		if (season === null) return fail(400);
		setEpisodes(
			locals.user!.id,
			category,
			details,
			airedEpisodes(details, season),
			data.get('watched') === '1'
		);
	},

	// Whole show (without specials) watched / not watched.
	all: async ({ params, request, locals }) => {
		const { category, details } = await loadDetails(params);
		const data = await request.formData();
		setEpisodes(
			locals.user!.id,
			category,
			details,
			airedEpisodes(details),
			data.get('watched') === '1'
		);
	}
};
