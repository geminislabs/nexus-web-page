import * as GoogleMapsLoader from '@googlemaps/js-api-loader';
import {
	MarkerClusterer,
	SuperClusterAlgorithm
} from '@googlemaps/markerclusterer/dist/index.esm.mjs';
import { darkBlueCarStyle, DBLUE, grayBlueMapStyle, COLORS } from '$lib/mapStyles';
import { unitIcons } from '$lib/data/unitIcons.js';

class MapService {
	constructor() {
		this.map = null;
		this.google = null;
		this.markers = new Map();
		this.vehicleClusterer = null;
		this._mapClickCloseListener = null;
		this._mobileZoneEditorZoom = 12;
		this._mobileZoneZoomLocked = false;
		this._openVehiclePopupId = null;
		this.apiKey =
			import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

		// ── Trip replay ───────────────────────────────────────
		this._tripPolyline = null;
		this._tripAnimationMarker = null;
		this._tripAnimationFrame = null;
		this._tripAnimationPaused = false;
		this._tripAnimationProgress = 0; // 0..1
		this._tripAnimationPoints = [];
		this._tripAnimationDuration = 0;
		this._tripAnimationStartTime = null;
		this._tripAnimationOnFinish = null;
	}

	// ── Theme helpers ─────────────────────────────────────────

	_isDarkVehiclePopupTheme() {
		if (typeof document === 'undefined') return true;
		return document.documentElement.classList.contains('dark');
	}

	refreshOpenVehicleInfoWindowTheme(mode) {
		const id = this._openVehiclePopupId;
		if (!id || !this.google) return;
		const entry = this.markers.get(id);
		if (!entry?.infoWindow || !entry.popupVehicle) return;
		entry.infoWindow.setContent(
			this.createVehicleInfoContent(entry.popupVehicle, entry.infoWindow, mode)
		);
	}

	_setMarkerMap(m, map) {
		if (!m) return;
		m.setMap(map);
	}

	// ── Marker icon helpers ───────────────────────────────────

	/**
	 * Devuelve icon config para un vehículo:
	 * - Si tiene icon_type en unitIcons → usa la imagen PNG
	 * - Si no → círculo SVG coloreado por estado
	 */
	_getVehicleIcon(vehicle) {
		const iconType = vehicle?.icon_type;
		if (iconType && unitIcons[iconType]) {
			return {
				url: unitIcons[iconType],
				scaledSize: new this.google.maps.Size(40, 40),
				anchor: new this.google.maps.Point(20, 20)
			};
		}
		// Fallback: círculo SVG con color de estado
		return {
			url: this._vehicleIconDataUrl(this.getVehicleColor(vehicle?.status)),
			scaledSize: new this.google.maps.Size(32, 32),
			anchor: new this.google.maps.Point(16, 16)
		};
	}

