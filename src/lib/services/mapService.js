import { get, writable } from 'svelte/store';
import * as GoogleMapsLoader from '@googlemaps/js-api-loader';
import {
	MarkerClusterer,
	SuperClusterAlgorithm
} from '@googlemaps/markerclusterer/dist/index.esm.mjs';
import { darkBlueCarStyle, DBLUE, grayBlueMapStyle, COLORS } from '$lib/mapStyles';
import { theme } from '$lib/stores/themeStore.js';
import {
	buildVehicleMarkerDataUrl,
	getStatusHexColor,
	resolveProfileColorHex,
	getVehicleMarkerMetrics,
	VEHICLE_MARKER_SIZE
} from '$lib/utils/vehicleMarkerIcon.js';

/** Color del rastro en vivo y del indicador de seguimiento. */
const LIVE_TRAIL_COLOR = '#00a6c0';
/** Breakpoint móvil (alineado con MapContainer / Tailwind `sm`). */
const MOBILE_MQ = '(max-width: 639px)';
/** Últimos N puntos por unidad (~5 min a 1 update/5s). */
const MAX_TRAIL_POINTS = 60;
const TRAIL_FADE_MS = 220;
const TRAIL_MIN_OPACITY = 0.12;
const TRAIL_MAX_OPACITY = 0.75;

