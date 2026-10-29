<script>
	/**
	 * Fondo de las pantallas sin mapa (login, registro, contraseña,
	 * invitación): degradado con un toque cálido y tres capas de olas que se
	 * desplazan en bucle. Todo es CSS `transform`, sin trabajo de JS por
	 * cuadro; con «reducir movimiento» las olas se quedan quietas.
	 */

	/** Ancho de un periodo del dibujo; la animación se desplaza exactamente esto. */
	const SPAN = 1440;

	/**
	 * Ola senoidal que se repite dos veces a lo ancho (2 × SPAN), para que al
	 * desplazarla medio ancho el empalme no se note.
	 * @param {number} base altura media (0..200)
	 * @param {number} amp amplitud
	 * @param {number} waves crestas por periodo
	 * @param {number} phase desfase en radianes
	 */
	function wavePath(base, amp, waves, phase) {
		const step = 24;
		let d = `M0,200 L0,${base}`;
		for (let x = 0; x <= SPAN * 2; x += step) {
			const y = base + amp * Math.sin((x / SPAN) * waves * 2 * Math.PI + phase);
			d += ` L${x},${y.toFixed(1)}`;
		}
		return `${d} L${SPAN * 2},200 Z`;
	}

	const layers = [
		{
			d: wavePath(92, 18, 2, 0),
			duration: 34,
			class: 'text-emerald-300/20 dark:text-emerald-500/[0.07]'
		},
		{
			d: wavePath(118, 14, 3, 1.4),
			duration: 24,
			class: 'text-amber-200/25 dark:text-amber-500/[0.06]'
		},
		{
			d: wavePath(146, 10, 2, 2.6),
			duration: 18,
			class: 'text-teal-300/20 dark:text-teal-400/[0.08]'
		}
	];
</script>

<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
	<div class="auth-backdrop-glow absolute inset-0"></div>
	<div class="absolute inset-x-0 bottom-0 h-[42vh] min-h-[220px]">
		{#each layers as layer, i (i)}
			<svg
				class="auth-wave absolute bottom-0 left-0 h-full w-[200%] {layer.class}"
				style="animation-duration: {layer.duration}s"
				viewBox="0 0 {SPAN * 2} 200"
				preserveAspectRatio="none"
			>
				<path d={layer.d} fill="currentColor" />
			</svg>
		{/each}
	</div>
</div>

<style>
	/* Degradado: verde de marca arriba, un brillo cálido abajo a la derecha. */
	.auth-backdrop-glow {
		background:
			radial-gradient(60% 50% at 12% 8%, rgb(187 247 208 / 0.55), transparent 70%),
			radial-gradient(55% 45% at 88% 92%, rgb(253 230 138 / 0.4), transparent 70%),
			radial-gradient(40% 35% at 70% 35%, rgb(153 246 228 / 0.3), transparent 70%);
	}
	:global(.dark) .auth-backdrop-glow {
		background:
			radial-gradient(60% 50% at 12% 8%, rgb(26 77 42 / 0.55), transparent 70%),
			radial-gradient(55% 45% at 88% 92%, rgb(120 72 20 / 0.28), transparent 70%),
			radial-gradient(40% 35% at 70% 35%, rgb(13 51 34 / 0.45), transparent 70%);
	}

	.auth-wave {
		will-change: transform;
		animation-name: auth-wave-drift;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
	}

	@keyframes auth-wave-drift {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.auth-wave {
			animation: none;
		}
	}
</style>
