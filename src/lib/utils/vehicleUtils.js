/**
 * Utilidades para el manejo de vehículos
 */

export function getStatusColor(status) {
	switch (status) {
		case 'active':
			return 'text-green-600';
		case 'inactive':
			return 'text-red-600';
		case 'maintenance':
			return 'text-yellow-600';
		default:
			return 'text-gray-600';
	}
}

export function getStatusText(status) {
	switch (status) {
		case 'active':
			return 'Activo';
		case 'inactive':
			return 'Inactivo';
		case 'maintenance':
			return 'Mantenimiento';
		default:
			return 'Desconocido';
	}
}

export function getStatusBgColor(status) {
	switch (status) {
		case 'active':
			return 'bg-green-100';
		case 'inactive':
			return 'bg-red-100';
		case 'maintenance':
			return 'bg-yellow-100';
		default:
			return 'bg-gray-100';
	}
}

export function getStatusPillClass(status) {
	switch (status) {
		case 'active':
			return 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/35 dark:bg-emerald-400/15 dark:text-emerald-200';
		case 'inactive':
			return 'border border-red-500/25 bg-red-500/10 text-red-800 dark:border-red-400/35 dark:bg-red-400/15 dark:text-red-200';
		case 'maintenance':
			return 'border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:border-amber-400/35 dark:bg-amber-400/15 dark:text-amber-100';
		default:
			return 'border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200';
	}
}

export function formatLastUpdate(dateString) {
	try {
		const date = new Date(dateString);
		const now = new Date();
		const diffInMinutes = Math.floor((now - date) / (1000 * 60));

		if (diffInMinutes < 1) {
			return 'Hace menos de 1 minuto';
		} else if (diffInMinutes < 60) {
			return `Hace ${diffInMinutes} minuto${diffInMinutes !== 1 ? 's' : ''}`;
		} else if (diffInMinutes < 1440) {
			const hours = Math.floor(diffInMinutes / 60);
			return `Hace ${hours} hora${hours !== 1 ? 's' : ''}`;
		} else {
			const days = Math.floor(diffInMinutes / 1440);
			return `Hace ${days} día${days !== 1 ? 's' : ''}`;
		}
	} catch (error) {
		return 'Fecha inválida';
	}
}

export function getFuelLevelColor(fuelLevel) {
	if (fuelLevel > 50) return 'text-green-600';
	if (fuelLevel > 25) return 'text-yellow-600';
	return 'text-red-600';
}

export function getSpeedColor(speed) {
	if (speed === 0) return 'text-gray-600';
	if (speed > 60) return 'text-red-600';
	if (speed > 40) return 'text-yellow-600';
	return 'text-green-600';
}
