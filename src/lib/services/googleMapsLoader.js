/**
 * Carga única de la API de Google Maps.
 *
 * `@googlemaps/js-api-loader` 2.x quitó la clase `Loader`: `new Loader()` lanza
 * al instante. La API nueva es funcional —`setOptions()` una sola vez y luego
 * `importLibrary()`—, y un segundo `setOptions()` se ignora. Por eso las dos
 * entradas al mapa (`mapService.initialize` y `ZonaHexPicker`) pasan por aquí y
 * comparten la misma promesa.
 *
 * Las `libraries` viajan en la URL del script, como con el `Loader` de la 1.x.
 */
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

const LIBRARIES = ['places', 'geometry', 'drawing'];

/** @type {Promise<typeof google> | null} */
let carga = null;

/**
 * Resuelve con el namespace global `google` cuando `google.maps` está listo.
 * @param {string} apiKey
 * @returns {Promise<typeof google>}
 */
export function cargarGoogleMaps(apiKey) {
	if (!carga) {
		setOptions({ key: apiKey, v: 'weekly', libraries: LIBRARIES });
		carga = importLibrary('maps').then(() => window.google);
	}
	return carga;
}
