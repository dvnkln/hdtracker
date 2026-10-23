<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { CATEGORIES, type Category } from '#lib/categories.js';
	import { m } from '#lib/i18n/index.svelte.js';
	import { img } from '#lib/images.js';
	import { sharingFor } from '#lib/sharing.js';
	import { STREAMING_AREAS } from '#lib/status.js';
	import { titles } from '#lib/titles.svelte.js';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PosterCard from '#lib/components/PosterCard.svelte';
	import ItemSheet, { type SheetItem } from '#lib/components/ItemSheet.svelte';
	import { ArrowLeft, Clapperboard, CloudOff } from '@lucide/svelte';

	let { data } = $props();

	// The tile "in no subscription" in the address (no service is called like this)
	const NOWHERE = '-';
	type Tile = { key: string; name: string; logoUrl: string | null; ids: number[] };
	let tiles: Tile[] = $derived([
		...data.services.map((service) => ({ key: service.name, ...service })),
		...(data.nowhere.length
			? [{ key: NOWHERE, name: m.streaming.nowhere, logoUrl: null, ids: data.nowhere }]
			: [])
	]);

	// The chosen service stands in the address (?s=Netflix), so the way back leads to the tiles
	let wanted = $derived(page.url.searchParams.get('s'));
	let chosen = $derived(wanted === null ? undefined : tiles.find((tile) => tile.key === wanted));
	// A service that is not (or no longer) there – its last title was just watched, say: back to
	// the tiles, without leaving the old address in the history
	$effect(() => {
		if (wanted !== null && !chosen) goto('/streaming', { replace: true });
	});
	const tileHref = (tile: Tile) => `?s=${encodeURIComponent(tile.key)}`;

	let byId = $derived(new Map(data.items.map((item) => [item.id, item])));
	// The titles of the chosen service by area, in the order of the bottom navigation
	let sections = $derived(
		STREAMING_AREAS.map((area) => ({
			area,
			items: (chosen?.ids ?? []).map((id) => byId.get(id)!).filter((item) => item.category === area)
		})).filter((section) => section.items.length > 0)
	);

	// Item shown in the bottom sheet (null = closed), always with the current data
	let selected = $state<SheetItem | null>(null);
	let sheetCategory = $state<Category>('movies');
	function open(item: (typeof data.items)[number]) {
		sheetCategory = item.category;
		selected = item;
	}
	let current = $derived(
		selected
			? data.items.find(
					(item) => item.category === sheetCategory && item.externalId === selected?.externalId
				)
			: undefined
	);

	// Phones: 3 posters per row; larger screens: as many as fit – like the library
	const gridClass = 'grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]';
</script>

<svelte:head><title>{chosen?.name ?? m.streaming.title} · hdtracker</title></svelte:head>

{#snippet logo(tile: Tile, size: string)}
	{#if tile.logoUrl}
		<img
			src={img(tile.logoUrl)}
			alt=""
			referrerpolicy="no-referrer"
			class="{size} shrink-0 rounded-lg ring-1 ring-zinc-800"
		/>
	{:else}
		<span
			class="{size} flex shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700"
		>
			<CloudOff size={20} />
		</span>
	{/if}
{/snippet}

<main class="app-width p-4">
	{#if !chosen}
		<h1 class="text-xl font-semibold">{m.streaming.title}</h1>
		{#if tiles.length === 0}
			<EmptyState icon={Clapperboard} title={m.streaming.emptyTitle} text={m.streaming.emptyHint} />
		{:else}
			<ul class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]">
				{#each tiles as tile (tile.key)}
					<li>
						<a
							href={tileHref(tile)}
							class="ui-card ui-btn flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900 p-2.5 transition-colors duration-100 hover:border-zinc-600 hover:bg-zinc-800 sm:gap-3 sm:p-3"
						>
							{@render logo(tile, 'size-9 sm:size-11')}
							<span class="min-w-0">
								<span class="line-clamp-2 leading-tight font-medium break-words">{tile.name}</span>
								<span class="text-sm text-zinc-500">{m.streaming.titles(tile.ids.length)}</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<a
			href="/streaming"
			class="inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
		>
			<ArrowLeft size={16} />
			{m.streaming.allServices}
		</a>
		<div class="mt-3 flex items-center gap-3">
			{@render logo(chosen, 'size-12')}
			<div class="min-w-0">
				<h1 class="truncate text-xl font-semibold">{chosen.name}</h1>
				<p class="text-sm text-zinc-500">{m.streaming.titles(chosen.ids.length)}</p>
			</div>
		</div>
		{#each sections as section (section.area)}
			{@const cat = CATEGORIES[section.area]}
			<section class="mt-6" style:--accent={cat.accent}>
				<h2 class="flex items-center gap-2 text-lg font-semibold">
					<cat.icon size={18} class="text-(--accent)" />
					{m.categories[section.area]}
				</h2>
				<ul class="mt-3 {gridClass}">
					{#each section.items as item (item.id)}
						<li>
							<PosterCard
								title={titles(item.category, item).main}
								year={item.year}
								earlyAccess={item.earlyAccess}
								posterUrl={item.posterUrl}
								people={data.together[item.id]}
								onclick={() => open(item)}
							/>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}

	<!-- The status window of the library; it saves with the actions of the title's area page -->
	<ItemSheet
		category={sheetCategory}
		item={selected}
		onclose={() => (selected = null)}
		actionPath="/{sheetCategory}"
		notify={current ? current.notify : null}
		sharing={current
			? sharingFor(data.people, data.together[current.id], data.pending[current.id])
			: null}
	/>
</main>
