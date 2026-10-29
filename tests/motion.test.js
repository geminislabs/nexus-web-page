import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

const reduced = { current: false };
vi.mock('svelte/motion', () => ({ prefersReducedMotion: reduced }));
vi.mock('$app/environment', () => ({ browser: true }));

describe('motion', () => {
	beforeEach(() => {
		reduced.current = false;
	});

	it('staggerDelay escalona por pasos y se topa', async () => {
		const { staggerDelay } = await import('../src/lib/motion/index.js');
		expect(staggerDelay(0)).toBe(0);
		expect(staggerDelay(3)).toBe(105);
		expect(staggerDelay(50)).toBe(8 * 35);
		expect(staggerDelay(2, { step: 50, max: 1 })).toBe(50);
		expect(staggerDelay(-4)).toBe(0);
		expect(staggerDelay(Number.NaN)).toBe(0);
	});

	it('motionDuration devuelve 0 con movimiento reducido', async () => {
		const { motionDuration } = await import('../src/lib/motion/index.js');
		expect(motionDuration(300)).toBe(300);
		reduced.current = true;
		expect(motionDuration(300)).toBe(0);
	});

	it('rise y softFade se apagan con movimiento reducido', async () => {
		const { rise, softFade } = await import('../src/lib/motion/index.js');
		const node = document.createElement('div');
		const normal = rise(node, { delay: 70 });
		expect(normal.delay).toBe(70);
		expect(normal.duration).toBeGreaterThan(0);
		expect(softFade(node).duration).toBeGreaterThan(0);

		reduced.current = true;
		expect(rise(node, { delay: 70 })).toEqual({ delay: 0, duration: 0 });
		expect(softFade(node)).toEqual({ delay: 0, duration: 0 });
	});
});

describe('themeReveal', () => {
	/** @type {any} */
	const doc = document;

	beforeEach(() => {
		vi.resetModules();
		reduced.current = false;
		localStorage.getItem.mockReturnValue(null);
		window.innerWidth = 1000;
		window.innerHeight = 800;
	});

	afterEach(() => {
		delete doc.startViewTransition;
	});

	it('revealOrigin usa el puntero, o el centro del botón si vino del teclado', async () => {
		const { revealOrigin } = await import('../src/lib/motion/themeReveal.js');
		expect(revealOrigin(/** @type {any} */ ({ detail: 1, clientX: 40, clientY: 60 }))).toEqual({
			x: 40,
			y: 60
		});

		const button = {
			getBoundingClientRect: () => ({ left: 100, top: 20, width: 40, height: 20 })
		};
		expect(
			revealOrigin(
				/** @type {any} */ ({ detail: 0, clientX: 0, clientY: 0, currentTarget: button })
			)
		).toEqual({ x: 120, y: 30 });

		expect(revealOrigin(undefined)).toEqual({ x: 500, y: 400 });
	});

	it('revealRadius cubre la esquina más lejana', async () => {
		const { revealRadius } = await import('../src/lib/motion/themeReveal.js');
		expect(revealRadius(0, 0)).toBeCloseTo(Math.hypot(1000, 800));
		expect(revealRadius(500, 400)).toBeCloseTo(Math.hypot(500, 400));
	});

	it('sin View Transitions cambia el tema al instante', async () => {
		const { setThemeWithReveal } = await import('../src/lib/motion/themeReveal.js');
		const { theme } = await import('../src/lib/stores/themeStore.js');
		setThemeWithReveal('light');
		expect(get(theme)).toBe('light');
	});

	it('no hace nada si el tema ya es el pedido', async () => {
		doc.startViewTransition = vi.fn();
		const { setThemeWithReveal } = await import('../src/lib/motion/themeReveal.js');
		const { theme } = await import('../src/lib/stores/themeStore.js');
		setThemeWithReveal(get(theme));
		expect(doc.startViewTransition).not.toHaveBeenCalled();
	});

	it('con View Transitions anima un círculo desde el clic', async () => {
		const animate = vi.fn();
		document.documentElement.animate = animate;
		/** @type {(v?: unknown) => void} */
		let finish = () => {};
		const finished = new Promise((r) => (finish = r));
		doc.startViewTransition = vi.fn((cb) => {
			const done = cb();
			return { ready: done.then(() => undefined), finished };
		});
		const { toggleThemeWithReveal } = await import('../src/lib/motion/themeReveal.js');
		const { theme } = await import('../src/lib/stores/themeStore.js');
		const before = get(theme);

		toggleThemeWithReveal(/** @type {any} */ ({ detail: 1, clientX: 10, clientY: 20 }));
		// La regla CSS que apaga el fundido sólo aplica mientras dura el cambio.
		expect(document.documentElement.classList.contains('theme-reveal')).toBe(true);
		await vi.waitFor(() => expect(animate).toHaveBeenCalled());
		finish();
		await vi.waitFor(() =>
			expect(document.documentElement.classList.contains('theme-reveal')).toBe(false)
		);

		expect(get(theme)).not.toBe(before);
		const [keyframes, options] = animate.mock.calls[0];
		expect(keyframes.clipPath[0]).toBe('circle(0px at 10px 20px)');
		expect(options.pseudoElement).toBe('::view-transition-new(root)');
	});

	it('con movimiento reducido no usa View Transitions', async () => {
		reduced.current = true;
		doc.startViewTransition = vi.fn();
		const { toggleThemeWithReveal } = await import('../src/lib/motion/themeReveal.js');
		const { theme } = await import('../src/lib/stores/themeStore.js');
		const before = get(theme);
		toggleThemeWithReveal();
		expect(doc.startViewTransition).not.toHaveBeenCalled();
		expect(get(theme)).not.toBe(before);
	});
});

