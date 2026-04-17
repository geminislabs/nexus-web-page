import * as GoogleMapsLoader from '@googlemaps/js-api-loader';
import {
	MarkerClusterer,
	SuperClusterAlgorithm
} from '@googlemaps/markerclusterer/dist/index.esm.mjs';
import { darkBlueCarStyle, DBLUE, grayBlueMapStyle, COLORS } from '$lib/mapStyles';

class MapService {
	constructor() {
		this.engine = null;
		this.mapInstance = null;
		this.unsubscribeTheme = null;
		this.currentTheme = 'modern';

		// Initialize the engine configuration
		// Note: We don't mount it yet, that happens in initialize()
		this.initEngine();
	}

	initEngine() {
		const apiKey =
			import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyC_NFPQKCUYcCq4WLTTOmSLnfQmRmPYE-8';

		this.engine = new GoogleMapEngine({
			apiKey,
			streetViewControl: true,
			// Define default theme and styles
			theme: this.currentTheme,
			styles: {
				modern: darkBlueCarStyle,
				dark: darkGrayMapStyle,
				matrix: matrixMapStyle,
				dgray: dGrayMapStyle,
				dgray: dGrayMapStyle,
				ancestral: ancestralMapStyle,
				light: null, // Default google maps style
				classic: null // Explicitly classic as default
			},
			// Icon resolver
			iconResolver: (vehicle) => {
				const iconType = vehicle.icon_type || 'vehicle-car-sedan';
				const url = unitIcons[iconType] || unitIcons['vehicle-car-sedan'];

				return {
					url: url,
					size: [40, 40],
					anchor: [20, 20]
				};
			},
			// Info window renderer
			infoWindowRenderer: (vehicle) => {
				const speed = vehicle.speed || 0;
				const battery = vehicle.main_battery_voltage || 0;
				const batteryDevice = vehicle.backup_battery_voltage || 0;
				const lastUpdate = vehicle.gps_datetime || 'No disponible';
				const statusClass = getStatusBadgeClass(vehicle.status);
				const statusText = getStatusText(vehicle.status);

				console.log(vehicle);

				return `
					<div class="info-window-text">
						<h3 class="font-semibold mb-2">${vehicle.name || vehicle.id || 'Sin ID'}</h3>
						<div class="space-y-1 text-sm">
							<p><span class="font-medium">Estado:</span> 
								<span class="px-2 py-1 text-xs ${statusClass}">
									${statusText}
								</span>
							</p>
							<p><span class="font-medium">Velocidad:</span> ${speed} km/h</p>
							<p><span class="font-medium">Batería:</span> ${battery} V</p>
							<p><span class="font-medium">Bater&iacute;a dispositivo:</span> ${batteryDevice || 0} V</p>
							<p><span class="font-medium">Última actualización:</span> ${lastUpdate}</p>
							${
								vehicle.latitude && vehicle.longitude
									? `<p><span class=\"font-medium\">Coordenadas:</span> ${vehicle.latitude}, ${vehicle.longitude}</p>`
									: ''
							}
						</div>
					</div>
				`;
			}
		});
	}

	async initialize(mapElement) {
		try {
			const loader = new GoogleMapsLoader.Loader({
				apiKey: this.apiKey,
				version: 'weekly',
				libraries: ['places', 'geometry', 'drawing']
			});

			this.google = await loader.load();

			// Initialize theme subscription
			this.setupThemeListener();

			// Initial background color set
			if (this.currentTheme) {
				const initialBg = this.getBackgroundColorForTheme(this.currentTheme);
				this.mapElement.style.backgroundColor = initialBg;
			}

			// Center map on default location if needed (Mexico City)
			// The engine might have its own default, but we can enforce one
			// this.engine.setCenter({ lat: 19.4326, lng: -99.1332 });
			// this.engine.setZoom(13);

			// Attempt to set user location (if engine supports it or we do it manually)
			// For now, retaining the pattern if possible, but map-engine might not have built-in user location.
			// Implementing user location manually on top of the map map instance if needed.
			// But since we want to rely on the engine, we will skip manual user location for now unless requested.
			// The previous service did: await this.setUserLocation();

			// Start the live animation loop once the map is ready
			this.startLive();

			return this.mapInstance;
		} catch (error) {
			console.error('Error inicializando Google Maps:', error);
			throw error;
		}
	}

	setupThemeListener() {
		if (this.unsubscribeTheme) return;

		this.unsubscribeTheme = theme.subscribe((t) => {
			this.currentTheme = t;
			if (this.engine) {
				// Map "classic" to "light" for the engine to recognize the default nature
				const engineTheme = t === 'classic' ? 'light' : t;
				this.engine.setTheme(engineTheme);

				// Apply background color fix
				const backgroundColor = this.getBackgroundColorForTheme(t);
				if (this.mapInstance) {
					this.mapInstance.setOptions({ backgroundColor });
				}

				// Force container background color update
				if (this.mapElement) {
					this.mapElement.style.backgroundColor = backgroundColor;
				}
			} else {
				console.warn('[MapService] Engine not ready for theme change');
			}
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

	getBackgroundColorForTheme(theme) {
		switch (theme) {
			case 'modern':
				return '#0b1524';
			case 'matrix':
				return '#0a0f0d';
			case 'dgray':
				return '#18181b';
			case 'dark':
				return '#0f1115';
			case 'dark':
				return '#0f1115';
			case 'ancestral':
				return '#2b1d0e';
			case 'classic':
			case 'light':
			default:
				return '#ffffff';
		}
	}

	// Methods delegating to the engine

	// Live Motion
	startLive() {
		if (this.engine && this.engine.startLive) {
			this.engine.startLive();
		}
	}

	stopLive() {
		if (this.engine && this.engine.stopLive) {
			this.engine.stopLive();
		}
	}

	addVehicleMarker(vehicle) {
		// Map backend data to LiveMotionInput expected by the engine
		const input = {
			id: vehicle.device_id || vehicle.id, // Ensure ID is present
			lat: vehicle.latitude,
			lng: vehicle.longitude,
			speedKmh: vehicle.speed || 0,
			bearing: vehicle.heading || vehicle.bearing || 0,
			timestamp: vehicle.timestamp ? new Date(vehicle.timestamp).getTime() : Date.now(),
			motion: {
				moving: vehicle.is_moving, // Assuming backend provides this
				ignition: vehicle.ignition_status ? 'on' : 'off' // Assuming this logic
			},
			// Pass through other properties if needed by the renderer
			...vehicle
		};

		// Determine the effective icon type (default to sedan)
		const iconType = vehicle.icon_type || 'vehicle-car-sedan';

		// CHECK FOR SVG ICON OVERRIDE
		// If vehicle type matches our SVG car (explicitly or by default), inject the SvgIconConfig
		if (iconType === 'vehicle-car-sedan') {
			const colorEntry = vehicleColors.find((c) => c.slug === vehicle.color);
			const fill = colorEntry ? colorEntry.hex : 'transparent';

			input.icon = {
				path: ICON_REGISTRY.car,
				fillColor: fill, // Use vehicle color or default Blue neon
				fillOpacity: 1,
				strokeColor: deriveStrokeColor(fill),
				strokeWeight: 1.2,
				scale: 0.7, // Adjusted scale as discussed
				anchor: { x: 27.5, y: 52.5 }
			};
		}

		return this.engine.updateVehicleMarker(input);
	}

	updateVehicleMarker(vehicle) {
		// Reuse mapping logic from addVehicleMarker
		return this.addVehicleMarker(vehicle);
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
		if (this.engine && this.engine.clear) {
			this.engine.clear();
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
				existingMarkerData.popupVehicle = vehicle;

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
		this._openVehiclePopupId = null;
		for (const data of this.markers.values()) {
			if (data?.infoWindow) data.infoWindow.close();
		}
	}

	/**
	 * Abre el InfoWindow de la unidad (mismo contenido que al pulsar el marcador).
	 * Si el marcador está en un cluster, se ancla por la posición del `Marker`.
	 * @param {{ id: string }} vehicle
	 * @param {{ refreshContent?: boolean }} [opts]
	 */
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

	centerOnVehicles(vehicles) {
		this.engine.centerOnVehicles(vehicles);
	}

	centerOnVehicle(vehicle) {
		this.engine.centerOnVehicles([vehicle]);
	}

	// Trip Replay
	drawTripPolyline(coordinates) {
		this.engine.drawTripPolyline(coordinates);
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

	resumeAnimation() {
		if (this.engine && this.engine.resumeTripAnimation) {
			this.engine.resumeTripAnimation();
		}
	}

	// Getters for compatibility
	get isReady() {
		return !!this.engine; // Simplified check, usually if instantiated it's "ready" to receive calls,
		// but "mount" is async.
	}
}

export const mapService = new MapService();
