<script lang="ts">
	import '@fontsource/outfit/600.css';
	import '@fontsource/outfit/800.css';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { CATEGORIES } from '$lib/categories';
	import Brand from '$lib/components/Brand.svelte';
	import HeaderSearch from '$lib/components/HeaderSearch.svelte';
	import { m, setLocale } from '$lib/i18n/index.svelte';
	import { setAnimeTitle } from '$lib/titles.svelte';
	import { LogOut, Settings } from '@lucide/svelte';

	let { data, children } = $props();

	// Apply the display settings (language, anime titles): once right away (so the first
	// render is already correct) and again whenever they change.
	// svelte-ignore state_referenced_locally
	setLocale(data.locale);
	// svelte-ignore state_referenced_locally
	setAnimeTitle(data.animeTitle);
	$effect.pre(() => {
		setLocale(data.locale);
		setAnimeTitle(data.animeTitle);
	});

	// First part of the URL, e.g. "movies" for /movies?q=dune
	let section = $derived(page.url.pathname.split('/')[1]);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if data.user}
	<!-- Stays at the top while scrolling -->
	<header
		class="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 pt-[env(safe-area-inset-top)] backdrop-blur"
	>
		<!-- Computers: three columns with equally wide outer ones, so the search field sits exactly
		     in the middle of the screen (same axis as the content and the bottom navigation). -->
		<div
			class="app-width flex items-center gap-1 px-4 py-3 md:grid md:grid-cols-[minmax(8.5rem,1fr)_minmax(0,36rem)_minmax(8.5rem,1fr)] md:gap-4"
		>
			<a
				href="/"
				aria-label={m.common.home}
				class="shrink-0 transition-opacity hover:opacity-80 md:justify-self-start"><Brand /></a
			>
			<HeaderSearch categories={data.categories} />
			<!-- -mr-2: the icon itself (not its hover area) lines up with the content edge -->
			<form
				method="POST"
				action="/logout"
				class="-mr-2 flex items-center gap-1 md:justify-self-end"
			>
				<a
					href="/settings"
					class="rounded-lg p-2 transition-colors hover:bg-zinc-800 hover:text-zinc-100 {section ===
					'settings'
						? 'text-zinc-100'
						: 'text-zinc-400'}"
					aria-label={m.common.settings}
					title={m.common.settings}
					aria-current={section === 'settings' ? 'page' : undefined}
				>
					<Settings size={18} />
				</a>
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
	</div>

	<nav
		class="fixed inset-x-0 bottom-0 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
	>
		<!-- One column per area that is switched on in the settings -->
		<div
			class="mx-auto grid max-w-screen-lg"
			style:grid-template-columns="repeat({data.categories.length}, minmax(0, 1fr))"
		>
			{#each data.categories as key (key)}
				{@const cat = CATEGORIES[key]}
				{@const active = section === key}
				<!-- Active area: icon in its colour and filled, label white. Hover previews that. -->
				<a
					href="/{key}"
					class="group/nav flex flex-col items-center gap-1 py-2 text-xs transition-colors {active
						? 'text-zinc-100'
						: 'text-zinc-400 hover:text-zinc-200'}"
					style:--accent={cat.accent}
					aria-current={active ? 'page' : undefined}
				>
					<cat.icon
						size={22}
						strokeWidth={active ? 2.5 : 2}
						class="transition duration-200 {active
							? 'fill-(--accent)/20 text-(--accent)'
							: 'group-hover/nav:scale-110 group-hover/nav:fill-(--accent)/20 group-hover/nav:text-(--accent)'}"
					/>
					{m.categories[key]}
				</a>
			{/each}
		</div>
	</nav>
{:else}
	{@render children()}
{/if}
