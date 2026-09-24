import type { Category } from '$lib/categories';
import { ProviderError, type SearchResult } from '$lib/server/providers/types';
import { searchCategory } from '$lib/server/search';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const category = params.category as Category;
	const q = url.searchParams.get('q')?.trim() ?? '';

	let results: SearchResult[] = [];
	let error: string | null = null;

	if (q) {
		try {
			results = await searchCategory(category, q);
		} catch (err) {
			console.error(`Search in ${category} failed`, err);
			error = err instanceof ProviderError ? err.message : 'Suche fehlgeschlagen.';
		}
	}

	return { category, q, results, error };
};
