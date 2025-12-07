import * as GoogleMapsLoader from '@googlemaps/js-api-loader';
import { darkBlueCarStyle, DBLUE, darkGrayMapStyle, DGREY } from '$lib/mapStyles';

import { getStatusBadgeClass } from '$lib/utils/vehicleUtils.js';
import { theme } from '$lib/stores/theme.js';
import { unitIcons } from '$lib/data/unitIcons.js';

class MapService {
	constructor() {
		this.map = null;
		this.google = null;
		this.markers = new Map();
		this.unsubscribeTheme = null;
		this.currentTheme = undefined;
		this.apiKey =
			import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyC_NFPQKCUYcCq4WLTTOmSLnfQmRmPYE-8';
		this.currentPolyline = null;
		this.tripMarkers = [];

		// Animación
		this.vehicleMarker = null;
		this.animationFrameId = null;
		this.isPaused = false;
		this.animationStartTime = null;
		this.pausedTime = 0;
		this.animationDuration = 0;
		this.animationPath = [];
	}

	async initialize(mapElement) {
		try {
			const loader = new GoogleMapsLoader.Loader({
				apiKey: this.apiKey,
				version: 'weekly'
			});

			this.google = await loader.load();

			// Determine initial theme (SSR-safe fallback)
			const initialTheme =
				typeof document !== 'undefined'
					? document.documentElement?.dataset?.theme || 'modern'
					: 'modern';

			const useModern = initialTheme === 'modern';
			const useDark = initialTheme === 'dark';

			const mapOptions = {
				center: { lat: 19.4326, lng: -99.1332 }, // Ciudad de México por defecto
				zoom: 13,
				mapTypeId: this.google.maps.MapTypeId.ROADMAP,
				fullscreenControl: true,
				streetViewControl: false,
				mapTypeControl: false,
				zoomControl: true,
				styles: useModern ? darkBlueCarStyle : useDark ? darkGrayMapStyle : null,
				backgroundColor: useModern ? DBLUE.bg : useDark ? DGREY.bg : '#ffffff',
				disableDefaultUI: true
			};

			this.map = new this.google.maps.Map(mapElement, mapOptions);

			// React to theme changes at runtime
			if (!this.unsubscribeTheme) {
				this.unsubscribeTheme = theme.subscribe((t) => {
					this.currentTheme = t;
					if (this.map) {
						const isModern = t === 'modern';
						const isDark = t === 'dark';
						this.map.setOptions({
							styles: isModern ? darkBlueCarStyle : isDark ? darkGrayMapStyle : null,
							backgroundColor: isModern ? DBLUE.bg : isDark ? DGREY.bg : '#ffffff'
						});
					}
				});
			}

			// Intentar obtener la ubicación actual del usuario
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
			}
		});

		this.markers.set('user-location', marker);
		return marker;
	}

	addVehicleMarker(vehicle) {
		// Verificar que tenemos coordenadas válidas
		const lat = vehicle.latitude || vehicle.lat;
		const lng = vehicle.longitude || vehicle.lng;

		if (!this.google || !this.map || !lat || !lng) {
			console.warn('No se pueden agregar marcadores sin coordenadas válidas:', vehicle);
			return;
		}

		const position = { lat: parseFloat(lat), lng: parseFloat(lng) };

		// Determine icon URL
		const iconUrl =
			vehicle.icon_type && unitIcons[vehicle.icon_type]
				? unitIcons[vehicle.icon_type]
				: unitIcons['vehicle-car-sedan'];

		const marker = new this.google.maps.Marker({
			position: position,
			map: this.map,
			title: vehicle.device_id,
			icon: {
				url: iconUrl,
				scaledSize: new this.google.maps.Size(40, 40),
				anchor: new this.google.maps.Point(20, 20)
			}
		});

		// Agregar info window
		const infoWindow = new this.google.maps.InfoWindow({
			content: this.createVehicleInfoContent(vehicle)
		});

		marker.addListener('click', () => {
			infoWindow.open(this.map, marker);
		});

		const id = vehicle.id || vehicle.deviceId || vehicle.device_id;
		this.markers.set(id, { marker, infoWindow });
		return marker;
	}

	getVehicleColor(status) {
		switch (status) {
			case 'active':
				return '#10B981'; // green
			case 'inactive':
				return '#EF4444'; // red
			case 'maintenance':
				return '#F59E0B'; // yellow
			default:
				return '#6B7280'; // gray
		}
	}

	createVehicleInfoContent(vehicle) {
		console.warn('Vehicle info:', vehicle);
		const speed = vehicle.speed || 0;
		const battery = vehicle.main_battery_voltage || 0;
		const batteryDevice = vehicle.backup_battery_voltage || 0;
		const lastUpdate = vehicle.gps_datetime || 'No disponible';

		return `
			<div class="info-window-text">
				<h3 class="font-semibold mb-2">${vehicle.device_id}</h3>
				<div class="space-y-1 text-sm">
					<p><span class="font-medium">Estado:</span> 
						<span class="px-2 py-1 text-xs ${getStatusBadgeClass(vehicle.status)}">
							${this.getStatusText(vehicle.status)}
						</span>
					</p>
					<p><span class="font-medium ">Velocidad:</span> ${speed} km/h</p>
					<p><span class="font-medium ">Batería:</span> ${battery} V</p>
					<p><span class="font-medium ">Bater&iacute;a dispositivo:</span> ${batteryDevice || 0} V</p>
					${vehicle.device_id ? `<p><span class=\"font-medium \">Device ID:</span> ${vehicle.device_id}</p>` : ''}
					<p><span class="font-medium ">Última actualización:</span> ${lastUpdate}</p>
					${
						vehicle.latitude && vehicle.longitude
							? `<p><span class=\"font-medium\">Coordenadas:</span> ${vehicle.latitude}, ${vehicle.longitude}</p>`
							: ''
					}
				</div>
			</div>
		`;
	}

	getStatusClasses(status) {
		switch (status) {
			case 'active':
				return 'bg-green-100 text-green-800';
			case 'inactive':
				return 'bg-red-100 text-red-800';
			case 'maintenance':
				return 'bg-yellow-100 text-yellow-800';
			default:
				return 'bg-gray-100 text-gray-800';
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
		if (markerData) {
			markerData.marker.setMap(null);
			this.markers.delete(id);
		}
	}

	clearAllMarkers() {
		// Safely remove all markers, handling different stored shapes
		this.markers.forEach((markerData) => {
			if (!markerData) return;
			// Vehicle markers stored as { marker, infoWindow }
			if (markerData.marker) {
				markerData.marker.setMap(null);
			} else if (typeof markerData.setMap === 'function') {
				// Direct marker instance (e.g., user-location)
				markerData.setMap(null);
			}
		});
		this.markers.clear();
	}

	// Agregar múltiples marcadores de vehículos
	addVehicleMarkers(vehicles) {
		if (!Array.isArray(vehicles)) return;

		vehicles.forEach((vehicle) => {
			this.addVehicleMarker(vehicle);
		});
	}

	// Actualizar marcador de vehículo existente
	updateVehicleMarker(vehicle) {
		const id = vehicle.id || vehicle.deviceId || vehicle.device_id;
		const existingMarkerData = this.markers.get(id);

		if (existingMarkerData) {
			// Actualizar posición
			const lat = vehicle.latitude || vehicle.lat;
			const lng = vehicle.longitude || vehicle.lng;

			if (lat && lng) {
				const newPosition = { lat: parseFloat(lat), lng: parseFloat(lng) };
				existingMarkerData.marker.setPosition(newPosition);

				// Actualizar contenido del info window
				existingMarkerData.infoWindow.setContent(this.createVehicleInfoContent(vehicle));

				// Determine icon URL
				const iconUrl =
					vehicle.icon_type && unitIcons[vehicle.icon_type]
						? unitIcons[vehicle.icon_type]
						: unitIcons['vehicle-car-sedan'];

				// Actualizar icono del marcador
				existingMarkerData.marker.setIcon({
					url: iconUrl,
					scaledSize: new this.google.maps.Size(40, 40),
					anchor: new this.google.maps.Point(20, 20)
				});
			}
		} else {
			// Si no existe, crear nuevo marcador
			this.addVehicleMarker(vehicle);
		}
	}

	centerOnVehicles(vehicles) {
		if (!vehicles.length || !this.map) return;

		const bounds = new this.google.maps.LatLngBounds();
		let hasValidCoordinates = false;

		vehicles.forEach((vehicle) => {
			const lat = vehicle.latitude || vehicle.lat;
			const lng = vehicle.longitude || vehicle.lng;

			if (lat && lng) {
				bounds.extend({ lat: parseFloat(lat), lng: parseFloat(lng) });
				hasValidCoordinates = true;
			}
		});

		if (hasValidCoordinates) {
			this.map.fitBounds(bounds);
		}
	}

	// Centrar en un vehículo específico
	centerOnVehicle(vehicle) {
		const lat = vehicle.latitude || vehicle.lat;
		const lng = vehicle.longitude || vehicle.lng;

		if (lat && lng && this.map) {
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

	drawTripPolyline(coordinates) {
		if (!this.map || !this.google) return;

		// Limpiar polilínea y marcadores existentes
		this.clearTripPolyline();

		if (!coordinates || coordinates.length === 0) return;

		const path = [];
		const bounds = new this.google.maps.LatLngBounds();

		coordinates.forEach((coord) => {
			const lat = parseFloat(coord.lat);
			const lng = parseFloat(coord.lng || coord.lon);
			const position = { lat, lng };

			path.push(position);
			bounds.extend(position);

			// Agregar marcadores para eventos de ignición
			if (coord.itemType === 'alert') {
				let iconUrl = null;

				if (coord.type === 'ignition_on') {
					iconUrl = '/marker/marker-power-on.png';
				} else if (coord.type === 'ignition_off') {
					iconUrl = '/marker/marker-power-off.png';
				}

				if (iconUrl) {
					const marker = new this.google.maps.Marker({
						position: position,
						map: this.map,
						icon: {
							url: iconUrl,
							scaledSize: new this.google.maps.Size(32, 32),
							anchor: new this.google.maps.Point(16, 16)
						},
						title: coord.type
					});
					this.tripMarkers.push(marker);
				}
			}
		});

		// Crear nueva polilínea
		this.currentPolyline = new this.google.maps.Polyline({
			path: path,
			geodesic: true,
			strokeColor: '#00FFFF', // Cyan neon
			strokeOpacity: 1.0,
			strokeWeight: 4,
			map: this.map
		});

		this.map.fitBounds(bounds);
	}

	clearTripPolyline() {
		if (this.currentPolyline) {
			this.currentPolyline.setMap(null);
			this.currentPolyline = null;
		}

		// Limpiar marcadores de viaje
		if (this.tripMarkers && this.tripMarkers.length > 0) {
			this.tripMarkers.forEach((marker) => marker.setMap(null));
			this.tripMarkers = [];
		}

		this.stopAnimation();
	}

	animateTrip(coordinates, totalDuration = 10000, onFinish = null) {
		if (!this.map || !this.google || !coordinates || coordinates.length < 2) return;

		this.stopAnimation();

		this.onFinish = onFinish;

		// Preparar path con lógica de clustering y tiempos
		const rawPath = coordinates.map((coord) => ({
			lat: parseFloat(coord.lat),
			lng: parseFloat(coord.lng || coord.lon)
		}));

		this.animationPath = this.prepareAnimationPath(rawPath, totalDuration);
		this.animationStartTime = performance.now();
		this.pausedTime = 0;
		this.isPaused = false;
		this.currentSegmentIndex = 0;

		// Crear marcador del vehículo si no existe
		if (!this.vehicleMarker) {
			this.vehicleMarker = new this.google.maps.Marker({
				map: this.map,
				icon: {
					url: unitIcons['vehicle-car-sedan'],
					scaledSize: new this.google.maps.Size(40, 40),
					anchor: new this.google.maps.Point(20, 20)
				},
				zIndex: 1000
			});
		} else {
			this.vehicleMarker.setMap(this.map);
		}

		// Posicionar al inicio
		if (this.animationPath.length > 0) {
			const startPos =
				this.animationPath[0].type === 'move'
					? this.animationPath[0].start
					: this.animationPath[0].position;
			this.vehicleMarker.setPosition(startPos);
		}

		this.animate(performance.now());
	}

	// Helper para calcular distancia Haversine entre dos puntos (en metros)
	haversineDistance(coords1, coords2) {
		const R = 6371e3; // metres
		const φ1 = (coords1.lat * Math.PI) / 180; // φ, λ in radians
		const φ2 = (coords2.lat * Math.PI) / 180;
		const Δφ = ((coords2.lat - coords1.lat) * Math.PI) / 180;
		const Δλ = ((coords2.lng - coords1.lng) * Math.PI) / 180;

		const a =
			Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
			Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		return R * c; // in metres
	}

	prepareAnimationPath(rawPath, totalDuration) {
		const segments = [];
		const STOP_THRESHOLD = 5; // metros
		const STOP_PAUSE_DURATION = 400; // ms

		let currentStop = null;

		// 1. Identificar segmentos (move vs stop)
		for (let i = 0; i < rawPath.length - 1; i++) {
			const p1 = rawPath[i];
			const p2 = rawPath[i + 1];
			const dist = this.haversineDistance(p1, p2);

			if (dist < STOP_THRESHOLD) {
				// Es un stop
				if (!currentStop) {
					currentStop = {
						type: 'stop',
						position: p1,
						duration: STOP_PAUSE_DURATION
					};
					segments.push(currentStop);
				}
				// Si ya estamos en un stop, simplemente lo extendemos (no hacemos nada visualmente extra)
			} else {
				// Es movimiento
				currentStop = null;
				segments.push({
					type: 'move',
					start: p1,
					end: p2,
					distance: dist,
					duration: 0 // Se calculará después
				});
			}
		}

		// 2. Calcular duración de segmentos de movimiento
		const totalMoveDistance = segments
			.filter((s) => s.type === 'move')
			.reduce((acc, s) => acc + s.distance, 0);

		const totalStopDuration = segments
			.filter((s) => s.type === 'stop')
			.reduce((acc, s) => acc + s.duration, 0);

		const availableMoveTime = Math.max(1000, totalDuration - totalStopDuration);

		segments.forEach((segment) => {
			if (segment.type === 'move') {
				// Asignar tiempo proporcional a la distancia
				segment.duration = (segment.distance / totalMoveDistance) * availableMoveTime;
			}
		});

		// 3. Calcular tiempos de inicio para cada segmento para facilitar la animación
		let accumulatedTime = 0;
		segments.forEach((segment) => {
			segment.startTime = accumulatedTime;
			accumulatedTime += segment.duration;
			segment.endTime = accumulatedTime;
		});

		this.totalAnimationTime = accumulatedTime;
		return segments;
	}

	animate(currentTime) {
		if (this.isPaused) {
			this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
			return;
		}

		const elapsed = currentTime - this.animationStartTime - this.pausedTime;

		if (elapsed >= this.totalAnimationTime) {
			// Fin de la animación
			const lastSegment = this.animationPath[this.animationPath.length - 1];
			const endPos = lastSegment.type === 'move' ? lastSegment.end : lastSegment.position;
			this.vehicleMarker.setPosition(endPos);
			this.isPaused = true;

			if (this.onFinish) {
				this.onFinish();
			}
			return;
		}

		// Encontrar segmento actual
		const segment = this.animationPath.find((s) => elapsed >= s.startTime && elapsed < s.endTime);

		if (segment) {
			if (segment.type === 'stop') {
				this.vehicleMarker.setPosition(segment.position);
			} else if (segment.type === 'move') {
				const segmentElapsed = elapsed - segment.startTime;
				const progress = segmentElapsed / segment.duration;

				// Interpolación simple (linear)
				// Podríamos agregar ease-in/out aquí si se desea
				const lat = segment.start.lat + (segment.end.lat - segment.start.lat) * progress;
				const lng = segment.start.lng + (segment.end.lng - segment.start.lng) * progress;

				this.vehicleMarker.setPosition({ lat, lng });
			}
		}

		this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
	}

	getInterpolatedPosition(progress) {
		// Deprecated by new animate logic
		return null;
	}

	pauseAnimation() {
		if (!this.isPaused && this.animationFrameId) {
			this.isPaused = true;
			this.lastPauseStart = performance.now();
		}
	}

	resumeAnimation() {
		if (this.isPaused) {
			this.isPaused = false;
			this.pausedTime += performance.now() - this.lastPauseStart;

			// Si ya había terminado, reiniciar
			const elapsed = performance.now() - this.animationStartTime - this.pausedTime;
			if (elapsed >= this.totalAnimationTime) {
				this.animationStartTime = performance.now();
				this.pausedTime = 0;
			}
		}
	}

	stopAnimation() {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
		if (this.vehicleMarker) {
			this.vehicleMarker.setMap(null);
		}
		this.isPaused = false;
		this.onFinish = null;
	}
}

export const mapService = new MapService();
