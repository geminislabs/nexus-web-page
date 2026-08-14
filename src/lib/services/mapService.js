import { get, writable } from 'svelte/store';
import { mount, unmount } from 'svelte';
import * as GoogleMapsLoader from '@googlemaps/js-api-loader';
import {
	MarkerClusterer,
	SuperClusterAlgorithm
} from '@googlemaps/markerclusterer/dist/index.esm.mjs';
import { darkBlueCarStyle, DBLUE, grayBlueMapStyle, COLORS } from '$lib/mapStyles';
import { formatTripAlertType, tripAlertMarkerColor } from '$lib/utils/tripAlertFormat.js';
import { theme } from '$lib/stores/themeStore.js';
import { logger } from '$lib/utils/logger.js';
import VehiclePositionPopup from '$lib/components/VehiclePositionPopup.svelte';
import {
	buildVehicleMarkerDataUrl,
	getStatusHexColor,
	resolveProfileColorHex,
	getVehicleMarkerMetrics,
	VEHICLE_MARKER_SIZE
} from '$lib/utils/vehicleMarkerIcon.js';

/** Color principal del rastro en vivo y del indicador de seguimiento. */
const LIVE_TRAIL_COLOR = '#00a6c0';
/** Borde del rastro según velocidad (km/h): ≤40 verde, <100 amarillo, ≥100 rojo. */
const TRAIL_EDGE_GREEN = '#22c55e';
const TRAIL_EDGE_YELLOW = '#eab308';
const TRAIL_EDGE_RED = '#ef4444';
/** Breakpoint móvil (alineado con MapContainer / Tailwind `sm`). */
const MOBILE_MQ = '(max-width: 639px)';
/** Últimos N puntos por unidad (~5 min a 1 update/5s). */
const MAX_TRAIL_POINTS = 60;
const TRAIL_FADE_MS = 220;
const TRAIL_MIN_OPACITY = 0.12;
const TRAIL_MAX_OPACITY = 0.75;
const TRAIL_MAIN_WEIGHT = 3;
const TRAIL_EDGE_WEIGHT = 6;

/** @param {number} speedKmH */
function trailEdgeColorForSpeed(speedKmH) {
	const speed = Number(speedKmH) || 0;
	if (speed > 100) return TRAIL_EDGE_RED;
	if (speed > 40) return TRAIL_EDGE_YELLOW;
	return TRAIL_EDGE_GREEN;
}

/** Unidad actualmente en modo "seguir" (o null). Para reactividad en UI (botón Seguir). */
export const followedVehicleId = writable(/** @type {string | null} */ (null));

/** Street View visible — para mostrar el botón propio de salir. */
export const streetViewVisible = writable(false);

class MapService {
	constructor() {
		this.map = null;
		this.google = null;
		this.markers = new Map();
		this.vehicleClusterer = null;
		this._mapClickCloseListener = null;
		/** Zoom fijo al crear zona en móvil */
		this._mobileZoneEditorZoom = 12;
		/** @type {boolean} */
		this._mobileZoneZoomLocked = false;
		/** @type {string | null} */
		this._openVehiclePopupId = null;
		/** @type {Map<object, { host: HTMLElement, instance: unknown }>} */
		this._vehiclePopupMounts = new Map();
		/** @type {((vehicle: any) => void) | null} */
		this._onVehicleMarkerClick = null;
		/** @type {Map<string, ReturnType<typeof setInterval>>} */
		this._blinkTimers = new Map();
		/** @type {string | null} */
		this._highlightedVehicleId = null;
		/** @type {ReturnType<typeof setInterval> | null} */
		this._highlightPulseTimer = null;
		this._highlightPulsePhase = 0;
		/** @type {ReturnType<typeof setInterval> | null} */
		this._ringRotationTimer = null;
		this._ringRotation = 0;
		/** @type {string | null} Unidad cuya cámara sigue en vivo */
		this._followVehicleId = null;
		/** @type {Map<string, Array<{ lat: number, lng: number, speed: number }>>} Rastro por unidad */
		this._liveTrails = new Map();
		/** @type {Map<string, Array<{ border: google.maps.Polyline, main: google.maps.Polyline }>>} */
		this._liveTrailPolylines = new Map();
		/** @type {Set<string>} Unidades con rastro visible actualmente */
		this._liveTrailVisible = new Set();
		/** @type {Map<string, number>} rAF handles de fade in/out por unidad */
		this._trailFadeTimers = new Map();
		/** @type {google.maps.Marker | null} Indicador pulsante de la unidad seguida */
		this._followBadgeMarker = null;
		/** @type {ReturnType<typeof setInterval> | null} */
		this._followBadgeTimer = null;
		this._followBadgePhase = 0;
		/** @type {google.maps.MapsEventListener | null} */
		this._followDragListener = null;
		this._suppressFollowClear = false;
		this._followZoom = 15;
		/** Vista de trayecto activa: bloquea otros movimientos de cámara. */
		this._tripViewActive = false;
		this.apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
		/** @type {google.maps.TrafficLayer | null} Capa de tráfico */
		this._trafficLayer = null;
		/** @type {boolean} Estado de visibilidad de tráfico */
		this._trafficVisible = false;
	}

	/** Alineado con themeStore (`html.dark` en tema oscuro). */
	_isDarkVehiclePopupTheme() {
		if (typeof document === 'undefined') return true;
		return document.documentElement.classList.contains('dark');
	}

	/**
	 * Regenera el HTML de todos los InfoWindow de unidades con el tema indicado
	 * (o el del DOM). Así el primer click tras cambiar tema no muestra el tema viejo.
	 * @param {'light' | 'dark' | undefined} [mode]
	 */
	refreshAllVehicleInfoWindowThemes(mode) {
		if (!this.google) return;
		const themeMode = mode ?? (this._isDarkVehiclePopupTheme() ? 'dark' : 'light');
		for (const entry of this.markers.values()) {
			if (!entry?.infoWindow || !entry.popupVehicle) continue;
			entry.infoWindow.setContent(
				this.createVehicleInfoContent(entry.popupVehicle, entry.infoWindow, themeMode)
			);
		}
	}

	/**
	 * Si hay un popup de unidad abierto, vuelve a renderizarlo con el tema indicado.
	 * @param {'light' | 'dark'} mode
	 */
	refreshOpenVehicleInfoWindowTheme(mode) {
		this.refreshAllVehicleInfoWindowThemes(mode);
	}

	/** @param {google.maps.Marker | null} m */
	_setMarkerMap(m, map) {
		if (!m) return;
		m.setMap(map);
	}

	setOnVehicleMarkerClick(handler) {
		this._onVehicleMarkerClick = typeof handler === 'function' ? handler : null;
	}

