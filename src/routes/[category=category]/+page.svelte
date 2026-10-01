<script lang="ts">
	import { CATEGORIES } from '$lib/categories';
	import { COLLAPSED_STATUSES, statusesFor } from '$lib/status';
	import { m, statusLabel } from '$lib/i18n/index.svelte';
	import { titles } from '$lib/titles.svelte';
	import PosterCard from '$lib/components/PosterCard.svelte';
	import ItemSheet, { type SheetItem } from '$lib/components/ItemSheet.svelte';
	import { STATUS_ICONS } from '$lib/statusIcons';
	import { ChevronRight } from '@lucide/svelte';

	let { data } = $props();

	let cat = $derived(CATEGORIES[data.category]);
	let label = $derived(m.categories[data.category]);

	// Library grouped by status, in section order; empty sections are skipped.
	let sections = $derived(
		statusesFor(data.category)
			.map((status) => ({ status, items: data.library.filter((i) => i.status === status) }))
			.filter((s) => s.items.length > 0)
	);

	// Item shown in the bottom sheet (null = closed)
	let selected = $state<SheetItem | null>(null);

	// Phones: 3 posters per row; larger screens: as many as fit (at least ~10rem wide each).
	const gridClass = 'grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]';
</script>

<svelte:head><title>{label} · hdtracker</title></svelte:head>

<main class="app-width p-4" style:--accent={cat.accent}>
	<!-- The area is shown in the bottom navigation and the search field; heading only for screen readers -->
	<h1 class="sr-only">{label}</h1>

	{#if data.q}
		<!-- Search results -->
		<div class="mt-1 flex items-center justify-between text-sm">
			<span class="text-zinc-400">
				{#if !data.error}{m.library.results(data.results.length, data.q)}{/if}
			</span>
			<a href="/{data.category}" class="text-(--accent) hover:underline">{m.library.toLibrary}</a>
		</div>

		{#if data.error}
			<p class="mt-4 rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">
				{data.error}
			</p>
		{:else if data.results.length === 0}
			<p class="mt-6 text-zinc-400">{m.library.noResults}</p>
		{:else}
			<ul class="mt-2 {gridClass}">
				{#each data.results as item (item.externalId)}
					<li>
						<PosterCard
							title={titles(data.category, item).main}
							year={item.year}
							earlyAccess={item.earlyAccess}
							posterUrl={item.posterUrl}
							badge={item.status ? statusLabel(data.category, item.status) : null}
							onclick={() => (selected = item)}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if sections.length === 0}
		<p class="mt-2 text-zinc-500">{m.library.empty}</p>
	{:else}
		<!-- Library, one collapsible section per status -->
		{#each sections as section (section.status)}
			{@const Icon = STATUS_ICONS[section.status]}
			<details
				class="group mt-6 first-of-type:mt-1"
				open={!COLLAPSED_STATUSES.includes(section.status)}
			>
				<summary
					class="group/summary flex cursor-pointer list-none items-center gap-2 select-none [&::-webkit-details-marker]:hidden"
				>
					<ChevronRight
						size={18}
						class="text-zinc-500 transition group-open:rotate-90 group-hover/summary:text-zinc-200"
					/>
					<Icon size={18} class="text-(--accent)" />
					<h2 class="text-lg font-semibold">{statusLabel(data.category, section.status)}</h2>
				</summary>
				<ul class="mt-3 {gridClass}">
					{#each section.items as item (item.id)}
						<li>
							<PosterCard
								title={titles(data.category, item).main}
								year={item.year}
								earlyAccess={item.earlyAccess}
								posterUrl={item.posterUrl}
								loading={item.metadataUpdatedAt === null}
								onclick={() => (selected = item)}
							/>
						</li>
					{/each}
				</ul>
			</details>
		{/each}
	{/if}

	<ItemSheet category={data.category} item={selected} onclose={() => (selected = null)} />
</main>
