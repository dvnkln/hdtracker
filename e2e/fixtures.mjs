// Made-up titles for the browser tests – what the fake data sources (fake-apis.mjs) answer.
// Nothing here is real data of TMDB, IGDB or AniList. Dates are relative to today, so the
// dashboard always has something "recently released" and something "coming up".

const DAY = 24 * 60 * 60 * 1000;
/** YYYY-MM-DD, `days` from today (negative = in the past) */
export const day = (days) => new Date(Date.now() + days * DAY).toLocaleDateString('sv-SE');
/** Unix seconds at noon of that day */
const unix = (days) => Math.floor(new Date(`${day(days)}T12:00:00`).getTime() / 1000);

const noOffers = { results: {} };

// ---- TMDB: movies ----
export const MOVIES = [
	{
		id: 101,
		title: 'Test Movie Alpha',
		original_title: 'Test Movie Alpha',
		release_date: day(-10),
		poster_path: '/alpha.jpg',
		overview: 'A made-up movie that is already out.',
		genres: [{ name: 'Drama' }],
		vote_average: 7.4,
		vote_count: 120,
		backdrop_path: '/alpha-wide.jpg',
		runtime: 111,
		release_dates: {
			results: [
				{
					iso_3166_1: 'US',
					release_dates: [{ type: 3, release_date: `${day(-10)}T00:00:00.000Z` }]
				}
			]
		},
		'watch/providers': {
			results: {
				US: {
					link: 'https://www.themoviedb.org/movie/101/watch',
					flatrate: [{ provider_name: 'Netflix', logo_path: '/netflix.jpg', display_priority: 1 }]
				}
			}
		},
		external_ids: { wikidata_id: 'Q101' },
		recommendations: { results: [] }
	},
	{
		id: 102,
		title: 'Future Film Beta',
		original_title: 'Future Film Beta',
		release_date: day(30),
		poster_path: '/beta.jpg',
		overview: 'A made-up movie that is not out yet.',
		genres: [],
		vote_average: 0,
		vote_count: 0,
		backdrop_path: null,
		runtime: null,
		release_dates: {
			results: [
				{ iso_3166_1: 'US', release_dates: [{ type: 3, release_date: `${day(30)}T00:00:00.000Z` }] }
			]
		},
		'watch/providers': noOffers,
		external_ids: { wikidata_id: null },
		recommendations: { results: [] }
	}
];

// ---- TMDB: one series, ended, 2 seasons with 2 episodes each ----
const episode = (number, days) => ({
	episode_number: number,
	name: `Episode ${number}`,
	air_date: day(days),
	overview: `What happens in episode ${number}.`,
	still_path: null,
	runtime: 45
});
export const SERIES = [
	{
		id: 201,
		name: 'Test Series Gamma',
		original_name: 'Test Series Gamma',
		first_air_date: day(-400),
		poster_path: '/gamma.jpg',
		overview: 'A made-up series with two short seasons.',
		genres: [{ name: 'Comedy' }],
		vote_average: 8.1,
		vote_count: 50,
		backdrop_path: null,
		status: 'Ended',
		number_of_seasons: 2,
		number_of_episodes: 4,
		episode_run_time: [45],
		networks: [{ name: 'Test Network' }],
		'watch/providers': noOffers,
		external_ids: { wikidata_id: null },
		recommendations: { results: [] },
		seasons: [{ season_number: 1 }, { season_number: 2 }],
		'season/1': {
			season_number: 1,
			name: 'Season 1',
			air_date: day(-400),
			episodes: [episode(1, -400), episode(2, -393)]
		},
		// The last episode aired 5 days ago: shows up under "recently released"
		'season/2': {
			season_number: 2,
			name: 'Season 2',
			air_date: day(-12),
			episodes: [episode(1, -12), episode(2, -5)]
		}
	}
];

// ---- TMDB: the show the test anime (301) is mapped to – source of its episode titles ----
// Not in SERIES, so the search for series does not find it. Episode 1 aired on the day the
// anime started at AniList, which is what the app checks before it trusts the mapping.
const animeEpisode = (number, days, name) => ({ ...episode(number, days), name, runtime: 24 });
export const ANIME_SHOWS = [
	{
		id: 202,
		name: 'Test Anime Delta',
		original_name: 'Tesuto Anime Delta',
		first_air_date: day(-11),
		poster_path: null,
		overview: 'The show as TMDB describes it.',
		external_ids: { wikidata_id: null },
		// Where season 1 can be streamed in the region of the test installation
		'season/1/watch/providers': {
			results: {
				US: {
					link: 'https://www.themoviedb.org/tv/202/watch',
					flatrate: [{ provider_name: 'Crunchyroll', logo_path: '/cr.jpg', display_priority: 1 }]
				}
			}
		},
		'season/1': {
			season_number: 1,
			name: 'Season 1',
			air_date: day(-11),
			episodes: [
				animeEpisode(1, -11, 'Delta sets out'),
				animeEpisode(2, -4, 'The second step'),
				animeEpisode(3, 3, 'Things to come')
			]
		}
	}
];
// The list that maps AniList entries to TMDB (anibridge-mappings), as small as it gets
export const ANIME_MAPPING = {
	$meta: { schema_version: '3' },
	'anilist:301': { 'tmdb_show:202:s1': { '1-12': '1-12' } }
};

// ---- Pushover: the one application token the fake service accepts ----
export const PUSHOVER_TOKEN = 'tokentokentokentokentokentoken';

// ---- IGDB: one game that is out ----
export const GAMES = [
	{
		id: 401,
		name: 'Test Game Epsilon',
		first_release_date: unix(-200),
		cover: { image_id: 'epsilon' },
		summary: 'A made-up game.',
		release_dates: [{ date: unix(-200), status: { name: 'Full Release' } }],
		url: 'https://www.igdb.com/games/test-game-epsilon',
		genres: [{ name: 'Puzzle' }],
		platforms: [{ name: 'PC' }],
		total_rating: 88,
		total_rating_count: 10,
		similar_games: []
	}
];

// ---- AniList: one anime that is airing (episode 2 aired 4 days ago, episode 3 in 3 days) ----
export const ANIME = [
	{
		id: 301,
		idMal: 9301,
		type: 'ANIME',
		title: { romaji: 'Tesuto Anime Delta', english: 'Test Anime Delta' },
		startDate: (() => {
			const [year, month, d] = day(-11).split('-').map(Number);
			return { year, month, day: d };
		})(),
		status: 'RELEASING',
		coverImage: { large: 'https://s4.anilist.co/file/delta.jpg' },
		bannerImage: null,
		description: 'A made-up anime.',
		genres: ['Adventure'],
		averageScore: 79,
		format: 'TV',
		episodes: 12,
		duration: 24,
		siteUrl: 'https://anilist.co/anime/301',
		nextAiringEpisode: { episode: 3, airingAt: unix(3) },
		airingSchedule: {
			nodes: [
				{ episode: 3, airingAt: unix(3) },
				{ episode: 4, airingAt: unix(10) }
			]
		},
		studios: { nodes: [{ name: 'Test Studio' }] },
		// Replaced by the offers of TMDB while the anime is matched to a TMDB season
		externalLinks: [
			{ site: 'Bilibili TV', url: 'https://www.bilibili.tv/delta', type: 'STREAMING' }
		],
		recommendations: { nodes: [] }
	}
];
// Episodes aired in the last weeks (the "past" part of the anime request)
export const ANIME_PAST = [
	{ mediaId: 301, episode: 1, airingAt: unix(-11) },
	{ mediaId: 301, episode: 2, airingAt: unix(-4) }
];
