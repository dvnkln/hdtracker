<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating } from '$app/state';
	import { CATEGORIES } from '$lib/categories';
	import { COLLAPSED_STATUSES, statusesFor, statusLabel } from '$lib/status';
	import PosterCard from '$lib/components/PosterCard.svelte';
	import ItemSheet, { type SheetItem } from '$lib/components/ItemSheet.svelte';
	import { STATUS_ICONS } from '$lib/statusIcons';
	import { ChevronRight, LoaderCircle, Search } from '@lucide/svelte';

	let { data } = $props();

	let cat = $derived(CATEGORIES[data.category]);
	// True while a new search is loading
	let searching = $derived(navigating.to?.url.pathname === `/${data.category}`);

	// Library grouped by status, in section order; empty sections are skipped.
	let sections = $derived(
		statusesFor(data.category)
			.map((status) => ({ status, items: data.library.filter((i) => i.status === status) }))
			.filter((s) => s.items.length > 0)
	);

	// Item shown in the bottom sheet (null = closed)
	let selected = $state<SheetItem | null>(null);

	// Emptying the search field (e.g. with its x button) goes back to the library.
	function onSearchInput(e: Event & { currentTarget: HTMLInputElement }) {
		if (e.currentTarget.value === '' && data.q) goto(`/${data.category}`, { keepFocus: true });
	}

	const gridClass = 'grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6';
</script>

<svelte:head><title>{cat.label} · hdtracker</title></svelte:head>

<main class="mx-auto max-w-screen-lg p-4" style:--accent={cat.accent}>
	<h1 class="text-2xl font-bold text-(--accent)">
		<a href="/{data.category}" class="inline-flex items-center gap-2">
			<cat.icon size={26} />
			{cat.label}
		</a>
	</h1>

	<form method="GET" class="mt-4 flex gap-2" data-sveltekit-keepfocus>
		<input
			type="search"
			name="q"
			value={data.q}
			placeholder="{cat.label} suchen…"
			autocomplete="off"
			enterkeyhint="search"
			oninput={onSearchInput}
			class="min-w-0 flex-1"
		/>
		<button
			class="flex items-center justify-center rounded-lg bg-(--accent) px-4 font-medium text-white"
			aria-label="Suchen"
		>
			{#if searching}
				<LoaderCircle size={20} class="animate-spin" />
			{:else}
				<Search size={20} />
			{/if}
		</button>
	</form>

	{#if data.q}
		<!-- Search results -->
		<div class="mt-4 flex items-center justify-between text-sm">
			<span class="text-zinc-400">
				{#if !data.error}{data.results.length} Treffer für „{data.q}“{/if}
			</span>
			<a href="/{data.category}" class="text-(--accent)">Zur Bibliothek</a>
		</div>

		{#if data.error}
			<p class="mt-4 rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">
				{data.error}
			</p>
		{:else if data.results.length === 0}
			<p class="mt-6 text-zinc-400">Keine Treffer.</p>
		{:else}
			<ul class="mt-2 {gridClass}">
				{#each data.results as item (item.externalId)}
					<li>
						<PosterCard
							title={item.title}
							year={item.year}
							posterUrl={item.posterUrl}
							badge={item.status ? statusLabel(data.category, item.status) : null}
							onclick={() => (selected = item)}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if sections.length === 0}
		<p class="mt-6 text-zinc-500">
			Deine Bibliothek ist noch leer. Suche oben nach einem Titel und tippe ihn an, um ihn
			hinzuzufügen.
		</p>
	{:else}
		<!-- Library, one collapsible section per status -->
		{#each sections as section (section.status)}
			{@const Icon = STATUS_ICONS[section.status]}
			<details class="group mt-6" open={!COLLAPSED_STATUSES.includes(section.status)}>
				<summary
					class="flex cursor-pointer list-none items-center gap-2 border-b border-zinc-800 pb-2 select-none [&::-webkit-details-marker]:hidden"
				>
					<ChevronRight size={18} class="text-zinc-500 transition-transform group-open:rotate-90" />
					<Icon size={18} class="text-(--accent)" />
					<h2 class="text-lg font-semibold">{statusLabel(data.category, section.status)}</h2>
				</summary>
				<ul class="mt-3 {gridClass}">
					{#each section.items as item (item.id)}
						<li>
							<PosterCard
								title={item.title}
								year={item.year}
								posterUrl={item.posterUrl}
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
