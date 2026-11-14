import { readFileSync } from 'node:fs';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { cspDirectives } from './src/lib/security/csp.js';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// Las mismas VITE_* que Vite hornea en el bundle: las del entorno (build-args
// del Dockerfile) mandan sobre las de `.env`. Desde SvelteKit 3 la
// configuración de Kit va aquí y no en `svelte.config.js`.
const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), 'VITE_');

function otlpEndpointForBuild(mode) {
	if (process.env.OTLP_ENDPOINT != null) return String(process.env.OTLP_ENDPOINT).trim();
	if (process.env.DEPLOY_ENV === 'production' || process.env.DEPLOY_ENV === 'test') return '';
	if (mode === 'production') return '';
	return 'http://localhost:4318';
}

export default defineConfig(({ mode }) => ({
	plugins: [
		sveltekit({
			adapter: adapter(),
			// SvelteKit 3 cambió `$lib` por `#lib`; se mantiene `$lib`, que es la
			// convención del repo (AGENTS.md).
			alias: { $lib: 'src/lib' },
			csp: {
				// `nonce` y no `auto`: el script del tema en app.html depende del nonce, y
				// en una página prerenderizada no lo habría. Hoy no se prerenderiza nada.
				mode: 'nonce',
				// Se aplica. Salió primero en Report-Only (v1.22.0) porque en local no hay
				// contra qué probar el mapa; el log de `/internal/csp-report` en producción
				// quedó vacío tras usar mapa, stream, Street View y /share. Lo que se
				// bloquee a partir de aquí sigue llegando a ese log.
				directives: cspDirectives(env)
			}
		})
	],
	ssr: {
		noExternal: [/^@opentelemetry\/(?!context-async-hooks|instrumentation-http)/]
	},
	define: {
		__SERVICE_NAME__: JSON.stringify('nexus-web-page'),
		__SERVICE_VERSION__: JSON.stringify(pkg.version),
		__DEPLOY_ENV__: JSON.stringify(process.env.DEPLOY_ENV || 'local'),
		__OTLP_ENDPOINT__: JSON.stringify(otlpEndpointForBuild(mode))
	},
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
				'src/lib/observability/**',
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
			// Umbrales recalibrados el 22/09/2026, al subir a vitest 4.
			//
			// No se ha bajado el listón: se ha dejado de inflar el número.
			// Vitest 3 contaba los ficheros de constantes y datos
			// —`legal.js`, `mapStyles.js`, `unitIcons.js`,
			// `vehicleColors.js`— al 100 %, porque son objetos literales que
			// se ejecutan enteros al importarse y no tienen nada que probar.
			// Eso subía el total de 80,87 % a 92,48 % sin que una sola línea
			// de lógica estuviera más cubierta. Vitest 4 deja de contarlos.
			//
			// Los valores están **justo por debajo** de la medida real, para
			// que la puerta siga detectando una regresión. Son un suelo, no
			// una meta: lo que toca es subirlos escribiendo tests, no
			// bajarlos cuando estorben.
			//
			//   medido con vitest 4: stmts 80,87 · branch 66,35 · funcs 95,83 · lines 85,23
			thresholds: {
				lines: 84,
				functions: 90,
				branches: 65,
				statements: 80
			}
		}
	},
	server: {
		hmr: {}
	}
}));
