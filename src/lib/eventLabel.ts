import type { Messages } from '$lib/i18n/de';
import type { DashboardEntry } from '$lib/server/dashboard';

// What happens on a date, e.g. "Kinostart", "S03E01 · Staffelstart", "S02E03–E05",
// "Folgen 3–5" – the same words on the dashboard and in notifications.
export function eventLabel(
	e: Pick<
		DashboardEntry,
		'category' | 'kind' | 'season' | 'episode' | 'lastSeason' | 'lastEpisode'
	>,
	m: Messages
) {
	// Games only know "Early Access" and "Release" (the finished game, with or without
	// early access before it).
	if (e.category === 'games' && e.kind === 'release') return m.home.kinds.fullRelease;
	if (e.kind !== 'episode') return m.home.kinds[e.kind];
	const first = e.episode ?? 1;
	const last = e.lastEpisode ?? first;
	let label: string;
	if (e.category === 'anime') {
		label = m.home.animeEpisodes(first, last);
	} else {
		label = m.home.episodeCode(e.season ?? 1, first);
		if (e.lastSeason !== e.season) label += `–${m.home.episodeCode(e.lastSeason ?? 1, last)}`;
		else if (last !== first) label += `–E${String(last).padStart(2, '0')}`;
	}
	if (first === 1 && last === 1) {
		const start =
			e.category === 'anime'
				? m.home.animeStart
				: e.season === 1
					? m.home.seriesStart
					: m.home.seasonStart;
		label += ` · ${start}`;
	}
	return label;
}
