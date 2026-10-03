import { defineConfig, devices } from '@playwright/test';

// Browser tests of the main flows (npm run test:e2e). They share one server with one database
// and build on each other (the first one creates the account), so they run one after another.
export default defineConfig({
	testDir: 'e2e',
	testMatch: '*.e2e.ts',
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: 'http://localhost:4173',
		locale: 'en-US',
		colorScheme: 'dark',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		// Build quietly; if the build fails, run it again so the error is shown
		command: '(npm run build > /dev/null 2>&1 || npm run build) && node e2e/server.mjs',
		url: 'http://localhost:4173/health',
		reuseExistingServer: false,
		timeout: 180_000,
		// Server errors (and requests the fake data sources had to block) show up in the output
		stdout: 'ignore',
		stderr: 'pipe'
	}
});