	_vehicleIconDataUrl(hexColor) {
		const svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="14" fill="${hexColor}" stroke="white" stroke-width="2"/><path d="M8 16h16M12 12h8M12 20h8" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`;
		return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
	}

	// ── Initialize ────────────────────────────────────────────

	async initialize(mapElement) {
		try {
			const loader = new GoogleMapsLoader.Loader({
				apiKey: this.apiKey,
				version: 'weekly',
				libraries: ['places', 'geometry', 'drawing']
			});

			this.google = await loader.load();

			const isMobileLayout =
				typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;

			this.map = new this.google.maps.Map(mapElement, {
				center: { lat: 19.4326, lng: -99.1332 },
				zoom: 13,
				mapTypeId: this.google.maps.MapTypeId.ROADMAP,
				disableDefaultUI: false,
				zoomControl: !isMobileLayout,
				fullscreenControl: false,
				mapTypeControl: false,
				streetViewControl: false,
				rotateControl: false,
				scaleControl: false,
				styles: darkBlueCarStyle,
				backgroundColor: DBLUE.bg
			});

			if (this._mapClickCloseListener) {
				this.google.maps.event.removeListener(this._mapClickCloseListener);
			}
			this._mapClickCloseListener = this.map.addListener('click', () => {
				this.closeAllVehicleInfoWindows();
			});

			await this.setUserLocation();

			// retorna undefined intencionalmente; usar mapService.map directamente
		} catch (error) {
			console.error('Error initializing MapEngine:', error);
			throw error;
		}
	}

	// ── User location ─────────────────────────────────────────

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
					encodeURIComponent(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="#3B82F6" stroke="#1E40AF" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="white"/></svg>`),
				scaledSize: new this.google.maps.Size(24, 24),
				anchor: new this.google.maps.Point(12, 12)
			},
			zIndex: 5000
		});
		this.markers.set('user-location', marker);
		return marker;
	}

	// ── Vehicle markers ───────────────────────────────────────

	addVehicleMarker(vehicle) {
		const lat = vehicle.latitude || vehicle.lat;
		const lng = vehicle.longitude || vehicle.lng;
		if (!this.google || !this.map || lat == null || lng == null) return;

		const position = { lat: parseFloat(lat), lng: parseFloat(lng) };

		const marker = new this.google.maps.Marker({
			position,
			map: null,
			title: vehicle.name,
			icon: this._getVehicleIcon(vehicle),
			zIndex: 1
		});

		const infoWindow = new this.google.maps.InfoWindow({
			maxWidth: 340,
			pixelOffset: new this.google.maps.Size(0, 4),
			disableAutoPan: false
		});
		infoWindow.setContent(this.createVehicleInfoContent(vehicle, infoWindow));

		marker.addListener('click', () => {
			this.openVehicleInfoWindow(vehicle, { refreshContent: false });
		});

		this.markers.set(vehicle.id, { marker, infoWindow, popupVehicle: vehicle });
		return marker;
	}

	getVehicleColor(status) {
		switch (status) {
			case 'active': return '#10B981';
			case 'inactive': return '#EF4444';
			case 'maintenance': return '#F59E0B';
			default: return '#6B7280';
		}
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
				algorithm: new SuperClusterAlgorithm({ maxZoom: 17, radius: 72 })
			});
		}
	}

	updateVehicleMarker(vehicle) {
		const entry = this.markers.get(vehicle.id);
		if (entry) {
			const lat = vehicle.latitude || vehicle.lat;
			const lng = vehicle.longitude || vehicle.lng;
			if (lat != null && lng != null) {
				entry.marker.setPosition({ lat: parseFloat(lat), lng: parseFloat(lng) });
				entry.marker.setIcon(this._getVehicleIcon(vehicle));
				entry.infoWindow.setContent(this.createVehicleInfoContent(vehicle, entry.infoWindow));
				entry.popupVehicle = vehicle;
				if (this.vehicleClusterer) {
					this.vehicleClusterer.removeMarker(entry.marker, true);
					this.vehicleClusterer.addMarker(entry.marker);
				}
			}
		} else {
			const m = this.addVehicleMarker(vehicle);
			if (m && this.vehicleClusterer) this.vehicleClusterer.addMarker(m);
		}
	}

	removeMarker(id) {
		const markerData = this.markers.get(id);
		if (!markerData) return;
		const raw = markerData.marker ?? markerData;
		if (id !== 'user-location' && this.vehicleClusterer) {
			this.vehicleClusterer.removeMarker(raw);
		} else {
			this._setMarkerMap(raw, null);
		}
		this.markers.delete(id);
	}

	clearVehicleMarkers() {
		if (this.vehicleClusterer) {
			this.vehicleClusterer.setMap(null);
			this.vehicleClusterer = null;
		}
		for (const [key, data] of [...this.markers.entries()]) {
			if (key === 'user-location') continue;
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

	// ── InfoWindow ────────────────────────────────────────────

	_escapeHtml(s) {
		if (s == null) return '';
		return String(s)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}

	_getStatusGradient(status) {
		switch (status) {
			case 'active': return 'linear-gradient(90deg,#34d399 0%,#22d3ee 55%,#38bdf8 100%)';
			case 'inactive': return 'linear-gradient(90deg,#fb7185 0%,#f43f5e 100%)';
			case 'maintenance': return 'linear-gradient(90deg,#fbbf24 0%,#f59e0b 100%)';
			default: return 'linear-gradient(90deg,#94a3b8 0%,#64748b 100%)';
		}
	}

	createVehicleInfoContent(vehicle, infoWindow, forcedTheme) {
		const isDark = forcedTheme != null ? forcedTheme === 'dark' : this._isDarkVehiclePopupTheme();
		const speed = Number(vehicle.speed) || 0;
		const battery = Number(vehicle.battery ?? vehicle.fuel) || 0;
		const lastUpdate = this._escapeHtml(vehicle.lastUpdateFormatted || 'No disponible');
		const name = this._escapeHtml(vehicle.name || 'Unidad');
		const driver = this._escapeHtml(vehicle.driver || 'No asignado');
		const location = this._escapeHtml(vehicle.location || 'Desconocida');
		const deviceId = vehicle.deviceId ? this._escapeHtml(String(vehicle.deviceId)) : '';
		const statusLabel = this._escapeHtml(this.getStatusText(vehicle.status));
		const statusBadge = isDark
			? this.getStatusBadgeStyleDark(vehicle.status)
			: this.getStatusBadgeStyleLight(vehicle.status);
		const barGradient = this._getStatusGradient(vehicle.status);

		const latRaw = vehicle.latitude ?? vehicle.lat;
		const lngRaw = vehicle.longitude ?? vehicle.lng;
		let coordsBlock = '';
		if (latRaw != null && lngRaw != null && !Number.isNaN(Number(latRaw)) && !Number.isNaN(Number(lngRaw))) {
			const coordColor = isDark ? '#94a3b8' : '#64748b';
			coordsBlock = `<p style="margin:0;font-family:ui-monospace,monospace;font-size:10px;color:${coordColor};">${Number(latRaw).toFixed(6)}, ${Number(lngRaw).toFixed(6)}</p>`;
		}

		const divTop = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.22)';
		const deviceBlock = deviceId
			? `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid ${divTop};"><span style="font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Dispositivo</span><span style="font-size:11px;color:${isDark ? '#cbd5e1' : '#334155'};font-weight:500;">${deviceId}</span></div>`
			: '';

		const cardBg = isDark
			? 'linear-gradient(165deg,rgba(15,23,42,0.99) 0%,rgba(17,24,39,0.98) 100%)'
			: 'linear-gradient(165deg,#ffffff 0%,#f8fafc 50%,#f1f5f9 100%)';
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
		const footerBorder = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.2)';
		const coordsDash = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.25)';
		const closeBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
		const closeColor = isDark ? '#cbd5e1' : '#64748b';

		const wrapper = document.createElement('div');
		wrapper.setAttribute('data-nexus-vehicle-popup', '');
		wrapper.style.cssText = `position:relative;min-width:268px;max-width:304px;border-radius:16px;overflow:hidden;background:${cardBg};border:1px solid ${isDark ? 'rgba(148,163,184,0.14)' : 'rgba(148,163,184,0.35)'};color:${cardColor};font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.4;`;

		wrapper.innerHTML = `
			<div style="height:3px;width:100%;background:${barGradient};opacity:0.95;"></div>
			<button type="button" data-action="close-popup" aria-label="Cerrar"
				style="position:absolute;right:10px;top:14px;z-index:2;width:30px;height:30px;border:none;border-radius:9999px;cursor:pointer;background:${closeBg};color:${closeColor};font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;">×</button>
			<div style="padding:16px 16px 14px 16px;">
				<div style="display:flex;align-items:flex-start;gap:10px;padding-right:28px;margin-bottom:12px;">
					<div style="flex:1;min-width:0;">
						<h3 style="margin:0 0 6px 0;font-size:17px;font-weight:800;color:${titleColor};line-height:1.2;">${name}</h3>
						<p style="margin:0;font-size:12px;color:${mutedColor};font-weight:500;">${driver}</p>
					</div>
					<span style="flex-shrink:0;display:inline-flex;align-items:center;padding:4px 10px;border-radius:9999px;font-size:10px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;${statusBadge}">${statusLabel}</span>
				</div>
				<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
					<div style="border-radius:12px;padding:10px 10px 8px;${metricBg}">
						<div style="font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Velocidad</div>
						<div style="font-size:22px;font-weight:800;color:${metricValue};">${speed}<span style="font-size:11px;font-weight:600;color:#64748b;margin-left:2px;">km/h</span></div>
					</div>
					<div style="border-radius:12px;padding:10px 10px 8px;${metricBg}">
						<div style="font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Batería</div>
						<div style="font-size:22px;font-weight:800;color:${metricValue};">${battery}<span style="font-size:11px;font-weight:600;color:#64748b;margin-left:1px;">%</span></div>
					</div>
				</div>
				<div style="border-radius:12px;padding:10px 12px;${locBox}margin-bottom:10px;">
					<div style="font-size:9px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Ubicación</div>
					<p style="margin:0;font-size:12px;font-weight:600;color:${isDark ? '#e2e8f0' : '#0f172a'};line-height:1.35;">${location}</p>
				</div>
				${deviceBlock}
				<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:10px;margin-top:4px;border-top:1px solid ${footerBorder};">
					<span style="font-size:10px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#64748b;">Última señal</span>
					<span style="font-size:11px;color:${mutedColor};font-weight:500;">${lastUpdate}</span>
				</div>
				${coordsBlock ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed ${coordsDash};">${coordsBlock}</div>` : ''}
			</div>
		`;

		const closeBtn = wrapper.querySelector('[data-action="close-popup"]');
		closeBtn?.addEventListener('click', (e) => {
			e.stopPropagation();
			this._openVehiclePopupId = null;
			infoWindow?.close();
		});
		return wrapper;
	}

	getStatusBadgeStyleDark(status) {
		switch (status) {
			case 'active': return 'background:rgba(16,185,129,0.14);color:#6ee7b7;border:1px solid rgba(45,212,191,0.35);';
			case 'inactive': return 'background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(248,113,113,0.35);';
			case 'maintenance': return 'background:rgba(245,158,11,0.12);color:#fcd34d;border:1px solid rgba(251,191,36,0.35);';
			default: return 'background:rgba(148,163,184,0.1);color:#cbd5e1;border:1px solid rgba(148,163,184,0.28);';
		}
	}

	getStatusBadgeStyleLight(status) {
		switch (status) {
			case 'active': return 'background:#d1fae5;color:#047857;border:1px solid #6ee7b7;';
			case 'inactive': return 'background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;';
			case 'maintenance': return 'background:#fef3c7;color:#b45309;border:1px solid #fcd34d;';
			default: return 'background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;';
		}
	}

	getStatusText(status) {
		switch (status) {
			case 'active': return 'Activo';
			case 'inactive': return 'Inactivo';
			case 'maintenance': return 'Mantenimiento';
			default: return 'Desconocido';
		}
	}

	// ── InfoWindow open/close ─────────────────────────────────

	closeAllVehicleInfoWindows() {
		this._openVehiclePopupId = null;
		for (const data of this.markers.values()) {
			if (data?.infoWindow) data.infoWindow.close();
		}
	}

	openVehicleInfoWindow(vehicle, opts = {}) {
		const refreshContent = opts.refreshContent !== false;
		if (!this.map || !this.google || !vehicle?.id) return;
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

	// ── Center / Zoom ─────────────────────────────────────────

	centerOnVehicles(vehicles) {
		if (!vehicles.length || !this.map) return;
		const bounds = new this.google.maps.LatLngBounds();
		let hasCoords = false;
		vehicles.forEach((v) => {
			const lat = v.latitude || v.lat;
			const lng = v.longitude || v.lng;
			if (lat != null && lng != null) {
				bounds.extend({ lat: parseFloat(lat), lng: parseFloat(lng) });
				hasCoords = true;
			}
		});
		if (hasCoords) this.map.fitBounds(bounds);
	}

	centerOnVehicle(vehicle, opts = {}) {
		const showPopup = opts.showPopup !== false;
		const lat = vehicle.latitude || vehicle.lat;
		const lng = vehicle.longitude || vehicle.lng;
		if (lat == null || lng == null || !this.map || !this.google) return;

		this.map.setCenter({ lat: parseFloat(lat), lng: parseFloat(lng) });
		this.map.setZoom(15);
		if (!showPopup) return;
		this.google.maps.event.addListenerOnce(this.map, 'idle', () => {
			this.openVehicleInfoWindow(vehicle);
		});
	}

	setCenter(lat, lng) {
		if (this.map) this.map.setCenter({ lat, lng });
	}

	setZoom(zoom) {
		if (this.map) this.map.setZoom(zoom);
	}

	// ── Theme ─────────────────────────────────────────────────

	setMapTheme(mode) {
		if (!this.map) return;
		if (mode === 'light') {
			this.map.setOptions({ styles: grayBlueMapStyle, backgroundColor: COLORS.grayLight });
		} else {
			this.map.setOptions({ styles: darkBlueCarStyle, backgroundColor: DBLUE.bg });
		}
	}

	resizeMap() {
		if (!this.map || !this.google) return;
		this.google.maps.event.trigger(this.map, 'resize');
	}

	setNavigationControlsCompact(compact) {
		if (!this.map) return;
		this.map.setOptions({ zoomControl: !compact });
	}

	// ── Zone editor zoom lock ─────────────────────────────────

	enableMobileZoneEditorZoomLock() {
		if (!this.map || this._mobileZoneZoomLocked) return;
		const z = this._mobileZoneEditorZoom;
		this._mobileZoneZoomLocked = true;
		this.map.setOptions({ zoom: z, minZoom: z, maxZoom: z });
	}

	disableMobileZoneEditorZoomLock() {
		if (!this.map || !this._mobileZoneZoomLocked) return;
		this._mobileZoneZoomLocked = false;
		this.map.setOptions({ minZoom: 0, maxZoom: 22 });
	}

	// ── Trip replay (rescatado del viejo, implementado nativamente) ──

	/**
	 * Dibuja una polilínea del trayecto en el mapa.
	 * @param {Array<{lat: number, lng: number} | {latitude: number, longitude: number}>} points
	 */
	drawTripPolyline(points) {
		if (!this.map || !this.google || !Array.isArray(points)) return;
		this._clearTripPolyline();

		const path = points
			.map((p) => ({
				lat: parseFloat(p.lat ?? p.latitude),
				lng: parseFloat(p.lng ?? p.longitude)
			}))
			.filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));

		if (path.length < 2) return;

		this._tripPolyline = new this.google.maps.Polyline({
			path,
			geodesic: true,
			strokeColor: '#3B82F6',
			strokeOpacity: 0.85,
			strokeWeight: 4,
			map: this.map
		});

		// Ajustar bounds al trayecto
		const bounds = new this.google.maps.LatLngBounds();
		path.forEach((p) => bounds.extend(p));
		this.map.fitBounds(bounds, { top: 60, right: 20, bottom: 60, left: 20 });
	}

	_clearTripPolyline() {
		if (this._tripPolyline) {
			this._tripPolyline.setMap(null);
			this._tripPolyline = null;
		}
	}

	_clearTripAnimationMarker() {
		if (this._tripAnimationMarker) {
			this._tripAnimationMarker.setMap(null);
			this._tripAnimationMarker = null;
		}
		if (this._tripAnimationFrame) {
			cancelAnimationFrame(this._tripAnimationFrame);
			this._tripAnimationFrame = null;
		}
	}

	/**
	 * Anima un marcador a lo largo de los puntos del trayecto.
	 * @param {Array} points
	 * @param {number} totalDurationMs Duración total de la animación en ms
	 * @param {() => void} [onFinish]
	 */
	animateTrip(points, totalDurationMs = 20000, onFinish) {
		if (!this.map || !this.google || !Array.isArray(points) || points.length < 2) return;

		this._clearTripAnimationMarker();
		this.drawTripPolyline(points);

		const path = points
			.map((p) => ({
				lat: parseFloat(p.lat ?? p.latitude),
				lng: parseFloat(p.lng ?? p.longitude)
			}))
			.filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));

		this._tripAnimationPoints = path;
		this._tripAnimationDuration = totalDurationMs;
		this._tripAnimationOnFinish = onFinish ?? null;
		this._tripAnimationPaused = false;
		this._tripAnimationProgress = 0;
		this._tripAnimationStartTime = null;

		this._tripAnimationMarker = new this.google.maps.Marker({
			position: path[0],
			map: this.map,
			title: 'Reproduciendo trayecto',
			icon: {
				url: this._vehicleIconDataUrl('#3B82F6'),
				scaledSize: new this.google.maps.Size(36, 36),
				anchor: new this.google.maps.Point(18, 18)
			},
			zIndex: 200
		});

		const animate = (timestamp) => {
			if (this._tripAnimationPaused) return;
			if (!this._tripAnimationStartTime) {
				this._tripAnimationStartTime = timestamp - this._tripAnimationProgress * totalDurationMs;
			}

			const elapsed = timestamp - this._tripAnimationStartTime;
			const t = Math.min(elapsed / totalDurationMs, 1);
			this._tripAnimationProgress = t;

			// Interpolar posición a lo largo del path
			const idx = t * (path.length - 1);
			const i = Math.floor(idx);
			const frac = idx - i;
			const from = path[Math.min(i, path.length - 1)];
			const to = path[Math.min(i + 1, path.length - 1)];
			const lat = from.lat + (to.lat - from.lat) * frac;
			const lng = from.lng + (to.lng - from.lng) * frac;

			this._tripAnimationMarker?.setPosition({ lat, lng });

			if (t < 1) {
				this._tripAnimationFrame = requestAnimationFrame(animate);
			} else {
				this._tripAnimationOnFinish?.();
				this._clearTripAnimationMarker();
			}
		};

		this._tripAnimationFrame = requestAnimationFrame(animate);
	}

	pauseAnimation() {
		if (!this._tripAnimationFrame) return;
		this._tripAnimationPaused = true;
		cancelAnimationFrame(this._tripAnimationFrame);
		this._tripAnimationFrame = null;
	}

	resumeAnimation() {
		if (!this._tripAnimationPaused || !this._tripAnimationPoints.length) return;
		this._tripAnimationPaused = false;
		this._tripAnimationStartTime = null; // se recalcula en el primer frame

		const animate = (timestamp) => {
			if (this._tripAnimationPaused) return;
			if (!this._tripAnimationStartTime) {
				this._tripAnimationStartTime =
					timestamp - this._tripAnimationProgress * this._tripAnimationDuration;
			}
			const elapsed = timestamp - this._tripAnimationStartTime;
			const t = Math.min(elapsed / this._tripAnimationDuration, 1);
			this._tripAnimationProgress = t;

			const path = this._tripAnimationPoints;
			const idx = t * (path.length - 1);
			const i = Math.floor(idx);
			const frac = idx - i;
			const from = path[Math.min(i, path.length - 1)];
			const to = path[Math.min(i + 1, path.length - 1)];
			this._tripAnimationMarker?.setPosition({
				lat: from.lat + (to.lat - from.lat) * frac,
				lng: from.lng + (to.lng - from.lng) * frac
			});

			if (t < 1) {
				this._tripAnimationFrame = requestAnimationFrame(animate);
			} else {
				this._tripAnimationOnFinish?.();
				this._clearTripAnimationMarker();
			}
		};
		this._tripAnimationFrame = requestAnimationFrame(animate);
	}

	stopAnimation() {
		this._clearTripAnimationMarker();
		this._clearTripPolyline();
		this._tripAnimationProgress = 0;
		this._tripAnimationPaused = false;
		this._tripAnimationPoints = [];
	}
}

export const mapService = new MapService();