describe('viewEnter y flipList', () => {
	beforeEach(() => {
		reduced.current = false;
	});

	it('viewEnter enfoca y sube; con movimiento reducido no anima', async () => {
		const { viewEnter } = await import('../src/lib/motion/index.js');
		const node = document.createElement('div');
		const t = /** @type {any} */ (viewEnter(node));
		expect(t.duration).toBeGreaterThan(0);
		expect(t.css(0, 1)).toBe('opacity: 0; filter: blur(6px); transform: translateY(6px);');
		expect(t.css(1, 0)).toBe('opacity: 1; filter: blur(0px); transform: translateY(0px);');

		reduced.current = true;
		expect(viewEnter(node)).toEqual({ delay: 0, duration: 0 });
	});

	it('flipList dura 0 con movimiento reducido', async () => {
		const { flipList } = await import('../src/lib/motion/index.js');
		const node = document.createElement('li');
		const rect = /** @type {DOMRect} */ ({ left: 0, top: 0, width: 10, height: 10 });
		const moved = /** @type {DOMRect} */ ({ left: 0, top: 40, width: 10, height: 10 });
		expect(flipList(node, { from: moved, to: rect }).duration).toBeGreaterThan(0);
		reduced.current = true;
		expect(flipList(node, { from: moved, to: rect }).duration).toBe(0);
	});
});

describe('pop y dialogScale', () => {
	beforeEach(() => {
		reduced.current = false;
	});

	it('pop crece pasándose de su tamaño y termina en 1', async () => {
		const { pop } = await import('../src/lib/motion/index.js');
		const t = /** @type {any} */ (pop(document.createElement('span')));
		expect(t.css(0)).toBe('transform: scale(0.55);');
		expect(t.css(1)).toBe('transform: scale(1);');
		const peak = Math.max(...[0.5, 0.6, 0.7, 0.8].map((x) => Number(t.css(x).match(/[\d.]+/)[0])));
		expect(peak).toBeGreaterThan(1);

		reduced.current = true;
		expect(pop(document.createElement('span'))).toEqual({ delay: 0, duration: 0 });
	});

	it('dialogScale anima y se apaga con movimiento reducido', async () => {
		const { dialogScale } = await import('../src/lib/motion/index.js');
		const node = document.createElement('div');
		expect(dialogScale(node).duration).toBeGreaterThan(0);
		reduced.current = true;
		expect(dialogScale(node)).toEqual({ delay: 0, duration: 0 });
	});
});

describe('geo', () => {
	it('lerpLatLng interpola entre dos puntos', async () => {
		const { lerpLatLng } = await import('../src/lib/motion/geo.js');
		const a = { lat: 19, lng: -99 };
		const b = { lat: 20, lng: -98 };
		expect(lerpLatLng(a, b, 0)).toEqual(a);
		expect(lerpLatLng(a, b, 1)).toEqual(b);
		expect(lerpLatLng(a, b, 0.5)).toEqual({ lat: 19.5, lng: -98.5 });
	});

	it('distanceMeters: un grado de latitud son ~111 km', async () => {
		const { distanceMeters } = await import('../src/lib/motion/geo.js');
		expect(distanceMeters({ lat: 19, lng: -99 }, { lat: 20, lng: -99 })).toBeCloseTo(111195, -2);
	});

	it('shouldGlide descarta temblores, saltos enormes y datos inválidos', async () => {
		const { shouldGlide } = await import('../src/lib/motion/geo.js');
		const here = { lat: 19.4326, lng: -99.1332 };
		expect(shouldGlide(here, { lat: 19.4336, lng: -99.1332 })).toBe(true); // ~110 m
		expect(shouldGlide(here, { lat: 19.432601, lng: -99.1332 })).toBe(false); // ~10 cm
		expect(shouldGlide(here, { lat: 19.5326, lng: -99.1332 })).toBe(false); // ~11 km
		expect(shouldGlide(here, { lat: Number.NaN, lng: -99 })).toBe(false);
		expect(shouldGlide(/** @type {any} */ (null), here)).toBe(false);
	});
});

