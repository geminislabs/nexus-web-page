import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateIcon } from '@iconify/svelte/dist/offline-functions';
import { generar, nombresUsados, SALIDA, subconjunto } from '../scripts/iconos.mjs';
// Importarlo registra el subconjunto en el almacén de Iconify.
import '../src/lib/components/Icon.svelte';

const SET = {
	prefix: 'mdi',
	width: 24,
	height: 24,
	icons: { home: { body: '<path d="h"/>' }, car: { body: '<path d="c"/>' } },
	aliases: { house: { parent: 'home' }, casa: { parent: 'house' } }
};

describe('subconjunto', () => {
	it('copia solo lo pedido y arrastra la cadena de alias', () => {
		const { data, faltan } = subconjunto(SET, ['casa']);
		expect(faltan).toEqual([]);
		expect(Object.keys(data.icons)).toEqual(['home']);
		expect(data.aliases).toEqual({ casa: { parent: 'house' }, house: { parent: 'home' } });
		expect(data).toMatchObject({ prefix: 'mdi', width: 24, height: 24 });
	});

	it('reporta los nombres que no existen en el set', () => {
		const { data, faltan } = subconjunto(SET, ['car', 'memory-off']);
		expect(faltan).toEqual(['memory-off']);
		expect(Object.keys(data.icons)).toEqual(['car']);
		expect(data.aliases).toBeUndefined();
	});
});

describe('src/lib/icons/mdi.json', () => {
	it('está al día con los íconos que usa el código (npm run icons)', () => {
		const { contenido, faltan } = generar();
		expect(faltan).toEqual([]);
		expect(readFileSync(SALIDA, 'utf8')).toBe(contenido);
	});

	it('encuentra los nombres en atributos, expresiones y listas', () => {
		const nombres = nombresUsados();
		for (const nombre of ['loading', 'eye-off', 'lightning-bolt', 'memory']) {
			expect(nombres).toContain(nombre);
		}
	});
});

describe('Icon', () => {
	it('registra el subconjunto: el SVG sale del bundle, sin esperar a la red', () => {
		const data = generateIcon({ icon: 'mdi:loading', class: 'h-5 w-5' });
		expect(data?.svg).toBe(true);
		expect(data.body).toContain('<path');
		expect(data.attributes.class).toBe('h-5 w-5');
	});

	it('un nombre fuera del subconjunto no pinta nada', () => {
		expect(generateIcon({ icon: 'mdi:no-existe' })).toBeNull();
	});
});
