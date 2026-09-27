<script lang="ts">
	import { CATEGORIES, CATEGORY_KEYS } from '$lib/categories';
	import { m } from '$lib/i18n/index.svelte';

	let { data } = $props();
</script>

<svelte:head><title>hdtracker</title></svelte:head>

<main class="mx-auto max-w-screen-lg p-4">
	<h1 class="text-2xl font-bold">{m.home.hello(data.user?.username ?? '')}</h1>

	<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
		{#each CATEGORY_KEYS as key (key)}
			{@const cat = CATEGORIES[key]}
			<a
				href="/{key}"
				class="flex aspect-[4/3] flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600"
			>
				<cat.icon size={32} color={cat.accent} />
				<span class="text-lg font-semibold">{m.categories[key]}</span>
			</a>
		{/each}
	</div>
</main>
