<script>
	import { logger } from '$lib/utils/logger.js';
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';
	import { apiService } from '$lib/services/api.js';
	import { alerts, zones, alarmEvents, alertActions } from '$lib/stores/alertStore.js';
	import { vehicles } from '$lib/stores/vehicleStore.js';
	import { workspaceActions } from '$lib/stores/workspaceStore.js';
	import { formatAlarmWhen } from '$lib/utils/alarmFormat.js';
	import AdminPageHeader from './AdminPageHeader.svelte';
	import StatCard from './StatCard.svelte';
	import QuickActionButton from './QuickActionButton.svelte';

	let loading = true;
	let loadError = '';
	let users = [];
	let devices = [];
	let unassigned = [];

	$: userCount = users.length;
	$: verifiedUsers = users.filter(
		(u) => u.email_verified !== false && u.status !== 'pending'
	).length;
	$: pendingUsers = Math.max(0, userCount - verifiedUsers);
	$: unitCount = $vehicles.length;
	$: deviceCount = devices.length;
	$: unassignedCount = unassigned.length;
	$: assignedDevices = Math.max(0, deviceCount - unassignedCount);
	$: alertCount = $alerts.length;
	$: enabledAlerts = $alerts.filter((a) => a.enabled !== false && a.is_enabled !== false).length;
	$: zoneCount = $zones.length;
	$: recentEvents = $alarmEvents.slice(0, 6);

	async function loadDashboard() {
		loading = true;
		loadError = '';
		try {
			const settled = await Promise.allSettled([
				apiService.getUsers(),
				apiService.getMyDevices(),
				apiService.getUnassignedDevices(),
				alertActions.syncAlertRulesFromApi(),
				alertActions.syncZonesFromApi(),
				alertActions.syncAlarmEventsFromApi()
			]);

			if (settled[0].status === 'fulfilled') {
				const raw = settled[0].value;
				users = Array.isArray(raw) ? raw : (raw?.items ?? raw?.data ?? []);
			}
			if (settled[1].status === 'fulfilled') {
				const raw = settled[1].value;
				devices = Array.isArray(raw) ? raw : (raw?.items ?? raw?.data ?? []);
			}
			if (settled[2].status === 'fulfilled') {
				const raw = settled[2].value;
				unassigned = Array.isArray(raw) ? raw : (raw?.items ?? raw?.data ?? []);
			}

			const failed = settled.filter((s) => s.status === 'rejected');
			if (failed.length === settled.length) {
				loadError = 'No se pudo cargar el resumen. Reintenta.';
			}
		} catch (err) {
			logger.error('Dashboard admin:', err);
			loadError = err?.displayMessage || err?.message || 'Error al cargar el dashboard';
		} finally {
			loading = false;
		}
	}

	onMount(loadDashboard);
</script>

