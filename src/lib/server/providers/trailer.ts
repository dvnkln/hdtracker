// Which trailer of a title is linked. All three data sources name videos by the ID they have
// at a video site; the app only ever links to them – nothing is embedded or loaded from there.

const YOUTUBE_ID = /^[\w-]{6,20}$/;
const DAILYMOTION_ID = /^[a-z0-9]{4,20}$/i;

// The address of a video – or null if the ID does not look like one (it ends up in a link).
function videoUrl(site: string | null | undefined, id: string | null | undefined) {
	if (!id) return null;
	const where = site?.toLowerCase();
	if (where === 'youtube')
		return YOUTUBE_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
	if (where === 'dailymotion') {
		return DAILYMOTION_ID.test(id) ? `https://www.dailymotion.com/video/${id}` : null;
	}
	return null;
}

export type TmdbVideo = {
	key: string;
	site: string;
	type: string;
	official?: boolean;
	iso_639_1?: string | null;
};

// TMDB lists many videos per title (trailers, teasers, clips, featurettes, in several
// languages). Linked is: a trailer rather than a teaser, nothing else; in the content
// language rather than English rather than any other; an official one first.
export function tmdbTrailer(videos: TmdbVideo[] | undefined, language: string) {
	const wanted = language.split('-')[0].toLowerCase();
	const rank = (video: TmdbVideo) =>
		(video.type === 'Trailer' ? 0 : 100) +
		(video.iso_639_1 === wanted ? 0 : video.iso_639_1 === 'en' ? 10 : 20) +
		(video.official === false ? 1 : 0);
	const best = (videos ?? [])
		.filter((video) => video.type === 'Trailer' || video.type === 'Teaser')
		.filter((video) => videoUrl(video.site, video.key))
		.sort((a, b) => rank(a) - rank(b))[0];
	return best ? videoUrl(best.site, best.key) : null;
}

// IGDB lists the videos of a game (all on YouTube) oldest first, usually starting with the
// announcement – which says the least about the game. Linked is the one that shows the most
// of what it became: the launch trailer (the one summary made for the finished game), else a
// gameplay trailer, else a plain "Trailer", else another trailer (story, release date, …).
// Whatever is called an announcement, a reveal or a teaser comes after all of those, whatever
// else its name says ("Gameplay Reveal Trailer" is an announcement); a video that is no
// trailer only if there is nothing else. Among equals the newest one (the highest number
// IGDB gave it).
function igdbRank(name = '') {
	const title = name.trim();
	if (/announce|reveal|teaser/i.test(title)) return 4;
	if (/launch/i.test(title)) return 0;
	if (/gameplay.*trailer/i.test(title)) return 1;
	if (/^(official )?trailer$/i.test(title)) return 2;
	if (/trailer/i.test(title)) return 3;
	return /gameplay/i.test(title) ? 5 : 6;
}
export function igdbTrailer(
	videos: { id?: number; video_id: string; name?: string }[] | undefined
) {
	const best = (videos ?? [])
		.filter((video) => videoUrl('youtube', video.video_id))
		.sort((a, b) => igdbRank(a.name) - igdbRank(b.name) || (b.id ?? 0) - (a.id ?? 0))[0];
	return best ? videoUrl('youtube', best.video_id) : null;
}

// AniList names one trailer per anime, at YouTube or Dailymotion.
export const anilistTrailer = (trailer: { id: string | null; site: string | null } | null) =>
	trailer ? videoUrl(trailer.site, trailer.id) : null;
