// Builds the large picture of a notification – the one shown when it is opened up. It is
// wide, a poster is upright: so a single title gets a kind of film card (its poster in front
// of its backdrop), and the message that sums up a day gets the posters side by side.
//
// Done with sharp (libvips), the usual tool for this: it computes outside the server's own
// thread, so the server keeps answering meanwhile, and it reads pictures already shrunk, so
// it needs little memory. (A first version in plain JavaScript stopped the server for a
// quarter of a second per picture, or – moved to a helper process – held 120–190 MB.)

export const LAYOUTS = {
	// Up to four posters in a row
	wide: { width: 720, height: 360, max: 4, min: 2 },
	// One title: [poster] or [poster, backdrop] – the whole poster in front of the darkened
	// backdrop; without a backdrop in front of a soft, dark blow-up of itself
	banner: { width: 720, height: 360, max: 2, min: 1 }
} as const;
export type Layout = keyof typeof LAYOUTS;
export const isLayout = (value: string): value is Layout => Object.hasOwn(LAYOUTS, value);

const GAP = 2; // pixels between two posters of a row
const BACKGROUND = { r: 24, g: 24, b: 27 }; // zinc-900, shows in the gaps
const MARGIN = 20; // around the poster of a film card
const RIM = 2; // light line around that poster
const RIM_COLOUR = '#e4e4e7'; // zinc-200
const QUALITY = 86;
// Larger pictures are not read at all (posters and backdrops are far below this)
const MAX_PIXELS = 4000 * 4000;

type SharpModule = (typeof import('sharp'))['default'];

// sharp is a native module with a program file per kind of machine. Where it cannot be
// loaded there are simply no large pictures – the app itself must not depend on it.
// Loading it stops the server for a moment (measured: about 30 ms) and takes about 25 MB
// from then on. So it is neither loaded for everybody at start nor at some point in the
// middle of the day: preparePictures() is called when notifications are in use (at start,
// and when somebody switches them on, see notifications.ts). The first picture loads it as
// well, should it be missing.
let loading: Promise<SharpModule | null> | undefined;
function loadSharp() {
	loading ??= import('sharp')
		.then(({ default: sharp }) => {
			// Frugal: no cache of its own, one picture at a time
			sharp.cache(false);
			sharp.concurrency(1);
			return sharp;
		})
		.catch((err) => {
			console.error(
				'Pictures for notifications are not available (sharp could not be loaded)',
				err
			);
			return null;
		});
	return loading;
}

// Loads the tool ahead of time. Never throws.
export const preparePictures = () => loadSharp().then((sharp) => sharp !== null);
// For tests: whether loading was started.
export const picturesPrepared = () => loading !== undefined;

// The given files (as stored) as one wide JPEG in the given layout. `wide`: the posters side
// by side, files that cannot be read are left out. `banner`: the first file is the poster,
// the second (optional) the backdrop. Null if there is too little to show.
export async function composePosters(
	bodies: (Buffer | null)[],
	layout: Layout
): Promise<Buffer | null> {
	const sharp = await loadSharp();
	if (!sharp) return null;
	const { width, height, max, min } = LAYOUTS[layout];
	const open = (body: Buffer) => sharp(body, { limitInputPixels: MAX_PIXELS });
	// Width and height of a file, or null if it is no picture sharp can read
	const sizeOf = async (body: Buffer | null | undefined) => {
		if (!body) return null;
		try {
			const meta = await open(body).metadata();
			return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
		} catch {
			return null;
		}
	};
	// Mixes a picture with the dark background: `keep` = how much of the picture stays
	const dim = (picture: import('sharp').Sharp, keep: number) =>
		picture.linear(
			[keep, keep, keep],
			[BACKGROUND.r, BACKGROUND.g, BACKGROUND.b].map((c) => c * (1 - keep))
		);
	const fill = (body: Buffer, w: number, h: number) =>
		open(body).resize(w, h, { fit: 'cover' }).removeAlpha();

	try {
		if (layout === 'banner') {
			const [poster, backdrop] = bodies;
			const size = await sizeOf(poster);
			if (!poster || !size) return null;
			const behind = backdrop && (await sizeOf(backdrop)) ? backdrop : null;
			// Behind: the darkened backdrop – or the poster itself, blown up, soft and dark
			const back = behind
				? dim(fill(behind, width, height), 0.6)
				: dim(fill(poster, width, height).blur(20), 0.45);
			// In front: the whole poster with a light rim; on the left if there is a backdrop
			// to look at, otherwise in the middle
			const posterHeight = height - 2 * MARGIN;
			const posterWidth = Math.min(
				width - 2 * MARGIN,
				Math.round((posterHeight * size.width) / size.height)
			);
			const left = behind ? MARGIN + 8 : Math.floor((width - posterWidth) / 2);
			const front = await fill(poster, posterWidth, posterHeight)
				.extend({ top: RIM, bottom: RIM, left: RIM, right: RIM, background: RIM_COLOUR })
				.toBuffer();
			// (Two steps: within one step sharp would dim the poster along with what is behind it.)
			return await sharp(await back.png({ compressionLevel: 0 }).toBuffer())
				.composite([{ input: front, left: left - RIM, top: MARGIN - RIM }])
				.jpeg({ quality: QUALITY })
				.toBuffer();
		}

		const readable: Buffer[] = [];
		for (const body of bodies) {
			if (readable.length < max && body && (await sizeOf(body))) readable.push(body);
		}
		if (readable.length < min) return null;
		// Equal fields with a small gap in between; the last one takes what is left of the width
		const fieldWidth = Math.floor((width - GAP * (readable.length - 1)) / readable.length);
		const fields = await Promise.all(
			readable.map(async (body, index) => {
				const left = index * (fieldWidth + GAP);
				const last = index === readable.length - 1;
				const input = await fill(body, last ? width - left : fieldWidth, height).toBuffer();
				return { input, left, top: 0 };
			})
		);
		return await sharp({ create: { width, height, channels: 3, background: BACKGROUND } })
			.composite(fields)
			.jpeg({ quality: QUALITY })
			.toBuffer();
	} catch (err) {
		// A picture that cannot be made is simply missing
		console.error('Building a notification picture failed', err);
		return null;
	}
}
