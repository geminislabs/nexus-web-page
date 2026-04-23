<script>
	import Icon from '@iconify/svelte';

	const features = [
		{
			icon: 'mdi:map-marker-path',
			label: 'Rutas y recorridos',
			desc: 'Distancia, duración y trayectorias por unidad'
		},
		{
			icon: 'mdi:speedometer',
			label: 'Análisis de velocidad',
			desc: 'Excesos, promedios y ranking de conductores'
		},
		{
			icon: 'mdi:fuel',
			label: 'Consumo de combustible',
			desc: 'Eficiencia, comparativas y alertas de gasto'
		},
		{
			icon: 'mdi:clock-time-four-outline',
			label: 'Tiempos operativos',
			desc: 'Horas activas, inactivas y en mantenimiento'
		},
		{
			icon: 'mdi:bell-badge-outline',
			label: 'Histórico de alertas',
			desc: 'Frecuencia, tipo y resolución de incidentes'
		},
		{
			icon: 'mdi:file-export-outline',
			label: 'Exportación de datos',
			desc: 'PDF, CSV y Excel con filtros por fecha'
		}
	];

	const bars = [38, 55, 42, 70, 58, 82, 65, 90, 74, 88, 62, 95];
	const miniLine = 'M0 60 C20 50 40 30 60 40 S100 20 120 25 S160 10 180 15 S220 5 240 8';
</script>

<section
	class="relative w-full min-w-0 bg-slate-50 text-slate-900 dark:bg-[#080d1a] dark:text-white"
	aria-labelledby="tab-informes-heading"
	style="font-family:'DM Sans',system-ui,sans-serif;padding:0"
