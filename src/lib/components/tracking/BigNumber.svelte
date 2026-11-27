<script>
	/**
	 * Número grande con los decimales atenuados (78.3 → «78» y «.3» en gris).
	 * `null` se pinta como raya: un dato que falta no es un cero.
	 */
	let { value = null, decimals = 1, suffix = '', sizeClass = 'text-[44px]' } = $props();

	const parts = $derived.by(() => {
		const n = Number(value);
		if (value == null || !Number.isFinite(n)) return null;
		const s = n.toLocaleString('es-MX', {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
		const i = decimals > 0 ? s.lastIndexOf('.') : -1;
		return i < 0 ? { int: s, dec: '' } : { int: s.slice(0, i), dec: s.slice(i) };
	});
</script>

<span class="inline-flex items-baseline gap-1.5">
	<span class="nx-num leading-none {sizeClass}">
		{#if parts}{parts.int}<span class="nx-muted">{parts.dec}</span>{:else}<span class="nx-muted"
				>—</span
			>{/if}
	</span>
	{#if suffix}
		<span class="nx-num nx-muted text-lg leading-none">{suffix}</span>
	{/if}
</span>
