import { beforeEach, describe, expect, it, vi } from 'vitest';

// La 2.x de @googlemaps/js-api-loader lanza en `new Loader()`. Ningún test
// cargaba el loader, así que el Dependabot que la subía (#90) pasó la CI en
// verde con el mapa roto. Esto fija el contrato de la API funcional.
const setOptions = vi.fn();
const importLibrary = vi.fn();
vi.mock('@googlemaps/js-api-loader', () => ({ setOptions, importLibrary }));

describe('cargarGoogleMaps', () => {
	beforeEach(() => {
		vi.resetModules();
		setOptions.mockReset();
		importLibrary.mockReset();
		window.google = { maps: { Map: function Map() {} } };
		importLibrary.mockResolvedValue({});
	});

	it('configura una vez con la key, sin librerías extra, e importa maps', async () => {
		const { cargarGoogleMaps } = await import('../src/lib/services/googleMapsLoader.js');

		const google = await cargarGoogleMaps('clave');

		expect(setOptions).toHaveBeenCalledWith({
			key: 'clave',
			v: 'weekly'
		});
		expect(importLibrary).toHaveBeenCalledWith('maps');
		expect(google).toBe(window.google);
	});

	it('las dos entradas al mapa comparten la misma carga', async () => {
		const { cargarGoogleMaps } = await import('../src/lib/services/googleMapsLoader.js');

		const [a, b] = await Promise.all([cargarGoogleMaps('clave'), cargarGoogleMaps('clave')]);

		expect(a).toBe(b);
		expect(setOptions).toHaveBeenCalledTimes(1);
		expect(importLibrary).toHaveBeenCalledTimes(1);
	});

	it('solo el módulo central importa el paquete', async () => {
		const fuentes = import.meta.glob('../src/**/*.{js,svelte}', {
			query: '?raw',
			import: 'default',
			eager: true
		});
		const importan = Object.entries(fuentes)
			.filter(([, codigo]) => /(from|import\()\s*['"]@googlemaps\/js-api-loader['"]/.test(codigo))
			.map(([ruta]) => ruta);
		expect(importan).toEqual(['../src/lib/services/googleMapsLoader.js']);
	});
});
