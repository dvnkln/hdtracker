import type { Status } from '#lib/status.js';
import type { SearchResult } from './providers/types';
import { airedEpisodes, getShowDetails, setEpisodes } from './episodes';
import { findItem, saveItem } from './library';
import { seriesSeasons } from './providers/anilist';
import { runInBackground } from './providers/types';
import { refreshPending } from './releases';

// Tracking a season of an anime tracks the series, as with a series of TMDB (decided with the
// user, 27.10.2026): when an anime is added, the other seasons of its series come along. The
// later ones as planned; the earlier ones like the chosen status – planned when the user plans
// to start the series, otherwise watched (with their episodes ticked off, as "watched" does).
// What is in the library already stays as it is; a dropped one brings nothing. Films, OVAs and
// specials do not come along – only seasons.
//
// When a recent search knows the whole series (the usual case), it happens at once, so the
// window of the series shows them right away; otherwise in the background, with the usual
// pauses – the status window does not wait for AniList.

type Added = { externalId: string; status: Status };
type Result = { added: Added[]; ticked: Promise<void> };

export async function trackSeries(userId: number, externalId: string, status: Status) {
	const nothing: Result = { added: [], ticked: Promise.resolve() };
	if (status === 'dropped') return { ...nothing, done: Promise.resolve(nothing) };
	const known = await seriesSeasons(externalId, { offline: true });
	if (known) {
		const result = addSeasons(userId, externalId, status, known);
		return { ...result, done: Promise.resolve(result) };
	}
	const done = runInBackground(async () =>
		addSeasons(userId, externalId, status, (await seriesSeasons(externalId)) ?? [])
	);
	done.catch((err) => console.error(`Could not add the other seasons of ${externalId}`, err));
	return { ...nothing, done };
}

function addSeasons(
	userId: number,
	externalId: string,
	status: Status,
	seasons: SearchResult[]
): Result {
	const at = seasons.findIndex((season) => season.externalId === externalId);
	const earlier: Status = status === 'planned' ? 'planned' : 'completed';
	const added: Added[] = [];
	seasons.forEach(({ anime: _facts, ...season }, index) => {
		if (index === at || at === -1 || findItem(userId, 'anime', season.externalId)) return;
		const own: Status = index < at ? earlier : 'planned';
		saveItem(userId, 'anime', season, own);
		added.push({ externalId: season.externalId, status: own });
	});
	if (added.length > 0) refreshPending();

	// The episodes of the watched ones: in the background, one request each
	const watched = added.filter((season) => season.status === 'completed');
	const ticked = runInBackground(async () => {
		for (const season of watched) {
			try {
				const details = await getShowDetails('anime', season.externalId);
				setEpisodes(userId, 'anime', details, airedEpisodes(details), true);
			} catch (err) {
				console.error(`Could not tick off the episodes of anime ${season.externalId}`, err);
			}
		}
	});
	return { added, ticked };
}