describe('slidingIndicator', () => {
	beforeEach(() => {
		reduced.current = false;
		vi.stubGlobal('requestAnimationFrame', (/** @type {FrameRequestCallback} */ cb) => {
			cb(0);
			return 1;
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	/** @param {number} active */
	function tablist(active) {
		const node = document.createElement('div');
		for (let i = 0; i < 3; i++) {
			const b = document.createElement('button');
			b.setAttribute('aria-selected', String(i === active));
			Object.defineProperties(b, {
				offsetLeft: { value: i * 50 },
				offsetTop: { value: 4 },
				offsetWidth: { value: 50 },
				offsetHeight: { value: 40 }
			});
			node.append(b);
		}
		return node;
	}

	it('se coloca sin animar la primera vez y se desliza después', async () => {
		const { slidingIndicator } = await import('../src/lib/motion/slidingIndicator.js');
		const node = tablist(0);
		const action = slidingIndicator(node, { active: 0, class: 'bg-blue-100' });
		const ind = /** @type {HTMLElement} */ (node.firstElementChild);

		expect(ind.getAttribute('aria-hidden')).toBe('true');
		expect(ind.className).toContain('bg-blue-100');
		expect(ind.style.transitionDuration).toBe('0ms');
		expect(ind.style.transform).toBe('translate(0px, 4px)');
		expect(ind.style.width).toBe('50px');
		expect(ind.style.height).toBe('40px');

		const buttons = node.querySelectorAll('button');
		buttons[0].setAttribute('aria-selected', 'false');
		buttons[2].setAttribute('aria-selected', 'true');
		action.update({ active: 2, class: 'bg-blue-100' });
		expect(ind.style.transform).toBe('translate(100px, 4px)');
		expect(ind.style.transitionDuration).not.toBe('0ms');

		action.destroy();
		expect(node.querySelector('[data-sliding-indicator]')).toBeNull();
	});

	it('acepta otro selector para el elemento activo', async () => {
		const { slidingIndicator } = await import('../src/lib/motion/slidingIndicator.js');
		const node = tablist(-1);
		node.querySelectorAll('button')[1].setAttribute('aria-current', 'page');
		const action = slidingIndicator(node, { active: 1, selector: '[aria-current="page"]' });
		const ind = /** @type {HTMLElement} */ (node.firstElementChild);
		expect(ind.style.transform).toBe('translate(50px, 4px)');
		expect(ind.style.opacity).toBe('1');
		action.destroy();
	});

	it('modo borde superior con margen, y se oculta sin pestaña activa', async () => {
		const { slidingIndicator } = await import('../src/lib/motion/slidingIndicator.js');
		const node = tablist(1);
		const action = slidingIndicator(node, { active: 1, edge: 'top', inset: 10 });
		const ind = /** @type {HTMLElement} */ (node.firstElementChild);
		expect(ind.style.width).toBe('30px');
		expect(ind.style.transform).toBe('translate(60px, 4px)');
		expect(ind.style.height).toBe('');

		node.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', 'false'));
		action.update({ active: null, edge: 'top', inset: 10 });
		expect(ind.style.opacity).toBe('0');
	});

	it('con movimiento reducido no se desliza', async () => {
		reduced.current = true;
		const { slidingIndicator } = await import('../src/lib/motion/slidingIndicator.js');
		const node = tablist(0);
		const action = slidingIndicator(node, { active: 0 });
		action.update({ active: 0 });
		expect(/** @type {HTMLElement} */ (node.firstElementChild).style.transitionDuration).toBe(
			'0ms'
		);
	});
});

describe('routeTransition', () => {
	/** @type {any} */
	const doc = document;

	beforeEach(() => {
		reduced.current = false;
	});

	afterEach(() => {
		delete doc.startViewTransition;
	});

	/** @param {string} from @param {string} to */
	function nav(from, to) {
		return /** @type {any} */ ({
			from: { url: new URL(`http://x${from}`) },
			to: { url: new URL(`http://x${to}`) },
			complete: Promise.resolve()
		});
	}

	it('sin soporte, con movimiento reducido o en la misma ruta no hace nada', async () => {
		const { routeTransition } = await import('../src/lib/motion/routeTransition.js');
		expect(routeTransition(nav('/login', '/dashboard'))).toBeUndefined();

		doc.startViewTransition = vi.fn();
		expect(routeTransition(nav('/dashboard', '/dashboard?x=1'))).toBeUndefined();
		reduced.current = true;
		expect(routeTransition(nav('/login', '/dashboard'))).toBeUndefined();
		expect(doc.startViewTransition).not.toHaveBeenCalled();
	});

	it('entre rutas distintas abre una View Transition que espera la navegación', async () => {
		/** @type {Promise<void> | undefined} */
		let inner;
		doc.startViewTransition = vi.fn((cb) => {
			inner = cb();
		});
		const { routeTransition } = await import('../src/lib/motion/routeTransition.js');
		await routeTransition(nav('/login', '/dashboard'));
		expect(doc.startViewTransition).toHaveBeenCalledTimes(1);
		await expect(inner).resolves.toBeUndefined();
	});
});
