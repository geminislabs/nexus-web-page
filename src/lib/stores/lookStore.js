import { writable } from 'svelte/store';

/**
 * Aspecto visual en uso: 'clasica' (el de siempre) o 'panel' (la vista nueva,
 * solo en escritorio). Lo fija la página del dashboard; los componentes que
 * comparten las dos vistas lo leen para cambiar solo sus colores de acento.
 * Con 'clasica' cada componente debe pintarse exactamente como antes.
 *
 * @type {import('svelte/store').Writable<'clasica' | 'panel'>}
 */
export const uiLook = writable('clasica');