	_stopMarkerBlink(vehicleId) {
		const timer = this._blinkTimers.get(vehicleId);
		if (timer) {
			clearInterval(timer);
			this._blinkTimers.delete(vehicleId);
		}
	}

	_stopHighlightPulse() {
		if (this._highlightPulseTimer) {
			clearInterval(this._highlightPulseTimer);
			this._highlightPulseTimer = null;
		}
		this._highlightPulsePhase = 0;
	}

	_stopRingRotation() {
		if (this._ringRotationTimer) {
			clearInterval(this._ringRotationTimer);
			this._ringRotationTimer = null;
		}
	}

	_startRingRotation() {
		if (this._ringRotationTimer || !this._highlightedVehicleId) return;
		this._ringRotationTimer = setInterval(() => {
			if (!this._highlightedVehicleId) {
				this._stopRingRotation();
				return;
			}
			// Sentido contrario a las agujas del reloj (ángulo decreciente en canvas).
			this._ringRotation -= 0.018;
			this._applyVehicleMarkerIcon(this._highlightedVehicleId);
		}, 110);
	}

	/** @param {string} vehicleId */
	async _applyVehicleMarkerIcon(vehicleId) {
		const entry = this.markers.get(vehicleId);
		if (!entry?.marker || !this.google) return;
		const vehicle = entry.popupVehicle;
		if (!vehicle) return;

		const isHighlighted = this._highlightedVehicleId === vehicleId;
		const showNameLabel = isHighlighted && Boolean(vehicle.name);
		const url = await buildVehicleMarkerDataUrl(vehicle, {
			badgeVisible: true,
			showRings: true,
			isHighlighted,
			pulsePhase: 0,
			ringRotation: isHighlighted ? this._ringRotation : 0,
			showNameLabel,
			labelText: showNameLabel ? String(vehicle.name) : ''
		});
		const metrics = getVehicleMarkerMetrics({ showNameLabel });
		entry.marker.setIcon({
			url,
			scaledSize: new this.google.maps.Size(metrics.width, metrics.height),
			anchor: new this.google.maps.Point(metrics.anchorX, metrics.anchorY)
		});
		entry.marker.setZIndex(isHighlighted ? 1200 : 1);
	}

	/** @param {string | null} vehicleId */
	setHighlightedVehicle(vehicleId) {
		const nextId = vehicleId || null;
		if (this._highlightedVehicleId === nextId) return;

		const prevId = this._highlightedVehicleId;
		this._highlightedVehicleId = nextId;
		this._stopHighlightPulse();
		this._stopRingRotation();

		if (prevId) {
			this._applyVehicleMarkerIcon(prevId);
		}
		if (nextId) {
			this._highlightPulsePhase = 0;
			this._ringRotation = 0;
			this._applyVehicleMarkerIcon(nextId);
			this._startRingRotation();
		}
	}

	/** @param {string} vehicleId @param {any} vehicle */
	_startMarkerBlink(vehicleId, vehicle) {
		this._stopMarkerBlink(vehicleId);
		const entry = this.markers.get(vehicleId);
		if (!entry?.marker) return;

		entry._badgeVisible = true;
		entry.popupVehicle = vehicle;
		this._applyVehicleMarkerIcon(vehicleId);
	}

	_getVehicleGlyphPath(iconType) {
		if (iconType?.includes('motorbike')) {
			return '<path d="M9 18a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 9 18zm14 0a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 23 18zM10.7 19.2h4.8l2.5-3.6h2.7l1.3 2.1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
		}
		if (
			iconType?.includes('truck') ||
			iconType?.includes('trailer') ||
			iconType?.includes('backhoe')
		) {
			return '<path d="M7 18h11v-6H7v6zm11 0h4l2-2.2V14h-6v4zM10 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
		}
		return '<path d="M8 16h16M12 12h8M12 20h8" stroke="white" stroke-width="2" stroke-linecap="round"/>';
	}

