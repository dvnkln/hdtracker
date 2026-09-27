<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/i18n/index.svelte';
	import { FileUp, Settings2, Wrench } from '@lucide/svelte';

	let { children } = $props();

	// Tabs of the settings area; each one is its own page.
	let tabs = $derived([
		{ href: '/settings', label: m.settings.general, icon: Settings2 },
		{ href: '/settings/maintenance', label: m.maintenance.title, icon: Wrench },
		{ href: '/settings/import', label: m.importData.title, icon: FileUp }
	]);
</script>

<div class="mx-auto max-w-screen-sm px-4 pt-4">
	<h1 class="text-2xl font-bold">{m.settings.title}</h1>
	<nav class="mt-4 grid grid-cols-3 border-b border-zinc-800">
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

<!-- Data sources (TMDB asks for this attribution) -->
<footer class="mx-auto max-w-screen-sm px-4 pt-6 text-xs text-zinc-500">
	<p>
		{m.footer.tmdbBefore}
		<a
			href="https://www.themoviedb.org"
			class="underline hover:text-zinc-300"
			target="_blank"
			rel="noreferrer">TMDB</a
		>{m.footer.tmdbAfter}
	</p>
	<p class="mt-1">
		{m.footer.gamesBy}
		<a
			href="https://www.igdb.com"
			class="underline hover:text-zinc-300"
			target="_blank"
			rel="noreferrer">IGDB</a
		>,
		{m.footer.animeBy}
		<a
			href="https://anilist.co"
			class="underline hover:text-zinc-300"
			target="_blank"
			rel="noreferrer">AniList</a
		>.
	</p>
</footer>
