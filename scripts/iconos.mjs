#!/usr/bin/env node
/**
 * Subconjunto de Material Design Icons que usa el panel.
 *
 * `@iconify/svelte` en modo online descarga cada ícono de `api.iconify.design`
 * al pintarlo: un tercero recibía la IP de cada usuario y el CSP tenía que
 * dejarle pasar. Ahora los íconos viajan en el bundle: este script busca cada
 * `mdi:<nombre>` en `src/` y copia sus datos de `@iconify-json/mdi` a
 * `src/lib/icons/mdi.json`, que `$lib/components/Icon.svelte` registra al cargar.
 *
 * Uso:
 *   npm run icons            reescribe src/lib/icons/mdi.json
 *   npm run icons -- --check falla si el archivo no está al día
 *
 * `tests/iconos.test.js` hace el mismo `--check`: un ícono nuevo sin regenerar
 * el subconjunto rompe la CI en lugar de salir en blanco en producción.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SALIDA = join(RAIZ, 'src/lib/icons/mdi.json');
const NOMBRE = /\bmdi:([a-z0-9]+(?:-[a-z0-9]+)*)/g;

function* archivos(dir) {
	for (const entrada of readdirSync(dir, { withFileTypes: true })) {
		const ruta = join(dir, entrada.name);
		if (entrada.isDirectory()) yield* archivos(ruta);
		else if (/\.(svelte|js)$/.test(entrada.name)) yield ruta;
	}
}

/** Nombres `mdi:*` que aparecen en el código, ordenados y sin repetir. */
export function nombresUsados(dir = join(RAIZ, 'src')) {
	const nombres = new Set();
	for (const ruta of archivos(dir)) {
		for (const [, nombre] of readFileSync(ruta, 'utf8').matchAll(NOMBRE)) nombres.add(nombre);
	}
	return [...nombres].sort();
}

const ordenado = (obj) =>
	Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : 1)));

/**
 * Copia del set completo solo los íconos pedidos. Un alias arrastra al ícono
 * del que deriva; un nombre que no existe va a `faltan`.
 */
export function subconjunto(set, nombres) {
	const icons = {};
	const aliases = {};
	const faltan = [];

	const incluir = (nombre) => {
		if (set.icons[nombre]) {
			icons[nombre] = set.icons[nombre];
			return true;
		}
		const alias = set.aliases?.[nombre];
		if (!alias || !incluir(alias.parent)) return false;
		aliases[nombre] = alias;
		return true;
	};

	for (const nombre of nombres) if (!incluir(nombre)) faltan.push(nombre);

	const data = {
		prefix: set.prefix,
		width: set.width,
		height: set.height,
		icons: ordenado(icons)
	};
	if (Object.keys(aliases).length) data.aliases = ordenado(aliases);
	return { data, faltan };
}

/** Contenido que debería tener `src/lib/icons/mdi.json`. */
export function generar() {
	const ruta = createRequire(import.meta.url).resolve('@iconify-json/mdi/icons.json');
	const set = JSON.parse(readFileSync(ruta, 'utf8'));
	const { data, faltan } = subconjunto(set, nombresUsados());
	return { contenido: `${JSON.stringify(data, null, '\t')}\n`, faltan };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const { contenido, faltan } = generar();
	const destino = relative(RAIZ, SALIDA);
	if (faltan.length) {
		console.error(`No existen en @iconify-json/mdi: ${faltan.join(', ')}`);
		process.exit(1);
	}
	if (process.argv.includes('--check')) {
		let actual = '';
		try {
			actual = readFileSync(SALIDA, 'utf8');
		} catch {
			// sin archivo cuenta como desactualizado
		}
		if (actual !== contenido) {
			console.error(`${destino} no está al día: corre npm run icons`);
			process.exit(1);
		}
		console.log(`${destino} al día`);
	} else {
		writeFileSync(SALIDA, contenido);
		const total = Object.keys(JSON.parse(contenido).icons).length;
		console.log(`${destino}: ${total} íconos`);
	}
}
