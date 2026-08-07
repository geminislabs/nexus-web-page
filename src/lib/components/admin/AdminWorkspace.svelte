<script>
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import logoUrl from '$lib/assets/logo.png';
	import { user } from '$lib/stores/auth.js';
	import { theme } from '$lib/stores/themeStore.js';
	import { adminSection, workspaceActions } from '$lib/stores/workspaceStore.js';
	import { logoutSession } from '$lib/services/sessionService.js';
	import { goto } from '$app/navigation';
	import WorkspaceSwitcher from './WorkspaceSwitcher.svelte';
	import AlarmBell from './AlarmBell.svelte';
	import AdminDashboard from './AdminDashboard.svelte';
	import AdminPanel from '$lib/components/AdminPanel.svelte';
	import TabInformes from '$lib/components/TabInformes.svelte';
	import DrawerConfiguracion from '$lib/components/DrawerConfiguracion.svelte';

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

	const navItems = [
		{ id: 'dashboard', label: 'Dashboard', icon: 'mdi:view-dashboard-outline' },
		{ id: 'users', label: 'Usuarios', icon: 'mdi:account-group-outline' },
		{ id: 'units', label: 'Unidades', icon: 'mdi:car-side' },
		{ id: 'devices', label: 'Dispositivos', icon: 'mdi:memory' },
		{ id: 'reports', label: 'Informes', icon: 'mdi:file-chart-outline' },
		{ id: 'settings', label: 'Configuración', icon: 'mdi:cog-outline' }
	];

	const sectionMeta = {
		dashboard: { title: 'Dashboard' },
		users: { title: 'Usuarios', locked: 'usuarios' },
		units: { title: 'Unidades', locked: 'unidades' },
		devices: { title: 'Dispositivos', locked: 'dispositivos' },
		reports: { title: 'Informes' },
		settings: { title: 'Configuración' }
	};

	/** En móvil arranca colapsado para dejar espacio al contenido. */
	let collapsed = browser ? window.matchMedia('(max-width: 639px)').matches : false;
	let showUserMenu = false;

	$: section = $adminSection;
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
	});
</script>

<svelte:window on:click={onDocClick} />

<div
	class="admin-workspace flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-900 antialiased dark:bg-[#060a12] dark:text-white"
	style="font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;"
	data-theme={$theme}
>
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
				alt="NEXUS"
				class="h-8 w-9 object-contain"
				width="36"
				height="32"
				decoding="async"
			/>
			{#if !collapsed}
				<span
					class="admin-display text-[15px] font-semibold tracking-wide text-slate-900 dark:text-white"
					>NEXUS</span
				>
			{/if}
		</div>

		<nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="Secciones">
			{#each navItems as item (item.id)}
				<button
					type="button"
					class="flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50
						{section === item.id
						? 'bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
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
			class="group m-2 flex h-11 w-[calc(100%-1rem)] items-center justify-center self-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 transition-[background,border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-emerald-400/50 hover:bg-emerald-500/20 hover:shadow-[0_8px_20px_rgba(16,185,129,0.2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:border-emerald-300/45 dark:hover:bg-emerald-500/20
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

	<div class="flex min-w-0 flex-1 flex-col">
		<header
			class="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/90 bg-white px-3 backdrop-blur-md dark:border-white/[0.07] dark:bg-[#080d18] sm:px-5"
		>
			<WorkspaceSwitcher />
			<div class="min-w-0 flex-1" aria-hidden="true"></div>
			<AlarmBell compact />
			<div class="relative" data-admin-user-menu>
				<button
					type="button"
					class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-1 pr-2.5 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
					aria-expanded={showUserMenu}
					aria-haspopup="true"
					on:click|stopPropagation={() => (showUserMenu = !showUserMenu)}
				>
					<span
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-[13px] font-bold text-white"
						aria-hidden="true">{initial}</span
					>
					<span class="hidden min-w-0 sm:block">
						<span
							class="block max-w-[9rem] truncate text-[12px] font-semibold text-slate-800 dark:text-white"
							>{displayName}</span
						>
						<span class="block text-[10px] font-medium text-emerald-700 dark:text-emerald-300/90"
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
				<AdminDashboard />
			{:else if section === 'users' || section === 'units' || section === 'devices'}
				<div class="flex min-h-0 flex-1 flex-col">
					<div class="mb-3 shrink-0">
						<h1
							class="admin-display m-0 text-[1.5rem] font-semibold tracking-tight text-slate-900 dark:text-white"
						>
							{meta.title}
						</h1>
						<p class="m-0 mt-1 text-sm text-slate-500 dark:text-white/45">
							Gestión desde siscom-admin-api
						</p>
					</div>
					<div
						class="admin-embed flex min-h-0 flex-1 flex-col overflow-auto rounded-2xl border border-slate-200/90 bg-white dark:border-white/[0.08] dark:bg-[#0d1424]"
					>
						{#key section}
							<AdminPanel embedded={true} lockedSection={meta.locked} />
						{/key}
					</div>
				</div>
			{:else if section === 'reports'}
				<div class="flex min-h-0 flex-1 flex-col">
					<div class="mb-3 shrink-0">
						<h1
							class="admin-display m-0 text-[1.5rem] font-semibold tracking-tight text-slate-900 dark:text-white"
						>
							Informes
						</h1>
						<p class="m-0 mt-1 text-sm text-slate-500 dark:text-white/45">
							Telemetría y reportes de unidades
						</p>
					</div>
					<div
						class="flex min-h-0 flex-1 flex-col overflow-auto rounded-2xl border border-slate-200/90 bg-white p-3 dark:border-white/[0.08] dark:bg-[#0d1424] sm:p-4"
					>
						<TabInformes />
					</div>
				</div>
			{:else if section === 'settings'}
				<div class="flex min-h-0 flex-1 flex-col">
					<div class="mb-3 shrink-0">
						<h1
							class="admin-display m-0 text-[1.5rem] font-semibold tracking-tight text-slate-900 dark:text-white"
						>
							Configuración
						</h1>
						<p class="m-0 mt-1 text-sm text-slate-500 dark:text-white/45">
							Apariencia y preferencias
						</p>
					</div>
					<div
						class="flex min-h-0 flex-1 flex-col overflow-auto rounded-2xl border border-slate-200/90 bg-white dark:border-white/[0.08] dark:bg-[#0d1424]"
					>
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
