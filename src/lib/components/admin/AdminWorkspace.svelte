<script>
	import Icon from '$lib/components/Icon.svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { logoDe, marcaOPorDefecto } from '$lib/brand.js';
	import { user } from '$lib/stores/auth.js';
	import { theme } from '$lib/stores/themeStore.js';
	import { adminSection, workspaceActions } from '$lib/stores/workspaceStore.js';
	import { accountAccess, canEditBrand } from '$lib/stores/accountStore.js';
	import { logoutSession, refreshAccountAccess } from '$lib/services/sessionService.js';
	import { goto } from '$app/navigation';
	import WorkspaceSwitcher from './WorkspaceSwitcher.svelte';
	import AlarmBell from './AlarmBell.svelte';
	import AdminDashboard from './AdminDashboard.svelte';
	import AdminDashboardPanel from './AdminDashboardPanel.svelte';
	import WorkspaceRail from '$lib/components/WorkspaceRail.svelte';
	import '@fontsource/sora/latin-300.css';
	import AdminPanel from '$lib/components/AdminPanel.svelte';
	import DrawerConfiguracion from '$lib/components/DrawerConfiguracion.svelte';
	import BrandWorkspace from '$lib/components/brand/BrandWorkspace.svelte';
	import { viewEnter } from '$lib/motion/index.js';
	import { slidingIndicator } from '$lib/motion/slidingIndicator.js';

	/* Tipografías auto-alojadas (latin/latin-ext): evita transferir la IP a Google Fonts. */
	import '@fontsource/sora/latin-500.css';
	import '@fontsource/sora/latin-600.css';
	import '@fontsource/sora/latin-700.css';
	import '@fontsource/sora/latin-ext-500.css';
	import '@fontsource/sora/latin-ext-600.css';
	import '@fontsource/sora/latin-ext-700.css';
	import '@fontsource/ibm-plex-sans/latin-400.css';
	import '@fontsource/ibm-plex-sans/latin-500.css';
	import '@fontsource/ibm-plex-sans/latin-600.css';
	import '@fontsource/ibm-plex-sans/latin-ext-400.css';
	import '@fontsource/ibm-plex-sans/latin-ext-500.css';
	import '@fontsource/ibm-plex-sans/latin-ext-600.css';

	const allNavItems = [
		{ id: 'dashboard', label: 'Dashboard', icon: 'mdi:view-dashboard-outline' },
		{ id: 'users', label: 'Usuarios', icon: 'mdi:account-group-outline' },
		{ id: 'units', label: 'Unidades', icon: 'mdi:car-side' },
		{ id: 'devices', label: 'Dispositivos', icon: 'mdi:memory' },
		{ id: 'brand', label: 'Marca', icon: 'mdi:palette-outline' },
		{ id: 'settings', label: 'Configuración', icon: 'mdi:cog-outline' }
	];

	const sectionMeta = {
		dashboard: { title: 'Dashboard' },
		users: { title: 'Usuarios', locked: 'usuarios' },
		units: { title: 'Unidades', locked: 'unidades' },
		devices: { title: 'Dispositivos', locked: 'dispositivos' },
		brand: { title: 'Marca' },
		settings: { title: 'Configuración' }
	};

	/**
	 * Vista Panel (preferencia del usuario, md+): mismo riel angosto y mismas
	 * superficies grises que el seguimiento nuevo. Con `false` todo queda como antes.
	 */
	export let panel = false;
	/** Vista Panel: reintento de los paneles del día (los pide la página). */
	export let onRetryFleetDay = () => {};
	/** Vista Panel: abre una unidad en el seguimiento. @type {(id: any) => void} */
	export let onSelectUnit = () => {};
	/** Vista Panel: abre Informes en el seguimiento. */
	export let onOpenReports = null;

	/** Superficie de las secciones embebidas. */
	$: cardClass = panel
		? 'flex min-h-0 flex-1 flex-col overflow-auto rounded-[18px] border border-slate-200/80 bg-white dark:border-white/[0.07] dark:bg-[#15171b]'
		: 'flex min-h-0 flex-1 flex-col overflow-auto rounded-2xl border border-slate-200/90 bg-white dark:border-white/[0.08] dark:bg-[#0d1424]';
	$: titleClass = panel
		? 'nx-num m-0 mt-1 text-[30px] leading-[1.1] text-slate-900 dark:text-white'
		: 'admin-display m-0 text-[1.5rem] font-semibold tracking-tight text-slate-900 dark:text-white';

	/** En móvil arranca colapsado para dejar espacio al contenido. */
	let collapsed = browser ? window.matchMedia('(max-width: 639px)').matches : false;
	let showUserMenu = false;

	// «Marca» se muestra con `branding.write` y `white_label_enabled`; ocultarla
	// es comodidad, el backend vuelve a comprobar las dos cosas (B4).
	$: brandAllowed = canEditBrand($accountAccess);
	$: navItems = allNavItems.filter((item) => item.id !== 'brand' || brandAllowed);

	$: section = $adminSection;
	$: if (section === 'reports') {
		// Sección movida a Seguimiento; limpia estado residual.
		workspaceActions.setAdminSection('dashboard');
	}
	$: if (section === 'brand' && !brandAllowed) {
		// Se perdió el permiso (otra cuenta, logout) con la sección abierta.
		workspaceActions.setAdminSection('dashboard');
	}
	$: meta = sectionMeta[section] ?? sectionMeta.dashboard;
	$: displayName = $user?.name || $user?.full_name || 'Admin';
	$: initial = displayName.charAt(0).toUpperCase();

	function go(id) {
		workspaceActions.setAdminSection(id);
		showUserMenu = false;
	}

	function onDocClick(e) {
		if (!e.target.closest('[data-admin-user-menu]')) showUserMenu = false;
	}

	onMount(() => {
		// Refuerza colapsado en viewport móvil tras hidratar.
		if (window.matchMedia('(max-width: 639px)').matches) collapsed = true;
		// Lo que GAC haya activado desde que se inició sesión (p. ej. la marca
		// propia) aparece en el menú sin cerrar sesión.
		refreshAccountAccess();
	});

	// La marca del dominio (§7), resuelta en el servidor: sale bien desde el primer HTML.
	const marca = marcaOPorDefecto(page.data.brand);
	const logoUrl = logoDe(marca);
