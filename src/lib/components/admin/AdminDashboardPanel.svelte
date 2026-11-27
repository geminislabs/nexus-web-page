<script>
	/**
	 * Dashboard de Administración en la vista Panel: mismos datos que el de la
	 * Clásica (adminSummaryService), con el lenguaje del seguimiento nuevo:
	 * tarjetas grises, números en Sora ligera y color solo para estados.
	 */
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import { marcaOPorDefecto } from '$lib/brand.js';
	import { logger } from '$lib/utils/logger.js';
	import Icon from '$lib/components/Icon.svelte';
	import { apiService } from '$lib/services/api.js';
	import { fetchAdminSummary, summarizeAdmin } from '$lib/services/adminSummaryService.js';
	import { alerts, zones, alarmEvents, alertActions } from '$lib/stores/alertStore.js';
	import { vehicles, vehicleActions, loadingVehicles } from '$lib/stores/vehicleStore.js';
	import { workspaceActions } from '$lib/stores/workspaceStore.js';
	import { pendingTrackingDrawer } from '$lib/stores/navigationStore.js';
	import { formatAlarmWhen } from '$lib/utils/alarmFormat.js';
	import BigNumber from '$lib/components/tracking/BigNumber.svelte';
	import KmTodayCard from '$lib/components/tracking/KmTodayCard.svelte';
	import ActivityTodayCard from '$lib/components/tracking/ActivityTodayCard.svelte';

	let { onRetryFleetDay = () => {}, onSelectUnit = () => {}, onOpenReports = null } = $props();

	let loading = $state(true);
	let loadError = $state('');
	let users = $state([]);
	let devices = $state([]);
	let unassigned = $state([]);

	const s = $derived(summarizeAdmin({ users, devices, unassigned, alerts: $alerts }));
	const unitCount = $derived($vehicles.length);
	const recentEvents = $derived($alarmEvents.slice(0, 6));
	const busy = $derived(loading || ($loadingVehicles && unitCount === 0));
	const assignedPct = $derived(
		s.deviceCount > 0 ? Math.round((s.assignedDevices / s.deviceCount) * 100) : 0
	);

	async function load() {
		loading = true;
		loadError = '';
		try {
			const r = await fetchAdminSummary({ api: apiService, alerts: alertActions });
			if (r.users) users = r.users;
			if (r.devices) devices = r.devices;
			if (r.unassigned) unassigned = r.unassigned;
			loadError = r.error;
		} catch (err) {
			logger.error('Dashboard admin:', err);
			loadError = err?.displayMessage || err?.message || 'Error al cargar el dashboard';
		} finally {
			loading = false;
		}
	}

	function refresh() {
		load();
		vehicleActions.loadVehicles();
		onRetryFleetDay();
	}

	/** @param {string} section */
	function openInTracking(section) {
		pendingTrackingDrawer.set(section);
		workspaceActions.goTracking();
	}

	onMount(() => {
		// En Administración el mapa no inicia, así que nadie más carga las unidades.
		if (get(vehicles).length === 0) vehicleActions.loadVehicles();
		load();
	});

	const marca = marcaOPorDefecto(page.data.brand);

	/** Tarjetas de cifras. `tone` colorea solo el texto de estado. */
	const tiles = $derived([
		{
			label: 'Usuarios',
			value: s.userCount,
			icon: 'mdi:account-group-outline',
			hint:
				s.pendingUsers > 0
					? `${s.pendingUsers} pendientes`
					: `${s.verifiedUsers} en la organización`,
			tone: s.pendingUsers > 0 ? 'warn' : '',
			onClick: () => workspaceActions.goAdmin('users')
		},
		{
			label: 'Unidades',
			value: unitCount,
			icon: 'mdi:car-side',
			hint: 'Flota registrada',
			tone: '',
			onClick: () => workspaceActions.goAdmin('units')
		},
		{
			label: 'Dispositivos',
			value: s.deviceCount,
			icon: 'mdi:memory',
			hint: s.unassignedCount > 0 ? `${s.unassignedCount} sin asignar` : 'Todos vinculados',
			tone: s.unassignedCount > 0 ? 'warn' : 'ok',
			onClick: () => workspaceActions.goAdmin('devices')
		},
		{
			label: 'Alertas',
			value: s.alertCount,
			icon: 'mdi:bell-ring-outline',
			hint: `${s.enabledAlerts} activas`,
			tone: s.enabledAlerts > 0 ? 'ok' : '',
			onClick: () => openInTracking('alertas_zonas')
		},
		{
			label: 'Zonas',
			value: $zones.length,
			icon: 'mdi:hexagon-multiple-outline',
			hint: 'Geocercas',
			tone: '',
			onClick: () => openInTracking('alertas_zonas')
		},
		{
			label: 'Eventos',
			value: $alarmEvents.length,
			icon: 'mdi:history',
			hint: 'De hoy',
			tone: '',
			onClick: null
		}
	]);

	const toneClass = {
		ok: 'text-emerald-600 dark:text-emerald-400',
		warn: 'text-amber-600 dark:text-amber-400',
		'': 'nx-muted'
	};

	const quickActions = [
		{ label: 'Usuarios', icon: 'mdi:account-plus-outline', go: 'users' },
		{ label: 'Unidades', icon: 'mdi:car-outline', go: 'units' },
		{ label: 'Dispositivos', icon: 'mdi:chip', go: 'devices' },
		{ label: 'Configuración', icon: 'mdi:cog-outline', go: 'settings' }
	];
