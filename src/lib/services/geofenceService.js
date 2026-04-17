import * as turf from '@turf/turf';
import { geofenceActions } from '$lib/stores/geofenceStore.js';
import { toPostgresGeofenceRow } from '$lib/utils/geofenceDbMapper.js';
import { h3GridOverlayService } from '$lib/services/h3GridOverlayService.js';

function createId(prefix = 'gf') {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

class GeofenceService {
	constructor() {
		this.map = null;
		this.google = null;
		this.overlays = new Map();
		this.drawKind = 'polygon';
		this.pending = null;
		this.onPending = () => {};
		this.onCreated = () => {};
		/** @param {string} _id */
		this.onOverlayClick = (_id) => {};
		/** @type {Map<string, google.maps.MapsEventListener>} */
		this._overlayClickListeners = new Map();
		this._drawingColor = '#10B981';
		this._twoPointClickListener = null;
		this._endpointMarkers = [];
		this._tpStart = null;

		/** @type {google.maps.MapsEventListener[]} */
		this._drawListeners = [];
		/** @type {google.maps.drawing.DrawingManager | null} */
		this._drawingManager = null;
	}

	attachMap(map, google) {
		this.map = map;
		this.google = google;
	}

	setOnPending(handler) {
		this.onPending = typeof handler === 'function' ? handler : () => {};
	}

	setOnCreated(handler) {
		this.onCreated = typeof handler === 'function' ? handler : () => {};
	}

	/** Clic en una geocerca ya guardada en el mapa (overlay por `id`). */
	setOnOverlayClick(handler) {
		this.onOverlayClick = typeof handler === 'function' ? handler : () => {};
	}

	_unbindOverlayClick(id) {
		const h = this._overlayClickListeners.get(id);
		if (h && this.google) {
			this.google.maps.event.removeListener(h);
		}
		this._overlayClickListeners.delete(id);
	}

	_bindOverlayClick(overlay, id) {
		if (!this.google || !overlay) return;
		this._unbindOverlayClick(id);
		const h = this.google.maps.event.addListener(overlay, 'click', () => {
			this.onOverlayClick(id);
		});
		this._overlayClickListeners.set(id, h);
	}

	_addDrawListener(map, eventName, handler) {
		const h = map.addListener(eventName, handler);
		this._drawListeners.push(h);
		return h;
	}

	_clearDrawListeners() {
		if (this.google && this._drawListeners.length) {
			this._drawListeners.forEach((h) => this.google.maps.event.removeListener(h));
		}
		this._drawListeners = [];
	}

	_abortCustomMapDrawing() {
		this._clearDrawListeners();
		if (this._drawingManager) {
			this._drawingManager.setDrawingMode(null);
		}
		if (this.map) {
			this.map.setOptions({ disableDoubleClickZoom: false });
		}
		h3GridOverlayService.setCellPolygonsClickable(true);
	}

	/**
	 * Polígono, círculo y rectángulo con la API estándar.
	 * @returns {google.maps.drawing.DrawingManager | null}
	 */
	_ensureDrawingManager() {
		if (!this.google || !this.map) return null;
		if (this._drawingManager) return this._drawingManager;

		const style = this.getPolygonStyle(this._drawingColor);
		const dm = new this.google.maps.drawing.DrawingManager({
			map: this.map,
			drawingMode: null,
			drawingControl: false,
			polygonOptions: { ...style },
			circleOptions: { ...style },
			rectangleOptions: { ...style }
		});

		this.google.maps.event.addListener(dm, 'overlaycomplete', (e) => {
			const Ov = this.google.maps.drawing.OverlayType;
			let typeStr = null;
			if (e.type === Ov.POLYGON) typeStr = 'polygon';
			else if (e.type === Ov.CIRCLE) typeStr = 'circle';
			else if (e.type === Ov.RECTANGLE) typeStr = 'rectangle';
			else {
				e.overlay?.setMap?.(null);
				return;
			}
			dm.setDrawingMode(null);
			this._emitDraftComplete(typeStr, e.overlay);
		});

		this._drawingManager = dm;
		return dm;
	}

	_emitDraftComplete(type, overlay) {
		const id = createId();
		const drawKind = this.drawKind;
		this.pending = { id, type, overlay, drawKind };

		this._abortCustomMapDrawing();

		const geofence = {
			id,
			type,
			geometry: this.serializeGeometry(type, overlay),
			drawKind
		};

		this.onPending(geofence);
	}

	_geofencePinIcon(color, glyph = '') {
		const safeGlyph =
			glyph && /^[A-Za-z0-9]$/.test(glyph)
				? `<text x="16" y="19" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="700" font-family="system-ui,sans-serif">${glyph}</text>`
				: '';
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path fill="${color}" stroke="#ffffff" stroke-width="2" d="M16 2C9.4 2 4 7.4 4 14c0 6.5 10.2 19.3 11.3 20.7.4.5 1 .5 1.4 0C17.8 33.3 28 20.5 28 14 28 7.4 22.6 2 16 2z"/><circle cx="16" cy="14" r="4.5" fill="#ffffff"/>${safeGlyph}</svg>`;
		return {
			url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
			scaledSize: new this.google.maps.Size(32, 40),
			anchor: new this.google.maps.Point(16, 40)
		};
	}

	_createGeofencePointMarkerAt(latLng, color) {
		return new this.google.maps.Marker({
			map: this.map,
			position: latLng,
			icon: this._geofencePinIcon(color),
			zIndex: 2500
		});
	}

	/**
	 * @returns {boolean} false si el mapa no está listo o el tipo no es dibujable
	 */
	startDrawing(type) {
		if (!this.google || !this.map) return false;
		this.drawKind = type;
		this.setDrawingManagerColor(this._drawingColor);

		if (type === 'polyline' || type === 'corridor') {
			this._abortCustomMapDrawing();
			this._beginTwoPointRoute(type);
			h3GridOverlayService.setCellPolygonsClickable(false);
			return true;
		}

		this._abortTwoPointRoute();
		this._abortCustomMapDrawing();

		if (type === 'polygon' || type === 'circle' || type === 'rectangle') {
			const dm = this._ensureDrawingManager();
			if (!dm) return false;
			const Ov = this.google.maps.drawing.OverlayType;
			const modes = {
				polygon: Ov.POLYGON,
				circle: Ov.CIRCLE,
				rectangle: Ov.RECTANGLE
			};
			dm.setDrawingMode(modes[type]);
			h3GridOverlayService.setCellPolygonsClickable(false);
			return true;
		}

		const ok = this._beginCustomOverlayDraw(type);
		if (ok) h3GridOverlayService.setCellPolygonsClickable(false);
		return ok;
	}

	/**
	 * @returns {boolean}
	 */
	_beginCustomOverlayDraw(type) {
		this.map.setOptions({ disableDoubleClickZoom: true });

		switch (type) {
			case 'marker':
				this._addDrawListener(this.map, 'click', (e) => {
					const latLng = e.latLng;
					if (!latLng) return;
					const marker = this._createGeofencePointMarkerAt(latLng, this._drawingColor);
					this._emitDraftComplete('marker', marker);
				});
				return true;
			default:
				this._abortCustomMapDrawing();
				return false;
		}
	}

	_beginTwoPointRoute(drawKind) {
		this._abortTwoPointRoute();
		this.drawKind = drawKind;

		this._twoPointClickListener = this.map.addListener('click', (e) => {
			const latLng = e.latLng;
			if (!latLng) return;

			if (!this._tpStart) {
				this._tpStart = latLng;
				this._endpointMarkers.push(this._createEndpointMarker(latLng, 'start'));
				return;
			}

			const end = latLng;
			this._endpointMarkers.push(this._createEndpointMarker(end, 'end'));

			const path = [this._tpStart, end];
			const overlay = new this.google.maps.Polyline({
				path,
				map: this.map,
				...this.getPolylineStyle(this._drawingColor)
			});

			const id = createId();
			if (this._twoPointClickListener) {
				this.google.maps.event.removeListener(this._twoPointClickListener);
				this._twoPointClickListener = null;
			}
			this._tpStart = null;

			this.pending = { id, type: 'polyline', overlay, drawKind };

			const geofence = {
				id,
				type: 'polyline',
				geometry: this.serializeGeometry('polyline', overlay),
				drawKind
			};

			h3GridOverlayService.setCellPolygonsClickable(true);

			geofenceActions.stopDrawing();
			this.onPending(geofence);
		});
	}

	_createEndpointMarker(latLng, role) {
		const isStart = role === 'start';
		return new this.google.maps.Marker({
			map: this.map,
			position: latLng,
			icon: this._geofencePinIcon(isStart ? '#16a34a' : '#dc2626', isStart ? 'A' : 'B'),
			zIndex: 3000,
			title: isStart ? 'Inicio' : 'Fin'
		});
	}

	_abortTwoPointRoute() {
		if (this._twoPointClickListener && this.google) {
			this.google.maps.event.removeListener(this._twoPointClickListener);
			this._twoPointClickListener = null;
		}
		this._tpStart = null;
		this._clearEndpointMarkers();
		h3GridOverlayService.setCellPolygonsClickable(true);
	}

	_clearEndpointMarkers() {
		this._endpointMarkers.forEach((m) => m?.setMap?.(null));
		this._endpointMarkers = [];
	}

	setDrawingManagerColor(color) {
		const raw = typeof color === 'string' ? color.trim() : '';
		const c = raw.startsWith('#') && raw.length >= 4 ? raw : '#10B981';
		this._drawingColor = c;
		if (this._drawingManager) {
			const style = this.getPolygonStyle(c);
			this._drawingManager.setOptions({
				polygonOptions: { ...style },
				circleOptions: { ...style },
				rectangleOptions: { ...style }
			});
		}
	}

	stopDrawing() {
		this._abortCustomMapDrawing();
		if (!this.pending) {
			this._abortTwoPointRoute();
		}
	}

	cancelPending() {
		if (!this.pending?.overlay) {
			this.pending = null;
			this._clearEndpointMarkers();
			return;
		}
		const o = this.pending.overlay;
		o.setMap?.(null);
		this.pending = null;
		this._clearEndpointMarkers();
	}

	confirmPending(details) {
		if (!this.pending?.overlay || !this.google) return;

		const { id, type, overlay } = this.pending;
		const drawKind = this.pending.drawKind;
		const color = details.color || '#10B981';

		let finalOverlay = overlay;
		let finalType = type;
		let geometry;

		if (type === 'polyline' && drawKind === 'corridor') {
			const width = Number(details.corridorWidthMeters);
			let usedCorridor = false;
			if (Number.isFinite(width) && width > 0) {
				const pathArr = overlay.getPath().getArray();
				const coords = pathArr.map((p) => [p.lng(), p.lat()]);
				if (coords.length >= 2) {
					try {
						const line = turf.lineString(coords);
						const buffered = turf.buffer(line, width, { units: 'meters' });
						const ring = buffered?.geometry?.coordinates?.[0];
						if (ring?.length) {
							const path = ring.map(([lng, lat]) => ({ lat, lng }));
							overlay.setMap(null);
							finalOverlay = new this.google.maps.Polygon({
								map: this.map,
								paths: path,
								...this.getPolygonStyle(color)
							});
							finalType = 'corridor';
							geometry = { bufferMeters: width, coordinates: path };
							usedCorridor = true;
						}
					} catch (e) {
						console.warn('Corredor: buffer Turf falló, se guarda como ruta.', e);
					}
				}
			}
			if (!usedCorridor) {
				console.warn('Corredor: usando polilínea (ancho inválido o buffer vacío).');
				this.applyOverlayStyle(overlay, 'polyline', color);
				geometry = this.serializeGeometry('polyline', overlay);
				finalType = 'polyline';
			}
		} else {
			this.applyOverlayStyle(overlay, type === 'corridor' ? 'polygon' : type, color);
			geometry = this.serializeGeometry(type, overlay);
		}

		const geofence = {
			id,
			type: finalType,
			name: details.name?.trim() || `Geocerca ${finalType}`,
			color,
			metadata: details.metadata && typeof details.metadata === 'object' ? details.metadata : {},
			createdAt: new Date().toISOString(),
			geometry
		};

		geofence.dbRow = toPostgresGeofenceRow(geofence, '');

		this.overlays.set(id, finalOverlay);
		this._bindOverlayClick(finalOverlay, id);
		this.pending = null;
		this._clearEndpointMarkers();
		this.onCreated(geofence);
	}

	applyGeofenceColor(id, color, storedType) {
		const overlay = this.overlays.get(id);
		if (!overlay || !this.google) return;
		const t =
			storedType === 'corridor'
				? 'polygon'
				: storedType === 'polyline'
					? 'polyline'
					: storedType === 'marker'
						? 'marker'
						: 'polygon';
		this.applyOverlayStyle(overlay, t, color);
	}

	clearAll() {
		this._abortTwoPointRoute();
		this._abortCustomMapDrawing();
		this.cancelPending();
		this._overlayClickListeners.forEach((h) => {
			if (this.google) this.google.maps.event.removeListener(h);
		});
		this._overlayClickListeners.clear();
		this.overlays.forEach((overlay) => overlay.setMap?.(null));
		this.overlays.clear();
	}

	removeById(id) {
		const overlay = this.overlays.get(id);
		if (!overlay) return;
		this._unbindOverlayClick(id);
		overlay.setMap?.(null);
		this.overlays.delete(id);
	}

	destroy() {
		this.clearAll();
		if (this._drawingManager) {
			this._drawingManager.setMap(null);
			this._drawingManager = null;
		}
		this.map = null;
		this.google = null;
	}

	_latLngFromOverlay(overlay) {
		const pos = overlay.getPosition?.();
		if (!pos) return null;
		return { lat: pos.lat(), lng: pos.lng() };
	}

	serializeGeometry(type, overlay) {
		if (type === 'circle') {
			const center = overlay.getCenter();
			return {
				center: { lat: center.lat(), lng: center.lng() },
				radiusMeters: overlay.getRadius()
			};
		}
		if (type === 'rectangle') {
			const bounds = overlay.getBounds();
			const ne = bounds.getNorthEast();
			const sw = bounds.getSouthWest();
			return {
				northEast: { lat: ne.lat(), lng: ne.lng() },
				southWest: { lat: sw.lat(), lng: sw.lng() }
			};
		}
		if (type === 'polyline') {
			const path = overlay.getPath().getArray();
			return { coordinates: path.map((p) => ({ lat: p.lat(), lng: p.lng() })) };
		}
		if (type === 'marker') {
			const pos = this._latLngFromOverlay(overlay);
			return pos ? { position: pos } : {};
		}
		const path = overlay.getPath().getArray();
		return { coordinates: path.map((p) => ({ lat: p.lat(), lng: p.lng() })) };
	}

	applyOverlayStyle(overlay, type, color) {
		if (type === 'polyline') {
			overlay.setOptions(this.getPolylineStyle(color));
			return;
		}
		if (type === 'marker') {
			overlay.setIcon(this._geofencePinIcon(color));
			return;
		}
		overlay.setOptions(this.getPolygonStyle(color));
	}

	getPolygonStyle(color) {
		return {
			fillColor: color,
			fillOpacity: 0.2,
			strokeColor: color,
			strokeOpacity: 0.95,
			strokeWeight: 2,
			clickable: true,
			editable: false,
			draggable: false
		};
	}

	getPolylineStyle(color) {
		return {
			strokeColor: color,
			strokeOpacity: 0.95,
			strokeWeight: 4,
			clickable: true,
			editable: false,
			draggable: false,
			geodesic: true
		};
	}

	restoreOverlays(items) {
		if (!this.map || !this.google) return;
		items.forEach((item) => {
			if (!item?.id || !item?.type || !item?.geometry) return;
			const color = item.color || '#10B981';
			let overlay = null;

			if (item.type === 'circle' && item.geometry.center) {
				overlay = new this.google.maps.Circle({
					map: this.map,
					center: item.geometry.center,
					radius: item.geometry.radiusMeters,
					...this.getPolygonStyle(color)
				});
			} else if (item.type === 'rectangle' && item.geometry.northEast && item.geometry.southWest) {
				overlay = new this.google.maps.Rectangle({
					map: this.map,
					bounds: new this.google.maps.LatLngBounds(
						item.geometry.southWest,
						item.geometry.northEast
					),
					...this.getPolygonStyle(color)
				});
			} else if (item.type === 'polyline' && item.geometry.coordinates?.length) {
				overlay = new this.google.maps.Polyline({
					map: this.map,
					path: item.geometry.coordinates,
					...this.getPolylineStyle(color)
				});
			} else if (item.type === 'marker' && item.geometry.position) {
				const p = item.geometry.position;
				const lat = typeof p.lat === 'function' ? p.lat() : Number(p.lat);
				const lng = typeof p.lng === 'function' ? p.lng() : Number(p.lng);
				overlay = this._createGeofencePointMarkerAt(new this.google.maps.LatLng(lat, lng), color);
			} else if (
				(item.type === 'corridor' || item.type === 'polygon') &&
				item.geometry.coordinates?.length
			) {
				overlay = new this.google.maps.Polygon({
					map: this.map,
					paths: item.geometry.coordinates,
					...this.getPolygonStyle(color)
				});
			}

			if (overlay) {
				this.overlays.set(item.id, overlay);
				this._bindOverlayClick(overlay, item.id);
			}
		});
	}
}

export const geofenceService = new GeofenceService();
