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
		doc.startViewTransition = vi.fn((cb) => {
			const done = cb();
			return { ready: done.then(() => undefined) };
		});
		const { toggleThemeWithReveal } = await import('../src/lib/motion/themeReveal.js');
		const { theme } = await import('../src/lib/stores/themeStore.js');
		const before = get(theme);

		toggleThemeWithReveal(/** @type {any} */ ({ detail: 1, clientX: 10, clientY: 20 }));
		await vi.waitFor(() => expect(animate).toHaveBeenCalled());

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
