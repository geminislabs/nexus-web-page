import { cellToBoundary, polygonToCells } from 'h3-js';

const DEFAULT_DEBOUNCE_MS = 250;
const DEFAULT_MAX_CELLS = 2500;

class H3GridOverlayService {
	constructor() {
		this.map = null;
		this.google = null;
		/** Si es false, los hexágonos no capturan clicks */
		this._cellsClickable = true;
		this.visible = false;
		this.resolution = 8;
		/** @type {Set<string>} */
		this.selectedCells = new Set();
		this.polygons = new Map();
		this.maxCells = DEFAULT_MAX_CELLS;
		this.idleListener = null;
		this.onCellSelect = () => {};
		this.onCellsRendered = () => {};
		/** @type {'light' | 'dark'} */
		this.mapTheme = 'dark';
		/** @type {'default' | 'zoneCreate'} */
		this.selectionStyle = 'default';
		this.redrawDebounced = this.createDebounced(() => this.redraw(), DEFAULT_DEBOUNCE_MS);
	}

	attachMap(map, google) {
		this.detachMapListeners();
		this.map = map;
		this.google = google;

		if (!this.map) return;

		this.idleListener = this.map.addListener('idle', () => {
			if (this.visible) {
				this.redrawDebounced();
			}
		});
	}

	/**
	 * Ajusta contraste de la malla según tema del mapa.
	 * @param {'light' | 'dark'} theme
	 */
	setMapTheme(theme) {
		this.mapTheme = theme === 'light' ? 'light' : 'dark';
		if (this.visible) {
			this.redraw();
		}
	}

	/** @param {'default' | 'zoneCreate'} style */
	setSelectionStyle(style) {
		this.selectionStyle = style === 'zoneCreate' ? 'zoneCreate' : 'default';
		this.updateSelectionStyles();
	}

	getPalette() {
		if (this.selectionStyle === 'zoneCreate') {
			return {
				stroke: '#7dd3fc',
				fill: '#bae6fd',
				fillOpacity: 0.18,
				strokeOpacity: 0.75,
				selectedStroke: '#007AFF',
				selectedFill: '#007AFF',
				selectedFillOpacity: 0.32
			};
		}
		if (this.mapTheme === 'light') {
			return {
				stroke: '#0e7490',
				fill: '#0891b2',
				fillOpacity: 0.22,
				strokeOpacity: 0.95,
				selectedStroke: '#c2410c',
				selectedFill: '#ea580c',
				selectedFillOpacity: 0.35
			};
		}
		return {
			stroke: '#22D3EE',
			fill: '#06B6D4',
			fillOpacity: 0.14,
			strokeOpacity: 0.85,
			selectedStroke: '#F59E0B',
			selectedFill: '#F59E0B',
			selectedFillOpacity: 0.28
		};
	}

	setVisible(visible) {
		this.visible = visible;
		if (!visible) {
			this.clearPolygons();
			this.onCellsRendered(0);
			return;
		}
		this.redraw();
		requestAnimationFrame(() => this.redraw());
		setTimeout(() => this.redraw(), 120);
		setTimeout(() => this.redraw(), 400);
	}

	setResolution(resolution) {
		this.resolution = resolution;
		if (this.visible) {
			this.redraw();
		}
	}

	/**
	 * @param {string[] | Set<string> | null | undefined} indices
	 */
	setSelectedCells(indices) {
		this.selectedCells = new Set();
		if (indices instanceof Set) {
			indices.forEach((id) => this.selectedCells.add(id));
		} else if (Array.isArray(indices)) {
			indices.forEach((id) => this.selectedCells.add(id));
		}
		this.updateSelectionStyles();
	}

	setOnCellSelect(handler) {
		this.onCellSelect = typeof handler === 'function' ? handler : () => {};
	}

	setOnCellsRendered(handler) {
		this.onCellsRendered = typeof handler === 'function' ? handler : () => {};
	}

	/**
	 * Controla si la malla H3 intercepta clicks.
	 * @param {boolean} clickable
	 */
	setCellPolygonsClickable(clickable) {
		this._cellsClickable = !!clickable;
		this.polygons.forEach((polygon) => {
			polygon.setOptions({ clickable: this._cellsClickable });
		});
	}

