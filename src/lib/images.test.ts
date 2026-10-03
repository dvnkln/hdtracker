import { expect, it } from 'vitest';
import { imageSource, img } from './images';

it('accepts only the image servers of the data sources', () => {
	expect(imageSource('https://image.tmdb.org/t/p/w500/x.jpg')).toBe('tmdb');
	expect(imageSource('https://images.igdb.com/igdb/image/upload/t_cover_big/x.jpg')).toBe('igdb');
	expect(imageSource('https://s4.anilist.co/file/x.jpg')).toBe('anilist');
});

it('refuses everything else', () => {
	for (const address of [
		'https://example.com/x.jpg',
		'http://image.tmdb.org/t/p/w500/x.jpg', // not https
		'https://image.tmdb.org:8443/x.jpg', // other port
		'https://user@image.tmdb.org/x.jpg',
		'https://image.tmdb.org.evil.example/x.jpg',
		'https://evilanilist.co/x.jpg',
		'http://localhost:3000/health',
		'not an address'
	]) {
		expect(imageSource(address), address).toBeNull();
		expect(img(address), address).toBeNull();
	}
});

it('builds the address on our own server', () => {
	expect(img('https://image.tmdb.org/t/p/w500/x.jpg')).toBe(
		'/img?u=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw500%2Fx.jpg'
	);
	expect(img(null)).toBeNull();
});
