<script>
	import Icon from '@iconify/svelte';

	/** Tamaño en px del contenedor cuadrado */
	export let size = 20;
	/** Escudo: white | red | inherit */
	export let variant = 'white';
	let className = '';
	export { className as class };
</script>

<span
	class="relative inline-flex shrink-0 items-center justify-center {className}"
	style="width: {size}px; height: {size}px;"
	aria-hidden="true"
>
	<Icon
		icon="mdi:shield"
		width={size}
		height={size}
		class="absolute inset-0 {variant === 'white'
			? 'text-white'
			: variant === 'red'
				? 'text-red-400'
				: ''}"
	/>
	<Icon
		icon="mdi:lightning-bolt"
		width={Math.round(size * 0.44)}
		height={Math.round(size * 0.44)}
		class="relative z-[1] {variant === 'red' ? 'text-white' : 'text-white'}"
		style="margin-top: {Math.round(size * 0.05)}px"
	/>
</span>
