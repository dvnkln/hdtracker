import { currentPart, groupAnime, isSeriesFormat } from '#lib/animeSeries.js';
import type { Status } from '#lib/status.js';
import { getDb } from './db';
import { libraryItems, users } from './db/schema';
import { and, count, eq, isNull } from 'drizzle-orm';
import { animeFactsOf } from './itemDetails';
import type { SearchResult } from './providers/types';
import { airedEpisodes, getShowDetails, setEpisodes } from './episodes';
import { findItem, listLibrary, saveItem } from './library';
import { seriesSeasons } from './providers/anilist';
import { runInBackground } from './providers/types';
import { refreshPending } from './releases';
import { getSetting, setSettings } from './settings';

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

// ---- Once, for the libraries from before ----

// After the update that brought this, the libraries hold series with seasons missing (only
// season 2 of something, say). Once, every series gets its missing seasons as if the season the
// user is on (the one its stack stands for) had just been added: earlier ones like its status,
// later ones planned. A series whose current season is dropped stays as it is; what is in the
// library stays as it is; a season removed afterwards does not come back (it runs only once).
// It needs the stored details (they say what belongs together), so it waits until they are
// loaded – after the update they are loaded again once.
export const SERIES_FILL = '1';

export async function fillSeries() {
	let added = 0;
	// Locked accounts are left out: nobody uses them
	const active = getDb()
		.select({ id: users.id })
		.from(users)
		.where(eq(users.disabled, false))
		.all();
	for (const { id: userId } of active) {
		const items = listLibrary(userId, 'anime');
		const facts = animeFactsOf(items.map((item) => item.id));
		const mine = new Set(items.map((item) => item.externalId));
		const hits = items
			.filter((item) => facts.has(item.id))
			.map((item) => ({ ...item, anime: facts.get(item.id) }));
		for (const entry of groupAnime(hits)) {
			const seasons = (entry.kind === 'series' ? entry.seasons : [entry.hit]).filter(
				isSeriesFormat
			);
			if (seasons.length === 0) continue;
			// Nothing missing as far as the stored links tell (no prequel or sequel outside the
			// library): no need to ask AniList
			const gap = seasons.some((h) =>
				h.anime!.links.some((l) => (l.type === 'PREQUEL' || l.type === 'SEQUEL') && !mine.has(l.id))
			);
			if (!gap) continue;
			const now =
				entry.kind === 'series'
					? currentPart({ ...entry, seasons, movies: [], extras: [] })!
					: seasons[0];
			try {
				const { done } = await trackSeries(userId, now.externalId, now.status);
				added += (await done).added.length;
			} catch (err) {
				console.error(`Could not add the missing seasons of anime ${now.externalId}`, err);
			}
		}
	}
	return added;
}

// Called at startup: runs fillSeries once – as soon as no anime waits for its details, or after
// an hour at the latest (an anime that keeps failing must not hold it up for good). "Done" is
// noted at the end, so a restart in the middle runs it again (what is there already is skipped).
const MAX_WAIT_MS = 60 * 60_000;
let filling = false;

export function prepareSeriesFill() {
	if (getSetting('seriesFill') === SERIES_FILL) return;
	const started = Date.now();
	const check = () => {
		if (filling) return;
		if (animeWaiting() > 0 && Date.now() - started < MAX_WAIT_MS) return;
		clearInterval(timer);
		filling = true;
		void runInBackground(fillSeries)
			.then((added) => {
				setSettings({ seriesFill: SERIES_FILL });
				if (added > 0) console.log(`Added ${added} missing anime seasons`);
			})
			.catch((err) => console.error('Adding the missing anime seasons failed', err))
			.finally(() => (filling = false));
	};
	const timer = setInterval(check, 60_000);
	timer.unref();
	check();
}

// Anime of any library whose details are still to be loaded
function animeWaiting() {
	return (
		getDb()
			.select({ n: count() })
			.from(libraryItems)
			.where(and(eq(libraryItems.category, 'anime'), isNull(libraryItems.metadataUpdatedAt)))
			.get()?.n ?? 0
	);
}
