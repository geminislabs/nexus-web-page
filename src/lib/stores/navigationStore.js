import { writable } from 'svelte/store';

// 'seguimiento' | 'alertas' | 'informes' | 'ajustes'
export const activeTab = writable('seguimiento');

export const requestedPanelView = writable(null);

/** Drawer de seguimiento a abrir al entrar desde admin (ej. 'informes'). */
export const pendingTrackingDrawer = writable(/** @type {string | null} */ (null));

export const alertasSubView = writable('list'); // 'list' | 'config' | 'gestionar' | 'crear' | 'zonas' | 'crearZona'
export const ajustesSubView = writable('main'); // 'main' | 'unidades'

export const navStack = writable([]);

export const navActions = {
	setTab(tab) {
		activeTab.set(tab);
		navStack.set([]);
	},
	push(view) {
		navStack.update((s) => [...s, view]);
	},
	pop() {
		navStack.update((s) => s.slice(0, -1));
	},
	reset() {
		navStack.set([]);
	}
};
