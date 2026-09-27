<script lang="ts">
	import '@fontsource/outfit/600.css';
	import '@fontsource/outfit/800.css';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { CATEGORIES, CATEGORY_KEYS } from '$lib/categories';
	import Brand from '$lib/components/Brand.svelte';
	import { m, setLocale } from '$lib/i18n/index.svelte';
	import { LogOut } from '@lucide/svelte';

	let { data, children } = $props();

	// Switch all texts to the configured interface language: once right away (so the first
	// render is already correct) and again whenever the setting changes.
	// svelte-ignore state_referenced_locally
	setLocale(data.locale);
	$effect.pre(() => setLocale(data.locale));

	// First part of the URL, e.g. "movies" for /movies?q=dune
	let section = $derived(page.url.pathname.split('/')[1]);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if data.user}
	<header class="border-b border-zinc-800">
		<div class="mx-auto flex max-w-screen-lg items-center justify-between px-4 py-3">
			<a href="/" aria-label={m.common.home} class="transition-opacity hover:opacity-80"
				><Brand /></a
			>
			<form method="POST" action="/logout" class="flex items-center gap-3">
				<span class="text-sm text-zinc-400">{data.user.username}</span>
				<button
					class="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
					aria-label={m.common.logout}
					title={m.common.logout}
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
					class="flex flex-col items-center gap-1 py-2 text-xs transition-colors hover:bg-zinc-900 {active
						? ''
						: 'hover:text-zinc-100'}"
					style:color={active ? cat.accent : undefined}
					class:text-zinc-400={!active}
					aria-current={active ? 'page' : undefined}
				>
					<cat.icon size={22} strokeWidth={active ? 2.5 : 2} />
					{m.categories[key]}
				</a>
			{/each}
		</div>
	</nav>
{:else}
	{@render children()}
{/if}
