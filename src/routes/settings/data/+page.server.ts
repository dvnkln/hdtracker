import { fail } from '@sveltejs/kit';
import { isCategory } from '$lib/categories';
import { serverMessages } from '$lib/server/i18n';
import { clearLibrary } from '$lib/server/library';
import {
	HiddenAreasError,
	ImportError,
	importYamtrack,
	type HiddenChoice
} from '$lib/server/import/yamtrack';
import { pendingStatus } from '$lib/server/releases';
import type { Actions, PageServerLoad } from './$types';

// Import, (later) export and deleting your own data.
// How many titles still wait for their details (shown after an import).
export const load: PageServerLoad = () => pendingStatus();

export const actions: Actions = {
	// Deletes all entries of one area (or all), including watched episodes.
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
	},

	yamtrack: async ({ request }) => {
		const t = serverMessages().importData;
		const data = await request.formData();
		const file = data.get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { error: t.noFile });
		const choice = String(data.get('hidden') ?? '');
		const hiddenChoice = ['skip', 'import', 'enable'].includes(choice)
			? (choice as HiddenChoice)
			: undefined;

		try {
			return { report: await importYamtrack(await file.text(), hiddenChoice) };
		} catch (err) {
			if (err instanceof ImportError) return fail(400, { error: t.invalidFile });
			// Titles of hidden areas: ask the user (the chosen file stays selected).
			if (err instanceof HiddenAreasError) return fail(409, { hidden: err.counts });
			console.error('Yamtrack import failed', err);
			const message = err instanceof Error ? err.message : '';
			return fail(500, { error: `${t.failed} ${message}` });
		}
	}
};
