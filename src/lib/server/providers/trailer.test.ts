import { describe, expect, it } from 'vitest';
import { anilistTrailer, igdbTrailer, tmdbTrailer, type TmdbVideo } from './trailer';

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const video = (key: string, values: Partial<TmdbVideo> = {}): TmdbVideo => ({
	key,
	site: 'YouTube',
	type: 'Trailer',
	official: true,
	iso_639_1: 'en',
	...values
});

describe('tmdbTrailer', () => {
	it('prefers a trailer in the content language, then English, then any', () => {
		const videos = [
			video('clip00001', { type: 'Clip', iso_639_1: 'de' }),
			video('french001', { iso_639_1: 'fr' }),
			video('english01'),
			video('german001', { iso_639_1: 'de' })
		];
		expect(tmdbTrailer(videos, 'de-DE')).toBe(yt('german001'));
		expect(tmdbTrailer(videos, 'en-US')).toBe(yt('english01'));
		expect(tmdbTrailer(videos, 'es-ES')).toBe(yt('english01'));
		expect(tmdbTrailer([videos[1]], 'es-ES')).toBe(yt('french001'));
	});

	it('takes a trailer before a teaser, an official one before others, and nothing else', () => {
		expect(
			tmdbTrailer(
				[video('teaser001', { type: 'Teaser', iso_639_1: 'de' }), video('trailer01')],
				'de-DE'
			)
		).toBe(yt('trailer01'));
		expect(
			tmdbTrailer([video('fanmade01', { official: false }), video('official1')], 'en-US')
		).toBe(yt('official1'));
		expect(tmdbTrailer([video('teaser001', { type: 'Teaser' })], 'en-US')).toBe(yt('teaser001'));
		expect(tmdbTrailer([video('feature01', { type: 'Featurette' })], 'en-US')).toBeNull();
		expect(tmdbTrailer(undefined, 'en-US')).toBeNull();
	});

	it('only links to video sites it knows, and only IDs that look like one', () => {
		expect(tmdbTrailer([video('vimeo0001', { site: 'Vimeo' })], 'en-US')).toBeNull();
		expect(tmdbTrailer([video('x"onclick="alert(1)')], 'en-US')).toBeNull();
		expect(tmdbTrailer([video('../../evil'), video('fine-ID_1')], 'en-US')).toBe(yt('fine-ID_1'));
	});
});

describe('igdbTrailer', () => {
	const game = (...names: string[]) =>
		names.map((name, n) => ({
			id: n + 1,
			video_id: `video${String(n + 1).padStart(4, '0')}`,
			name
		}));
	const pick = (...names: string[]) => {
		const videos = game(...names);
		const url = igdbTrailer(videos);
		return videos.find((video) => url === yt(video.video_id))?.name;
	};

	it('prefers what shows the game as it became over the announcement', () => {
		// The lists of four real games, in the order IGDB gives them (oldest first)
		expect(pick('Announcement Trailer', 'Trailer', 'Trailer', 'Dev Diary', 'Launch Trailer')).toBe(
			'Launch Trailer'
		);
		expect(
			pick(
				'Announcement Trailer',
				'Trailer',
				'Trailer',
				'Release Date Trailer',
				'Gameplay Trailer',
				'Dev Diary'
			)
		).toBe('Gameplay Trailer');
		expect(pick('Announcement Trailer', 'Launch Trailer', 'Gameplay Video', 'Trailer')).toBe(
			'Launch Trailer'
		);
		expect(pick('Devils Lair Gameplay', 'Story Trailer', 'Launch Trailer', 'Trailer')).toBe(
			'Launch Trailer'
		);
	});

	it('treats a reveal as the announcement it is, whatever else its name says', () => {
		expect(pick('Gameplay Reveal Trailer', 'Trailer')).toBe('Trailer');
		expect(pick('Trailer', 'Gameplay Reveal Trailer')).toBe('Trailer');
		expect(pick('Announcement Trailer', 'Gameplay Reveal Trailer', 'Dev Diary')).toBe(
			'Gameplay Reveal Trailer'
		); // the newer of two announcements
		// The whole list of a real game
		expect(
			pick(
				'Devils Lair Gameplay',
				'Story Trailer',
				'Live Action Trailer',
				'Pathways Out Of Darkness',
				'Launch Trailer',
				'Gameplay Reveal Trailer',
				'Trailer',
				'VGX 2013 Gameplay Trailer'
			)
		).toBe('Launch Trailer');
	});

	it('falls back step by step, and takes the newest among equals', () => {
		expect(igdbTrailer(game('Trailer', 'Announcement Trailer', 'Trailer'))).toBe(yt('video0003'));
		expect(pick('Announcement Trailer', 'Story Trailer')).toBe('Story Trailer');
		expect(pick('Dev Diary', 'Teaser', 'Announcement Trailer')).toBe('Announcement Trailer');
		expect(pick('Dev Diary', 'Gameplay Video')).toBe('Gameplay Video');
		expect(pick('Dev Diary')).toBe('Dev Diary');
	});

	it('only links IDs that look like one', () => {
		expect(igdbTrailer([{ video_id: 'bad id!', name: 'Launch Trailer' }])).toBeNull();
		expect(igdbTrailer(undefined)).toBeNull();
	});
});

describe('anilistTrailer', () => {
	it('links to YouTube or Dailymotion, nothing else', () => {
		expect(anilistTrailer({ id: 'abcDEF12345', site: 'youtube' })).toBe(yt('abcDEF12345'));
		expect(anilistTrailer({ id: 'x8abc12', site: 'dailymotion' })).toBe(
			'https://www.dailymotion.com/video/x8abc12'
		);
		expect(anilistTrailer({ id: 'abc', site: 'somewhere' })).toBeNull();
		expect(anilistTrailer({ id: null, site: 'youtube' })).toBeNull();
		expect(anilistTrailer(null)).toBeNull();
	});
});
