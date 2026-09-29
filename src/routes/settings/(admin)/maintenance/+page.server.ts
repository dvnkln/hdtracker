import { fail } from '@sveltejs/kit';
import { serverMessages } from '$lib/server/i18n';
import { getSetting, setSettings } from '$lib/server/settings';
import { deleteAllBackups, deleteBackup, listBackups } from '$lib/server/tasks/backups';
import {
	FREQUENCIES,
	TASKS,
	isRunning,
	isTaskKey,
	listTasks,
	nextSlot,
	runTask,
	updateTask,
	type Frequency,
	type TaskKey
} from '$lib/server/tasks/scheduler';
import { requireAdmin } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/; // "03:00"
const MAX_KEEP = 100;

export const load: PageServerLoad = () => {
	const taskList = listTasks().map((t) => {
		const key = t.key as TaskKey;
		return {
			key,
			enabled: t.enabled,
			frequency: t.frequency,
			time: t.time,
			weekday: t.weekday,
			usesApi: TASKS[key].usesApi,
			running: isRunning(key),
			lastRunAt: t.lastRunAt?.toISOString() ?? null,
			lastDurationMs: t.lastDurationMs,
			lastError: t.lastError,
			nextRunAt: t.enabled ? nextSlot(t).toISOString() : null
		};
	});
	return {
		tasks: taskList,
		frequencies: FREQUENCIES,
		backups: listBackups(),
		backupKeep: Number(getSetting('backupKeep')),
		maxKeep: MAX_KEEP,
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
	};
};

function readKey(data: FormData) {
	const key = String(data.get('key') ?? '');
	return isTaskKey(key) ? key : null;
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const t = serverMessages();
		const data = await request.formData();
		const key = readKey(data);
		const frequency = String(data.get('frequency') ?? '') as Frequency;
		// Hourly tasks have no time field; keep a valid value anyway.
		const time = String(data.get('time') ?? '00:00');
		const weekday = Number(data.get('weekday') ?? 0);
		const invalid = () => fail(400, { key, error: t.common.invalidData });

		if (
			!key ||
			!FREQUENCIES.includes(frequency) ||
			!TIME_PATTERN.test(time) ||
			!(Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)
		) {
			return invalid();
		}
		if (key === 'backup') {
			const keep = Number(data.get('keep'));
			if (!(Number.isInteger(keep) && keep >= 1 && keep <= MAX_KEEP)) return invalid();
			setSettings({ backupKeep: String(keep) });
		}
		updateTask(key, { enabled: data.get('enabled') === 'on', frequency, time, weekday });
		return { key, message: t.settings.saved };
	},

	run: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const key = readKey(await request.formData());
		if (!key) return fail(400, { key, error: serverMessages().common.invalidData });
		const error = await runTask(key);
		if (error) return fail(500, { key, error: `${serverMessages().maintenance.failed} ${error}` });
		return { key, message: serverMessages().maintenance.done };
	},

	deleteBackup: async ({ request, locals }) => {
		requireAdmin(locals.user);
		deleteBackup(String((await request.formData()).get('name') ?? ''));
		return { key: 'backup' };
	},

	deleteAllBackups: ({ locals }) => {
		requireAdmin(locals.user);
		deleteAllBackups();
		return { key: 'backup' };
	}
};
