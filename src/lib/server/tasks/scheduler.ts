import { eq } from 'drizzle-orm';
import { deleteExpiredSessions } from '../auth';
import { pruneCache } from '../cache';
import { getDb } from '../db';
import { tasks } from '../db/schema';
import { refreshAll, refreshPending } from '../releases';
import { createBackup } from './backups';

export type TaskRow = typeof tasks.$inferSelect;
export type Frequency = TaskRow['frequency'];
export const FREQUENCIES: Frequency[] = ['hourly', 'daily', 'weekly', 'monthly'];

type TaskDef = {
	run: () => void | Promise<void>;
	// Calls external APIs: the settings page then warns before "Run now" (rate limits).
	usesApi: boolean;
	defaults: Pick<TaskRow, 'enabled' | 'frequency' | 'time' | 'weekday'>;
};

// All background tasks, in display order: the ones used most first, the backup (off by
// default) last. On the page, switched-off tasks are listed below the active ones.
export const TASKS = {
	metadata: {
		// Titles, posters and release dates of all library items (for the dashboard).
		run: refreshAll,
		usesApi: true,
		defaults: { enabled: true, frequency: 'daily', time: '04:30', weekday: 0 }
	},
	cache: {
		run: () => void pruneCache(),
		usesApi: false,
		defaults: { enabled: true, frequency: 'hourly', time: '00:00', weekday: 0 }
	},
	optimize: {
		// Updates the query planner statistics and compacts the file.
		run: () => {
			const client = getDb().$client;
			client.pragma('optimize');
			client.exec('VACUUM');
			client.pragma('wal_checkpoint(TRUNCATE)');
		},
		usesApi: false,
		defaults: { enabled: true, frequency: 'weekly', time: '04:00', weekday: 0 }
	},
	sessions: {
		run: () => void deleteExpiredSessions(),
		usesApi: false,
		defaults: { enabled: true, frequency: 'daily', time: '03:30', weekday: 0 }
	},
	backup: {
		run: createBackup,
		usesApi: false,
		// Off by default: most people back up the whole Docker volume anyway.
		defaults: { enabled: false, frequency: 'daily', time: '03:00', weekday: 0 }
	}
} satisfies Record<string, TaskDef>;

export type TaskKey = keyof typeof TASKS;
export const TASK_KEYS = Object.keys(TASKS) as TaskKey[];

export function isTaskKey(value: string): value is TaskKey {
	return Object.hasOwn(TASKS, value);
}

// ---- Schedule ----

// The most recent planned run time at or before `now` (local time, TZ from .env).
// Hourly tasks run at the start of every hour.
export function latestSlot(task: TaskRow, now = new Date()) {
	const [hours, minutes] = task.time.split(':').map(Number);
	const slot = new Date(now);
	switch (task.frequency) {
		case 'hourly':
			slot.setMinutes(0, 0, 0);
			break;
		case 'daily':
			slot.setHours(hours, minutes, 0, 0);
			if (slot > now) slot.setDate(slot.getDate() - 1);
			break;
		case 'weekly':
			slot.setHours(hours, minutes, 0, 0);
			slot.setDate(slot.getDate() - ((slot.getDay() - task.weekday + 7) % 7));
			if (slot > now) slot.setDate(slot.getDate() - 7);
			break;
		case 'monthly':
			slot.setDate(1);
			slot.setHours(hours, minutes, 0, 0);
			if (slot > now) slot.setMonth(slot.getMonth() - 1);
			break;
	}
	return slot;
}

// The next planned run time after `now`.
export function nextSlot(task: TaskRow, now = new Date()) {
	const slot = latestSlot(task, now);
	if (task.frequency === 'hourly') slot.setHours(slot.getHours() + 1);
	if (task.frequency === 'daily') slot.setDate(slot.getDate() + 1);
	if (task.frequency === 'weekly') slot.setDate(slot.getDate() + 7);
	if (task.frequency === 'monthly') slot.setMonth(slot.getMonth() + 1);
	return slot;
}

// Due if a planned time has passed since the last run (or since the schedule was changed).
// Several missed times still lead to only one run.
function isDue(task: TaskRow, now: Date) {
	if (!task.enabled) return false;
	const since = Math.max(task.lastRunAt?.getTime() ?? 0, task.changedAt.getTime());
	return latestSlot(task, now).getTime() > since;
}

// ---- Rows in the database ----

// Creates missing rows with default values (new install or new task).
function ensureRows() {
	const db = getDb();
	for (const key of TASK_KEYS) {
		db.insert(tasks)
			.values({ key, ...TASKS[key].defaults, changedAt: new Date() })
			.onConflictDoNothing()
			.run();
	}
}

// All tasks in display order: active ones first, switched-off ones below (each group in the
// order of TASKS).
export function listTasks(): TaskRow[] {
	const rows = getDb().select().from(tasks).all();
	const ordered = TASK_KEYS.map((key) => rows.find((r) => r.key === key)).filter(
		(r) => r !== undefined
	);
	return [...ordered.filter((t) => t.enabled), ...ordered.filter((t) => !t.enabled)];
}

export function updateTask(
	key: TaskKey,
	values: Pick<TaskRow, 'enabled' | 'frequency' | 'time' | 'weekday'>
) {
	getDb()
		.update(tasks)
		.set({ ...values, changedAt: new Date() })
		.where(eq(tasks.key, key))
		.run();
	loadRows();
}

// ---- Running ----

const running = new Set<TaskKey>();

export function isRunning(key: TaskKey) {
	return running.has(key);
}

// Runs a task now and stores the result. Returns the error message, or null on success.
export async function runTask(key: TaskKey): Promise<string | null> {
	if (running.has(key)) return null;
	running.add(key);
	const started = new Date();
	let error: string | null = null;
	try {
		await TASKS[key].run();
	} catch (err) {
		console.error(`Task ${key} failed`, err);
		error = err instanceof Error ? err.message : String(err);
	} finally {
		running.delete(key);
	}
	getDb()
		.update(tasks)
		.set({ lastRunAt: started, lastDurationMs: Date.now() - started.getTime(), lastError: error })
		.where(eq(tasks.key, key))
		.run();
	loadRows();
	return error;
}

// ---- Scheduler ----

// In-memory copy of the rows, so the minute check does not read the database every time.
let rows: TaskRow[] = [];
function loadRows() {
	rows = listTasks();
}

async function tick() {
	const now = new Date();
	for (const task of rows) {
		if (isDue(task, now)) await runTask(task.key as TaskKey);
	}
}

// Called once at server start: checks every minute whether a task is due. Tasks missed while
// the server was off run shortly after the start.
export function startScheduler() {
	// During development the server code can be reloaded; never start a second timer.
	const g = globalThis as { hdtrackerScheduler?: boolean };
	if (g.hdtrackerScheduler) return;
	g.hdtrackerScheduler = true;

	ensureRows();
	loadRows();
	const safeTick = () => tick().catch((err) => console.error('Scheduler failed', err));
	setTimeout(safeTick, 30_000).unref();
	// Details still missing (e.g. an import interrupted by a restart): continue loading them.
	setTimeout(refreshPending, 5_000).unref();
	setInterval(safeTick, 60_000).unref();
}
