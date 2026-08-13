/**
 * Etiqueta legible para alertas de trayecto en el mapa.
 * Alineado con móviles:
 * - Android: el marcador no muestra el código crudo (solo punto).
 * - iOS EventsView: humaniza snake_case (`formatEventType`).
 * `UNKNOWN_ALERT` viene del dispositivo/simulador; no es un tipo de negocio.
 *
 * @param {string | null | undefined} type
 * @returns {string}
 */
export function formatTripAlertType(type) {
	const raw = String(type || '').trim();
	if (!raw) return 'Alerta';

	const key = raw.toLowerCase().replace(/[\s-]+/g, '_');

	const known = {
		unknown_alert: 'Alerta',
		unknown: 'Alerta',
		speeding: 'Exceso de velocidad',
		speed_alert: 'Exceso de velocidad',
		harsh_brake: 'Frenado brusco',
		harsh_braking: 'Frenado brusco',
		harsh_acceleration: 'Aceleración brusca',
		harsh_cornering: 'Curva brusca',
		harsh_cornering_left: 'Curva brusca (izq.)',
		harsh_cornering_right: 'Curva brusca (der.)',
		ignition_on: 'Ignición encendida',
		ignition_on_engine_on: 'Ignición encendida',
		engine_on: 'Ignición encendida',
		turn_on: 'Ignición encendida',
		ignition_off: 'Ignición apagada',
		engine_off: 'Ignición apagada',
		turn_off: 'Ignición apagada',
		gps_signal_lost: 'Señal GPS perdida',
		panic_button: 'Botón de pánico',
		battery_low: 'Batería baja',
		low_battery: 'Batería baja',
		door_open: 'Puerta abierta'
	};

	if (known[key]) return known[key];

	// Igual que iOS formatEventType: snake_case → título legible
	return raw
		.replace(/_/g, ' ')
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(' ');
}

/**
 * Color del marcador (misma lógica que iOS MapView.alertColor).
 * @param {string | null | undefined} type
 * @returns {string} hex
 */
export function tripAlertMarkerColor(type) {
	const key = String(type || '')
		.toLowerCase()
		.trim()
		.replace(/[\s-]+/g, '_');
	if (key === 'ignition_on' || key === 'engine_on' || key === 'turn_on') return '#22c55e';
	if (key === 'ignition_off' || key === 'engine_off' || key === 'turn_off') return '#f97316';
	return '#f59e0b';
}
