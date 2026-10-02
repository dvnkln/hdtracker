import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { libraryItems } from '$lib/server/db/schema';
import { serverMessages } from '$lib/server/i18n';
import { getContentLanguages, getWatchRegions } from '$lib/server/providers/tmdb';
import { refreshPending } from '$lib/server/releases';
import { getSetting, setSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

const LANGUAGE_PATTERN = /^[a-z]{2,3}-[A-Z]{2}$/; // e.g. "de-DE"
const REGION_PATTERN = /^[A-Z]{2}$/; // e.g. "DE"

// Settings for the whole installation: titles, dates and streaming offers are stored once.
export const load: PageServerLoad = async () => {
	const values = { language: getSetting('language'), region: getSetting('region') };

	// Choices come from TMDB. If it is not reachable, only the current value can be kept.
	const [regions, languages] = await Promise.allSettled([getWatchRegions(), getContentLanguages()]);
	const listsFailed = regions.status === 'rejected' || languages.status === 'rejected';
	if (listsFailed) console.error('Could not load settings lists from TMDB');

	const withCurrent = (list: string[], current: string) =>
		list.includes(current) ? list : [current, ...list];
	return {
		values,
		regions: withCurrent(regions.status === 'fulfilled' ? regions.value : [], values.region),
		languages: withCurrent(
			languages.status === 'fulfilled' ? languages.value : [],
			values.language
		),
		listsFailed
	};
};

export const actions: Actions = {
	content: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const data = await request.formData();
		const language = String(data.get('language') ?? '');
		const region = String(data.get('region') ?? '');
		if (!LANGUAGE_PATTERN.test(language) || !REGION_PATTERN.test(region)) {
			return fail(400, { section: 'content', error: serverMessages().common.invalidData });
		}
		const changed = language !== getSetting('language') || region !== getSetting('region');
		setSettings({ language, region });
		// Stored texts and streaming offers depend on both: load the whole library again.
		if (changed) {
			getDb().update(libraryItems).set({ metadataUpdatedAt: null }).run();
			refreshPending();
		}
		return { section: 'content', message: serverMessages().settings.saved };
	}
};
