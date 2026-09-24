<script lang="ts">
	import { navigating } from '$app/state';
	import { CATEGORIES } from '$lib/categories';
	import { ImageOff, LoaderCircle, Search } from '@lucide/svelte';

	let { data } = $props();

	let cat = $derived(CATEGORIES[data.category]);
	// True while a new search is loading
	let searching = $derived(navigating.to?.url.pathname === `/${data.category}`);
</script>

<svelte:head><title>{cat.label} · hdtracker</title></svelte:head>

<main class="mx-auto max-w-screen-lg p-4" style:--accent={cat.accent}>
	<h1 class="flex items-center gap-2 text-2xl font-bold text-(--accent)">
		<cat.icon size={26} />
		{cat.label}
	</h1>

	<form method="GET" class="mt-4 flex gap-2" data-sveltekit-keepfocus>
		<input
			type="search"
			name="q"
			value={data.q}
			placeholder="{cat.label} suchen…"
			autocomplete="off"
			enterkeyhint="search"
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

	{#if data.error}
		<p class="mt-4 rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">
			{data.error}
		</p>
	{:else if data.q && data.results.length === 0}
		<p class="mt-6 text-zinc-400">Keine Treffer für „{data.q}“.</p>
	{:else if data.results.length > 0}
		<p class="mt-4 text-sm text-zinc-400">{data.results.length} Treffer</p>
		<ul class="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
			{#each data.results as item (item.externalId)}
				<li class="flex flex-col" title={item.overview ?? ''}>
					<div class="aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
						{#if item.posterUrl}
							<img
								src={item.posterUrl}
								alt={item.title}
								loading="lazy"
								referrerpolicy="no-referrer"
								class="h-full w-full object-cover"
							/>
						{:else}
							<div class="flex h-full items-center justify-center text-zinc-600">
								<ImageOff size={28} />
							</div>
						{/if}
					</div>
					<p class="mt-1.5 line-clamp-2 text-sm leading-tight font-medium">{item.title}</p>
					<p class="text-xs text-zinc-500">{item.year ?? '–'}</p>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mt-6 text-zinc-500">
			Suche nach einem Titel, um ihn später zur Bibliothek hinzuzufügen.
		</p>
	{/if}
</main>
