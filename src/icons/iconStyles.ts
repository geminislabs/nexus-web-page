function hexToRgb(hex: string) {
	const clean = hex.replace('#', '');
	const num = parseInt(clean, 16);

	return {
		r: (num >> 16) & 255,
		g: (num >> 8) & 255,
		b: num & 255
	};
}

function rgbToHex(r: number, g: number, b: number) {
	return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function luminance({ r, g, b }: { r: number; g: number; b: number }) {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function adjustColor(
	{ r, g, b }: { r: number; g: number; b: number },
	amount: number // positivo aclara, negativo oscurece
) {
	return {
		r: Math.min(255, Math.max(0, r + amount * 0.9)),
		g: Math.min(255, Math.max(0, g + amount)),
		b: Math.min(255, Math.max(0, b + amount * 1.1))
	};
}

export function deriveStrokeColor(fillHex: string): string {
	const rgb = hexToRgb(fillHex);
	const lum = luminance(rgb);

	let strokeRgb;

	if (lum > 185) {
		// 🔹 Color CLARO → oscurecer fuerte
		strokeRgb = adjustColor(rgb, -75);
	} else if (lum < 85) {
		// 🔹 Color OSCURO → aclarar moderado
		strokeRgb = adjustColor(rgb, 70);
	} else {
		// 🔹 Color MEDIO → oscurecer leve
		strokeRgb = adjustColor(rgb, -65);
	}

	// 🔹 Evitar blanco y negro puros
	strokeRgb = {
		r: Math.min(230, Math.max(20, strokeRgb.r)),
		g: Math.min(230, Math.max(20, strokeRgb.g)),
		b: Math.min(230, Math.max(20, strokeRgb.b))
	};

	return rgbToHex(strokeRgb.r, strokeRgb.g, strokeRgb.b);
}
