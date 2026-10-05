import { fail } from '@sveltejs/kit';
import pkg from '../../../../../package.json';
import { connectionOf, requireAdmin } from '$lib/server/auth';
import { serverOverview } from '$lib/server/health';
import { randomBytes } from 'node:crypto';
import { PROXY_KEY_HEADER, parseProxies } from '$lib/server/proxy';
import { eq } from 'drizzle-orm';
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
export const load: PageServerLoad = async (event) => {
	const values = {
		language: getSetting('language'),
		region: getSetting('region'),
		animeEpisodeTitles: getSetting('animeEpisodeTitles') === 'on'
	};

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
		listsFailed,
		// Overview: is everything fine, plus a few facts for the admin
		overview: { ...(await serverOverview(event)), version: pkg.version },
		// Reverse proxy: what hdtracker sees of this request, and the proxies entered so far.
		connection: connectionOf(event),
		trustedProxies: parseProxies(getSetting('trustedProxies')).entries.join(', '),
		proxyKey: getSetting('proxyKey'),
		proxyKeyHeader: PROXY_KEY_HEADER
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
	},

	// Episode titles for anime from TMDB, on or off: only the anime are loaded again.
	animeTitles: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const wanted = (await request.formData()).get('animeEpisodeTitles') === 'on' ? 'on' : 'off';
		if (wanted !== getSetting('animeEpisodeTitles')) {
			setSettings({ animeEpisodeTitles: wanted });
			getDb()
				.update(libraryItems)
				.set({ metadataUpdatedAt: null })
				.where(eq(libraryItems.category, 'anime'))
				.run();
			refreshPending();
		}
		return { section: 'animeTitles', message: serverMessages().settings.saved };
	},

	// Reverse proxies whose forwarded visitor address is believed (see $lib/server/proxy.ts).
	proxies: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const t = serverMessages();
		const text = String((await request.formData()).get('proxies') ?? '');
		const { entries, invalid } = parseProxies(text);
		if (invalid.length || entries.length > 20) {
			return fail(400, {
				section: 'proxies',
				proxies: text,
				error: invalid.length ? t.settings.proxiesInvalid(invalid.join(', ')) : t.common.invalidData
			});
		}
		setSettings({ trustedProxies: entries.join(',') });
		return { section: 'proxies', message: t.settings.saved };
	},

	// The secret a reverse proxy sends to prove itself: create (or replace) it, or remove it.
	proxyKey: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const remove = (await request.formData()).get('remove') === '1';
		setSettings({ proxyKey: remove ? '' : randomBytes(32).toString('base64url') });
		return { section: 'proxyKey', message: serverMessages().settings.saved };
	}
};
