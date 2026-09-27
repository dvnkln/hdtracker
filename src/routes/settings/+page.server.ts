import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { isCategory } from '$lib/categories';
import { isLocale } from '$lib/i18n/index.svelte';
import { MIN_PASSWORD_LENGTH as MIN_PASSWORD } from '$lib/limits';
import {
	SESSION_COOKIE,
	clearLoginFailures,
	deleteOtherSessions,
	hashPassword,
	loginLockedFor,
	recordLoginFailure,
	verifyPassword
} from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { serverMessages } from '$lib/server/i18n';
import { clearLibrary } from '$lib/server/library';
import { getContentLanguages, getWatchRegions } from '$lib/server/providers/tmdb';
import { getSetting, setSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

const LANGUAGE_PATTERN = /^[a-z]{2,3}-[A-Z]{2}$/; // e.g. "de-DE"
const REGION_PATTERN = /^[A-Z]{2}$/; // e.g. "DE"

export const load: PageServerLoad = async () => {
	const values = {
		uiLanguage: getSetting('uiLanguage'),
		language: getSetting('language'),
		region: getSetting('region'),
		animeTitle: getSetting('animeTitle'),
		hideSpoilers: getSetting('hideSpoilers') === 'on',
		autoStatus: getSetting('autoStatus') === 'on'
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
		listsFailed
	};
};

export const actions: Actions = {
	display: async ({ request }) => {
		const data = await request.formData();
		const uiLanguage = String(data.get('uiLanguage') ?? '');
		const language = String(data.get('language') ?? '');
		const region = String(data.get('region') ?? '');
		const animeTitle = String(data.get('animeTitle') ?? '');
		if (
			!isLocale(uiLanguage) ||
			!LANGUAGE_PATTERN.test(language) ||
			!REGION_PATTERN.test(region) ||
			(animeTitle !== 'english' && animeTitle !== 'romaji')
		) {
			return fail(400, { section: 'display', error: serverMessages().common.invalidData });
		}
		const hideSpoilers = data.get('hideSpoilers') === 'on' ? 'on' : 'off';
		setSettings({ uiLanguage, language, region, animeTitle, hideSpoilers });
		return { section: 'display', message: serverMessages().settings.saved };
	},

	behavior: async ({ request }) => {
		const data = await request.formData();
		setSettings({ autoStatus: data.get('autoStatus') === 'on' ? 'on' : 'off' });
		return { section: 'behavior', message: serverMessages().settings.saved };
	},

	password: async ({ request, locals, cookies, getClientAddress }) => {
		const t = serverMessages();
		const user = locals.user!;
		const ip = getClientAddress();
		const data = await request.formData();
		const current = String(data.get('current') ?? '');
		const password = String(data.get('password') ?? '');
		const confirm = String(data.get('confirm') ?? '');
		const failWith = (error: string) => fail(400, { section: 'password', error });

		// Same brute-force protection as the login form.
		const locked = loginLockedFor(ip);
		if (locked > 0) return failWith(t.auth.tooManyAttempts(locked));

		const row = getDb().select().from(users).where(eq(users.id, user.id)).get();
		if (!row || !(await verifyPassword(current, row.passwordHash))) {
			recordLoginFailure(ip);
			return failWith(t.settings.wrongPassword);
		}
		clearLoginFailures(ip);
		if (password.length < MIN_PASSWORD) return failWith(t.auth.passwordTooShort(MIN_PASSWORD));
		if (password !== confirm) return failWith(t.auth.passwordsDiffer);

		const passwordHash = await hashPassword(password);
		getDb().update(users).set({ passwordHash }).where(eq(users.id, user.id)).run();
		deleteOtherSessions(user.id, cookies.get(SESSION_COOKIE) ?? '');
		return { section: 'password', message: t.settings.passwordChanged };
	},

	logoutOthers: async ({ locals, cookies }) => {
		const count = deleteOtherSessions(locals.user!.id, cookies.get(SESSION_COOKIE) ?? '');
		return { section: 'logoutOthers', message: serverMessages().settings.loggedOutOthers(count) };
	},

	clear: async ({ request }) => {
		const t = serverMessages().settings;
		const data = await request.formData();
		const target = String(data.get('target') ?? '');
		const confirm = String(data.get('confirm') ?? '').trim();
		if (target !== 'all' && !isCategory(target)) {
			return fail(400, { section: 'clear', error: serverMessages().common.invalidData });
		}
		if (confirm.toUpperCase() !== t.confirmWord) {
			return fail(400, { section: 'clear', error: t.confirmWrong(t.confirmWord) });
		}
		const count = clearLibrary(target);
		return { section: 'clear', message: t.cleared(count) };
	}
};
