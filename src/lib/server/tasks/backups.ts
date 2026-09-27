import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DATA_DIR } from '../config';
import { getDb } from '../db';
import { getSetting } from '../settings';

export const BACKUP_DIR = resolve(DATA_DIR, 'backups');

// Only files created by the app, e.g. "hdtracker-2026-09-27_030000.db".
const NAME_PATTERN = /^hdtracker-\d{4}-\d{2}-\d{2}_\d{6}\.db$/;

export function isBackupName(name: string) {
	return NAME_PATTERN.test(name);
}

export type BackupFile = { name: string; size: number; createdAt: string };

// All backup files, newest first.
export function listBackups(): BackupFile[] {
	let names: string[];
	try {
		names = readdirSync(BACKUP_DIR);
	} catch {
		return []; // folder does not exist yet
	}
	return names
		.filter(isBackupName)
		.map((name) => {
			const stat = statSync(join(BACKUP_DIR, name));
			return { name, size: stat.size, createdAt: stat.mtime.toISOString() };
		})
		.sort((a, b) => b.name.localeCompare(a.name));
}

// Copies the database into the backup folder, then deletes the oldest copies beyond the
// configured number. The copy is consistent even while the app keeps running.
export async function createBackup() {
	mkdirSync(BACKUP_DIR, { recursive: true });
	// Local time stamp: "2026-09-27 03:00:00" -> "2026-09-27_030000"
	const stamp = new Date().toLocaleString('sv-SE').replace(' ', '_').replaceAll(':', '');
	await getDb().$client.backup(join(BACKUP_DIR, `hdtracker-${stamp}.db`));

	const keep = Math.max(1, Number.parseInt(getSetting('backupKeep'), 10) || 1);
	for (const old of listBackups().slice(keep)) deleteBackup(old.name);
}

export function deleteBackup(name: string) {
	if (!isBackupName(name)) return;
	try {
		unlinkSync(join(BACKUP_DIR, name));
	} catch {
		// already gone
	}
}

export function deleteAllBackups() {
	for (const file of listBackups()) deleteBackup(file.name);
}
