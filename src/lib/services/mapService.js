import * as GoogleMapsLoader from '@googlemaps/js-api-loader';
import {
	MarkerClusterer,
	SuperClusterAlgorithm
} from '@googlemaps/markerclusterer/dist/index.esm.mjs';
import { darkBlueCarStyle, DBLUE, grayBlueMapStyle, COLORS } from '$lib/mapStyles';

class MapService {
	constructor() {
		this.map = null;
		this.google = null;
		this.markers = new Map();
		this.vehicleClusterer = null;
		this._mapClickCloseListener = null;
		this.apiKey =
			import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyC_NFPQKCUYcCq4WLTTOmSLnfQmRmPYE-8';
	}

	/** @param {google.maps.Marker | null} m */
	_setMarkerMap(m, map) {
		if (!m) return;
		m.setMap(map);
	}

	_vehicleIconDataUrl(hexColor) {
		const svg = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="14" fill="${hexColor}" stroke="white" stroke-width="2"/><path d="M8 16h16M12 12h8M12 20h8" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`;
		return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
	}

	async initialize(mapElement) {
		try {
			const loader = new GoogleMapsLoader.Loader({
				apiKey: this.apiKey,
				version: 'weekly',
				libraries: ['places', 'geometry', 'drawing']
			});

			this.google = await loader.load();

			const mapOptions = {
				center: { lat: 19.4326, lng: -99.1332 },
				zoom: 13,
				mapTypeId: this.google.maps.MapTypeId.ROADMAP,
				disableDefaultUI: false,
				zoomControl: true,
				fullscreenControl: false,
				mapTypeControl: false,
				streetViewControl: false,
				rotateControl: false,
				scaleControl: false,
				styles: darkBlueCarStyle,
				backgroundColor: DBLUE.bg
			};

			this.map = new this.google.maps.Map(mapElement, mapOptions);
			if (this._mapClickCloseListener) {
				this.google.maps.event.removeListener(this._mapClickCloseListener);
			}
			this._mapClickCloseListener = this.map.addListener('click', () => {
				this.closeAllVehicleInfoWindows();
			});

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
		const color = this.getVehicleColor(vehicle.status);

		const marker = new this.google.maps.Marker({
			position,
			map: null,
			title: vehicle.name,
			icon: {
				url: this._vehicleIconDataUrl(color),
				scaledSize: new this.google.maps.Size(32, 32),
				anchor: new this.google.maps.Point(16, 16)
			},
			zIndex: 1
		});

		const infoWindow = new this.google.maps.InfoWindow();
		infoWindow.setContent(this.createVehicleInfoContent(vehicle, infoWindow));

		marker.addListener('click', () => {
			this.closeAllVehicleInfoWindows();
			infoWindow.open(this.map, marker);
		});

		this.markers.set(vehicle.id, { marker, infoWindow });
		return marker;
	}

	getVehicleColor(status) {
		switch (status) {
			case 'active':
				return '#10B981';
			case 'inactive':
				return '#EF4444';
			case 'maintenance':
				return '#F59E0B';
			default:
				return '#6B7280';
		}
	}

	createVehicleInfoContent(vehicle, infoWindow) {
		const speed = vehicle.speed || 0;
		const battery = vehicle.battery || vehicle.fuel || 0;
		const lastUpdate = vehicle.lastUpdateFormatted || 'No disponible';
		const statusStyle = this.getStatusStyle(vehicle.status);
		const wrapper = document.createElement('div');
		wrapper.style.minWidth = '220px';
		wrapper.style.maxWidth = '280px';
		wrapper.style.padding = '12px';
		wrapper.style.fontFamily = 'Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
		wrapper.style.color = '#0f172a';
		wrapper.style.lineHeight = '1.35';
		wrapper.style.position = 'relative';
		wrapper.innerHTML = `
			<button type="button" data-action="close-popup" aria-label="Cerrar popup"
				style="position:absolute; right:0; top:0; width:22px; height:22px; border:none; border-radius:9999px; background:#e2e8f0; color:#0f172a; font-size:14px; font-weight:700; cursor:pointer; line-height:1;">
				×
			</button>
			<h3 style="margin:0 24px 10px 0; font-size:15px; font-weight:700; color:#0f172a;">${vehicle.name}</h3>
			<div style="font-size:13px; color:#1e293b;">
				<p style="margin:0 0 6px 0;"><span style="font-weight:600;">Conductor:</span> ${vehicle.driver || 'No asignado'}</p>
				<p style="margin:0 0 6px 0;"><span style="font-weight:600;">Estado:</span> 
					<span style="display:inline-block; margin-left:4px; padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:700; ${statusStyle}">
						${this.getStatusText(vehicle.status)}
					</span>
				</p>
				<p style="margin:0 0 6px 0;"><span style="font-weight:600;">Ubicación:</span> ${vehicle.location || 'Desconocida'}</p>
				<p style="margin:0 0 6px 0;"><span style="font-weight:600;">Velocidad:</span> ${speed} km/h</p>
				<p style="margin:0 0 6px 0;"><span style="font-weight:600;">Batería:</span> ${battery}%</p>
				${vehicle.deviceId ? `<p style="margin:0 0 6px 0;"><span style="font-weight:600;">Device ID:</span> ${vehicle.deviceId}</p>` : ''}
				<p style="margin:0 0 6px 0;"><span style="font-weight:600;">Última actualización:</span> ${lastUpdate}</p>
				${
					vehicle.latitude && vehicle.longitude
						? `<p style="margin:0;"><span style="font-weight:600;">Coordenadas:</span> ${Number(vehicle.latitude).toFixed(6)}, ${Number(vehicle.longitude).toFixed(6)}</p>`
						: ''
				}
			</div>
		`;
		const closeBtn = wrapper.querySelector('[data-action="close-popup"]');
		closeBtn?.addEventListener('click', () => infoWindow?.close());
		return wrapper;
	}

	getStatusStyle(status) {
		switch (status) {
			case 'active':
				return 'background:#dcfce7; color:#166534;';
			case 'inactive':
				return 'background:#fee2e2; color:#991b1b;';
			case 'maintenance':
				return 'background:#fef3c7; color:#92400e;';
			default:
				return 'background:#e5e7eb; color:#374151;';
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

				existingMarkerData.marker.setIcon({
					url: this._vehicleIconDataUrl(this.getVehicleColor(vehicle.status)),
					scaledSize: new this.google.maps.Size(32, 32),
					anchor: new this.google.maps.Point(16, 16)
				});

				if (this.vehicleClusterer) {
					const m = existingMarkerData.marker;
					this.vehicleClusterer.removeMarker(m, true);
					this.vehicleClusterer.addMarker(m);
				}
			}
		} else {
			const m = this.addVehicleMarker(vehicle);
			if (m && this.vehicleClusterer) {
				this.vehicleClusterer.addMarker(m);
			}
		}
	}

	closeAllVehicleInfoWindows() {
		for (const data of this.markers.values()) {
			if (data?.infoWindow) data.infoWindow.close();
		}
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
			this.map.fitBounds(bounds);
		}
	}

	centerOnVehicle(vehicle) {
		const lat = vehicle.latitude || vehicle.lat;
		const lng = vehicle.longitude || vehicle.lng;

		if (lat != null && lng != null && this.map) {
			this.map.setCenter({ lat: parseFloat(lat), lng: parseFloat(lng) });
			this.map.setZoom(15);
		}
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

	getViewSnapshot() {
		if (!this.map) return null;
		const c = this.map.getCenter();
		const b = this.map.getBounds();
		const ne = b?.getNorthEast();
		const sw = b?.getSouthWest();
		return {
			center: { lat: c.lat(), lng: c.lng() },
			zoom: this.map.getZoom(),
			bounds:
				ne && sw
					? {
							northEast: { lat: ne.lat(), lng: ne.lng() },
							southWest: { lat: sw.lat(), lng: sw.lng() }
						}
					: null
		};
	}

	applyViewSnapshot(view) {
		if (!this.map || !this.google || !view) return;
		const b = view.bounds?.northEast && view.bounds?.southWest;
		if (b) {
			const ne = view.bounds.northEast;
			const sw = view.bounds.southWest;
			const bounds = new this.google.maps.LatLngBounds(
				{ lat: sw.lat, lng: sw.lng },
				{ lat: ne.lat, lng: ne.lng }
			);
			this.map.fitBounds(bounds);
			return;
		}
		if (view.center && typeof view.center.lat === 'number' && typeof view.center.lng === 'number') {
			this.map.setCenter(view.center);
		}
		if (typeof view.zoom === 'number' && Number.isFinite(view.zoom)) {
			this.map.setZoom(view.zoom);
		}
	}
}

export const mapService = new MapService();
