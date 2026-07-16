<script>
	import Icon from '@iconify/svelte';
	import ShieldBoltIcon from '$lib/components/icons/ShieldBoltIcon.svelte';

	export let unit = null;
	export let onBack = () => {};

	$: deviceModel = unit?.deviceModel || unit?.device_model || 'ST4315U';
	$: deviceBrand = unit?.deviceBrand || unit?.device_brand || 'Suntech';
</script>

<div
	class="pointer-events-auto w-full rounded-t-2xl bg-white shadow-[0_-4px_20px_rgba(15,23,42,0.12)] dark:bg-[#0c1829] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
>
	<div class="flex justify-center py-2">
		<div class="h-1 w-9 rounded-full bg-slate-300 dark:bg-white/30"></div>
	</div>

	<div class="flex items-center gap-3 border-b border-slate-200 px-4 pb-3 dark:border-white/[0.08]">
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600/20 text-red-400"
		>
			<ShieldBoltIcon size={22} variant="red" />
		</div>
		<div class="min-w-0 flex-1">
			<h2 class="m-0 text-[17px] font-bold text-slate-900 dark:text-white">Consola de Seguridad</h2>
			<p class="m-0 truncate text-[13px] text-slate-500 dark:text-white/50">
				{unit?.name || 'Unidad'}
			</p>
		</div>
		<button
			type="button"
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/15 dark:hover:text-white"
			on:click={onBack}
			aria-label="Cerrar consola de seguridad"
		>
			<Icon icon="mdi:close" width={18} aria-hidden="true" />
		</button>
	</div>

	<div class="max-h-[min(68vh,520px)] overflow-y-auto overscroll-contain px-4 py-4 pb-6">
		<p
			class="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-white/40"
		>
			Acciones disponibles
		</p>

		<div
			class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/[0.08] dark:bg-white/[0.04]"
		>
			<div class="mb-3 flex items-start justify-between gap-2">
				<div class="flex items-center gap-2">
					<Icon icon="mdi:shield-check" width={18} class="text-sky-400" aria-hidden="true" />
					<span class="text-[14px] font-bold text-slate-900 dark:text-white"
						>Control Remoto de Motor</span
					>
				</div>
				<span
					class="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400"
				>
					✓ Compatible
				</span>
			</div>
			<p class="m-0 mb-4 text-[12px] text-slate-500 dark:text-white/45">
				Modelo registrado: {deviceModel} ({deviceBrand})
			</p>

			<div class="grid grid-cols-2 gap-2.5">
				<button
					type="button"
					class="flex items-center gap-2.5 rounded-xl bg-red-600 px-3 py-3 text-left opacity-90"
					disabled
					title="Próximamente"
				>
					<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
						<Icon icon="mdi:power" width={18} class="text-white" aria-hidden="true" />
					</span>
					<span class="text-[13px] font-bold leading-tight text-white">Apagar<br />Motor</span>
				</button>
				<button
					type="button"
					class="flex items-center gap-2.5 rounded-xl bg-emerald-600 px-3 py-3 text-left opacity-90"
					disabled
					title="Próximamente"
				>
					<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
						<Icon icon="mdi:key-variant" width={18} class="text-white" aria-hidden="true" />
					</span>
					<span class="text-[13px] font-bold leading-tight text-white">Liberar<br />Motor</span>
				</button>
			</div>
		</div>

		<p
			class="m-0 mb-2 mt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-white/40"
		>
			Historial de peticiones (auditoría)
		</p>

		<div
			class="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center dark:border-white/[0.08] dark:bg-white/[0.03]"
		>
			<div class="relative mb-3 text-slate-300 dark:text-white/25">
				<Icon icon="mdi:clock-outline" width={44} aria-hidden="true" />
				<Icon
					icon="mdi:check-circle"
					width={16}
					class="absolute -bottom-0.5 -right-1 text-slate-400 dark:text-white/35"
					aria-hidden="true"
				/>
			</div>
			<p class="m-0 max-w-[280px] text-[12px] leading-relaxed text-slate-400 dark:text-white/40">
				No se registran comandos enviados recientemente a esta unidad desde este dispositivo.
			</p>
		</div>
	</div>
</div>
