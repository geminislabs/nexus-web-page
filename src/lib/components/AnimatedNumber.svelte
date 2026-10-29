<script>
	import { Tween } from 'svelte/motion';
	import { DURATION, EASE, motionDuration } from '$lib/motion/index.js';

	/**
	 * Número que cuenta hasta su valor y frena al final. La primera vez parte
	 * de 0; después, del valor anterior. Los lectores de pantalla sólo leen
	 * el valor final, no los intermedios.
	 * @type {{
	 *   value: number | null | undefined,
	 *   format?: (n: number) => string,
	 *   duration?: number,
	 *   fallback?: string
	 * }}
	 */
	let {
		value,
		format = (n) => String(Math.round(n)),
		duration = DURATION.slow,
		fallback = '—'
	} = $props();

	const valid = $derived(typeof value === 'number' && Number.isFinite(value));
	const tween = new Tween(0, { easing: EASE.out });

	$effect(() => {
		if (valid) tween.set(/** @type {number} */ (value), { duration: motionDuration(duration) });
	});
</script>

{#if valid}<span class="tabular-nums" aria-hidden="true">{format(tween.current)}</span><span
		class="sr-only">{format(/** @type {number} */ (value))}</span
	>{:else}{fallback}{/if}
