// Sets a new temporary password for an account – for when the password (or username) was
// forgotten. Needs access to the server, so it is not reachable from the web:
//
//   docker exec hdtracker node reset-password.js [username]
//
// Without a username the only account is used. All devices of the account are logged out;
// the app does not need a restart.
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';

function fail(message) {
	console.error(message);
	process.exit(1);
}

const dbPath = resolve(process.env.DATA_DIR ?? './data', 'hdtracker.db');
if (!existsSync(dbPath)) fail(`No database found at ${dbPath}.`);

const db = new Database(dbPath);
const users = db.prepare('SELECT id, username FROM users ORDER BY id').all();
if (users.length === 0) {
	fail('There is no account yet. Open hdtracker in your browser to create one.');
}

const wanted = process.argv[2];
let user;
if (wanted) {
	user = users.find((u) => u.username === wanted);
	if (!user)
		fail(`No account named "${wanted}". Accounts: ${users.map((u) => u.username).join(', ')}`);
} else if (users.length === 1) {
	user = users[0];
} else {
	fail(
		`Several accounts exist – name the one to reset:\n  node reset-password.js <username>\nAccounts: ${users.map((u) => u.username).join(', ')}`
	);
}

// Must stay the same format as hashPassword() in src/lib/server/auth.ts:
// scrypt$<salt hex>$<hash hex>, 16 byte salt, 64 byte hash.
const password = randomBytes(12).toString('base64url');
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
const passwordHash = `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;

db.transaction(() => {
	db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
	db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
})();
db.close();

console.log(`
Password reset – all devices of this account were logged out.

  Username:           ${user.username}
  Temporary password: ${password}

Log in and choose your own password under Settings → Account.
`);
