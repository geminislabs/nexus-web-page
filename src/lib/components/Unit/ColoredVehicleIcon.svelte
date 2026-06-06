<script>
	export let src = '';
	export let colorHex = '#334155';
	export let sizeClass = 'h-8 w-8';
	export let alt = 'Icono de vehículo';

	const imgClass = 'pointer-events-none absolute inset-0 h-full w-full object-contain';
</script>

<!--
  1) Máscara del PNG → silueta con colorHex.
  2) PNG + multiply → cuerpo coloreado con algo de detalle.
  3) PNG + darken (alto contraste) → refuerza llantas, vidrios y accesorios oscuros.
-->
<div class="relative {sizeClass}">
	<div
		class="absolute inset-0"
		style="
			background-color: {colorHex};
			-webkit-mask-image: url('{src}');
			mask-image: url('{src}');
			-webkit-mask-size: contain;
			mask-size: contain;
			-webkit-mask-repeat: no-repeat;
			mask-repeat: no-repeat;
			-webkit-mask-position: center;
			mask-position: center;
		"
		aria-hidden="true"
	></div>

	<img
		{src}
		{alt}
		class="{imgClass} mix-blend-multiply"
		style="filter: contrast(1.35) brightness(0.92);"
	/>

	<img
		{src}
		alt=""
		aria-hidden="true"
		class="{imgClass} mix-blend-darken opacity-70"
		style="filter: contrast(2.1) brightness(0.58);"
	/>
</div>
