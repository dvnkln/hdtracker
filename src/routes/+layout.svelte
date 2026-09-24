<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { CATEGORIES, CATEGORY_KEYS } from '$lib/categories';
	import { LogOut } from '@lucide/svelte';

	let { data, children } = $props();

	// First part of the URL, e.g. "filme" for /filme?q=dune
	let section = $derived(page.url.pathname.split('/')[1]);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if data.user}
	<header class="border-b border-zinc-800">
		<div class="mx-auto flex max-w-screen-lg items-center justify-between px-4 py-3">
			<a href="/" class="text-lg font-bold tracking-tight">hdtracker</a>
			<form method="POST" action="/logout" class="flex items-center gap-3">
				<span class="text-sm text-zinc-400">{data.user.username}</span>
				<button
					class="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
					aria-label="Abmelden"
					title="Abmelden"
				>
					<LogOut size={18} />
				</button>
			</form>
		</div>
	</header>

	<!-- pb-24 keeps content above the bottom navigation -->
	<div class="pb-24">
		{@render children()}

		<footer class="mx-auto max-w-screen-lg px-4 pt-10 text-xs text-zinc-500">
			<p>
				Film- und Seriendaten von
				<a href="https://www.themoviedb.org" class="underline" target="_blank" rel="noreferrer"
					>TMDB</a
				>. Dieses Produkt nutzt die TMDB-API, wird aber nicht von TMDB unterstützt oder
				zertifiziert.
			</p>
			<p class="mt-1">
				Spieldaten von
				<a href="https://www.igdb.com" class="underline" target="_blank" rel="noreferrer">IGDB</a>,
				Animedaten von
				<a href="https://anilist.co" class="underline" target="_blank" rel="noreferrer">AniList</a>.
			</p>
		</footer>
	</div>

	<nav
		class="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
	>
		<div class="mx-auto grid max-w-screen-lg grid-cols-4">
			{#each CATEGORY_KEYS as key (key)}
				{@const cat = CATEGORIES[key]}
				{@const active = section === key}
				<a
					href="/{key}"
					class="flex flex-col items-center gap-1 py-2 text-xs"
					style:color={active ? cat.accent : undefined}
					class:text-zinc-400={!active}
					aria-current={active ? 'page' : undefined}
				>
					<cat.icon size={22} strokeWidth={active ? 2.5 : 2} />
					{cat.label}
				</a>
			{/each}
		</div>
	</nav>
{:else}
	{@render children()}
{/if}