	redraw() {
		if (!this.map || !this.google || !this.visible) return;

		const cellIds = this.computeVisibleCells();
		const visibleCellIds = new Set(cellIds);

		this.polygons.forEach((polygon, h3Index) => {
			if (!visibleCellIds.has(h3Index)) {
				polygon.setMap(null);
				this.polygons.delete(h3Index);
			}
		});

		cellIds.forEach((h3Index) => {
			if (!this.polygons.has(h3Index)) {
				const polygon = this.createPolygon(h3Index);
				this.polygons.set(h3Index, polygon);
			}
		});

		this.updateSelectionStyles();
		this.onCellsRendered(this.polygons.size);
	}

	computeVisibleCells() {
		const bounds = this.map?.getBounds();
		if (!bounds) return [];

		const sw = bounds.getSouthWest();
		const ne = bounds.getNorthEast();

		const viewportLoopGeoJson = [
			[sw.lng(), sw.lat()],
			[ne.lng(), sw.lat()],
			[ne.lng(), ne.lat()],
			[sw.lng(), ne.lat()],
			[sw.lng(), sw.lat()]
		];
		const viewportLoopLatLng = [
			[sw.lat(), sw.lng()],
			[sw.lat(), ne.lng()],
			[ne.lat(), ne.lng()],
			[ne.lat(), sw.lng()],
			[sw.lat(), sw.lng()]
		];

		let targetResolution = this.resolution;
		let cellIds = [];

		while (targetResolution >= 0) {
			try {
				cellIds = polygonToCells([viewportLoopGeoJson], targetResolution, true);
				if (!cellIds.length) {
					cellIds = polygonToCells([viewportLoopLatLng], targetResolution, false);
				}
			} catch (e) {
				console.warn('H3 polygonToCells:', e);
				cellIds = [];
			}
			if (cellIds.length <= this.maxCells || targetResolution === 0) {
				break;
			}
			targetResolution -= 1;
		}

		return cellIds;
	}

	createPolygon(h3Index) {
		const pal = this.getPalette();
		const vertices = cellToBoundary(h3Index).map(([lat, lng]) => ({ lat, lng }));
		const polygon = new this.google.maps.Polygon({
			paths: vertices,
			strokeColor: pal.stroke,
			strokeOpacity: pal.strokeOpacity,
			strokeWeight: this.mapTheme === 'light' ? 2 : 1,
			fillColor: pal.fill,
			fillOpacity: pal.fillOpacity,
			clickable: this._cellsClickable,
			zIndex: 180,
			map: this.map
		});

		polygon.addListener('click', () => {
			this.onCellSelect(h3Index);
		});

		return polygon;
	}

	updateSelectionStyles() {
		const pal = this.getPalette();
		this.polygons.forEach((polygon, h3Index) => {
			const isSelected = this.selectedCells.has(h3Index);
			polygon.setOptions({
				strokeColor: isSelected ? pal.selectedStroke : pal.stroke,
				strokeWeight: isSelected ? 3 : this.mapTheme === 'light' ? 2 : 1,
				fillColor: isSelected ? pal.selectedFill : pal.fill,
				fillOpacity: isSelected ? pal.selectedFillOpacity : pal.fillOpacity
			});
		});
	}

	clearPolygons() {
		this.polygons.forEach((polygon) => polygon.setMap(null));
		this.polygons.clear();
	}

	detachMapListeners() {
		if (this.idleListener) {
			this.idleListener.remove();
			this.idleListener = null;
		}
	}

	destroy() {
		this.detachMapListeners();
		this.clearPolygons();
		this.map = null;
		this.google = null;
		this.selectedCells = new Set();
		this.onCellsRendered(0);
	}

	createDebounced(fn, delayMs) {
		let timeoutId = null;
		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			timeoutId = setTimeout(() => {
				timeoutId = null;
				fn();
			}, delayMs);
		};
	}
}

export const h3GridOverlayService = new H3GridOverlayService();
