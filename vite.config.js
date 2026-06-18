import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: 'happy-dom',
		globals: true,
		setupFiles: ['./vitest-setup.js'],
		include: ['tests/**/*.{test,spec}.{js,ts}'],
		exclude: ['e2e/**'],
		reporter: 'dot',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			reportsDirectory: './coverage',
			include: ['src/lib/**'],
			exclude: [
				'src/routes/**',
				'src/lib/components/**',
				'src/lib/index.js',
				'src/lib/services/mapService.js',
				'src/lib/services/h3GridOverlayService.js',
				'src/lib/services/vehiclePositionStream.js',
				'src/lib/services/positionService.js',
				'src/lib/utils/telemetryCharts.js',
				'src/lib/utils/telemetryUtils.js',
				'src/lib/utils/vehicleMarkerIcon.js',
				'src/lib/stores/vehicleStore.js',
				'src/lib/stores/alertStore.js',
				'src/lib/stores/tripStore.js',
				'src/lib/stores/eventStore.js',
				'src/lib/stores/telemetryStore.js',
				'src/lib/stores/h3Store.js',
				'src/lib/stores/navigationStore.js',
				'src/**/*.spec.{js,ts}',
				'src/**/*.test.{js,ts}',
				'src/app.html',
				'src/app.css',
				'**/*.config.{js,ts}',
				'**/vitest-setup*'
			],
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 70,
				statements: 90
			}
		}
	},
	server: {
		hmr: {}
	}
});