	_vehicleIconDataUrl(hexColor, iconType = 'vehicle-car-sedan') {
		const glyphPath = this._getVehicleGlyphPath(iconType);
		const svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="14" fill="${hexColor}" stroke="white" stroke-width="2"/>${glyphPath}</svg>`;
		return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
	}

	async initialize(mapElement) {
		try {
			if (!this.apiKey) {
				throw new Error(
					'VITE_GOOGLE_MAPS_API_KEY no está configurada. Define la variable en .env o en el build de Docker.'
				);
			}

			const loader = new GoogleMapsLoader.Loader({
				apiKey: this.apiKey,
				version: 'weekly',
				libraries: ['places', 'geometry', 'drawing']
			});

			this.google = await loader.load();

			const isMobileLayout = this._isMobileLayout();

			const initialTheme = this._resolveInitialMapTheme();
			const mapOptions = {
				center: { lat: 19.4326, lng: -99.1332 },
				zoom: 10,
				mapTypeId: this.google.maps.MapTypeId.ROADMAP,
				disableDefaultUI: true,
				// Zoom custom (MapContainer); Street View nativo de Google (pegman)
				zoomControl: false,
				fullscreenControl: false,
				mapTypeControl: false,
				streetViewControl: !isMobileLayout,
				streetViewControlOptions: {
					position: this.google.maps.ControlPosition.RIGHT_BOTTOM
				},
				rotateControl: false,
				scaleControl: false,
				styles: initialTheme === 'light' ? grayBlueMapStyle : darkBlueCarStyle,
				backgroundColor: initialTheme === 'light' ? COLORS.grayLight : DBLUE.bg
			};

			this.map = new this.google.maps.Map(mapElement, mapOptions);
			if (this._mapClickCloseListener) {
				this.google.maps.event.removeListener(this._mapClickCloseListener);
			}
			this._mapClickCloseListener = this.map.addListener('click', () => {
				this.closeAllVehicleInfoWindows();
			});
			this._attachFollowInteractionListeners();

			// Street View: close nativo OFF (se empalma con WorkspaceSwitcher).
			// Dirección abajo a la izquierda; salida con botón propio en la UI.
			const streetView = new this.google.maps.StreetViewPanorama(mapElement, {
				visible: false,
				enableCloseButton: false,
				fullscreenControl: false,
				addressControl: true,
				addressControlOptions: {
					position: this.google.maps.ControlPosition.BOTTOM_LEFT
				},
				zoomControl: false,
				panControl: true,
				linksControl: true
			});
			this.map.setStreetView(streetView);
			this._streetView = streetView;
			this._bindStreetViewVisibility(streetView);

			// Inicializar capa de tráfico (oculta por defecto)
			this._trafficLayer = new this.google.maps.TrafficLayer();
			this._trafficVisible = false;

			await this.setUserLocation();

			return this.map;
		} catch (error) {
			logger.error('Error inicializando Google Maps:', error);
			throw error;
		}
	}

	async setUserLocation() {
		if (!navigator.geolocation) return;

		return new Promise((resolve) => {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const userLocation = {
						lat: position.coords.latitude,
						lng: position.coords.longitude
					};

					this.map.setCenter(userLocation);
					this.addUserLocationMarker(userLocation);
					resolve(userLocation);
				},
				(error) => {
					logger.warn('Error obteniendo ubicación:', error);
					resolve(null);
				}
			);
		});
	}

	addUserLocationMarker(location) {
		if (!this.google || !this.map) return;

		const marker = new this.google.maps.Marker({
			position: location,
			map: this.map,
			title: 'Tu ubicación actual',
			icon: {
				url:
					'data:image/svg+xml;charset=UTF-8,' +
					encodeURIComponent(`
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<circle cx="12" cy="12" r="8" fill="#3B82F6" stroke="#1E40AF" stroke-width="2"/>
						<circle cx="12" cy="12" r="3" fill="white"/>
					</svg>
				`),
				scaledSize: new this.google.maps.Size(24, 24),
				anchor: new this.google.maps.Point(12, 12)
			},
			zIndex: 5000
		});

		this.markers.set('user-location', marker);
		return marker;
	}

	addVehicleMarker(vehicle) {
		const lat = vehicle.latitude || vehicle.lat;
		const lng = vehicle.longitude || vehicle.lng;

		if (!this.google || !this.map || lat == null || lng == null) {
			return;
		}

		const position = { lat: parseFloat(lat), lng: parseFloat(lng) };

		const marker = new this.google.maps.Marker({
			position,
			map: null,
			title: vehicle.name,
			icon: {
				url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
				scaledSize: new this.google.maps.Size(VEHICLE_MARKER_SIZE, VEHICLE_MARKER_SIZE),
				anchor: new this.google.maps.Point(VEHICLE_MARKER_SIZE / 2, VEHICLE_MARKER_SIZE / 2)
			},
			zIndex: 1
		});

		const infoWindow = new this.google.maps.InfoWindow({
			maxWidth: 340,
			pixelOffset: new this.google.maps.Size(0, 4),
			disableAutoPan: false,
			// Cierre propio en VehiclePositionPopup; ocultar X nativo de Google
			headerDisabled: true
		});
		infoWindow.setContent(this.createVehicleInfoContent(vehicle, infoWindow));

		marker.addListener('click', () => {
			this._onVehicleMarkerClick?.(vehicle);
			// Siempre regenerar contenido: el HTML del InfoWindow puede quedar del tema anterior
			this.openVehicleInfoWindow(vehicle, { refreshContent: true });
		});

		this.markers.set(vehicle.id, {
			marker,
			infoWindow,
			popupVehicle: vehicle,
			_badgeVisible: true
		});
		this._startMarkerBlink(vehicle.id, vehicle);
		return marker;
	}

	/** Color de perfil del vehículo (no confundir con estatus). */
	getVehicleColor(vehicle) {
		return resolveProfileColorHex(vehicle);
	}

	getStatusColor(vehicle) {
		return getStatusHexColor(vehicle?.status);
	}

	/** @param {unknown} s */
	_escapeHtml(s) {
		if (s == null) return '';
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	_getStatusGradient(status) {
		switch (status) {
			case 'active':
				return 'linear-gradient(90deg,#34d399 0%,#22d3ee 55%,#38bdf8 100%)';
			case 'inactive':
				return 'linear-gradient(90deg,#fb7185 0%,#f43f5e 100%)';
			case 'maintenance':
				return 'linear-gradient(90deg,#fbbf24 0%,#f59e0b 100%)';
			default:
				return 'linear-gradient(90deg,#94a3b8 0%,#64748b 100%)';
		}
	}

	/**
	 * Popup de marcador: monta VehiclePositionPopup (mismos tiles/SignalMeters que el panel).
	 * @param {unknown} vehicle
	 * @param {object | undefined} infoWindow
	 * @param {'light' | 'dark' | undefined} [forcedTheme]
	 */
	createVehicleInfoContent(vehicle, infoWindow, forcedTheme) {
		const isDark = forcedTheme != null ? forcedTheme === 'dark' : this._isDarkVehiclePopupTheme();
		this._destroyVehiclePopupMount(infoWindow);

		const host = document.createElement('div');
		host.className = 'nexus-viw-host';
		host.setAttribute('data-nexus-vehicle-popup', '');
		host.setAttribute('data-popup-theme', isDark ? 'dark' : 'light');

		const instance = mount(VehiclePositionPopup, {
			target: host,
			props: {
				vehicle: vehicle || {},
				theme: isDark ? 'dark' : 'light',
				onClose: () => {
					this._openVehiclePopupId = null;
					infoWindow?.close();
				}
			}
		});

		if (infoWindow) {
			this._vehiclePopupMounts.set(infoWindow, { host, instance });
		}
		return host;
	}

	/** @param {object | undefined | null} infoWindow */
	_destroyVehiclePopupMount(infoWindow) {
		if (!infoWindow || !this._vehiclePopupMounts) return;
		const entry = this._vehiclePopupMounts.get(infoWindow);
		if (!entry) return;
		try {
			unmount(entry.instance);
		} catch {
			/* ya desmontado */
		}
		this._vehiclePopupMounts.delete(infoWindow);
	}

	getStatusBadgeStyleDark(status) {
		switch (status) {
			case 'active':
				return 'background:rgba(16,185,129,0.14);color:#6ee7b7;border:1px solid rgba(45,212,191,0.35);';
			case 'inactive':
				return 'background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(248,113,113,0.35);';
			case 'maintenance':
				return 'background:rgba(245,158,11,0.12);color:#fcd34d;border:1px solid rgba(251,191,36,0.35);';
			default:
				return 'background:rgba(148,163,184,0.1);color:#cbd5e1;border:1px solid rgba(148,163,184,0.28);';
		}
	}

	getStatusBadgeStyleLight(status) {
		switch (status) {
			case 'active':
				return 'background:#d1fae5;color:#047857;border:1px solid #6ee7b7;';
			case 'inactive':
				return 'background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;';
			case 'maintenance':
				return 'background:#fef3c7;color:#b45309;border:1px solid #fcd34d;';
			default:
				return 'background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;';
		}
	}

	getStatusText(status) {
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

	removeMarker(id) {
		const markerData = this.markers.get(id);
		if (!markerData) return;
		this._stopMarkerBlink(id);
		const raw = markerData.marker ?? markerData;
		if (id !== 'user-location' && this.vehicleClusterer) {
			this.vehicleClusterer.removeMarker(raw);
		} else {
			this._setMarkerMap(raw, null);
		}
		this.markers.delete(id);
	}

	clearVehicleMarkers() {
		this._stopHighlightPulse();
		this._stopRingRotation();
		this.clearLiveTrail();
		if (this.vehicleClusterer) {
			this.vehicleClusterer.setMap(null);
			this.vehicleClusterer = null;
		}
		for (const [key, data] of [...this.markers.entries()]) {
			if (key === 'user-location') continue;
			this._stopMarkerBlink(key);
			const m = data.marker ?? data;
			this._setMarkerMap(m, null);
			this.markers.delete(key);
		}
	}

	clearAllMarkers() {
		if (this.vehicleClusterer) {
			this.vehicleClusterer.setMap(null);
			this.vehicleClusterer = null;
		}
		this.markers.forEach((markerData) => {
			const m = markerData.marker ?? markerData;
			this._setMarkerMap(m, null);
		});
		this.markers.clear();
	}

	addVehicleMarkers(vehicles) {
		if (!Array.isArray(vehicles)) return;

		this.clearVehicleMarkers();

		const markerList = [];
		vehicles.forEach((vehicle) => {
			const m = this.addVehicleMarker(vehicle);
			if (m) markerList.push(m);
		});

		if (markerList.length > 0 && this.map) {
			this.vehicleClusterer = new MarkerClusterer({
				map: this.map,
				markers: markerList,
				algorithm: new SuperClusterAlgorithm({
					maxZoom: 17,
					radius: 72
				})
			});
		}

		if (this._highlightedVehicleId) {
			const id = this._highlightedVehicleId;
			this._highlightedVehicleId = null;
			this.setHighlightedVehicle(id);
		}
	}

	updateVehicleMarker(vehicle) {
		const existingMarkerData = this.markers.get(vehicle.id);

		if (existingMarkerData) {
			const lat = vehicle.latitude || vehicle.lat;
			const lng = vehicle.longitude || vehicle.lng;

			if (lat != null && lng != null) {
				const newPosition = { lat: parseFloat(lat), lng: parseFloat(lng) };
				existingMarkerData.marker.setPosition(newPosition);

				existingMarkerData.infoWindow.setContent(
					this.createVehicleInfoContent(vehicle, existingMarkerData.infoWindow)
				);
				existingMarkerData.popupVehicle = vehicle;
				this._startMarkerBlink(vehicle.id, vehicle);

				if (this.vehicleClusterer) {
					this.vehicleClusterer.render();
				}

				if (vehicle.id === this._followVehicleId && !this._tripViewActive) {
					this._appendLiveTrailPoint(
						vehicle.id,
						newPosition.lat,
						newPosition.lng,
						Number(vehicle.speed) || 0
					);
					this.showLiveTrail(vehicle.id);
					this._followLivePosition(vehicle, newPosition);
				}
			}
		} else {
			// No recrear marcador aquí: la visibilidad la controla mapVisibleUnitIds vía MapContainer.
		}
	}

	_attachFollowInteractionListeners() {
		if (!this.map || this._followDragListener) return;
		this._followDragListener = this.map.addListener('dragstart', () => {
			this._onUserMapInteraction();
		});
	}

	_onUserMapInteraction() {
		if (this._tripViewActive) return;
		if (this._suppressFollowClear) {
			this._suppressFollowClear = false;
			return;
		}
		this.clearFollowVehicle();
	}

	/**
	 * Activa seguimiento en vivo de una unidad (cámara + rastro + indicador).
	 * Solo una unidad a la vez; el rastro solo existe mientras hay seguimiento.
	 * @param {string} vehicleId
	 * @param {{ resetTrail?: boolean, seedPosition?: { lat: number, lng: number }, seedSpeed?: number }} [opts]
	 */
	setFollowVehicle(vehicleId, opts = {}) {
		if (this._tripViewActive) return;

		const prevId = this._followVehicleId;
		if (prevId && prevId !== vehicleId) {
			this.clearLiveTrail(prevId);
		}

		this._followVehicleId = vehicleId || null;
		followedVehicleId.set(this._followVehicleId);
		if (!vehicleId) {
			this._removeFollowBadge();
			return;
		}

		if (opts.resetTrail !== false) {
			this.clearLiveTrail(vehicleId);
		}
		this.showLiveTrail(vehicleId);
		if (opts.seedPosition) {
			this._appendLiveTrailPoint(
				vehicleId,
				opts.seedPosition.lat,
				opts.seedPosition.lng,
				opts.seedSpeed ?? 0
			);
		}

		const seed = opts.seedPosition ?? this._getMarkerPosition(vehicleId);
		if (seed) this._ensureFollowBadge(seed);
	}

	/** Detiene el seguimiento y elimina el rastro de esa unidad. */
	clearFollowVehicle() {
		const id = this._followVehicleId;
		this._followVehicleId = null;
		followedVehicleId.set(null);
		this._removeFollowBadge();
		if (id) this.clearLiveTrail(id);
	}

	/** @param {string | null | undefined} vehicleId */
	isFollowingVehicle(vehicleId) {
		return Boolean(vehicleId && this._followVehicleId === vehicleId);
	}

	/** @param {string} vehicleId */
	_getMarkerPosition(vehicleId) {
		const pos = this.markers.get(vehicleId)?.marker?.getPosition?.();
		return pos ? { lat: pos.lat(), lng: pos.lng() } : null;
	}

	// ── Rastro en vivo (por unidad) ───────────────────────────────────────────

	/**
	 * @param {string} vehicleId
	 * @param {number} lat
	 * @param {number} lng
	 * @param {number} [speed]
	 */
	_appendLiveTrailPoint(vehicleId, lat, lng, speed = 0) {
		if (!vehicleId || !this.google || Number.isNaN(lat) || Number.isNaN(lng)) return;

		const path = this._liveTrails.get(vehicleId) || [];
		path.push({ lat, lng, speed: Number(speed) || 0 });
		if (path.length > MAX_TRAIL_POINTS) path.shift();
		this._liveTrails.set(vehicleId, path);
	}

	/** @param {string} vehicleId @param {number} multiplier 0..1 factor de opacidad (fade) */
	_buildTrailSegments(vehicleId, multiplier) {
		const path = this._liveTrails.get(vehicleId) || [];
		const segments = [];
		for (let i = 1; i < path.length; i++) {
			const t = path.length > 2 ? (i - 1) / (path.length - 2) : 1;
			const opacity =
				(TRAIL_MIN_OPACITY + t * (TRAIL_MAX_OPACITY - TRAIL_MIN_OPACITY)) * multiplier;
			const edgeSpeed = Math.max(Number(path[i - 1].speed) || 0, Number(path[i].speed) || 0);
			segments.push({
				path: [path[i - 1], path[i]],
				opacity,
				edgeColor: trailEdgeColorForSpeed(edgeSpeed)
			});
		}
		return segments;
	}

	/** @param {string} vehicleId @param {number} [multiplier] */
	_redrawLiveTrail(vehicleId, multiplier = 1) {
		if (!this.map || !this.google) return;
		const existing = this._liveTrailPolylines.get(vehicleId) || [];
		const segments = this._buildTrailSegments(vehicleId, multiplier);

		segments.forEach((seg, i) => {
			let pair = existing[i];
			if (!pair) {
				const border = new this.google.maps.Polyline({
					geodesic: true,
					strokeColor: seg.edgeColor,
					strokeWeight: TRAIL_EDGE_WEIGHT,
					strokeOpacity: seg.opacity,
					map: this.map,
					zIndex: 44,
					clickable: false
				});
				const main = new this.google.maps.Polyline({
					geodesic: true,
					strokeColor: LIVE_TRAIL_COLOR,
					strokeWeight: TRAIL_MAIN_WEIGHT,
					strokeOpacity: seg.opacity,
					map: this.map,
					zIndex: 45,
					clickable: false
				});
				pair = { border, main };
				existing[i] = pair;
			}
			pair.border.setPath(seg.path);
			pair.border.setOptions({ strokeOpacity: seg.opacity, strokeColor: seg.edgeColor });
			pair.main.setPath(seg.path);
			pair.main.setOptions({ strokeOpacity: seg.opacity });
		});

		for (let i = segments.length; i < existing.length; i++) {
			existing[i]?.border?.setMap(null);
			existing[i]?.main?.setMap(null);
		}
		existing.length = segments.length;
		this._liveTrailPolylines.set(vehicleId, existing);
	}

	/**
	 * @param {string} vehicleId
	 * @param {number} from
	 * @param {number} to
	 * @param {() => void} [onDone]
	 */
	_animateTrailFade(vehicleId, from, to, onDone) {
		const existingTimer = this._trailFadeTimers.get(vehicleId);
		if (existingTimer) cancelAnimationFrame(existingTimer);

		const start = performance.now();
		const step = (now) => {
			const t = Math.min(1, (now - start) / TRAIL_FADE_MS);
			this._redrawLiveTrail(vehicleId, from + (to - from) * t);
			if (t < 1) {
				this._trailFadeTimers.set(vehicleId, requestAnimationFrame(step));
			} else {
				this._trailFadeTimers.delete(vehicleId);
				onDone?.();
			}
		};
		this._trailFadeTimers.set(vehicleId, requestAnimationFrame(step));
	}

	/** Activa (con fade-in) el rastro de una unidad. @param {string} vehicleId */
	showLiveTrail(vehicleId) {
		if (!vehicleId || !this.map || !this.google) return;
		if (this._liveTrailVisible.has(vehicleId)) {
			this._redrawLiveTrail(vehicleId, 1);
			return;
		}
		this._liveTrailVisible.add(vehicleId);
		this._animateTrailFade(vehicleId, 0, 1);
	}

	/** Oculta (con fade-out) el rastro sin borrar los puntos. @param {string} vehicleId */
	hideLiveTrail(vehicleId) {
		if (!vehicleId || !this._liveTrailVisible.has(vehicleId)) return;
		this._liveTrailVisible.delete(vehicleId);
		this._animateTrailFade(vehicleId, 1, 0, () => {
			const lines = this._liveTrailPolylines.get(vehicleId) || [];
			lines.forEach((pair) => {
				pair?.border?.setMap(null);
				pair?.main?.setMap(null);
			});
			this._liveTrailPolylines.delete(vehicleId);
		});
	}

	_hideAllLiveTrails() {
		for (const vehicleId of [...this._liveTrailVisible]) {
			this.hideLiveTrail(vehicleId);
		}
	}

	/** Borra el rastro (puntos + polylines). Sin argumento, borra el de todas las unidades. */
	clearLiveTrail(vehicleId) {
		if (!vehicleId) {
			for (const id of [...this._liveTrails.keys()]) this.clearLiveTrail(id);
			return;
		}
		this._liveTrailVisible.delete(vehicleId);
		const timer = this._trailFadeTimers.get(vehicleId);
		if (timer) {
			cancelAnimationFrame(timer);
			this._trailFadeTimers.delete(vehicleId);
		}
		const lines = this._liveTrailPolylines.get(vehicleId) || [];
		lines.forEach((pair) => {
			pair?.border?.setMap(null);
			pair?.main?.setMap(null);
		});
		this._liveTrailPolylines.delete(vehicleId);
		this._liveTrails.delete(vehicleId);
	}

	// ── Indicador de seguimiento (badge pulsante) ─────────────────────────────

	/** @param {{ lat: number, lng: number }} position */
	_ensureFollowBadge(position) {
		if (!this.google || !this.map) return;
		if (!this._followBadgeMarker) {
			this._followBadgeMarker = new this.google.maps.Marker({
				position,
				map: this.map,
				icon: this._followBadgeIcon(0),
				zIndex: 1300,
				clickable: false
			});
			this._startFollowBadgePulse();
		} else {
			this._followBadgeMarker.setPosition(position);
		}
	}

	/** @param {number} phase */
	_followBadgeIcon(phase) {
		const scale = 1 + 0.35 * Math.sin(phase);
		const ringOpacity = 0.55 + 0.35 * Math.cos(phase);
		const r = 7 * scale;
		const svg = `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="${r.toFixed(2)}" fill="${LIVE_TRAIL_COLOR}" fill-opacity="${ringOpacity.toFixed(2)}"/><circle cx="14" cy="14" r="4" fill="${LIVE_TRAIL_COLOR}"/></svg>`;
		return {
			url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
			scaledSize: new this.google.maps.Size(28, 28),
			anchor: new this.google.maps.Point(14, 14)
		};
	}

	_startFollowBadgePulse() {
		if (this._followBadgeTimer) return;
		this._followBadgeTimer = setInterval(() => {
			this._followBadgePhase += 0.25;
			this._followBadgeMarker?.setIcon(this._followBadgeIcon(this._followBadgePhase));
		}, 90);
	}

	_removeFollowBadge() {
		if (this._followBadgeTimer) {
			clearInterval(this._followBadgeTimer);
			this._followBadgeTimer = null;
		}
		if (this._followBadgeMarker) {
			this._followBadgeMarker.setMap(null);
			this._followBadgeMarker = null;
		}
		this._followBadgePhase = 0;
	}

	/**
	 * @param {any} vehicle
	 * @param {{ lat: number, lng: number }} [position] posición ya calculada (evita re-parsear)
	 */
	_followLivePosition(vehicle, position) {
		if (this._tripViewActive) return;
		const pos = position ?? {
			lat: parseFloat(vehicle.latitude || vehicle.lat),
			lng: parseFloat(vehicle.longitude || vehicle.lng)
		};
		if (!this.map || Number.isNaN(pos.lat) || Number.isNaN(pos.lng)) return;

		this._suppressFollowClear = true;
		this.map.panTo(pos);
		this._ensureFollowBadge(pos);
	}

	closeAllVehicleInfoWindows() {
		this._openVehiclePopupId = null;
		for (const data of this.markers.values()) {
			if (data?.infoWindow) {
				this._destroyVehiclePopupMount(data.infoWindow);
				data.infoWindow.close();
			}
		}
	}

	/** @returns {boolean} */
	_isMobileLayout() {
		return typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches;
	}

	/**
	 * Abre el InfoWindow de la unidad (mismo contenido que al pulsar el marcador).
	 * En móvil no se muestra: el panel inferior ya cubre la ficha de la unidad.
	 * Si el marcador está en un cluster, se ancla por la posición del `Marker`.
	 * @param {{ id: string }} vehicle
	 * @param {{ refreshContent?: boolean }} [opts]
	 */
	openVehicleInfoWindow(vehicle, opts = {}) {
		const refreshContent = opts.refreshContent !== false;
		if (!this.map || !this.google || !vehicle?.id) return;

		// Móvil: sheet de tracking; evita duplicar la ficha sobre el mapa.
		if (this._isMobileLayout()) {
			this.closeAllVehicleInfoWindows();
			return;
		}

		const entry = this.markers.get(vehicle.id);
		if (!entry?.infoWindow || !entry.marker) return;

		this.closeAllVehicleInfoWindows();

		if (refreshContent) {
			const themeMode = this._isDarkVehiclePopupTheme() ? 'dark' : 'light';
			entry.infoWindow.setContent(
				this.createVehicleInfoContent(vehicle, entry.infoWindow, themeMode)
			);
		}
		entry.popupVehicle = vehicle;

		const marker = entry.marker;
		if (marker.getMap?.()) {
			entry.infoWindow.open(this.map, marker);
		} else {
			const pos = marker.getPosition?.();
			if (!pos) return;
			entry.infoWindow.setPosition({ lat: pos.lat(), lng: pos.lng() });
			entry.infoWindow.open(this.map);
		}
		this._openVehiclePopupId = vehicle.id;
	}

	centerOnVehicles(vehicles) {
		if (this._tripViewActive) return;
		if (!vehicles.length || !this.map) return;

		const bounds = new this.google.maps.LatLngBounds();
		let hasValidCoordinates = false;

		vehicles.forEach((vehicle) => {
			const lat = vehicle.latitude || vehicle.lat;
			const lng = vehicle.longitude || vehicle.lng;

			if (lat != null && lng != null) {
				bounds.extend({ lat: parseFloat(lat), lng: parseFloat(lng) });
				hasValidCoordinates = true;
			}
		});

		if (hasValidCoordinates) {
			this.map.fitBounds(bounds, { padding: 80 });
			this.google.maps.event.addListenerOnce(this.map, 'idle', () => {
				if (this.map.getZoom() > 12) {
					this.map.setZoom(12);
				}
			});
		}
	}

	centerOnVehicle(vehicle, opts = {}) {
		if (this._tripViewActive) return;
		const showPopup = opts.showPopup !== false;
		const follow = opts.follow !== false;
		const zoom = opts.zoom ?? this._followZoom;
		const lat = vehicle.latitude || vehicle.lat;
		const lng = vehicle.longitude || vehicle.lng;

		if (lat == null || lng == null || !this.map || !this.google) return;

		const position = { lat: parseFloat(lat), lng: parseFloat(lng) };
		this._suppressFollowClear = true;
		this.map.setCenter(position);
		this.map.setZoom(zoom);

		if (follow && vehicle.id) {
			this.setFollowVehicle(vehicle.id, {
				seedPosition: position,
				seedSpeed: Number(vehicle.speed) || 0
			});
		}

		if (!showPopup) return;

		this.google.maps.event.addListenerOnce(this.map, 'idle', () => {
			this.openVehicleInfoWindow(vehicle);
		});
	}

	setCenter(lat, lng) {
		if (this.map) {
			this.map.setCenter({ lat, lng });
		}
	}

	setZoom(zoom) {
		if (this.map) {
			this.map.setZoom(zoom);
		}
	}

	/**
	 * Tema del mapa al inicializar: respeta store / DOM (sin flash a dark).
	 * @returns {'light' | 'dark'}
	 */
	_resolveInitialMapTheme() {
		try {
			const t = get(theme);
			if (t === 'light' || t === 'dark') return t;
		} catch {
			/* store aún no disponible */
		}
		if (typeof document !== 'undefined') {
			if (document.documentElement.classList.contains('dark')) return 'dark';
			if (document.documentElement.dataset.theme === 'light') return 'light';
			if (document.documentElement.dataset.theme === 'dark') return 'dark';
		}
		return 'dark';
	}

	/**
	 * @param {'light' | 'dark'} mode
	 */
	setMapTheme(mode) {
		if (!this.map) return;
		if (mode === 'light') {
			this.map.setOptions({
				styles: grayBlueMapStyle,
				backgroundColor: COLORS.grayLight
			});
		} else {
			this.map.setOptions({
				styles: darkBlueCarStyle,
				backgroundColor: DBLUE.bg
			});
		}
	}

	resizeMap() {
		if (!this.map || !this.google) return;
		this.google.maps.event.trigger(this.map, 'resize');
	}

	/**
	 * Sincroniza store streetViewVisible con el panorama.
	 * @param {google.maps.StreetViewPanorama} panorama
	 */
	_bindStreetViewVisibility(panorama) {
		if (!panorama) return;
		streetViewVisible.set(Boolean(panorama.getVisible()));
		panorama.addListener('visible_changed', () => {
			streetViewVisible.set(Boolean(panorama.getVisible()));
		});
	}

	/** Cierra Street View y vuelve al mapa. */
	exitStreetView() {
		const panorama = this._streetView || this.map?.getStreetView?.();
		if (!panorama) return;
		panorama.setVisible(false);
		streetViewVisible.set(false);
	}

	/**
	 * En móvil (≤639px) oculta el pegman de Street View; en escritorio lo muestra.
	 * El zoom sigue siendo custom en MapContainer.
	 * @param {boolean} compact true = layout móvil
	 */
	setNavigationControlsCompact(compact) {
		if (!this.map || !this.google) return;
		this.map.setOptions({
			zoomControl: false,
			streetViewControl: !compact,
			streetViewControlOptions: {
				position: this.google.maps.ControlPosition.RIGHT_BOTTOM
			}
		});
	}

	/**
	 * Durante edición de zona: oculta Street View / capas, pero deja zoom libre
	 * para que la rejilla H3 pueda crecer/achicarse.
	 */
	enableMobileZoneEditorZoomLock() {
		if (!this.map) return;
		this._mobileZoneZoomLocked = true;
		this.map.setOptions({
			streetViewControl: false,
			mapTypeControl: false,
			zoomControl: false
		});
	}

	/** Restaura controles tras salir del editor de zona. */
	disableMobileZoneEditorZoomLock() {
		if (!this.map || !this._mobileZoneZoomLocked) return;
		this._mobileZoneZoomLocked = false;
		this.map.setOptions({
			minZoom: 0,
			maxZoom: 22,
			streetViewControl: !this._isMobileLayout(),
			streetViewControlOptions: {
				position: this.google.maps.ControlPosition.RIGHT_BOTTOM
			},
			mapTypeControl: false,
			zoomControl: false
		});
	}

	/** Acerca el mapa un nivel. */
	zoomIn() {
		if (!this.map) return;
		const z = this.map.getZoom();
		if (z == null) return;
		this.map.setZoom(Math.min(z + 1, 22));
	}

	/** Aleja el mapa un nivel. */
	zoomOut() {
		if (!this.map) return;
		const z = this.map.getZoom();
		if (z == null) return;
		this.map.setZoom(Math.max(z - 1, 0));
	}

	// ── Trip Route (Polyline) ─────────────────────────────────────────────────

	/** @type {google.maps.Polyline | null} */
	_tripPolyline = null;
	/** @type {google.maps.Marker | null} */
	_tripStartMarker = null;
	/** @type {google.maps.Marker | null} */
	_tripEndMarker = null;

	/**
	 * Dibuja la ruta del trayecto en el mapa
	 * @param {Array<{lat: number, lon: number}>} points
	 */
	drawTripRoute(points) {
		if (!this.map || !this.google || !points?.length) return;

		this._tripViewActive = true;
		this.clearFollowVehicle();
		this.clearTripRoute({ keepTripView: true });

		const path = points.map((p) => ({
			lat: parseFloat(p.lat),
			lng: parseFloat(p.lon ?? p.lng)
		}));

		this._tripPolyline = new this.google.maps.Polyline({
			path,
			geodesic: true,
			strokeColor: '#10b981',
			strokeOpacity: 1,
			strokeWeight: 5,
			map: this.map
		});

		if (path.length > 0) {
			this._tripStartMarker = new this.google.maps.Marker({
				position: path[0],
				map: this.map,
				icon: {
					path: this.google.maps.SymbolPath.CIRCLE,
					scale: 8,
					fillColor: '#22c55e',
					fillOpacity: 1,
					strokeColor: '#fff',
					strokeWeight: 2
				},
				title: 'Inicio'
			});
		}

		if (path.length > 1) {
			this._tripEndMarker = new this.google.maps.Marker({
				position: path[path.length - 1],
				map: this.map,
				icon: {
					path: this.google.maps.SymbolPath.CIRCLE,
					scale: 8,
					fillColor: '#ef4444',
					fillOpacity: 1,
					strokeColor: '#fff',
					strokeWeight: 2
				},
				title: 'Fin'
			});
		}
	}

	/**
	 * Limpia la ruta del trayecto del mapa
	 * @param {{ keepTripView?: boolean }} [opts]
	 */
	clearTripRoute(opts = {}) {
		this._hideAllLiveTrails();
		if (this._tripPolyline) {
			this._tripPolyline.setMap(null);
			this._tripPolyline = null;
		}
		if (this._tripStartMarker) {
			this._tripStartMarker.setMap(null);
			this._tripStartMarker = null;
		}
		if (this._tripEndMarker) {
			this._tripEndMarker.setMap(null);
			this._tripEndMarker = null;
		}
		if (!opts.keepTripView) {
			this._tripViewActive = false;
		}
	}

	/**
	 * Ajusta el mapa para mostrar todos los puntos del trayecto
	 * @param {Array<{lat: number, lon: number}>} points
	 */
	fitBoundsToPoints(points) {
		if (!this.map || !this.google || !points?.length) return;

		this.clearFollowVehicle();
		this._tripViewActive = true;
		const bounds = new this.google.maps.LatLngBounds();
		for (const p of points) {
			bounds.extend({
				lat: parseFloat(p.lat),
				lng: parseFloat(p.lon ?? p.lng)
			});
		}
		const mobile = this._isMobileLayout();
		const padding = mobile
			? { top: 72, right: 36, bottom: 320, left: 36 }
			: { top: 80, right: 360, bottom: 80, left: 100 };
		this.map.fitBounds(bounds, padding);
		this.google.maps.event.addListenerOnce(this.map, 'idle', () => {
			const z = this.map.getZoom();
			if (z != null && z > 16) this.map.setZoom(16);
		});
	}

	/** @returns {boolean} */
	isTripViewActive() {
		return Boolean(this._tripViewActive);
	}

	/**
	 * Solo mueve la cámara si el punto está cerca del borde del viewport (evita saltos).
	 * @param {{ lat: number, lng: number }} pos
	 */
	_panIfNearEdge(pos) {
		if (!this.map || !this.google) return;
		const bounds = this.map.getBounds();
		if (!bounds) {
			this.map.panTo(pos);
			return;
		}
		const ne = bounds.getNorthEast();
		const sw = bounds.getSouthWest();
		const latPad = (ne.lat() - sw.lat()) * 0.22;
		const lngPad = (ne.lng() - sw.lng()) * 0.22;
		const lat = pos.lat;
		const lng = pos.lng;
		const nearEdge =
			lat > ne.lat() - latPad ||
			lat < sw.lat() + latPad ||
			lng > ne.lng() - lngPad ||
			lng < sw.lng() + lngPad;
		if (nearEdge) this.map.panTo(pos);
	}

	// ── Trip Playback ─────────────────────────────────────────────────────────

	/** @type {google.maps.Marker | null} */
	_playbackMarker = null;
	/** @type {number | null} */
	_playbackInterval = null;
	/** @type {number} */
	_playbackIndex = 0;
	/** @type {Array<{lat: number, lng: number}>} */
	_playbackPath = [];
	/** @type {((progress: number) => void) | null} */
	_onPlaybackProgress = null;
	/** @type {(() => void) | null} */
	_onPlaybackComplete = null;
	/** @type {boolean} */
	_playbackPaused = false;

	/**
	 * Inicia la reproducción animada del trayecto
	 * @param {Array<{lat: number, lon: number}>} points
	 * @param {{ onProgress?: (progress: number) => void, onComplete?: () => void }} callbacks
	 */
	startTripPlayback(points, callbacks = {}) {
		if (!this.map || !this.google || !points?.length) return;

		this._tripViewActive = true;
		this.stopTripPlayback();

		this._playbackPath = points.map((p) => ({
			lat: parseFloat(p.lat),
			lng: parseFloat(p.lon ?? p.lng)
		}));
		this._playbackIndex = 0;
		this._onPlaybackProgress = callbacks.onProgress || null;
		this._onPlaybackComplete = callbacks.onComplete || null;
		this._playbackPaused = false;

		this._playbackMarker = new this.google.maps.Marker({
			position: this._playbackPath[0],
			map: this.map,
			icon: {
				path: this.google.maps.SymbolPath.CIRCLE,
				scale: 10,
				fillColor: '#ef4444',
				fillOpacity: 1,
				strokeColor: '#fff',
				strokeWeight: 3
			},
			zIndex: 1000,
			title: 'Posición actual'
		});

		const PLAYBACK_SPEED_MS = 400;

		this._playbackInterval = setInterval(() => {
			if (this._playbackPaused) return;

			this._playbackIndex++;

			if (this._playbackIndex >= this._playbackPath.length) {
				this.stopTripPlayback();
				this._onPlaybackComplete?.();
				return;
			}

			const pos = this._playbackPath[this._playbackIndex];
			this._playbackMarker?.setPosition(pos);
			this._panIfNearEdge(pos);

			const progress = this._playbackIndex / (this._playbackPath.length - 1);
			this._onPlaybackProgress?.(progress);
		}, PLAYBACK_SPEED_MS);
	}

	/** Pausa la reproducción */
	pauseTripPlayback() {
		this._playbackPaused = true;
	}

	/** Reanuda la reproducción */
	resumeTripPlayback() {
		if (!this._playbackPath.length || !this._playbackInterval) return;
		this._playbackPaused = false;
	}

	/** True si hay una reproducción pausada que se puede continuar. */
	canResumeTripPlayback() {
		return Boolean(this._playbackPaused && this._playbackPath.length > 0 && this._playbackInterval);
	}

	/** Detiene y resetea la reproducción */
	stopTripPlayback() {
		if (this._playbackInterval) {
			clearInterval(this._playbackInterval);
			this._playbackInterval = null;
		}
		if (this._playbackMarker) {
			this._playbackMarker.setMap(null);
			this._playbackMarker = null;
		}
		this._playbackIndex = 0;
		this._playbackPath = [];
		this._playbackPaused = false;
		this._onPlaybackProgress = null;
		this._onPlaybackComplete = null;
	}

	// ── Trip Alerts ───────────────────────────────────────────────────────────

	/** @type {google.maps.Marker[]} */
	_tripAlertMarkers = [];

	/**
	 * Muestra marcadores de alertas en el mapa
	 * @param {Array<{lat: number, lon: number, type: string}>} alerts
	 */
	showTripAlerts(alerts) {
		if (!this.map || !this.google || !alerts?.length) return;

		this.hideTripAlerts();

		for (const alert of alerts) {
			if (alert.lat == null || alert.lon == null) continue;

			const label = formatTripAlertType(alert.type);
			const fillColor = tripAlertMarkerColor(alert.type);
			const safeLabel = label
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;');

			const marker = new this.google.maps.Marker({
				position: {
					lat: parseFloat(alert.lat),
					lng: parseFloat(alert.lon ?? alert.lng)
				},
				map: this.map,
				icon: {
					path: this.google.maps.SymbolPath.CIRCLE,
					scale: 8,
					fillColor,
					fillOpacity: 1,
					strokeColor: '#fff',
					strokeWeight: 2
				},
				title: label,
				zIndex: 500
			});

			const infoWindow = new this.google.maps.InfoWindow({
				content: `<div style="background:#0c1829;color:#fff;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;">
					<span style="color:${fillColor};">⚠</span> ${safeLabel}
				</div>`
			});

			let isOpen = false;
			marker.addListener('click', () => {
				if (isOpen) {
					infoWindow.close();
					isOpen = false;
				} else {
					infoWindow.open(this.map, marker);
					isOpen = true;
				}
			});
			infoWindow.addListener('closeclick', () => {
				isOpen = false;
			});

			this._tripAlertMarkers.push(marker);
		}
	}

	/** Oculta marcadores de alertas */
	hideTripAlerts() {
		for (const marker of this._tripAlertMarkers) {
			marker.setMap(null);
		}
		this._tripAlertMarkers = [];
	}

	// ── Traffic Layer (Capa de tráfico) ─────────────────────────────────────────

	/**
	 * Alterna la visibilidad de la capa de tráfico
	 * @returns {boolean} Nuevo estado de visibilidad
	 */
	toggleTraffic() {
		this._trafficVisible = !this._trafficVisible;
		this.setTrafficVisible(this._trafficVisible);
		return this._trafficVisible;
	}

	/**
	 * Establece la visibilidad de la capa de tráfico
	 * @param {boolean} visible
	 */
	setTrafficVisible(visible) {
		if (!this._trafficLayer || !this.map) return;
		this._trafficVisible = visible;
		this._trafficLayer.setMap(visible ? this.map : null);
	}

	/**
	 * Devuelve el estado actual de visibilidad del tráfico
	 * @returns {boolean}
	 */
	isTrafficVisible() {
		return this._trafficVisible;
	}

	// ── Map Type (Tipo de mapa) ─────────────────────────────────────────────────

	/**
	 * Tipos de mapa disponibles
	 * @readonly
	 */
	static MAP_TYPES = {
		ROADMAP: 'roadmap',
		SATELLITE: 'satellite',
		HYBRID: 'hybrid',
		TERRAIN: 'terrain'
	};

	/**
	 * Cambia el tipo de mapa
	 * @param {'roadmap' | 'satellite' | 'hybrid' | 'terrain'} mapType
	 */
	setMapType(mapType) {
		if (!this.map || !this.google) return;
		const typeId = {
			roadmap: this.google.maps.MapTypeId.ROADMAP,
			satellite: this.google.maps.MapTypeId.SATELLITE,
			hybrid: this.google.maps.MapTypeId.HYBRID,
			terrain: this.google.maps.MapTypeId.TERRAIN
		}[mapType];
		if (typeId) {
			this.map.setMapTypeId(typeId);
		}
	}

	/**
	 * Obtiene el tipo de mapa actual
	 * @returns {'roadmap' | 'satellite' | 'hybrid' | 'terrain' | null}
	 */
	getMapType() {
		if (!this.map) return null;
		const typeId = this.map.getMapTypeId();
		const reverseMap = {
			roadmap: 'roadmap',
			satellite: 'satellite',
			hybrid: 'hybrid',
			terrain: 'terrain'
		};
		return reverseMap[typeId] || 'roadmap';
	}
}

export const mapService = new MapService();