>
	<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
		<div
			class="absolute -left-24 top-8 h-64 w-64 rounded-full bg-blue-600/[0.07] blur-[80px]"
		></div>
		<div
			class="absolute -right-16 bottom-16 h-48 w-48 rounded-full bg-indigo-500/[0.06] blur-[60px]"
		></div>
		<div
			class="absolute inset-0 opacity-[0.025]"
			style="background-image:radial-gradient(rgba(255,255,255,.6) 1px,transparent 1px);background-size:24px 24px"
		></div>
	</div>

	<div class="relative w-full min-w-0 px-3 py-6 sm:px-4">
		<div class="mb-6">
			<div class="mb-3 flex items-center gap-2.5">
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300"
				>
					<Icon icon="mdi:chart-bar" width={20} aria-hidden="true" />
				</div>
				<div>
					<h3
						id="tab-informes-heading"
						class="m-0 text-[16px] font-bold tracking-tight text-slate-900 dark:text-white"
					>
						Informes
					</h3>
					<p class="m-0 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-white/30">
						En desarrollo
					</p>
				</div>
				<span
					class="ml-auto flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-300"
				>
					<span class="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
					Próximamente
				</span>
			</div>
		</div>

		<div class="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
			{#each [{ label: 'Km recorridos', value: '12,847', unit: 'km', icon: 'mdi:map-marker-distance', color: 'blue' }, { label: 'Tiempo activo', value: '487', unit: 'hrs', icon: 'mdi:clock-outline', color: 'emerald' }, { label: 'Alertas totales', value: '34', unit: 'este mes', icon: 'mdi:bell-outline', color: 'amber' }, { label: 'Eficiencia flota', value: '94', unit: '%', icon: 'mdi:gauge', color: 'violet' }] as kpi, i}
				<div
					class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-white/[0.07] dark:bg-white/[0.04]"
					style="animation: fadeInUp 0.4s ease both; animation-delay: {i * 80}ms"
				>
					<div
						class="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.5s_ease_infinite_{i *
							400}ms] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
						aria-hidden="true"
					></div>
					<div class="mb-2 flex items-center justify-between">
						<span
							class="flex h-7 w-7 items-center justify-center rounded-lg
							{kpi.color === 'blue'
								? 'bg-blue-500/15 text-blue-300'
								: kpi.color === 'emerald'
									? 'bg-emerald-500/15 text-emerald-300'
									: kpi.color === 'amber'
										? 'bg-amber-500/15 text-amber-300'
										: 'bg-violet-500/15 text-violet-300'}"
						>
							<Icon icon={kpi.icon} width={15} aria-hidden="true" />
						</span>
						<span
							class="select-none rounded-md blur-[5px] text-[18px] font-bold text-slate-600 dark:text-white/60"
							aria-hidden="true">{kpi.value}</span
						>
					</div>
					<p class="m-0 text-[11px] font-medium text-slate-600 dark:text-white/50">{kpi.label}</p>
					<p class="m-0 text-[10px] text-slate-500 dark:text-white/25">{kpi.unit}</p>
				</div>
			{/each}
		</div>

		<div
			class="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.07] dark:bg-white/[0.04]"
			style="animation: fadeInUp 0.4s ease 320ms both"
		>
			<div class="mb-3 flex items-center justify-between">
				<div>
					<p class="m-0 text-[12px] font-semibold text-slate-600 dark:text-white/60">Actividad semanal</p>
					<p class="m-0 text-[10px] text-slate-500 dark:text-white/28">Km recorridos por día</p>
				</div>
				<div class="flex items-center gap-1 blur-sm" aria-hidden="true">
					<span class="h-2 w-2 rounded-full bg-blue-500"></span>
					<span class="text-[10px] text-slate-500 dark:text-white/35">Esta semana</span>
				</div>
			</div>

			<div class="relative h-24 overflow-hidden pointer-events-none" aria-hidden="true">
				<div class="absolute inset-x-0 bottom-0 flex items-end gap-[5px] px-1 blur-[1.5px]">
					{#each bars as h, i}
						<div
							class="flex-1 rounded-t-sm bg-blue-500/25 transition-all"
							style="height:{h}%; opacity:{0.4 + i * 0.045}; animation: barGrow 0.8s ease {i *
								60}ms both"
						></div>
					{/each}
				</div>
				<svg
					class="absolute inset-0 w-full h-full opacity-30"
					viewBox="0 0 240 90"
					preserveAspectRatio="none"
				>
					<path d={miniLine} fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" />
					<path d="{miniLine} L240 90 L0 90 Z" fill="url(#lineGrad)" opacity="0.3" />
					<defs>
						<linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#6366f1" stop-opacity="0.4" />
							<stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
						</linearGradient>
					</defs>
				</svg>
				<div
					class="absolute inset-0 bg-gradient-to-t from-slate-100/90 to-transparent dark:from-[#080d1a]/60"
				></div>
			</div>

			<div class="mt-2 flex justify-between px-1 blur-sm" aria-hidden="true">
				{#each ['L', 'M', 'X', 'J', 'V', 'S', 'D', 'L', 'M', 'X', 'J', 'D'] as d}
					<span class="text-[9px] text-slate-500 dark:text-white/25">{d}</span>
				{/each}
			</div>
		</div>

		<div style="animation: fadeInUp 0.4s ease 480ms both">
			<p class="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/28">
				Funciones incluidas
			</p>
			<div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
				{#each features as f, i}
					<div
						class="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors hover:bg-slate-100 dark:border-white/[0.05] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
						style="animation: fadeInUp 0.35s ease {540 + i * 60}ms both"
					>
						<span
							class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500/12 text-indigo-300/70"
						>
							<Icon icon={f.icon} width={13} aria-hidden="true" />
						</span>
						<div class="min-w-0">
							<p class="m-0 text-[12px] font-semibold text-slate-700 dark:text-white/65">{f.label}</p>
							<p class="m-0 mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-white/30">{f.desc}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<p class="mt-5 text-center text-[10px] leading-relaxed text-slate-500 dark:text-white/22">
			¿Necesitas datos históricos con urgencia?<br />
			Contacta al administrador de tu organización.
		</p>
	</div>
</section>

<style>
	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes shimmer {
		0% {
			transform: translateX(-100%);
		}
		60% {
			transform: translateX(200%);
		}
		100% {
			transform: translateX(200%);
		}
	}
	@keyframes barGrow {
		from {
			transform: scaleY(0);
			transform-origin: bottom;
		}
		to {
			transform: scaleY(1);
			transform-origin: bottom;
		}
	}
</style>
