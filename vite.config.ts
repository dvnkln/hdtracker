import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

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
			// Images only from our own server (see src/lib/images.ts): browsers refuse anything else.
			csp: { directives: { 'img-src': ['self', 'data:'] } },
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		})
	]
});
