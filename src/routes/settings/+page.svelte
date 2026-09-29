<script lang="ts">
	import { goto } from '$app/navigation';
	import { m } from '$lib/i18n/index.svelte';
	import { settingsGroups } from '$lib/settingsNav';
	import { ChevronRight } from '@lucide/svelte';

	let { data } = $props();

	let groups = $derived(
		settingsGroups().filter((g) => g.items.length && (g.items[0].group !== 'admin' || data.isAdmin))
	);

	// Computers show the sidebar next to the content, so go straight to the first area.
	$effect(() => {
		if (window.matchMedia('(min-width: 48rem)').matches) {
			goto('/settings/general', { replaceState: true });
		}
	});
</script>

<svelte:head><title>{m.settings.title} · hdtracker</title></svelte:head>

<!-- Phones: list of all areas, grouped (like the iOS settings) -->
<div class="flex flex-col gap-6 md:hidden">
	{#each groups as group, i (i)}
		<div>
			{#if group.title}
				<p class="px-1 pb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
					{group.title}
				</p>
			{/if}
			<ul
				class="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40"
			>
				{#each group.items as item (item.href)}
					<li>
						<a
							href={item.href}
							class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-800"
						>
							<item.icon size={20} class="shrink-0 text-zinc-400" />
							<span class="min-w-0 flex-1">
								<span class="block text-sm font-medium">{item.label}</span>
								<span class="block truncate text-xs text-zinc-500">{item.hint}</span>
							</span>
							<ChevronRight size={18} class="shrink-0 text-zinc-600" />
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</div>
