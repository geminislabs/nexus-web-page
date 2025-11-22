<script>
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { user, authToken } from '$lib/stores/auth.js';
	import UserPanel from './UserPanel.svelte';
	import VehiclePanel from './VehiclePanel.svelte';
	import AdminPanel from './AdminPanel.svelte';
	import OptionPanel from './OptionPanel.svelte';

	export let userData = null;

	let activeMenu = null; // 'user', 'vehicle', 'options' or null

	function toggleMenu(menu) {
		if (activeMenu === menu) {
			activeMenu = null;
		} else {
			activeMenu = menu;
		}
	}

	function closeMenu() {
		activeMenu = null;
	}

	function handleLogout() {
		user.logout();
		authToken.clearToken();
		goto('/login');
	}
</script>

<!-- Sidebar Container -->
<div class="sidebar" class:expanded={activeMenu !== null}>
	<!-- Logo Area -->
	<div class="logo-area">
		<img src="/img/logo-nexus-short.png" alt="Nexus" class="logo-img" />
	</div>

	<!-- Menu Icons -->
	<div class="menu-icons">
		<!-- User Icon -->
		<button
			class="sidebar-btn"
			class:active={activeMenu === 'user'}
			on:click={() => toggleMenu('user')}
			aria-label="Usuario"
		>
			<svg class="icon" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>

		<!-- Vehicle Icon -->
		<button
			class="sidebar-btn"
			class:active={activeMenu === 'vehicle'}
			on:click={() => toggleMenu('vehicle')}
			aria-label="Vehículos"
		>
			<svg
				class="icon"
				fill="currentColor"
				viewBox="-12.29 -12.29 147.46 147.46"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M10.17,34.23c-10.98-5.58-9.72-11.8,1.31-11.15l2.47,4.63l5.09-15.83C21.04,5.65,24.37,0,30.9,0H96 c6.53,0,10.29,5.54,11.87,11.87l3.82,15.35l2.2-4.14c11.34-0.66,12.35,5.93,0.35,11.62l1.95,2.99c7.89,8.11,7.15,22.45,5.92,42.48 v8.14c0,2.04-1.67,3.71-3.71,3.71h-15.83c-2.04,0-3.71-1.67-3.71-3.71v-4.54H24.04v4.54c0,2.04-1.67,3.71-3.71,3.71H4.5 c-2.04,0-3.71-1.67-3.71-3.71V78.2c0-0.2,0.02-0.39,0.04-0.58C-0.37,62.25-2.06,42.15,10.17,34.23L10.17,34.23z M30.38,58.7 l-14.06-1.77c-3.32-0.37-4.21,1.03-3.08,3.89l1.52,3.69c0.49,0.95,1.14,1.64,1.9,2.12c0.89,0.55,1.96,0.82,3.15,0.87l12.54,0.1 c3.03-0.01,4.34-1.22,3.39-4C34.96,60.99,33.18,59.35,30.38,58.7L30.38,58.7z M54.38,52.79h14.4c0.85,0,1.55,0.7,1.55,1.55l0,0 c0,0.85-0.7,1.55-1.55,1.55h-14.4c-0.85,0-1.55-0.7-1.55-1.55l0,0C52.82,53.49,53.52,52.79,54.38,52.79L54.38,52.79z M89.96,73.15 h14.4c0.85,0,1.55,0.7,1.55,1.55l0,0c0,0.85-0.7,1.55-1.55,1.55h-14.4c-0.85,0-1.55-0.7-1.55-1.55l0,0 C88.41,73.85,89.1,73.15,89.96,73.15L89.96,73.15z M92.5,58.7l14.06-1.77c3.32-0.37,4.21,1.03,3.08,3.89l-1.52,3.69 c-0.49,0.95-1.14,1.64-1.9,2.12c-0.89,0.55-1.96,0.82-3.15,0.87l-12.54,0.1c-3.03-0.01-4.34-1.22-3.39-4 C87.92,60.99,89.7,59.35,92.5,58.7L92.5,58.7z M18.41,73.15h14.4c0.85,0,1.55,0.7,1.55,1.55l0,0c0,0.85-0.7,1.55-1.55,1.55h-14.4 c-0.85,0-1.55-0.7-1.55-1.55l0,0C16.86,73.85,17.56,73.15,18.41,73.15L18.41,73.15z M19.23,31.2h86.82l-3.83-15.92 c-1.05-4.85-4.07-9.05-9.05-9.05H33.06c-4.97,0-7.52,4.31-9.05,9.05L19.23,31.2v0.75V31.2L19.23,31.2z"
				/>
			</svg>
		</button>

		<!-- Admin Icon (Only for masters) -->
		{#if userData?.is_master}
			<button
				class="sidebar-btn"
				class:active={activeMenu === 'admin'}
				on:click={() => toggleMenu('admin')}
				aria-label="Administración"
			>
				<svg class="icon" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		{/if}

		<!-- Options Icon -->
		<button
			class="sidebar-btn"
			class:active={activeMenu === 'options'}
			on:click={() => toggleMenu('options')}
			aria-label="Configuración"
		>
			<svg class="icon" viewBox="0 0 32 32" fill="currentColor">
				<path
					d="M23.265,24.381l.9-.894c4.164.136,4.228-.01,4.411-.438l1.144-2.785L29.805,20l-.093-.231c-.049-.122-.2-.486-2.8-2.965V15.5c3-2.89,2.936-3.038,2.765-3.461L28.538,9.225c-.171-.422-.236-.587-4.37-.474l-.9-.93a20.166,20.166,0,0,0-.141-4.106l-.116-.263-2.974-1.3c-.438-.2-.592-.272-3.4,2.786l-1.262-.019c-2.891-3.086-3.028-3.03-3.461-2.855L9.149,3.182c-.433.175-.586.237-.418,4.437l-.893.89c-4.162-.136-4.226.012-4.407.438L2.285,11.733,2.195,12l.094.232c.049.12.194.48,2.8,2.962l0,1.3c-3,2.89-2.935,3.038-2.763,3.462l1.138,2.817c.174.431.236.584,4.369.476l.9.935a20.243,20.243,0,0,0,.137,4.1l.116.265,2.993,1.308c.435.182.586.247,3.386-2.8l1.262.016c2.895,3.09,3.043,3.03,3.466,2.859l2.759-1.115C23.288,28.644,23.44,28.583,23.265,24.381ZM11.407,17.857a4.957,4.957,0,1,1,6.488,2.824A5.014,5.014,0,0,1,11.407,17.857Z"
				></path>
			</svg>
		</button>

		<!-- Logout Button -->
		<button class="sidebar-btn logout-btn" on:click={handleLogout} aria-label="Cerrar Sesión">
			<svg class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9"
				/>
			</svg>
		</button>
	</div>

	<!-- Expanded Content -->
	<div class="sidebar-content">
		{#if activeMenu === 'user'}
			<div in:fade={{ duration: 200 }}>
				<UserPanel {userData} embedded={true} />
			</div>
		{:else if activeMenu === 'vehicle'}
			<div in:fade={{ duration: 200 }}>
				<VehiclePanel embedded={true} />
			</div>
		{:else if activeMenu === 'admin'}
			<div in:fade={{ duration: 200 }}>
				<AdminPanel embedded={true} />
			</div>
		{:else if activeMenu === 'options'}
			<div in:fade={{ duration: 200 }}>
				<OptionPanel embedded={true} />
			</div>
		{/if}
	</div>
</div>

<style>
	.sidebar {
		position: fixed;
		left: 0;
		top: 0;
		bottom: 0;
		width: 60px; /* Collapsed width */
		background: var(--glass-bg);
		backdrop-filter: blur(12px);
		border-right: 1px solid var(--glass-border);
		z-index: 50;
		display: flex;
		flex-direction: column;
		transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		overflow: hidden;
	}

	.sidebar.expanded {
		width: 360px; /* Expanded width */
	}

	.logo-area {
		height: 60px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		padding: 10px;
		background-color: rgba(255, 255, 255, 0.01);
	}

	.logo-img {
		max-width: 25px;
		max-height: 26px;
		object-fit: contain;
		transition: all 0.3s ease;
	}

	.sidebar:not(.expanded) .logo-img {
		/* Optional: Adjust logo when collapsed if needed, e.g. smaller or different icon */
	}

	.menu-icons {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 2rem;
		gap: 1.5rem;
		width: 60px; /* Fixed width for icon column */
		flex-shrink: 0;
		position: absolute;
		top: 60px;
		bottom: 0;
		left: 0;
		background: rgba(0, 0, 0, 0.1); /* Slight shade for icon strip */
	}

	.sidebar-btn {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--app-text);
		transition: all 0.2s ease;
		opacity: 0.7;
	}

	.sidebar-btn:hover {
		background: var(--btn-secondary-hover-bg);
		color: var(--accent-cyan);
		opacity: 1;
		transform: scale(1.1);
	}

	.sidebar-btn.active {
		background: var(--accent-cyan);
		color: white;
		opacity: 1;
		box-shadow: 0 0 15px var(--accent-cyan);
	}

	.icon {
		width: 24px;
		height: 24px;
	}

	.sidebar-content {
		position: absolute;
		left: 80px;
		top: 80px;
		right: 0;
		bottom: 0;
		padding: 1.5rem 1.5rem 1.5rem 1.5rem; /* Increased left padding */
		overflow-y: auto;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s ease 0.1s;
	}

	.sidebar.expanded .sidebar-content {
		opacity: 1;
		pointer-events: auto;
	}
	.logout-btn {
		margin-top: auto;
		margin-bottom: 2rem;
		color: #ef4444; /* Red-500 */
		opacity: 0.8;
		border-radius: 50%;
		width: 32px;
		height: 32px;
	}

	.logout-btn:hover {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
	}
</style>
