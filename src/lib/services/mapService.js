import { GoogleMapEngine } from '@jesusCabrera84/map-engine';
import { darkBlueCarStyle, DBLUE, darkGrayMapStyle, DGREY } from '$lib/mapStyles';
import { getStatusBadgeClass, getStatusText } from '$lib/utils/vehicleUtils.js';
import { theme } from '$lib/stores/theme.js';
import { unitIcons } from '$lib/data/unitIcons.js';
import { ICON_REGISTRY } from '../../icons/index.js';

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
			// Define default theme and styles
			theme: this.currentTheme,
			styles: {
				modern: darkBlueCarStyle,
				dark: darkGrayMapStyle,
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

				return `
					<div class="info-window-text">
						<h3 class="font-semibold mb-2">${vehicle.device_id}</h3>
						<div class="space-y-1 text-sm">
							<p><span class="font-medium">Estado:</span> 
								<span class="px-2 py-1 text-xs ${statusClass}">
									${statusText}
								</span>
							</p>
							<p><span class="font-medium">Velocidad:</span> ${speed} km/h</p>
							<p><span class="font-medium">Batería:</span> ${battery} V</p>
							<p><span class="font-medium">Bater&iacute;a dispositivo:</span> ${batteryDevice || 0} V</p>
							${vehicle.device_id ? `<p><span class=\"font-medium\">Device ID:</span> ${vehicle.device_id}</p>` : ''}
							<p><span class="font-medium">Última actualización:</span> ${lastUpdate}</p>
							${vehicle.latitude && vehicle.longitude
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
			// Store map element reference
			this.mapElement = mapElement;

			// Mount the engine to the DOM element
			this.mapInstance = await this.engine.mount(mapElement);

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
			console.error('Error initializing MapEngine:', error);
			throw error;
		}
	}

	setupThemeListener() {
		if (this.unsubscribeTheme) return;

		this.unsubscribeTheme = theme.subscribe((t) => {
			console.log('[MapService] Theme changed:', t);
			this.currentTheme = t;
			if (this.engine) {
				// Map "classic" to "light" for the engine to recognize the default nature
				const engineTheme = t === 'classic' ? 'light' : t;
				console.log('[MapService] Setting engine theme:', engineTheme);
				this.engine.setTheme(engineTheme);

				// Apply background color fix
				const backgroundColor = this.getBackgroundColorForTheme(t);
				if (this.mapInstance) {
					console.log('[MapService] Setting map background color:', backgroundColor);
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
	}

	getBackgroundColorForTheme(theme) {
		switch (theme) {
			case 'modern':
				return '#0b1524';
			case 'dark':
				return '#0f1115';
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
			input.icon = {
				path: ICON_REGISTRY.car,
				fillColor: '#3B82F6', // Blue neon
				fillOpacity: 1,
				strokeColor: '#ffffff',
				strokeWeight: 1,
				scale: 0.7, // Adjusted scale as discussed
				anchor: { x: 32, y: 32 }
			};
		}

		return this.engine.updateVehicleMarker(input);
	}

	updateVehicleMarker(vehicle) {
		// Reuse mapping logic from addVehicleMarker
		return this.addVehicleMarker(vehicle);
	}

	addVehicleMarkers(vehicles) {
		if (!Array.isArray(vehicles)) return;
		vehicles.forEach((v) => this.updateVehicleMarker(v));
	}

	removeMarker(id) {
		if (this.engine && this.engine.removeMarker) {
			this.engine.removeMarker(id);
		} else {
			console.warn(
				'removeMarker not explicit on engine, trying update with null/removal logic if supported'
			);
		}
	}

	clearAllMarkers() {
		if (this.engine && this.engine.clear) {
			this.engine.clear();
		}
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

	animateTrip(coordinates, totalDuration, onFinish) {
		this.engine.animateTrip(coordinates, totalDuration, onFinish);
	}

	stopAnimation() {
		if (this.engine && this.engine.stopTripAnimation) {
			this.engine.stopTripAnimation();
		}
	}

	pauseAnimation() {
		if (this.engine && this.engine.pauseTripAnimation) {
			this.engine.pauseTripAnimation();
		}
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
