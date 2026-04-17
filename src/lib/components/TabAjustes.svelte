<script>
	import Icon from '@iconify/svelte';
	import { goto } from '$app/navigation';
	import { user, authToken } from '$lib/stores/auth.js';
	import { vehicles, vehicleActions, loadingVehicles } from '$lib/stores/vehicleStore.js';
	import { getStatusText, getStatusPillClass } from '$lib/utils/vehicleUtils.js';

	let subView = 'main'; // 'main' | 'unidades'

	function getInitial(name) {
		return name ? name.charAt(0).toUpperCase() : '?';
	}

	function handleLogout() {
		user.logout();
		authToken.clearToken();
		goto('/login');
	}

	async function loadUnidades() {
		if ($vehicles.length === 0) {
			await vehicleActions.loadVehicles();
		}
		subView = 'unidades';
	}
</script>

<section
	class="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top,#0f1a33_0%,#020617_55%,#000_100%)] font-sans text-white"
	aria-label="Ajustes de la aplicación"
	style="min-height:0;align-items:stretch;justify-content:flex-start;padding:0"
>
	{#if subView === 'main'}
		<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-5">
			{#if $user}
				<article
					class="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 pl-[1.125rem] shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm"
					aria-labelledby="ajustes-user-name"
				>
					<div
						class="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 text-2xl font-bold text-white"
						aria-hidden="true"
					>
						{getInitial($user.name)}
					</div>
					<div class="min-w-0 flex-1">
						<h2 id="ajustes-user-name" class="m-0 truncate text-base font-semibold text-white">
							{$user.name}
						</h2>
						<p class="m-0 mt-1 truncate text-[0.8125rem] text-white/45">{$user.email}</p>
					</div>
				</article>
			{/if}

			<div aria-labelledby="ajustes-gestion-heading">
				<h3
					id="ajustes-gestion-heading"
					class="mb-1 ml-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-white/40"
				>
					Gestión
				</h3>
				<div class="overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.03]">
					<button
						type="button"
						class="flex w-full cursor-pointer items-center justify-between border-b border-white/[0.06] px-4 py-3.5 text-left text-base font-medium text-white transition-colors last:border-b-0 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
						on:click={loadUnidades}
						aria-label="Gestionar unidades del sistema"
					>
						<span class="flex items-center gap-3">
							<span
								class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 [&_svg]:h-5 [&_svg]:w-5"
								aria-hidden="true"
							>
								<Icon icon="mdi:car-side" aria-hidden="true" />
							</span>
							<span>Gestionar unidades</span>
						</span>
						<Icon
							icon="mdi:chevron-right"
							class="h-[18px] w-[18px] shrink-0 text-white/25"
							aria-hidden="true"
						/>
					</button>
				</div>
			</div>

			<div aria-labelledby="ajustes-cuenta-heading">
				<h3
					id="ajustes-cuenta-heading"
					class="mb-1 ml-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-white/40"
				>
					Cuenta
				</h3>
				<div class="overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.03]">
					<button
						type="button"
						class="flex w-full cursor-pointer items-center justify-between px-4 py-3.5 text-left text-base font-medium text-red-400 transition-colors hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
						on:click={handleLogout}
						aria-label="Cerrar sesión y volver a la pantalla de inicio de sesión"
					>
						<span class="flex items-center gap-3">
							<span
								class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-400 [&_svg]:h-5 [&_svg]:w-5"
								aria-hidden="true"
							>
								<Icon icon="mdi:logout" aria-hidden="true" />
							</span>
							<span>Cerrar sesión</span>
						</span>
					</button>
				</div>
			</div>

			<div aria-labelledby="ajustes-info-heading">
				<h3
					id="ajustes-info-heading"
					class="mb-1 ml-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-white/40"
				>
					Información
				</h3>
				<div class="overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.03]">
					<dl class="m-0 flex items-center justify-between px-4 py-3.5">
						<dt class="m-0 text-base font-medium text-white">Versión</dt>
						<dd class="m-0 text-base text-white/40">
							<span class="font-mono text-sm tracking-tight">1.0.0</span>
						</dd>
					</dl>
				</div>
			</div>
		</div>
	{:else if subView === 'unidades'}
		<div class="flex h-full min-h-0 flex-col">
			<header class="flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 py-4">
				<button
					type="button"
					class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-zinc-900 text-white transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
					on:click={() => (subView = 'main')}
					aria-label="Volver a ajustes generales"
				>
					<Icon icon="mdi:chevron-left" class="h-[22px] w-[22px]" aria-hidden="true" />
				</button>
				<h2 class="m-0 text-lg font-bold text-white">Gestionar unidades</h2>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
				{#if $loadingVehicles}
					<div
						class="flex h-[200px] items-center justify-center"
						role="status"
						aria-live="polite"
						aria-busy="true"
					>
						<div
							class="h-9 w-9 animate-spin rounded-full border-2 border-blue-600/20 border-t-blue-600"
							aria-hidden="true"
						></div>
						<span class="sr-only">Cargando unidades…</span>
					</div>
				{:else if $vehicles.length === 0}
					<div class="flex flex-col items-center gap-3 px-6 py-12 text-center" role="status">
						<Icon icon="mdi:car-off" class="h-20 w-20 shrink-0 opacity-20" aria-hidden="true" />
						<h3 class="m-0 text-lg font-semibold text-white">No hay unidades disponibles</h3>
						<p class="m-0 max-w-xs text-sm leading-relaxed text-white/40">
							Las unidades registradas aparecerán en esta lista.
						</p>
					</div>
				{:else}
					<ul class="m-0 flex list-none flex-col gap-2.5 p-0" aria-label="Unidades registradas">
						{#each $vehicles as v (v.id)}
							<li>
								<article
									class="flex items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3.5"
									aria-labelledby="unit-name-{v.id}"
								>
									<div
										class="h-2.5 w-2.5 shrink-0 rounded-full {v.status === 'active'
											? 'bg-emerald-500'
											: v.status === 'maintenance'
												? 'bg-amber-500'
												: 'bg-white/20'}"
										aria-hidden="true"
									></div>
									<div class="min-w-0 flex-1">
										<p id="unit-name-{v.id}" class="m-0 text-[0.9375rem] font-medium text-white">
											{v.name}
										</p>
										<p class="m-0 mt-0.5 text-xs leading-snug text-white/45">
											{v.driver || 'Sin conductor'}
											{#if v.speed !== undefined}
												· {v.speed} km/h
											{/if}
										</p>
										{#if v.lastUpdateFormatted}
											<p class="m-0 mt-0.5 text-[0.6875rem] text-white/30">{v.lastUpdateFormatted}</p>
										{/if}
									</div>
									<span
										class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold {getStatusPillClass(
											v.status
										)}"
									>
										{getStatusText(v.status)}
									</span>
								</article>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/if}
</section>
