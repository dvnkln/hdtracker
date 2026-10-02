// Posters and other images are never loaded by the browser from TMDB, IGDB or AniList directly:
// they go through our own server (/img), which fetches and caches them (see server/images.ts).

export type ImageSource = 'tmdb' | 'igdb' | 'anilist';

// The only places images may come from. A new image source must be added here (and in
// server/images.ts, with how long its images may be kept).
export function imageSource(address: string): ImageSource | null {
	let url: URL;
	try {
		url = new URL(address);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
	if (url.hostname === 'image.tmdb.org') return 'tmdb';
	if (url.hostname === 'images.igdb.com') return 'igdb';
	if (url.hostname.endsWith('.anilist.co')) return 'anilist';
	return null;
}

// Address of an image on our own server. Empty or foreign addresses (e.g. from an import file)
// give null, so the placeholder is shown instead.
export function img(address: string | null | undefined) {
	return address && imageSource(address) ? `/img?u=${encodeURIComponent(address)}` : null;
}
