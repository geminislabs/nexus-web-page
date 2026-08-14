import { unitIcons } from '$lib/data/unitIcons';
import { vehicleColors } from '$lib/data/vehicleColors';

const DEFAULT_PROFILE_COLOR = '#334155';
export const VEHICLE_MARKER_SIZE = 84;
export const VEHICLE_MARKER_LABEL_EXTRA = 20;
const VEHICLE_SIZE = 34;
const BADGE_RADIUS = 5;
const CENTER = VEHICLE_MARKER_SIZE / 2;
const INNER_RING_RADIUS = 27;
const OUTER_RING_RADIUS = 32;
const PULSE_RING_RADIUS = 36;

/** @type {Map<string, Promise<HTMLImageElement>>} */
const imageCache = new Map();
/** @type {Map<string, string>} */
const dataUrlCache = new Map();

export function getStatusHexColor(status) {
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

/** @param {{ color?: string | null, profile_color_hex?: string | null, profile_color?: string | null }} [vehicle] */
export function resolveProfileColorHex(vehicle) {
	if (vehicle?.profile_color_hex) return vehicle.profile_color_hex;
	if (vehicle?.profile_color?.startsWith?.('#')) return vehicle.profile_color;
	const slug = vehicle?.color;
	if (slug) {
		const match = vehicleColors.find((c) => c.slug === slug);
		if (match) return match.hex;
	}
	return DEFAULT_PROFILE_COLOR;
}

/** @param {string} src */
function loadImage(src) {
	if (!imageCache.has(src)) {
		imageCache.set(
			src,
			new Promise((resolve, reject) => {
				const img = new Image();
				img.crossOrigin = 'anonymous';
				img.onload = () => resolve(img);
				img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
				img.src = src;
			})
		);
	}
	return imageCache.get(src);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} radius
 * @param {number} lineWidth
 * @param {string} color
 * @param {number} rotation
 * @param {number[]} dash
 */
function drawRotatingRing(ctx, radius, lineWidth, color, rotation, dash) {
	ctx.save();
	ctx.translate(CENTER, CENTER);
	ctx.rotate(rotation);
	ctx.translate(-CENTER, -CENTER);
	ctx.setLineDash(dash);
	ctx.lineDashOffset = 0;
	ctx.beginPath();
	ctx.arc(CENTER, CENTER, radius, 0, Math.PI * 2);
	ctx.strokeStyle = color;
	ctx.lineWidth = lineWidth;
	ctx.lineCap = 'round';
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ isHighlighted?: boolean, pulsePhase?: number, ringRotation?: number }} [opts]
 */
