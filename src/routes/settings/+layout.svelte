<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/i18n/index.svelte';
	import { Settings2, Wrench } from '@lucide/svelte';

	let { children } = $props();

	// Tabs of the settings area; each one is its own page.
	let tabs = $derived([
		{ href: '/settings', label: m.settings.general, icon: Settings2 },
		{ href: '/settings/maintenance', label: m.maintenance.title, icon: Wrench }
	]);
</script>

<div class="mx-auto max-w-screen-sm px-4 pt-4">
	<h1 class="text-2xl font-bold">{m.settings.title}</h1>
	<nav class="mt-4 grid grid-cols-2 border-b border-zinc-800">
		{#each tabs as tab (tab.href)}
			{@const active = page.url.pathname === tab.href}
			<a
				href={tab.href}
				aria-current={active ? 'page' : undefined}
				class="-mb-px flex items-center justify-center gap-2 border-b-2 py-2.5 text-sm font-medium transition-colors {active
					? 'border-zinc-100 text-zinc-100'
					: 'border-transparent text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}"
			>
				<tab.icon size={18} />
				{tab.label}
			</a>
		{/each}
	</nav>
</div>

{@render children()}
