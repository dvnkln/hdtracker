import { fail } from '@sveltejs/kit';
import { removeChannel, saveChannel, setChannelEnabled } from '$lib/server/channels';
import { serverMessages } from '$lib/server/i18n';
import {
	NOTIFY_MODES,
	prefsFor,
	sampleMessage,
	savePrefs,
	type NotifyMode
} from '$lib/server/notifications';
import {
	addDevice,
	parseSubscription,
	pushPublicKey,
	removeDevice,
	renameDevice,
	setDeviceEnabled
} from '$lib/server/push';
import { deliver, listTargets, parseTargetKey } from '$lib/server/targets';
import type { Actions, PageServerLoad } from './$types';

// Notifications are personal: every user has their own targets (devices, Pushover, ...).
export const load: PageServerLoad = ({ locals }) => ({
	publicKey: pushPublicKey(),
	prefs: prefsFor(locals.user!.id),
	targets: listTargets(locals.user!.id)
});

export const actions: Actions = {
	// What to be told about new releases, and from which hour of the day.
	prefs: async ({ request, locals }) => {
		const t = serverMessages();
		const data = await request.formData();
		const mode = String(data.get('mode') ?? '') as NotifyMode;
		const hour = Number(data.get('hour'));
		if (!NOTIFY_MODES.includes(mode) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
			return fail(400, { section: 'prefs', error: t.common.invalidData });
		}
		savePrefs(locals.user!.id, mode, hour);
		return { section: 'prefs', message: t.settings.saved };
	},

	// "This device": called by the page after the browser has subscribed at its push service.
	subscribe: async ({ request, locals }) => {
		const t = serverMessages();
		const sub = parseSubscription(String((await request.formData()).get('subscription') ?? ''));
		const agent = request.headers.get('user-agent') ?? '';
		if (!sub || !addDevice(locals.user!.id, sub, agent)) {
			return fail(400, { error: t.notifications.refused });
		}
		return { message: t.settings.saved };
	},

	// The switch of a target: off keeps everything about it.
	targetToggle: async ({ request, locals }) => {
		const data = await request.formData();
		const ref = parseTargetKey(String(data.get('key') ?? ''));
		const enabled = data.get('enabled') === 'on';
		const done =
			ref &&
			(ref.type === 'device'
				? setDeviceEnabled(locals.user!.id, ref.id, enabled)
				: setChannelEnabled(locals.user!.id, ref.id, enabled));
		if (!done) return fail(400, { error: serverMessages().notifications.channelErrors.unknown });
		return {};
	},

	targetRemove: async ({ request, locals }) => {
		const t = serverMessages().notifications;
		const ref = parseTargetKey(String((await request.formData()).get('key') ?? ''));
		const done =
			ref &&
			(ref.type === 'device'
				? removeDevice(locals.user!.id, ref.id)
				: removeChannel(locals.user!.id, ref.id));
		if (!done) return fail(400, { error: t.channelErrors.unknown });
		return { message: t.removed };
	},

	// A test message to exactly one target (also one that is switched off): it looks like a
	// real message where the library has something to show.
	targetTest: async ({ request, locals }) => {
		const t = serverMessages().notifications;
		const ref = parseTargetKey(String((await request.formData()).get('key') ?? ''));
		const [result] = ref ? await deliver(locals.user!.id, sampleMessage(locals.user!.id), ref) : [];
		if (!result) return fail(400, { error: t.channelErrors.unknown });
		if (result.ok) return { message: t.testSent };
		const reason =
			result.error === 'gone'
				? t.gone
				: !result.error || result.error === 'unreachable'
					? t.unreachable
					: t.testFailed(result.error);
		return fail(502, { error: reason });
	},

	// The name of a device (a device has no other settings).
	deviceRename: async ({ request, locals }) => {
		const t = serverMessages();
		const data = await request.formData();
		const ref = parseTargetKey(String(data.get('key') ?? ''));
		const done =
			ref?.type === 'device' &&
			renameDevice(locals.user!.id, ref.id, String(data.get('name') ?? ''));
		if (!done) return fail(400, { error: t.notifications.channelErrors.name });
		return { message: t.settings.saved };
	},

	// Creates or changes a Pushover, ntfy or webhook target (Pushover's keys are checked there first).
	channelSave: async ({ request, locals }) => {
		const t = serverMessages();
		const data = await request.formData();
		const ref = parseTargetKey(String(data.get('key') ?? ''));
		const text = (name: string) => String(data.get(name) ?? '');
		const result = await saveChannel(locals.user!.id, {
			id: ref?.type === 'channel' ? ref.id : null,
			kind: text('kind'),
			name: text('name'),
			fields: {
				token: text('token'),
				user: text('user'),
				devices: text('devices'),
				picture: text('picture'),
				url: text('url'),
				body: text('body'),
				header: text('header'),
				clearHeader: text('clearHeader'),
				server: text('server'),
				topic: text('topic'),
				icon: text('icon'),
				clearToken: text('clearToken')
			}
		});
		if (!result.ok) {
			const error =
				result.error === 'refused'
					? t.notifications.rejected(result.text ?? '')
					: (t.notifications.channelErrors[result.error] ?? t.common.invalidData);
			return fail(400, { error });
		}
		return { message: t.settings.saved, key: `channel:${result.id}` };
	}
};
