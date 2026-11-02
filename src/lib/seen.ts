import { invalidate } from '$app/navigation';

// Tells the server that the user has now seen what a page shows (the inbox, or the releases on
// the dashboard), then fetches the number at the bell again. Done from the page once it is on
// screen – not while loading it, because pages are loaded ahead when a link is merely hovered.
// `shownUpTo`: the newest notice there was when the page was loaded (from its data) – notices
// that came later were not on it and stay unread.
export async function reportSeen(action: string, shownUpTo: number) {
	const body = new FormData();
	body.set('shownUpTo', String(shownUpTo));
	try {
		await fetch(action, {
			method: 'POST',
			body,
			headers: { accept: 'application/json', 'x-sveltekit-action': 'true' }
		});
		await invalidate('app:inbox');
	} catch {
		// Offline: it stays unread until the next visit.
	}
}
