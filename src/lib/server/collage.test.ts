import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { LAYOUTS, composePosters } from './collage';
import { readCollageAddress, signedCollagePath } from './images';

// A poster (2:3) in one colour, as a file of the given kind.
function poster(
	[r, g, b]: number[],
	format: 'jpeg' | 'png' | 'webp' = 'jpeg',
	width = 60,
	height = 90
) {
	const image = sharp({ create: { width, height, channels: 3, background: { r, g, b } } });
	return image.toFormat(format, { quality: 95 }).toBuffer();
}
const RED = [220, 30, 30];
const GREEN = [30, 200, 60];
const BLUE = [40, 60, 220];

const sizeOf = async (image: Buffer) => {
	const { width, height } = await sharp(image).metadata();
	return [width, height];
};
// Colour in the middle of the n-th of `count` fields (JPEG is lossy: compare roughly)
async function colourOfField(image: Buffer, index: number, count: number) {
	const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
	const x = Math.floor(((index + 0.5) * info.width) / count);
	const i = (Math.floor(info.height / 2) * info.width + x) * info.channels;
	return [data[i], data[i + 1], data[i + 2]];
}
const near = (actual: number[], wanted: number[]) =>
	actual.every((value, i) => Math.abs(value - wanted[i]) < 25);

describe('composePosters', () => {
	it('puts the posters side by side in the order given – JPEG, PNG and WebP alike', async () => {
		const posters = [await poster(RED), await poster(GREEN, 'png'), await poster(BLUE, 'webp')];
		const image = (await composePosters(posters, 'wide'))!;
		expect(await sizeOf(image)).toEqual([LAYOUTS.wide.width, LAYOUTS.wide.height]);
		expect(near(await colourOfField(image, 0, 3), RED)).toBe(true);
		expect(near(await colourOfField(image, 1, 3), GREEN)).toBe(true);
		expect(near(await colourOfField(image, 2, 3), BLUE)).toBe(true);
	});

	it('takes up to four posters', async () => {
		const five = await Promise.all([RED, GREEN, BLUE, RED, GREEN].map((colour) => poster(colour)));
		const wide = (await composePosters(five, 'wide'))!;
		expect(near(await colourOfField(wide, 2, 4), BLUE)).toBe(true);
		expect(near(await colourOfField(wide, 3, 4), RED)).toBe(true);
	});

	it('leaves out files it cannot read, and needs at least two posters', async () => {
		const text = Buffer.from('this is no picture at all');
		const broken = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]);
		const posters = [text, await poster(RED), broken, null, await poster(BLUE)];
		const image = (await composePosters(posters, 'wide'))!;
		expect(near(await colourOfField(image, 0, 2), RED)).toBe(true);
		expect(near(await colourOfField(image, 1, 2), BLUE)).toBe(true);
		expect(await composePosters([await poster(RED), text], 'wide')).toBeNull();
		expect(await composePosters([], 'wide')).toBeNull();
	});

	it('banner: the whole poster in the middle of a soft, dark blow-up of itself', async () => {
		const image = (await composePosters([await poster(RED)], 'banner'))!;
		expect(await sizeOf(image)).toEqual([LAYOUTS.banner.width, LAYOUTS.banner.height]);
		// Middle of three fields: the poster itself; outer fields: the same colour, much darker
		expect(near(await colourOfField(image, 1, 3), RED)).toBe(true);
		const [r, g, b] = await colourOfField(image, 0, 3);
		expect(r).toBeGreaterThan(g + 20);
		expect(r).toBeLessThan(RED[0] * 0.7);
		expect(b).toBeLessThan(60);
	});

	it('banner with a backdrop: poster on the left, the darkened backdrop beside it', async () => {
		const backdrop = await poster(BLUE, 'jpeg', 160, 90);
		const image = (await composePosters([await poster(RED), backdrop], 'banner'))!;
		// Six fields across: the poster covers the second one, the right half shows the backdrop
		expect(near(await colourOfField(image, 1, 6), RED)).toBe(true);
		const [r, g, b] = await colourOfField(image, 4, 6);
		expect(b).toBeGreaterThan(r + 60);
		expect(b).toBeLessThan(BLUE[2] * 0.8);
		expect(g).toBeLessThan(80);
	});

	it('banner needs the poster; a backdrop that cannot be read is simply left out', async () => {
		const text = Buffer.from('this is no picture at all');
		expect(await composePosters([], 'banner')).toBeNull();
		expect(await composePosters([null, await poster(BLUE)], 'banner')).toBeNull();
		expect(await composePosters([text, await poster(BLUE)], 'banner')).toBeNull();
		const alone = (await composePosters([await poster(RED), text], 'banner'))!;
		expect(near(await colourOfField(alone, 1, 3), RED)).toBe(true);
	});
});

describe('collage address', () => {
	const POSTERS = ['https://image.tmdb.org/t/p/w342/a.jpg', 'https://s4.anilist.co/file/b.png'];
	const url = (path: string) => new URL(path, 'https://tracker.example');
	const NOW = Date.parse('2026-10-05T09:00:00Z');
	const DAY = 24 * 60 * 60 * 1000;

	it('names the posters and the layout', () => {
		const address = readCollageAddress(url(signedCollagePath(POSTERS, 'wide', NOW)), NOW);
		expect(address).toEqual({ layout: 'wide', addresses: POSTERS });
	});

	it('is refused when anything about it was changed', () => {
		const good = url(signedCollagePath(POSTERS, 'wide', NOW));
		const changed = (change: (query: URLSearchParams) => void) => {
			const copy = new URL(good.href);
			change(copy.searchParams);
			return readCollageAddress(copy, NOW);
		};
		expect(changed(() => {})).not.toBeNull();
		expect(changed((q) => q.set('l', 'banner'))).toBeNull();
		expect(changed((q) => q.append('u', 'https://image.tmdb.org/t/p/w342/c.jpg'))).toBeNull();
		expect(changed((q) => q.set('u', POSTERS[1]))).toBeNull();
		expect(changed((q) => q.set('e', String(Number(q.get('e')) + 1000)))).toBeNull();
		expect(changed((q) => q.delete('s'))).toBeNull();
	});

	it('stops working after a week', () => {
		const address = url(signedCollagePath(POSTERS, 'wide', NOW));
		expect(readCollageAddress(address, NOW + 6 * DAY)).not.toBeNull();
		expect(readCollageAddress(address, NOW + 8 * DAY)).toBeNull();
	});
});
