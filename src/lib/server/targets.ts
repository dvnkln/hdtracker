import { composePosters, type Layout } from './collage';
import { getChannel, listChannels, publicChannel, sendToChannel, type Outgoing } from './channels';
import { serverMessages } from './i18n';
import { getImage, type Image } from './images';
import { allowedOrigins } from './origins';
import { listDevices, sendPush, type PushMessage } from './push';

// Where notifications go: the user's own devices (push messages of the app itself, see
// push.ts) and further channels such as Pushover or ntfy (channels.ts). For the user they are one
// list of targets, each with a name and a switch; this file is the one place that knows both.

// What the large picture of a message is made of – so a channel that takes a file (Pushover)
// can get one, while the devices load the picture from a signed address.
export type PictureSource = { layout: Layout; addresses: string[] } | { address: string };
// A message as notifications.ts builds it: what the devices get, plus what channels need.
export type Notice = PushMessage & { source: PictureSource | null; count: number; test?: boolean };

export type TargetRef = { type: 'device' | 'channel'; id: number };
export const targetKey = (ref: TargetRef) => `${ref.type}:${ref.id}`;
export function parseTargetKey(key: string): TargetRef | null {
	const match = /^(device|channel):(\d+)$/.exec(key);
	return match ? { type: match[1] as TargetRef['type'], id: Number(match[2]) } : null;
}

// Everything the settings page lists, devices first.
export function listTargets(userId: number) {
	const devices = listDevices(userId).map((device) => ({
		key: targetKey({ type: 'device', id: device.id }),
		kind: 'device' as const,
		name: device.label,
		enabled: device.enabled,
		lastOkAt: device.lastOkAt?.toISOString() ?? null,
		lastError: null as string | null,
		// Address at the push service: tells the page which entry is the device it runs on
		endpoint: device.endpoint,
		fields: {
			devices: '',
			known: [] as string[],
			picture: true,
			url: '',
			body: '',
			hasHeader: false,
			server: '',
			topic: '',
			icon: '',
			hasToken: false
		}
	}));
	const channels = listChannels(userId).map((row) => {
		const channel = publicChannel(row);
		return {
			...channel,
			key: targetKey({ type: 'channel', id: row.id }),
			endpoint: null as string | null
		};
	});
	return [...devices, ...channels];
}

// Whether any target is switched on – without one there is nobody to tell.
export function hasEnabledTarget(userId: number) {
	return listTargets(userId).some((target) => target.enabled);
}

// The address the app is reached at from outside, for links in messages: the first https
// address of ORIGIN, else the first one. Null without ORIGIN (dev server).
function publicAddress(path: string) {
	const origins = allowedOrigins();
	const origin = origins.find((o) => o.startsWith('https://')) ?? origins[0];
	return origin ? origin + path : null;
}

async function pictureFile(source: PictureSource | null): Promise<Image | null> {
	if (!source) return null;
	if ('address' in source) return getImage(source.address);
	const files = await Promise.all(source.addresses.map((a) => getImage(a).catch(() => null)));
	const body = await composePosters(
		files.map((file) => file?.body ?? null),
		source.layout
	);
	return body ? { body, type: 'image/jpeg' } : null;
}

export type Delivery = { key: string; name: string; ok: boolean; error?: string };

// Sends a message to every target of the user that is switched on – or, with `only`, to that
// one target whether it is switched on or not (test). One after the other; never throws.
export async function deliver(userId: number, notice: Notice, only?: TargetRef) {
	const results: Delivery[] = [];
	const { source, count, test, ...push } = notice;

	if (!only || only.type === 'device') {
		for (const sent of await sendPush(userId, push, only?.id)) {
			results.push({
				key: targetKey({ type: 'device', id: sent.id }),
				name: sent.label,
				ok: sent.ok,
				error: sent.gone ? 'gone' : undefined
			});
		}
	}

	const channels =
		only?.type === 'channel'
			? [getChannel(userId, only.id)].filter((row) => row !== undefined)
			: only
				? []
				: listChannels(userId).filter((row) => row.enabled);
	if (channels.length) {
		// Built once for all channels, and only if one asks for it
		let picture: Promise<Image | null> | undefined;
		const outgoing: Outgoing = {
			title: push.title,
			body: push.body,
			link: publicAddress(push.url),
			linkTitle: serverMessages().notifications.openLink,
			image: push.image ? publicAddress(push.image) : null,
			picture: () => (picture ??= pictureFile(source).catch(() => null)),
			count,
			test: test === true,
			icon: publicAddress('/icons/icon-192.png')
		};
		for (const row of channels) {
			const sent = await sendToChannel(row, outgoing);
			results.push({
				key: targetKey({ type: 'channel', id: row.id }),
				name: row.name,
				ok: sent.ok,
				error: sent.ok ? undefined : sent.error
			});
		}
	}
	return results;
}
