<script>
	import { goto } from '$app/navigation';
	import { user, authToken } from '$lib/stores/auth.js';
	import { theme } from '$lib/stores/theme.js';

	export let showOptionPanel = false;
	export let toggleOptionPanel = null;
	export let embedded = false;

	let showTheme = false;

	function toggleTheme() {
		showTheme = !showTheme;
	}

	function changeTheme(newTheme) {
		theme.set(newTheme);
	}
</script>

{#if !embedded}
	<button
		on:click={toggleOptionPanel || (() => (showOptionPanel = !showOptionPanel))}
		aria-label="Abrir panel de configuraci&oacute;n"
		class="nav-button"
	>
		<!-- Icono de opciones -->
		<svg class="menu-icon" viewBox="0 0 32 32">
			<path
				d="M23.265,24.381l.9-.894c4.164.136,4.228-.01,4.411-.438l1.144-2.785L29.805,20l-.093-.231c-.049-.122-.2-.486-2.8-2.965V15.5c3-2.89,2.936-3.038,2.765-3.461L28.538,9.225c-.171-.422-.236-.587-4.37-.474l-.9-.93a20.166,20.166,0,0,0-.141-4.106l-.116-.263-2.974-1.3c-.438-.2-.592-.272-3.4,2.786l-1.262-.019c-2.891-3.086-3.028-3.03-3.461-2.855L9.149,3.182c-.433.175-.586.237-.418,4.437l-.893.89c-4.162-.136-4.226.012-4.407.438L2.285,11.733,2.195,12l.094.232c.049.12.194.48,2.8,2.962l0,1.3c-3,2.89-2.935,3.038-2.763,3.462l1.138,2.817c.174.431.236.584,4.369.476l.9.935a20.243,20.243,0,0,0,.137,4.1l.116.265,2.993,1.308c.435.182.586.247,3.386-2.8l1.262.016c2.895,3.09,3.043,3.03,3.466,2.859l2.759-1.115C23.288,28.644,23.44,28.583,23.265,24.381ZM11.407,17.857a4.957,4.957,0,1,1,6.488,2.824A5.014,5.014,0,0,1,11.407,17.857Z"
			></path>
		</svg>
	</button>
{/if}

<!-- Panel de opciones -->
{#if showOptionPanel || embedded}
	<div class={embedded ? '' : 'menu-card'}>
		<div class="controls">
			<p
				class="text-center text-lg font-bold uppercase tracking-widest mb-12 text-app opacity-100 border-b border-[var(--panel-border)] pb-3"
			>
				Configuraciones
			</p>

			<div class="space-y-4">
				<div>
					<button class="large-button justify-between w-full mb-2" on:click={toggleTheme}>
						<div class="flex items-center gap-2">
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z"
									clip-rule="evenodd"
								/>
							</svg>
							<span class="font-semibold tracking-wide text-white/90">Tema</span>
						</div>
						<svg
							class="w-4 h-4 transition-transform text-white/70"
							class:rotate-180={showTheme}
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>

					{#if showTheme}
						<div class="p-3 rounded-lg panel shadow-inner bg-[var(--glass-bg)]">
							<div class="grid grid-cols-3 gap-2">
								<button
									class="px-3 py-2 rounded-md text-xs font-medium transition-all shadow-sm {theme ===
									'dark'
										? 'bg-accent-cyan text-white shadow-accent-cyan/20'
										: 'bg-[var(--btn-secondary-bg)] text-app opacity-70 hover:bg-[var(--btn-secondary-hover-bg)]'}"
									on:click={() => changeTheme('dark')}
								>
									Dark
								</button>
								<button
									class="px-3 py-2 rounded-md text-xs font-medium transition-all shadow-sm {theme ===
									'classic'
										? 'bg-accent-cyan text-white shadow-accent-cyan/20'
										: 'bg-[var(--btn-secondary-bg)] text-app opacity-70 hover:bg-[var(--btn-secondary-hover-bg)]'}"
									on:click={() => changeTheme('classic')}
								>
									Light
								</button>
								<button
									class="px-3 py-2 rounded-md text-xs font-medium transition-all shadow-sm {theme ===
									'modern'
										? 'bg-accent-cyan text-white shadow-accent-cyan/20'
										: 'bg-[var(--btn-secondary-bg)] text-app opacity-70 hover:bg-[var(--btn-secondary-hover-bg)]'}"
									on:click={() => changeTheme('modern')}
								>
									Glass
								</button>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
