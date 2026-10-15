// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Locale } from '#lib/i18n/index.svelte.js';
import type { SessionUser } from '#lib/server/auth.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: SessionUser | null;
			// Interface language of this request (the user's, or the device's when logged out)
			locale: Locale;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
