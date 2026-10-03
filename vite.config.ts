import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// Tests must not depend on (or use) the real .env: fixed values, set before SvelteKit reads
// the environment.
if (process.env.VITEST) {
	Object.assign(process.env, {
		SECRET: 'test-secret-test-secret-test-secret-0123',
		TMDB_API_TOKEN: 'test',
		IGDB_CLIENT_ID: 'test',
		IGDB_CLIENT_SECRET: 'test'
	});
}

export default defineConfig({
	// npm test: every test file gets its own empty database, no network (see src/tests/setup.ts)
	test: { environment: 'node', include: ['src/**/*.test.ts'], setupFiles: ['src/tests/setup.ts'] },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Our own origin check in hooks.server.ts replaces this, because ORIGIN may list several addresses.
			csrf: { trustedOrigins: ['*'] },
			// The browser only loads from our own server and runs only our own scripts. Images in
			// particular never come from TMDB & co. directly (see src/lib/images.ts). Inline styles
			// are needed for the accent colours (style="color: …").
			csp: {
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:'],
					'font-src': ['self'],
					'connect-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			},
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		})
	]
});