function drawGuideRings(ctx, opts = {}) {
	const { isHighlighted = false, pulsePhase = 0, ringRotation = 0 } = opts;

	ctx.save();
	ctx.shadowColor = 'rgba(34, 211, 238, 0.55)';
	ctx.shadowBlur = 6;

	drawRotatingRing(
		ctx,
		OUTER_RING_RADIUS,
		1.75,
		'rgba(34, 211, 238, 0.55)',
		ringRotation,
		[18, 10]
	);
	drawRotatingRing(
		ctx,
		INNER_RING_RADIUS,
		2,
		'rgba(34, 211, 238, 0.82)',
		ringRotation * 1.15,
		[14, 8]
	);

	if (isHighlighted) {
		const scale = 1 + pulsePhase * 0.18;
		const alpha = 0.65 - pulsePhase * 0.45;
		drawRotatingRing(
			ctx,
			PULSE_RING_RADIUS * scale,
			2,
			`rgba(6, 182, 212, ${Math.max(0.15, alpha)})`,
			ringRotation * 0.9,
			[12, 9]
		);
	}

	ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {string} colorHex
 * @param {number} x
 * @param {number} y
 * @param {number} size
 */
function drawColoredVehicle(ctx, img, colorHex, x, y, size) {
	const tmp = document.createElement('canvas');
	tmp.width = size;
	tmp.height = size;
	const tctx = tmp.getContext('2d');
	if (!tctx) return;

	tctx.fillStyle = colorHex;
	tctx.fillRect(0, 0, size, size);
	tctx.globalCompositeOperation = 'destination-in';
	tctx.drawImage(img, 0, 0, size, size);

	ctx.drawImage(tmp, x, y, size, size);
	ctx.globalCompositeOperation = 'multiply';
	ctx.globalAlpha = 0.88;
	ctx.drawImage(img, x, y, size, size);
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = 'source-over';
}

/**
 * Icono de unidad teñido con el color de perfil (mismo algoritmo que el marcador).
 * Funciona en fondos claros y oscuros (no depende de mix-blend CSS).
 * @param {string} src
 * @param {string} colorHex
 * @param {number} [size=128]
 * @returns {Promise<string>}
 */
export async function buildColoredUnitIconDataUrl(src, colorHex, size = 128) {
	const hex = colorHex || DEFAULT_PROFILE_COLOR;
	const cacheKey = `unit-icon|${src}|${hex}|${size}`;
	if (dataUrlCache.has(cacheKey)) return dataUrlCache.get(cacheKey);

	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';

	try {
		const img = await loadImage(src);
		drawColoredVehicle(ctx, img, hex, 0, 0, size);
	} catch {
		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
		ctx.fillStyle = hex;
		ctx.fill();
	}

	const url = canvas.toDataURL('image/png');
	dataUrlCache.set(cacheKey, url);
	return url;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} statusColor
 * @param {boolean} visible
 */
function drawStatusBadge(ctx, statusColor, visible) {
	const cx = VEHICLE_MARKER_SIZE - 10;
	const cy = 10;
	ctx.globalAlpha = visible ? 1 : 0.2;
	ctx.beginPath();
	ctx.arc(cx, cy, BADGE_RADIUS, 0, Math.PI * 2);
	ctx.fillStyle = statusColor;
	ctx.fill();
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.globalAlpha = 1;
}

/**
 * @param {import('$lib/stores/vehicleStore.js').Vehicle | Record<string, unknown>} vehicle
 * @param {boolean | { badgeVisible?: boolean, showRings?: boolean, isHighlighted?: boolean, pulsePhase?: number, ringRotation?: number, showNameLabel?: boolean, labelText?: string }} [options]
 */
export async function buildVehicleMarkerDataUrl(vehicle, options = true) {
	const opts =
		typeof options === 'boolean'
			? {
					badgeVisible: options,
					showRings: true,
					isHighlighted: false,
					pulsePhase: 0,
					ringRotation: 0,
					showNameLabel: false,
					labelText: ''
				}
			: {
					badgeVisible: options.badgeVisible !== false,
					showRings: options.showRings !== false,
					isHighlighted: options.isHighlighted === true,
					pulsePhase: Number(options.pulsePhase) || 0,
					ringRotation: Number(options.ringRotation) || 0,
					showNameLabel: options.showNameLabel === true,
					labelText: String(options.labelText || '')
				};

	const iconType =
		/** @type {string} */ (vehicle?.icon_type || vehicle?.iconType) || 'vehicle-car-sedan';
	const src = unitIcons[iconType] || unitIcons['vehicle-car-sedan'];
	const profileColor = resolveProfileColorHex(vehicle);
	const statusColor = getStatusHexColor(/** @type {string | undefined} */ (vehicle?.status));

	const pulseBucket = opts.isHighlighted ? Math.round(opts.pulsePhase * 10) : 0;
	const rotationBucket = Math.round(opts.ringRotation * 40);
	const labelKey = opts.showNameLabel ? opts.labelText : '';
	const cacheKey = `${iconType}|${profileColor}|${statusColor}|${opts.badgeVisible}|${opts.showRings}|${opts.isHighlighted}|${pulseBucket}|${rotationBucket}|${labelKey}`;
	if (
		!opts.isHighlighted &&
		opts.ringRotation === 0 &&
		!opts.showNameLabel &&
		dataUrlCache.has(cacheKey)
	) {
		return dataUrlCache.get(cacheKey);
	}

	const canvas = document.createElement('canvas');
	canvas.width = VEHICLE_MARKER_SIZE;
	canvas.height = opts.showNameLabel
		? VEHICLE_MARKER_SIZE + VEHICLE_MARKER_LABEL_EXTRA
		: VEHICLE_MARKER_SIZE;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';

	if (opts.showRings) {
		drawGuideRings(ctx, {
			isHighlighted: opts.isHighlighted,
			pulsePhase: opts.pulsePhase,
			ringRotation: opts.ringRotation
		});
	}

	const offset = (VEHICLE_MARKER_SIZE - VEHICLE_SIZE) / 2;

	try {
		const img = await loadImage(src);
		drawColoredVehicle(ctx, img, profileColor, offset, offset, VEHICLE_SIZE);
	} catch {
		ctx.beginPath();
		ctx.arc(CENTER, CENTER, 14, 0, Math.PI * 2);
		ctx.fillStyle = profileColor;
		ctx.fill();
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 2;
		ctx.stroke();
	}

	drawStatusBadge(ctx, statusColor, opts.badgeVisible);

	if (opts.showNameLabel && opts.labelText) {
		drawUnitNameLabel(ctx, String(opts.labelText));
	}

	const url = canvas.toDataURL('image/png');
	if (!opts.isHighlighted && opts.ringRotation === 0 && !opts.showNameLabel) {
		dataUrlCache.set(cacheKey, url);
	}
	return url;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} name
 */
function drawUnitNameLabel(ctx, name) {
	const text = name.length > 16 ? `${name.slice(0, 15)}…` : name;
	ctx.save();
	ctx.font = 'bold 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	ctx.fillStyle = '#ffffff';
	ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
	ctx.shadowBlur = 5;
	ctx.shadowOffsetY = 1;
	ctx.fillText(text, CENTER, VEHICLE_MARKER_SIZE + 3);
	ctx.restore();
}

/** @param {{ showNameLabel?: boolean }} [opts] */
export function getVehicleMarkerMetrics(opts = {}) {
	const showNameLabel = opts.showNameLabel === true;
	return {
		width: VEHICLE_MARKER_SIZE,
		height: showNameLabel ? VEHICLE_MARKER_SIZE + VEHICLE_MARKER_LABEL_EXTRA : VEHICLE_MARKER_SIZE,
		anchorX: VEHICLE_MARKER_SIZE / 2,
		anchorY: VEHICLE_MARKER_SIZE / 2
	};
}
