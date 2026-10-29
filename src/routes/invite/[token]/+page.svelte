<script>
	import { page } from '$app/state';
	import { logoDe, marcaOPorDefecto, tituloDe } from '$lib/brand.js';
	import {
		IOS_APP_STORE_ID,
		IOS_APP_STORE_URL,
		enlaceDeLaAppParaInvitacion
	} from '$lib/appLinks.js';

	// Con la app instalada iOS abre el enlace directo en ella y esta página no
	// llega a pintarse. Aquí cae quien no la tiene, quien está en Android o en
	// una computadora, o quien pegó el enlace en la barra del navegador.
	const token = $derived(page.params.token ?? '');
	const marca = $derived(marcaOPorDefecto(page.data.brand));
	const nombre = $derived(marca.isDefault ? 'NEXUS' : marca.name);
</script>

<svelte:head>
	<title>{tituloDe(marca, 'Invitación a un equipo')}</title>
	<!-- El token es una credencial de un solo uso: que no se indexe. -->
	<meta name="robots" content="noindex, nofollow" />
	<meta
		name="apple-itunes-app"
		content={`app-id=${IOS_APP_STORE_ID}, app-argument=${page.url.origin}/invite/${encodeURIComponent(token)}`}
	/>
</svelte:head>

<div
	class="fixed inset-0 flex items-center justify-center overflow-y-auto bg-slate-100 px-4 font-sans [-webkit-font-smoothing:antialiased] dark:bg-[#0a0f0a]"
>
	<main
		class="relative z-10 flex w-[min(420px,100%)] flex-col items-center rounded-[20px] border border-slate-200 bg-white px-8 pb-8 pt-8 text-center shadow-xl dark:border-white/20 dark:bg-white/[0.08]"
		aria-labelledby="invite-heading"
	>
		<div class="mb-5 flex h-[72px] w-[72px] items-center justify-center">
			<img src={logoDe(marca)} alt="" class="h-full w-full object-contain" />
		</div>

		<h1 id="invite-heading" class="mb-2 mt-0 text-2xl font-bold text-slate-900 dark:text-white">
			Te invitaron a un equipo
		</h1>
		<p class="mb-6 mt-0 text-sm leading-relaxed text-slate-600 dark:text-white/60">
			La invitación se acepta desde la app de {nombre} para iPhone. Si aún no la tienes, descárgala, inicia
			sesión y vuelve a tocar el enlace que te enviaron.
		</p>

		<div class="flex w-full flex-col gap-3">
			<a
				href={enlaceDeLaAppParaInvitacion(token)}
				class="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-700 dark:bg-[#00a6c0] dark:hover:bg-[#0090a8]"
			>
				Abrir en la app
			</a>
			<a
				href={IOS_APP_STORE_URL}
				class="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
				rel="noopener"
			>
				Descargar en App Store
			</a>
		</div>

		<p class="mb-0 mt-6 text-xs text-slate-500 dark:text-white/40">
			En Android, los equipos llegan pronto.
		</p>
	</main>
</div>
