import { fail } from '@sveltejs/kit';
import { serverMessages } from '$lib/server/i18n';
import { ImportError, importYamtrack } from '$lib/server/import/yamtrack';
import { pendingStatus } from '$lib/server/releases';
import type { Actions, PageServerLoad } from './$types';

// How many titles still wait for their details (shown after an import).
export const load: PageServerLoad = () => pendingStatus();

export const actions: Actions = {
	yamtrack: async ({ request }) => {
		const t = serverMessages().importData;
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { error: t.noFile });

		try {
			return { report: await importYamtrack(await file.text()) };
		} catch (err) {
			if (err instanceof ImportError) return fail(400, { error: t.invalidFile });
			console.error('Yamtrack import failed', err);
			const message = err instanceof Error ? err.message : '';
			return fail(500, { error: `${t.failed} ${message}` });
		}
	}
};
