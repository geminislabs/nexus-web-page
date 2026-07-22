import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const LS_KEY = 'nexus-workspace';

/** @typedef {'admin' | 'tracking'} WorkspaceId */
/** @typedef {'dashboard' | 'users' | 'units' | 'devices' | 'reports' | 'settings'} AdminSectionId */

/** @returns {WorkspaceId} */
function readStoredWorkspace() {
	if (!browser) return 'tracking';
	const v = sessionStorage.getItem(LS_KEY);
	return v === 'admin' || v === 'tracking' ? v : 'admin';
}

/** Workspace activo: admin (sin mapa) | tracking (mapa). */
export const workspace = writable(/** @type {WorkspaceId} */ (readStoredWorkspace()));

/** Sección dentro del workspace Administración. */
export const adminSection = writable(/** @type {AdminSectionId} */ ('dashboard'));

export const workspaceActions = {
	/** @param {WorkspaceId} id */
	setWorkspace(id) {
		workspace.set(id);
		if (browser) sessionStorage.setItem(LS_KEY, id);
	},
	/** @param {AdminSectionId} id */
	setAdminSection(id) {
		adminSection.set(id);
	},
	goTracking() {
		this.setWorkspace('tracking');
	},
	/** @param {AdminSectionId} [section] */
	goAdmin(section = 'dashboard') {
		this.setWorkspace('admin');
		this.setAdminSection(section);
	},
	/** Usuarios no-master siempre en seguimiento. */
	ensureTrackingForUser() {
		this.setWorkspace('tracking');
	}
};
