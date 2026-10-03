<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/i18n/index.svelte';
	import { BUTTON_PRIMARY } from '$lib/components/SubmitButton.svelte';
	import { CircleAlert, SearchX } from '@lucide/svelte';

	let missing = $derived(page.status === 404);
	// SvelteKit's default messages and our plain "not found" say nothing more than the
	// heading: only show what a page set itself (e.g. "TMDB is not reachable right now.").
	let detail = $derived(
		page.error && !['Not Found', 'Internal Error', m.common.notFound].includes(page.error.message)
			? page.error.message
			: ''
	);
</script>

<svelte:head>
	<title>{missing ? m.errorPage.notFound : m.errorPage.failed} · hdtracker</title>
</svelte:head>

<!-- Shown inside the normal layout (header, navigation, theme) for any error of a page -->
<main class="mx-auto flex max-w-md flex-col items-center px-4 pt-16 text-center">
	{#if missing}
		<SearchX size={40} class="text-zinc-500" />
	{:else}
		<CircleAlert size={40} class="text-amber-400" />
	{/if}
	<p class="mt-4 font-mono text-sm text-zinc-500">{page.status}</p>
	<h1 class="mt-1 text-xl font-bold">{missing ? m.errorPage.notFound : m.errorPage.failed}</h1>
	<p class="mt-2 text-sm text-zinc-400">
		{detail || (missing ? m.errorPage.notFoundHint : m.errorPage.failedHint)}
	</p>
	<a href="/" class="{BUTTON_PRIMARY} mt-6">{m.errorPage.home}</a>
</main>