/** Unidad actualmente en modo "seguir" (o null). Para reactividad en UI (botón Seguir). */
export const followedVehicleId = writable(/** @type {string | null} */ (null));

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
		/** @type {Map<string, Array<{ lat: number, lng: number }>>} Rastro por unidad */
		this._liveTrails = new Map();
		/** @type {Map<string, google.maps.Polyline[]>} Segmentos de polyline por unidad (degradado) */
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
		this.apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
	}

	/** Alineado con themeStore (`html.dark` en tema oscuro). */
	_isDarkVehiclePopupTheme() {
		if (typeof document === 'undefined') return true;
		return document.documentElement.classList.contains('dark');
	}

	/**
	 * Si hay un popup de unidad abierto, vuelve a renderizarlo con el tema indicado.
	 * @param {'light' | 'dark'} mode
	 */
	refreshOpenVehicleInfoWindowTheme(mode) {
		const id = this._openVehiclePopupId;
		if (!id || !this.google) return;
		const entry = this.markers.get(id);
		if (!entry?.infoWindow || !entry.popupVehicle) return;
		entry.infoWindow.setContent(
			this.createVehicleInfoContent(entry.popupVehicle, entry.infoWindow, mode)
		);
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
			if (prevId !== this._followVehicleId) this.hideLiveTrail(prevId);
		}
		if (nextId) {
			this._highlightPulsePhase = 0;
			this._ringRotation = 0;
			this._applyVehicleMarkerIcon(nextId);
			this._startRingRotation();
			this.showLiveTrail(nextId);
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
				zoomControl: !isMobileLayout,
				zoomControlOptions: {
					position: this.google.maps.ControlPosition.LEFT_BOTTOM
				},
				fullscreenControl: false,
				mapTypeControl: false,
				streetViewControl: false,
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

			await this.setUserLocation();

			return this.map;
		} catch (error) {
			console.error('Error inicializando Google Maps:', error);
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
					console.warn('Error obteniendo ubicación:', error);
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
			disableAutoPan: false
		});
		infoWindow.setContent(this.createVehicleInfoContent(vehicle, infoWindow));

		marker.addListener('click', () => {
			this._onVehicleMarkerClick?.(vehicle);
			this.openVehicleInfoWindow(vehicle, { refreshContent: false });
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
	 * @param {unknown} vehicle
	 * @param {object | undefined} infoWindow
	 * @param {'light' | 'dark' | undefined} [forcedTheme] Si viene del store al cambiar tema; si no, se usa el DOM.
	 */
	createVehicleInfoContent(vehicle, infoWindow, forcedTheme) {
		const isDark = forcedTheme != null ? forcedTheme === 'dark' : this._isDarkVehiclePopupTheme();
		const speed = Number(vehicle.speed) || 0;
		const battery = Number(vehicle.battery ?? vehicle.fuel) || 0;
		const lastUpdate = this._escapeHtml(vehicle.lastUpdateFormatted || 'No disponible');
		const name = this._escapeHtml(vehicle.name || 'Unidad');
		const driver = this._escapeHtml(vehicle.driver || 'No asignado');
		const brandModel = [vehicle.brand, vehicle.model].filter(Boolean).join(' ').trim();
		const brandModelText = this._escapeHtml(brandModel || 'Sin modelo');
		const plateText = this._escapeHtml(vehicle.plate || '');
		const location = this._escapeHtml(vehicle.location || 'Desconocida');
		const deviceId = vehicle.deviceId ? this._escapeHtml(String(vehicle.deviceId)) : '';
		// Telemetría igual que CommunicationDTO en Android/iOS
		const mainVoltage = Number(vehicle.mainBatteryVoltage ?? vehicle.main_battery_voltage);
		const backupVoltage = Number(vehicle.backupBatteryVoltage ?? vehicle.backup_battery_voltage);
		const satellites = Number(vehicle.satellites);
		const statusLabel = this._escapeHtml(this.getStatusText(vehicle.status));
		const statusBadge = isDark
			? this.getStatusBadgeStyleDark(vehicle.status)
			: this.getStatusBadgeStyleLight(vehicle.status);
		const barGradient = this._getStatusGradient(vehicle.status);

		const latRaw = vehicle.latitude ?? vehicle.lat;
		const lngRaw = vehicle.longitude ?? vehicle.lng;
		let coordsBlock = '';
		if (
			latRaw != null &&
			lngRaw != null &&
			!Number.isNaN(Number(latRaw)) &&
			!Number.isNaN(Number(lngRaw))
		) {
			const la = Number(latRaw).toFixed(6);
			const lo = Number(lngRaw).toFixed(6);
			const coordColor = isDark ? '#94a3b8' : '#64748b';
			coordsBlock = `<p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:10px;color:${coordColor};letter-spacing:0.02em;">${la}, ${lo}</p>`;
		}

		const hasMainVoltage = !Number.isNaN(mainVoltage) && mainVoltage > 0;
		const hasBackupVoltage = !Number.isNaN(backupVoltage) && backupVoltage > 0;
		const hasSatellites = !Number.isNaN(satellites) && satellites > 0;
		const telemetryItems = [
			hasMainVoltage ? `Principal ${mainVoltage.toFixed(1)}V` : null,
			hasBackupVoltage ? `Respaldo ${backupVoltage.toFixed(1)}V` : null,
			hasSatellites ? `${satellites} sat` : null
		].filter(Boolean);

		const divTop = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.22)';
		const deviceBlock = deviceId
			? `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid ${divTop};">
					<span style="font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Dispositivo</span>
					<span style="font-size:11px;color:${isDark ? '#cbd5e1' : '#334155'};font-weight:500;">${deviceId}</span>
				</div>`
			: '';

		const cardBg = isDark
			? 'linear-gradient(165deg,rgba(15,23,42,0.99) 0%,rgba(17,24,39,0.98) 42%,rgba(15,23,42,0.99) 100%)'
			: 'linear-gradient(165deg,#ffffff 0%,#f8fafc 50%,#f1f5f9 100%)';
		const cardShadow = isDark
			? 'inset 0 1px 0 rgba(255,255,255,0.07),0 18px 40px rgba(0,0,0,0.45)'
			: 'inset 0 1px 0 rgba(255,255,255,0.9),0 18px 40px rgba(15,23,42,0.1)';
		const cardBorder = isDark
			? '1px solid rgba(148,163,184,0.14)'
			: '1px solid rgba(148,163,184,0.35)';
		const cardColor = isDark ? '#e2e8f0' : '#0f172a';

		const titleColor = isDark ? '#f8fafc' : '#0f172a';
		const mutedColor = isDark ? '#94a3b8' : '#64748b';
		const metricBg = isDark
			? 'background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.06);'
			: 'background:rgba(241,245,249,0.95);border:1px solid rgba(148,163,184,0.22);';
		const metricValue = isDark ? '#f1f5f9' : '#0f172a';
		const locBox = isDark
			? 'background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.1);'
			: 'background:#ffffff;border:1px solid rgba(148,163,184,0.22);';
		const locText = isDark ? '#e2e8f0' : '#0f172a';
		const footerBorder = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.2)';
		const signalMuted = isDark ? '#94a3b8' : '#64748b';
		const coordsHeading = isDark ? '#475569' : '#94a3b8';
		const coordsDash = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.25)';

		const closeBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
		const closeColor = isDark ? '#cbd5e1' : '#64748b';
		const closeInset = isDark
			? 'inset 0 1px 0 rgba(255,255,255,0.06)'
			: 'inset 0 1px 0 rgba(255,255,255,0.7)';
		const closeHoverBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)';
		const closeHoverColor = isDark ? '#f8fafc' : '#0f172a';

		const wrapper = document.createElement('div');
		wrapper.className = 'nexus-viw-card';
		wrapper.setAttribute('data-nexus-vehicle-popup', '');
		wrapper.setAttribute('data-popup-theme', isDark ? 'dark' : 'light');
		wrapper.style.cssText = [
			'position:relative',
			'min-width:268px',
			'max-width:304px',
			'border-radius:16px',
			'overflow:hidden',
			`background:${cardBg}`,
			`box-shadow:${cardShadow}`,
			`border:${cardBorder}`,
			'font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
			`color:${cardColor}`,
			'line-height:1.4'
		].join(';');

		wrapper.innerHTML = `
			<div style="height:3px;width:100%;background:${barGradient};opacity:0.95;"></div>
			<button type="button" data-action="close-popup" aria-label="Cerrar"
				style="position:absolute;right:10px;top:14px;z-index:2;width:30px;height:30px;border:none;border-radius:9999px;cursor:pointer;
				background:${closeBg};color:${closeColor};font-size:18px;font-weight:400;line-height:1;display:flex;align-items:center;justify-content:center;
				box-shadow:${closeInset};transition:background 0.15s ease,color 0.15s ease;">
				×
			</button>
			<div style="padding:16px 16px 14px 16px;">
				<div style="display:flex;align-items:flex-start;gap:10px;padding-right:28px;margin-bottom:12px;">
					<div style="flex:1;min-width:0;">
						<h3 style="margin:0 0 6px 0;font-size:17px;font-weight:800;letter-spacing:-0.03em;color:${titleColor};line-height:1.2;">${name}</h3>
						<p style="margin:0;font-size:12px;color:${mutedColor};font-weight:500;">${driver}</p>
						<p style="margin:2px 0 0 0;font-size:11px;color:${mutedColor};font-weight:500;">${brandModelText}${plateText ? ` · ${plateText}` : ''}</p>
					</div>
					<span style="flex-shrink:0;display:inline-flex;align-items:center;padding:4px 10px;border-radius:9999px;font-size:10px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;${statusBadge}">${statusLabel}</span>
				</div>
				<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
					<div style="border-radius:12px;padding:10px 10px 8px;${metricBg}">
						<div style="font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Velocidad</div>
						<div style="font-size:22px;font-weight:800;color:${metricValue};letter-spacing:-0.02em;">${speed}<span style="font-size:11px;font-weight:600;color:#64748b;margin-left:2px;">km/h</span></div>
					</div>
					<div style="border-radius:12px;padding:10px 10px 8px;${metricBg}">
						<div style="font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Batería</div>
						<div style="font-size:22px;font-weight:800;color:${metricValue};letter-spacing:-0.02em;">${battery}<span style="font-size:11px;font-weight:600;color:#64748b;margin-left:1px;">%</span></div>
					</div>
				</div>
				<div style="border-radius:12px;padding:10px 12px;${locBox}margin-bottom:10px;">
					<div style="font-size:9px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Ubicación</div>
					<p style="margin:0;font-size:12px;font-weight:600;color:${locText};line-height:1.35;">${location}</p>
				</div>
				${telemetryItems.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">${telemetryItems.map((label) => `<span style="display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:0.02em;background:${isDark ? 'rgba(15,23,42,0.68)' : '#e2e8f0'};color:${isDark ? '#cbd5e1' : '#334155'};border:1px solid ${isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.22)'};">${label}</span>`).join('')}</div>` : ''}
				${deviceBlock}
				<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:10px;margin-top:4px;border-top:1px solid ${footerBorder};">
					<span style="font-size:10px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#64748b;">Última señal</span>
					<span style="font-size:11px;color:${signalMuted};font-weight:500;">${lastUpdate}</span>
				</div>
				${coordsBlock ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed ${coordsDash};"><div style="font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${coordsHeading};margin-bottom:4px;">Coordenadas</div>${coordsBlock}</div>` : ''}
			</div>
		`;
		const closeBtn = wrapper.querySelector('[data-action="close-popup"]');
		closeBtn?.addEventListener('click', (e) => {
			e.stopPropagation();
			this._openVehiclePopupId = null;
			infoWindow?.close();
		});
		closeBtn?.addEventListener(
			'mouseenter',
			() => {
				closeBtn.style.background = closeHoverBg;
				closeBtn.style.color = closeHoverColor;
			},
			{ passive: true }
		);
		closeBtn?.addEventListener(
			'mouseleave',
			() => {
				closeBtn.style.background = closeBg;
				closeBtn.style.color = closeColor;
			},
			{ passive: true }
		);
		return wrapper;
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
				console.log('[trail] update', vehicle.id, newPosition.lat, newPosition.lng);
				existingMarkerData.marker.setPosition(newPosition);

				existingMarkerData.infoWindow.setContent(
					this.createVehicleInfoContent(vehicle, existingMarkerData.infoWindow)
				);
				existingMarkerData.popupVehicle = vehicle;
				this._startMarkerBlink(vehicle.id, vehicle);

				if (this.vehicleClusterer) {
					this.vehicleClusterer.render();
				}

				this._appendLiveTrailPoint(vehicle.id, newPosition.lat, newPosition.lng);
				this.showLiveTrail(vehicle.id);

				if (vehicle.id === this._followVehicleId) {
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
		if (this._suppressFollowClear) {
			this._suppressFollowClear = false;
			return;
		}
		this.clearFollowVehicle();
	}

	/**
	 * Activa seguimiento en vivo de una unidad (cámara + rastro + indicador).
	 * @param {string} vehicleId
	 * @param {{ resetTrail?: boolean, seedPosition?: { lat: number, lng: number } }} [opts]
	 */
	setFollowVehicle(vehicleId, opts = {}) {
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
			this._appendLiveTrailPoint(vehicleId, opts.seedPosition.lat, opts.seedPosition.lng, {
				force: true
			});
		}

		const seed = opts.seedPosition ?? this._getMarkerPosition(vehicleId);
		if (seed) this._ensureFollowBadge(seed);
	}

	/** Detiene el seguimiento; conserva el rastro si la unidad sigue activa/seleccionada. */
	clearFollowVehicle() {
		const id = this._followVehicleId;
		this._followVehicleId = null;
		followedVehicleId.set(null);
		this._removeFollowBadge();
		if (id && id !== this._highlightedVehicleId) {
			this.hideLiveTrail(id);
		}
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
	 * @param {{ force?: boolean }} [opts]
	 */
	_appendLiveTrailPoint(vehicleId, lat, lng) {
		if (!vehicleId || !this.google || Number.isNaN(lat) || Number.isNaN(lng)) return;

		const path = this._liveTrails.get(vehicleId) || [];
		path.push({ lat, lng });
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
			segments.push({ path: [path[i - 1], path[i]], opacity });
		}
		return segments;
	}

	/** @param {string} vehicleId @param {number} [multiplier] */
	_redrawLiveTrail(vehicleId, multiplier = 1) {
		if (!this.map || !this.google) return;
		const existing = this._liveTrailPolylines.get(vehicleId) || [];
		const segments = this._buildTrailSegments(vehicleId, multiplier);
		const points = this._liveTrails.get(vehicleId) || [];
		console.log('[trail] drawing', vehicleId, points.length, 'points');

		segments.forEach((seg, i) => {
			let line = existing[i];
			if (!line) {
				line = new this.google.maps.Polyline({
					geodesic: true,
					strokeColor: LIVE_TRAIL_COLOR,
					strokeWeight: 3,
					strokeOpacity: seg.opacity,
					map: this.map,
					zIndex: 45
				});
				existing[i] = line;
			}
			line.setPath(seg.path);
			line.setOptions({ strokeOpacity: seg.opacity });
		});

		for (let i = segments.length; i < existing.length; i++) {
			existing[i]?.setMap(null);
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
			lines.forEach((l) => l.setMap(null));
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
		lines.forEach((l) => l.setMap(null));
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
			if (data?.infoWindow) data.infoWindow.close();
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
			entry.infoWindow.setContent(this.createVehicleInfoContent(vehicle, entry.infoWindow));
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
			this.setFollowVehicle(vehicle.id, { seedPosition: position });
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
	 * En móvil (≤639px) oculta el control de zoom de Google; en escritorio lo muestra.
	 * @param {boolean} compact true = layout móvil
	 */
	setNavigationControlsCompact(compact) {
		if (!this.map) return;
		this.map.setOptions({
			zoomControl: !compact
		});
	}

	/**
	 * Fija zoom y límites min/max para el editor de zona (móvil).
	 * Mantiene el centro actual; solo ajusta el nivel de zoom al de referencia.
	 */
	enableMobileZoneEditorZoomLock() {
		if (!this.map || this._mobileZoneZoomLocked) return;
		if (!this._isMobileLayout()) return;
		const z = this._mobileZoneEditorZoom;
		this._mobileZoneZoomLocked = true;
		this.map.setOptions({
			zoom: z,
			minZoom: z,
			maxZoom: z
		});
	}

	/** Restaura zoom libre tras salir del editor de zona. */
	disableMobileZoneEditorZoomLock() {
		if (!this.map || !this._mobileZoneZoomLocked) return;
		this._mobileZoneZoomLocked = false;
		this.map.setOptions({
			minZoom: 0,
			maxZoom: 22
		});
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

		this.clearFollowVehicle();
		this.clearTripRoute();

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

	/** Limpia la ruta del trayecto del mapa */
	clearTripRoute() {
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
	}

	/**
	 * Ajusta el mapa para mostrar todos los puntos del trayecto
	 * @param {Array<{lat: number, lon: number}>} points
	 */
	fitBoundsToPoints(points) {
		if (!this.map || !this.google || !points?.length) return;

		this.clearFollowVehicle();
		const bounds = new this.google.maps.LatLngBounds();
		for (const p of points) {
			bounds.extend({
				lat: parseFloat(p.lat),
				lng: parseFloat(p.lon ?? p.lng)
			});
		}
		this.map.fitBounds(bounds, { padding: 50 });
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
			this.map.panTo(pos);

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
		this._playbackPaused = false;
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

			const marker = new this.google.maps.Marker({
				position: {
					lat: parseFloat(alert.lat),
					lng: parseFloat(alert.lon ?? alert.lng)
				},
				map: this.map,
				icon: {
					path: this.google.maps.SymbolPath.CIRCLE,
					scale: 8,
					fillColor: '#f59e0b',
					fillOpacity: 1,
					strokeColor: '#fff',
					strokeWeight: 2
				},
				title: alert.type || 'Alerta',
				zIndex: 500
			});

			const infoWindow = new this.google.maps.InfoWindow({
				content: `<div style="background:#0c1829;color:#fff;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;">
					<span style="color:#f59e0b;">⚠</span> ${alert.type || 'Alerta'}
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
}

export const mapService = new MapService();
