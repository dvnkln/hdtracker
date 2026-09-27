<script lang="ts">
	import '@fontsource/outfit/600.css';
	import '@fontsource/outfit/800.css';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { CATEGORIES, CATEGORY_KEYS } from '$lib/categories';
	import Brand from '$lib/components/Brand.svelte';
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
		<div class="mx-auto flex max-w-screen-lg items-center justify-between px-4 py-3">
			<a href="/" aria-label={m.common.home} class="transition-opacity hover:opacity-80"
				><Brand /></a
			>
			<form method="POST" action="/logout" class="flex items-center gap-1">
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
		<div class="mx-auto grid max-w-screen-lg grid-cols-4">
			{#each CATEGORY_KEYS as key (key)}
				{@const cat = CATEGORIES[key]}
				{@const active = section === key}
				<!-- Active area: icon + label in its colour, icon filled. Hover previews that on the icon. -->
				<a
					href="/{key}"
					class="group/nav flex flex-col items-center gap-1 py-2 text-xs transition-colors {active
						? 'text-(--accent)'
						: 'text-zinc-400 hover:text-zinc-200'}"
					style:--accent={cat.accent}
					aria-current={active ? 'page' : undefined}
				>
					<cat.icon
						size={22}
						strokeWidth={active ? 2.5 : 2}
						class="transition duration-200 {active
							? 'fill-(--accent)/20'
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
