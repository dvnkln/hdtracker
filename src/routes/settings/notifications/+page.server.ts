import { fail } from '@sveltejs/kit';
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
	listDevices,
	parseSubscription,
	pushPublicKey,
	removeDevice,
	renameDevice,
	sendPush
} from '$lib/server/push';
import type { Actions, PageServerLoad } from './$types';

// Push notifications are personal: every user switches on their own devices.
export const load: PageServerLoad = ({ locals }) => ({
	publicKey: pushPublicKey(),
	prefs: prefsFor(locals.user!.id),
	devices: listDevices(locals.user!.id).map((device) => ({
		...device,
		createdAt: device.createdAt.toISOString(),
		lastOkAt: device.lastOkAt?.toISOString() ?? null
	}))
});

export const actions: Actions = {
	// Called by the page after the browser has subscribed at its push service.
	subscribe: async ({ request, locals }) => {
		const t = serverMessages();
		const sub = parseSubscription(String((await request.formData()).get('subscription') ?? ''));
		const agent = request.headers.get('user-agent') ?? '';
		if (!sub || !addDevice(locals.user!.id, sub, agent)) {
			return fail(400, { section: 'device', error: t.notifications.refused });
		}
		return { section: 'device', message: t.notifications.enabled };
	},

	// Removes one of the user's own devices (the page also ends the subscription in the browser).
	unsubscribe: async ({ request, locals }) => {
		const t = serverMessages();
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id) || !removeDevice(locals.user!.id, id)) {
			return fail(400, { section: 'devices', error: t.common.invalidData });
		}
		return { section: 'devices', message: t.notifications.removed };
	},

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

	rename: async ({ request, locals }) => {
		const t = serverMessages();
		const data = await request.formData();
		const id = Number(data.get('id'));
		if (
			!Number.isInteger(id) ||
			!renameDevice(locals.user!.id, id, String(data.get('label') ?? ''))
		) {
			return fail(400, { section: 'devices', error: t.common.invalidData });
		}
		return { section: 'devices', message: t.settings.saved };
	},

	// A test message to all devices of the user.
	test: async ({ locals }) => {
		const t = serverMessages();
		// Looks like the real thing where the library has something to show
		const message = sampleMessage(locals.user!.id) ?? {
			title: t.notifications.testTitle,
			body: t.notifications.testBody,
			url: '/settings/notifications',
			tag: 'test'
		};
		const results = await sendPush(locals.user!.id, message);
		const failed = results.filter((r) => !r.ok);
		if (results.length === 0 || failed.length) {
			const labels = failed.map((r) => r.label).join(', ');
			return fail(502, {
				section: 'test',
				error: results.length ? t.notifications.testFailed(labels) : t.notifications.noDevices
			});
		}
		return { section: 'test', message: t.notifications.testSent(results.length) };
	}
};
