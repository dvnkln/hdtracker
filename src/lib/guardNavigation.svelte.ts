import { goto, preloadData, type BeforeNavigate } from '$app/navigation';
import { isCategory } from '#lib/categories.js';
import { m } from '#lib/i18n/index.svelte.js';
import { toast } from '#lib/toasts.svelte.js';

// Pages that ask a data source when they open – a detail page, a search – can fail because of
// the source ("AniList is slowing down requests", "TMDB is not reachable"). Instead of leaving
// for an error page the user then has to come back from, the page is loaded first: if that
// works, the change of page goes on with what was loaded (no second request); if the source
// failed, the user stays where they were and reads why at the top (toast). Only for changes of
// page from within the app – an address opened directly still shows the error page.

// The page being loaded right now (for the spinner of the search)
export const guarded = $state<{ url: URL | null }>({ url: null });
// The change of page this guard started itself, after loading went well
let passing: string | null = null;

const ID = /^\d{1,12}$/;

function asksSource(url: URL) {
	const [area, id, more] = url.pathname.split('/').slice(1);
	if (!isCategory(area) || more !== undefined) return false;
	return id === undefined ? !!url.searchParams.get('q') : ID.test(id);
}

// What went wrong, if a data source did; null = go on.
export function failureOf(result: Awaited<ReturnType<typeof preloadData>>): string | null {
	if (result.type === 'error') {
		// "Not found" and other refusals keep their page; only failures of a source are caught
		if (result.status < 500) return null;
		const message = (result.error as { message?: string } | undefined)?.message;
		return message && message !== 'Internal Error' ? message : m.errorPage.failed;
	}
	if (result.type === 'loaded') {
		// A search that failed says so in its data (and shows it when opened directly)
		const error = (result.data as { error?: unknown }).error;
		return typeof error === 'string' && error ? error : null;
	}
	return null;
}

export function guardNavigation({ to, type, cancel, willUnload }: BeforeNavigate) {
	if (willUnload || !to?.url || (type !== 'link' && type !== 'goto')) return;
	const href = to.url.href;
	if (passing === href) {
		passing = null;
		return;
	}
	if (to.url.origin !== location.origin || !asksSource(to.url)) return;
	cancel();
	void check(to.url);
}

async function check(url: URL) {
	guarded.url = url;
	let failure: string | null = null;
	try {
		failure = failureOf(await preloadData(url.href));
	} catch {
		// Could not even ask (e.g. offline): let the normal change of page deal with it
	}
	// Another link was tapped in the meantime: that one counts
	if (guarded.url !== url) return;
	guarded.url = null;
	if (failure) {
		toast(failure, { kind: 'error' });
		return;
	}
	// Cleared again in any case, even if the change of page never started (then the next tap
	// on the same link would skip the check)
	passing = url.href;
	try {
		await goto(url);
	} finally {
		passing = null;
	}
}
