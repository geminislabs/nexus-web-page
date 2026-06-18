import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'list',
	use: {
		...devices['Desktop Chrome'],
		baseURL,
		trace: 'on-first-retry'
	},
	webServer: {
		command: `npm run build && npm run preview -- --port ${port} --host 127.0.0.1`,
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 180000,
		env: {
			ORIGIN: baseURL,
			PORT: String(port),
			VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8100/api/v1',
			VITE_ADMIN_API_URL: process.env.VITE_ADMIN_API_URL || 'http://127.0.0.1:8100/api/v1',
			VITE_COMM_API_URL: process.env.VITE_COMM_API_URL || 'http://127.0.0.1:8000',
			VITE_POSITION_STREAM_WS_BASE:
				process.env.VITE_POSITION_STREAM_WS_BASE || 'ws://127.0.0.1:8000',
			VITE_COMPANY_URL: process.env.VITE_COMPANY_URL || baseURL,
			VITE_GOOGLE_MAPS_API_KEY: process.env.VITE_GOOGLE_MAPS_API_KEY || ''
		}
	}
});
