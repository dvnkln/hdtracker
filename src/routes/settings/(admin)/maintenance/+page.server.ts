import { fail } from '@sveltejs/kit';
import { serverMessages } from '$lib/server/i18n';
import { imageStats } from '$lib/server/images';
import { detailsStats } from '$lib/server/itemDetails';
import { getSetting, setSettings } from '$lib/server/settings';
import { deleteAllBackups, deleteBackup, listBackups } from '$lib/server/tasks/backups';
import {
	FREQUENCIES,
	TASKS,
	databaseSize,
	isRequired,
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
const RUN_WAIT_MS = 10_000;

export const load: PageServerLoad = async () => {
	const backups = listBackups();
	const images = await imageStats();
	// Disk space of what a task looks after: preloaded details, stored images, the database
	// file, all backups.
	type Used =
		| { kind: 'images' | 'metadata'; bytes: number; count: number }
		| { kind: 'optimize' | 'backup'; bytes: number };
	const used: Partial<Record<TaskKey, Used>> = {
		metadata: { kind: 'metadata', ...detailsStats() },
		images: { kind: 'images', bytes: images.bytes, count: images.count },
		optimize: { kind: 'optimize', bytes: databaseSize() }
	};
	if (backups.length) {
		used.backup = { kind: 'backup', bytes: backups.reduce((sum, b) => sum + b.size, 0) };
	}
	const taskList = listTasks().map((t) => {
		const key = t.key as TaskKey;
		return {
			key,
			enabled: t.enabled,
			required: isRequired(key),
			used: used[key] ?? null,
			frequency: t.frequency,
			time: t.time,
			weekday: t.weekday,
			usesApi: TASKS[key].usesApi,
			running: isRunning(key),
			lastRunAt: t.lastRunAt?.toISOString() ?? null,
			lastDurationMs: t.lastDurationMs,
			lastFreedBytes: t.lastFreedBytes,
			lastError: t.lastError,
			nextRunAt: t.enabled ? nextSlot(t).toISOString() : null,
			// The schedule differs from the one a new installation has (then it can be reset)
			customSchedule: !sameSchedule(t, TASKS[key].defaults)
		};
	});
	return {
		tasks: taskList,
		frequencies: FREQUENCIES,
		backups,
		backupKeep: Number(getSetting('backupKeep')),
		maxKeep: MAX_KEEP,
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
	};
};

// Only what takes effect counts: hourly tasks have no time, the weekday only matters weekly.
type Schedule = { frequency: Frequency; time: string; weekday: number };
function sameSchedule(a: Schedule, b: Schedule) {
	return (
		a.frequency === b.frequency &&
		(a.frequency === 'hourly' || a.time === b.time) &&
		(a.frequency !== 'weekly' || a.weekday === b.weekday)
	);
}

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

	// Back to the schedule of a new installation; whether the task is switched on stays as it is.
	resetSchedule: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const key = readKey(await request.formData());
		const current = listTasks().find((t) => t.key === key);
		if (!key || !current) return fail(400, { key, error: serverMessages().common.invalidData });
		const { frequency, time, weekday } = TASKS[key].defaults;
		updateTask(key, { enabled: current.enabled, frequency, time, weekday });
		return { key, message: serverMessages().settings.saved };
	},

	run: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const key = readKey(await request.formData());
		if (!key) return fail(400, { key, error: serverMessages().common.invalidData });
		// Long tasks (refreshing a big library) keep running in the background; the request only
		// waits a moment, so it never runs into a timeout of the browser or a reverse proxy.
		const slow = Symbol('slow');
		const error = await Promise.race([
			runTask(key),
			new Promise<typeof slow>((resolve) => setTimeout(() => resolve(slow), RUN_WAIT_MS))
		]);
		if (error === slow) return { key, message: serverMessages().maintenance.stillRunning };
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