</script>

<svelte:window on:click={onDocClick} />

<div
	data-look={panel ? 'panel' : undefined}
	class="admin-workspace flex h-screen w-screen overflow-hidden antialiased {panel
		? 'bg-[#eef0f3] text-slate-900 dark:bg-[#0b0c0e] dark:text-[#eceef0]'
		: 'bg-slate-100 text-slate-900 dark:bg-[#060a12] dark:text-white'}"
	style="font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;"
	data-theme={$theme}
>
	{#if panel}
		<aside
			class="relative z-20 flex h-full w-[72px] shrink-0 flex-col items-center gap-1 border-r border-slate-200 bg-white py-4 dark:border-white/[0.07] dark:bg-[#0e0f12]"
			aria-label="Navegación de administración"
		>
			<img
				src={logoUrl}
				alt={marca.name}
				class="mb-1 h-[34px] w-10 object-contain"
				width="40"
				height="34"
				decoding="async"
			/>
			<div
				class="my-2 h-px w-9 shrink-0 bg-slate-200 dark:bg-white/[0.08]"
				role="presentation"
			></div>
			<WorkspaceRail />
			<div
				class="my-2 h-px w-9 shrink-0 bg-slate-200 dark:bg-white/[0.08]"
				role="presentation"
			></div>
			<nav class="flex flex-1 flex-col items-center gap-1" aria-label="Secciones">
				{#each navItems as item (item.id)}
					{@const on = section === item.id}
					<button
						type="button"
						class="relative flex h-12 w-12 items-center justify-center rounded-[14px] border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60
							{on
							? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-white/[0.12] dark:bg-white/[0.07] dark:text-white'
							: 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white/85'}"
						aria-current={on ? 'page' : undefined}
						aria-label={item.label}
						title={item.label}
						on:click={() => go(item.id)}
					>
						<Icon icon={item.icon} class="h-[22px] w-[22px] shrink-0" aria-hidden="true" />
					</button>
				{/each}
			</nav>
		</aside>
	{:else}
		<aside
			class="relative z-20 flex h-full shrink-0 flex-col border-r border-slate-200/90 bg-white transition-[width] duration-200 dark:border-white/[0.07] dark:bg-[#080d18]
			{collapsed ? 'w-[72px]' : 'w-[232px]'}"
			aria-label="Navegación de administración"
		>
			<div
				class="flex h-14 items-center gap-2.5 border-b border-slate-100 px-3 dark:border-white/[0.06]"
			>
				<img
					src={logoUrl}
					alt={marca.name}
					class="h-8 w-9 object-contain"
					width="36"
					height="32"
					decoding="async"
				/>
				{#if !collapsed}
					<span
						class="admin-display text-[15px] font-semibold tracking-wide text-slate-900 dark:text-white"
						>{marca.isDefault ? 'NEXUS' : marca.name}</span
					>
				{/if}
			</div>

			<nav
				class="relative flex flex-1 flex-col gap-0.5 overflow-y-auto p-2"
				aria-label="Secciones"
				use:slidingIndicator={{
					active: section,
					selector: '[aria-current="page"]',
					class: 'rounded-xl bg-brand-500/15'
				}}
			>
				{#each navItems as item (item.id)}
					<button
						type="button"
						class="relative flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50
						{section === item.id
							? 'text-brand-800 dark:text-brand-200'
							: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-white/45 dark:hover:bg-white/[0.05] dark:hover:text-white/85'}
						{collapsed ? 'justify-center px-0' : ''}"
						aria-current={section === item.id ? 'page' : undefined}
						title={item.label}
						on:click={() => go(item.id)}
					>
						<Icon icon={item.icon} width={20} class="shrink-0" aria-hidden="true" />
						{#if !collapsed}
							<span class="truncate">{item.label}</span>
						{/if}
					</button>
				{/each}
			</nav>

			<button
				type="button"
				class="group m-2 flex h-11 w-[calc(100%-1rem)] items-center justify-center self-center rounded-xl border border-brand-500/25 bg-brand-500/10 text-brand-700 transition-[background,border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-brand-400/50 hover:bg-brand-500/20 hover:shadow-[0_8px_20px_rgba(16,185,129,0.2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 dark:border-brand-400/25 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:border-brand-300/45 dark:hover:bg-brand-500/20
				{collapsed ? 'w-11' : ''}"
				on:click={() => (collapsed = !collapsed)}
				aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
				title={collapsed ? 'Expandir menú' : 'Contraer menú'}
			>
				<Icon
					icon={collapsed ? 'mdi:menu-close' : 'mdi:menu-open'}
					width={22}
					class="transition-transform duration-200 group-hover:scale-110"
					aria-hidden="true"
				/>
			</button>
		</aside>
	{/if}

	<div class="flex min-w-0 flex-1 flex-col">
		<header
			class="relative z-30 flex h-14 shrink-0 items-center gap-3 px-3 sm:px-5 {panel
				? ''
				: 'border-b border-slate-200/90 bg-white backdrop-blur-md dark:border-white/[0.07] dark:bg-[#080d18]'}"
		>
			{#if !panel}
				<WorkspaceSwitcher />
			{/if}
			<div class="min-w-0 flex-1" aria-hidden="true"></div>
			<AlarmBell compact />
			<div class="relative" data-admin-user-menu>
				<button
					type="button"
					class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-1 pr-2.5 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
					aria-expanded={showUserMenu}
					aria-haspopup="true"
					on:click|stopPropagation={() => (showUserMenu = !showUserMenu)}
				>
					<span
						data-look="keep"
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-deep text-[13px] font-bold text-white"
						aria-hidden="true">{initial}</span
					>
					<span class="hidden min-w-0 sm:block">
						<span
							class="block max-w-[9rem] truncate text-[12px] font-semibold text-slate-800 dark:text-white"
							>{displayName}</span
						>
						<span class="block text-[10px] font-medium text-brand-700 dark:text-brand-300/90"
							>Administrador</span
						>
					</span>
					<Icon icon="mdi:chevron-down" width={16} class="text-slate-400" aria-hidden="true" />
				</button>
				{#if showUserMenu}
					<div
						class="absolute right-0 top-[calc(100%+6px)] z-[70] w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#0b1220]"
						role="menu"
					>
						<button
							type="button"
							role="menuitem"
							class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-slate-700 hover:bg-slate-50 dark:text-white/75 dark:hover:bg-white/[0.05]"
							on:click={() => go('settings')}
						>
							<Icon icon="mdi:cog-outline" width={16} />
							Configuración
						</button>
						<button
							type="button"
							role="menuitem"
							class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
							on:click={async () => {
								await logoutSession();
								goto('/login');
							}}
						>
							<Icon icon="mdi:logout" width={16} />
							Cerrar sesión
						</button>
					</div>
				{/if}
			</div>
		</header>

		<main class="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4" aria-label={meta.title}>
			{#if section === 'dashboard'}
				<div in:viewEnter>
					{#if panel}
						<AdminDashboardPanel {onRetryFleetDay} {onSelectUnit} {onOpenReports} />
					{:else}
						<AdminDashboard />
					{/if}
				</div>
			{:else if section === 'users' || section === 'units' || section === 'devices'}
				<div class="flex min-h-0 flex-1 flex-col" in:viewEnter>
					<div class="mb-3 shrink-0">
						{#if panel}<p class="nx-label m-0">Administración</p>{/if}
						<h1 class={titleClass}>
							{meta.title}
						</h1>
						<p class="m-0 mt-1 text-sm {panel ? 'nx-muted' : 'text-slate-500 dark:text-white/45'}">
							Gestión desde siscom-admin-api
						</p>
					</div>
					<div class="admin-embed {cardClass}">
						{#key section}
							<div class="flex min-h-0 flex-1 flex-col" in:viewEnter>
								<AdminPanel embedded={true} lockedSection={meta.locked} />
							</div>
						{/key}
					</div>
				</div>
			{:else if section === 'brand' && brandAllowed}
				<div class="flex min-h-0 flex-1 flex-col" in:viewEnter>
					<div class="mb-3 shrink-0">
						{#if panel}<p class="nx-label m-0">Administración</p>{/if}
						<h1 class={titleClass}>Marca</h1>
						<p class="m-0 mt-1 text-sm {panel ? 'nx-muted' : 'text-slate-500 dark:text-white/45'}">
							Nombre, logos y colores con los que tus usuarios ven la plataforma
						</p>
					</div>
					<!-- Marca muestra los colores reales del partner: fuera de la piel de Panel. -->
					<div class={cardClass} data-look="keep">
						{#key $accountAccess.accountId}
							<BrandWorkspace accountId={$accountAccess.accountId} />
						{/key}
					</div>
				</div>
			{:else if section === 'settings'}
				<div class="flex min-h-0 flex-1 flex-col" in:viewEnter>
					<div class="mb-3 shrink-0">
						{#if panel}<p class="nx-label m-0">Administración</p>{/if}
						<h1 class={titleClass}>Configuración</h1>
						<p class="m-0 mt-1 text-sm {panel ? 'nx-muted' : 'text-slate-500 dark:text-white/45'}">
							Apariencia y preferencias
						</p>
					</div>
					<div class={cardClass}>
						<DrawerConfiguracion initialSection="apariencia" showSectionSidebar={false} />
					</div>
				</div>
			{/if}
		</main>
	</div>
</div>

<style>
	:global(.admin-workspace .admin-display),
	:global(.admin-workspace .admin-stat-value) {
		font-family: 'Sora', 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
	}

	:global(.admin-embed .admin-panel.embedded) {
		padding: 1rem 1.25rem 1.25rem;
		max-width: none;
		width: 100%;
		flex: 1;
		min-height: 0;
	}
</style>
