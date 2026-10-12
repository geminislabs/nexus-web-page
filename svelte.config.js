import adapter from '@sveltejs/adapter-node';
import { loadEnv } from 'vite';
import { cspDirectives } from './src/lib/security/csp.js';

// Las mismas VITE_* que Vite hornea en el bundle: las del entorno (build-args
// del Dockerfile) mandan sobre las de `.env`.
const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), 'VITE_');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
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
	}
};

export default config;