<div class="admin-dashboard w-full">
	<AdminPageHeader
		title="Dashboard"
		subtitle="Resumen operativo de tu organización — datos en vivo desde la API."
	>
		<button
			slot="actions"
			type="button"
			class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.08]"
			on:click={loadDashboard}
			disabled={loading}
		>
			<Icon
				icon={loading ? 'mdi:loading' : 'mdi:refresh'}
				width={16}
				class={loading ? 'animate-spin' : ''}
				aria-hidden="true"
			/>
			Actualizar
		</button>
	</AdminPageHeader>

	{#if loadError}
		<p
			class="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
			role="alert"
		>
			{loadError}
		</p>
	{/if}

	<!-- Hero strip -->
	<section
		class="relative mb-6 overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 text-slate-900 shadow-[0_12px_36px_rgba(15,23,42,0.06)] dark:border-emerald-500/20 dark:from-[#0a1628] dark:via-[#0d1f2e] dark:to-[#06261c] dark:text-white dark:shadow-[0_20px_50px_rgba(2,8,20,0.35)] sm:p-7"
		aria-label="Resumen principal"
	>
		<div
			class="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-400/25 blur-3xl dark:bg-emerald-400/20"
			aria-hidden="true"
		></div>
		<div
			class="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-400/15"
			aria-hidden="true"
		></div>
		<div class="relative flex flex-wrap items-end justify-between gap-4">
			<div>
				<p
					class="m-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-200/80"
				>
					Flota NEXUS
				</p>
				<p class="admin-display m-0 mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
					{loading ? '…' : unitCount}
					<span class="text-lg font-medium text-slate-500 dark:text-white/55 sm:text-xl"
						>unidades</span
					>
				</p>
				<p class="m-0 mt-2 max-w-md text-sm text-slate-600 dark:text-white/55">
					{loading
						? 'Cargando inventario…'
						: `${deviceCount} dispositivos · ${assignedDevices} asignados · ${unassignedCount} sin asignar`}
				</p>
			</div>
			<button
				type="button"
				class="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-white/60"
				on:click={() => workspaceActions.goTracking()}
			>
				<Icon icon="mdi:earth" width={18} aria-hidden="true" />
				Ir a seguimiento
			</button>
		</div>
	</section>

	<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
		<StatCard
			label="Usuarios"
			value={loading ? '—' : userCount}
			hint={pendingUsers > 0 ? `${pendingUsers} pendientes` : `${verifiedUsers} en org`}
			icon="mdi:account-group-outline"
			accent="sky"
			onClick={() => workspaceActions.goAdmin('users')}
		/>
		<StatCard
			label="Unidades"
			value={loading ? '—' : unitCount}
			hint="Flota registrada"
			icon="mdi:car-side"
			accent="emerald"
			onClick={() => workspaceActions.goAdmin('units')}
		/>
		<StatCard
			label="Dispositivos"
			value={loading ? '—' : deviceCount}
			hint={unassignedCount > 0 ? `${unassignedCount} sin asignar` : 'Todos vinculados'}
			icon="mdi:memory"
			accent="amber"
			onClick={() => workspaceActions.goAdmin('devices')}
		/>
		<StatCard
			label="Alertas"
			value={loading ? '—' : alertCount}
			hint={`${enabledAlerts} activas`}
			icon="mdi:bell-ring-outline"
			accent="rose"
			onClick={() => workspaceActions.goTracking()}
		/>
		<StatCard
			label="Zonas"
			value={loading ? '—' : zoneCount}
			hint="Geocercas"
			icon="mdi:hexagon-multiple-outline"
			accent="slate"
			onClick={() => workspaceActions.goTracking()}
		/>
		<StatCard
			label="Eventos"
			value={$alarmEvents.length}
			hint="Historial reciente"
			icon="mdi:history"
			accent="sky"
		/>
	</div>

	<div class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
		<section
			class="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-white/[0.08] dark:bg-[#0d1424] sm:p-5"
			aria-label="Actividad reciente"
		>
			<div class="mb-3 flex items-center justify-between gap-2">
				<h2 class="m-0 text-sm font-semibold text-slate-900 dark:text-white">Actividad reciente</h2>
				<span class="text-[11px] font-medium text-slate-400 dark:text-white/35"
					>Eventos de alarma</span
				>
			</div>
			{#if recentEvents.length === 0}
				<div
					class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-white/10"
				>
					<Icon
						icon="mdi:bell-sleep-outline"
						width={28}
						class="text-slate-300 dark:text-white/25"
					/>
					<p class="m-0 text-sm text-slate-500 dark:text-white/45">Sin eventos de hoy.</p>
					<p class="m-0 text-[11px] text-slate-400 dark:text-white/30">
						Las alarmas aparecerán aquí cuando se disparen reglas.
					</p>
				</div>
			{:else}
				<ul class="m-0 list-none space-y-2 p-0">
					{#each recentEvents as ev (ev.id)}
						<li
							class="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]"
						>
							<span
								class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-300"
								aria-hidden="true"
							>
								<Icon icon="mdi:bell" width={16} />
							</span>
							<div class="min-w-0 flex-1">
								<p class="m-0 truncate text-[13px] font-semibold text-slate-900 dark:text-white">
									{ev.name || 'Evento'}
								</p>
								<p class="m-0 mt-0.5 truncate text-[11px] text-slate-500 dark:text-white/40">
									{ev.vehicle || 'Unidad'} · {formatAlarmWhen(ev.at)}
								</p>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section
			class="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-white/[0.08] dark:bg-[#0d1424] sm:p-5"
			aria-label="Acciones rápidas"
		>
			<h2 class="m-0 mb-3 text-sm font-semibold text-slate-900 dark:text-white">
				Acciones rápidas
			</h2>
			<div class="grid grid-cols-2 gap-2">
				<QuickActionButton
					label="Usuarios"
					icon="mdi:account-plus-outline"
					onClick={() => workspaceActions.goAdmin('users')}
				/>
				<QuickActionButton
					label="Unidades"
					icon="mdi:car-outline"
					onClick={() => workspaceActions.goAdmin('units')}
				/>
				<QuickActionButton
					label="Dispositivos"
					icon="mdi:chip"
					onClick={() => workspaceActions.goAdmin('devices')}
				/>
				<QuickActionButton
					label="Configuración"
					icon="mdi:cog-outline"
					onClick={() => workspaceActions.goAdmin('settings')}
				/>
			</div>
		</section>
	</div>
</div>