</script>

<div class="mx-auto flex w-full max-w-[1440px] flex-col gap-3">
	<header class="flex flex-wrap items-end justify-between gap-3 pb-1">
		<div class="min-w-0">
			<p class="nx-label m-0">Administración</p>
			<h1 class="nx-num m-0 mt-1 text-[30px] leading-[1.1]">Dashboard</h1>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="nx-glass inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
				onclick={refresh}
				disabled={loading}
			>
				<Icon
					icon={loading ? 'mdi:loading' : 'mdi:refresh'}
					class="h-4 w-4 {loading ? 'animate-spin' : ''}"
					aria-hidden="true"
				/>
				Actualizar
			</button>
			<button
				type="button"
				class="inline-flex h-9 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
				onclick={() => workspaceActions.goTracking()}
			>
				<Icon icon="mdi:map-outline" class="h-4 w-4" aria-hidden="true" />
				Ir a seguimiento
			</button>
		</div>
	</header>

	{#if loadError}
		<p
			class="nx-glass m-0 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] text-rose-600 dark:text-rose-300"
			role="alert"
		>
			<Icon icon="mdi:alert-circle-outline" class="h-4 w-4 shrink-0" aria-hidden="true" />
			{loadError}
		</p>
	{/if}

	<div class="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2.1fr)]">
		<section class="nx-glass flex flex-col rounded-[18px] p-5" aria-label="Resumen de la flota">
			<p class="nx-label m-0">Flota {marca.isDefault ? 'NEXUS' : marca.name}</p>
			<div class="mt-3">
				{#if busy && unitCount === 0}
					<span
						class="inline-block h-11 w-20 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10"
						aria-hidden="true"
					></span>
					<span class="sr-only">Cargando</span>
				{:else}
					<BigNumber
						value={unitCount}
						decimals={0}
						suffix={unitCount === 1 ? 'unidad' : 'unidades'}
						sizeClass="text-[52px]"
					/>
				{/if}
			</div>
			<div class="mt-auto pt-5">
				<div class="flex items-baseline justify-between text-[12px]">
					<span class="nx-muted">Dispositivos asignados</span>
					<span class="nx-num text-[13px]">{s.assignedDevices} / {s.deviceCount}</span>
				</div>
				<div
					class="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]"
					role="img"
					aria-label="{s.assignedDevices} de {s.deviceCount} dispositivos asignados"
				>
					<span class="h-full bg-slate-900 dark:bg-white/80" style="width: {assignedPct}%"></span>
				</div>
				{#if s.unassignedCount > 0}
					<p class="m-0 mt-2 text-[12px] text-amber-600 dark:text-amber-400">
						{s.unassignedCount} sin asignar
					</p>
				{/if}
			</div>
		</section>

		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{#each tiles as t (t.label)}
				<svelte:element
					this={t.onClick ? 'button' : 'div'}
					type={t.onClick ? 'button' : undefined}
					class="nx-glass flex min-w-0 flex-col rounded-[18px] p-4 text-left {t.onClick
						? 'transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:border-white/20'
						: ''}"
					onclick={t.onClick ?? undefined}
					role={t.onClick ? undefined : 'group'}
					aria-label={t.onClick ? undefined : t.label}
				>
					<span class="flex items-center justify-between gap-2">
						<span class="nx-label">{t.label}</span>
						<Icon icon={t.icon} class="nx-muted h-[18px] w-[18px] shrink-0" aria-hidden="true" />
					</span>
					<span class="mt-3">
						{#if loading && t.label !== 'Unidades' && t.label !== 'Eventos'}
							<span
								class="inline-block h-8 w-12 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10"
								aria-hidden="true"
							></span>
						{:else}
							<BigNumber value={t.value} decimals={0} sizeClass="text-[32px]" />
						{/if}
					</span>
					<span class="mt-2 truncate text-[12px] {toneClass[t.tone]}">{t.hint}</span>
				</svelte:element>
			{/each}
		</div>
	</div>

	{#if unitCount > 0}
		<div class="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
			<KmTodayCard onRetry={onRetryFleetDay} {onOpenReports} />
			<ActivityTodayCard onRetry={onRetryFleetDay} {onSelectUnit} />
		</div>
	{/if}

	<div class="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
		<section class="nx-glass rounded-[18px] p-4" aria-label="Actividad reciente">
			<div class="mb-3 flex items-baseline justify-between gap-2">
				<h2 class="m-0 text-[14px] font-medium">Actividad reciente</h2>
				<span class="nx-label">Eventos de alarma</span>
			</div>
			{#if recentEvents.length === 0}
				<div
					class="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-white/10"
				>
					<Icon icon="mdi:bell-sleep-outline" class="nx-muted h-6 w-6" aria-hidden="true" />
					<p class="m-0 text-[13px]">Sin eventos de hoy.</p>
					<p class="nx-muted m-0 text-[12px]">
						Las alarmas aparecerán aquí cuando se disparen reglas.
					</p>
				</div>
			{:else}
				<ul class="m-0 list-none divide-y divide-slate-200/80 p-0 dark:divide-white/[0.06]">
					{#each recentEvents as ev (ev.id)}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-slate-900/[0.03] focus-visible:outline-2 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-white/[0.04]"
								disabled={!ev.unitId}
								onclick={() => ev.unitId && onSelectUnit(ev.unitId)}
								title={ev.unitId ? 'Ver la unidad en el seguimiento' : undefined}
							>
								<span
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900/[0.05] dark:bg-white/[0.07]"
									aria-hidden="true"
								>
									<Icon icon="mdi:bell-outline" class="h-4 w-4" />
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-[13px] font-medium">{ev.name || 'Evento'}</span>
									<span class="nx-muted block truncate text-[12px]"
										>{ev.vehicle || 'Unidad'} · {formatAlarmWhen(ev.at)}</span
									>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="nx-glass rounded-[18px] p-4" aria-label="Acciones rápidas">
			<h2 class="m-0 mb-3 text-[14px] font-medium">Acciones rápidas</h2>
			<div class="grid grid-cols-2 gap-2">
				{#each quickActions as a (a.go)}
					<button
						type="button"
						class="flex min-h-[4.25rem] flex-col items-start justify-center gap-2 rounded-xl border border-slate-200/80 px-3.5 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-900/[0.03] focus-visible:outline-2 dark:border-white/[0.07] dark:hover:border-white/15 dark:hover:bg-white/[0.04]"
						onclick={() => workspaceActions.goAdmin(/** @type {any} */ (a.go))}
					>
						<Icon icon={a.icon} class="h-[18px] w-[18px]" aria-hidden="true" />
						<span class="text-[12.5px] font-medium">{a.label}</span>
					</button>
				{/each}
			</div>
		</section>
	</div>
</div>
