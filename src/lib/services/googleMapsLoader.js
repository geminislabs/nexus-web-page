/**
 * Carga única de la API de Google Maps.
 *
 * `@googlemaps/js-api-loader` 2.x quitó la clase `Loader`: `new Loader()` lanza
 * al instante. La API nueva es funcional —`setOptions()` una sola vez y luego
 * `importLibrary()`—, y un segundo `setOptions()` se ignora. Por eso la entrada
 * al mapa (`mapService.initialize`) pasa por aquí y cualquier otra que se agregue
 * debe compartir la misma promesa.
 *
 * Sin `libraries`: todo lo que usa el panel (Map, Marker, Polyline, Polygon,
 * InfoWindow, StreetViewPanorama, TrafficLayer) está en la librería base `maps`.
 * `places`, `geometry` y `drawing` se pedían sin que nada las usara, y cada una
 * es una descarga más en cada carga del mapa.
 */
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

/** @type {Promise<typeof google> | null} */
let carga = null;

/**
 * Resuelve con el namespace global `google` cuando `google.maps` está listo.
 * @param {string} apiKey
 * @returns {Promise<typeof google>}
 */
export function cargarGoogleMaps(apiKey) {
	if (!carga) {
		setOptions({ key: apiKey, v: 'weekly' });
		carga = importLibrary('maps').then(() => window.google);
	}
	return carga;
}
