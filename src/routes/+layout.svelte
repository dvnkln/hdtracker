<script lang="ts">
	import '@fontsource/outfit/600.css';
	import '@fontsource/outfit/800.css';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page, updated } from '$app/state';
	import { CATEGORIES } from '#lib/categories.js';
	import Brand from '#lib/components/Brand.svelte';
	import HeaderSearch from '#lib/components/HeaderSearch.svelte';
	import ScrollThumb from '#lib/components/ScrollThumb.svelte';
	import Toasts from '#lib/components/Toasts.svelte';
	import UserMenu from '#lib/components/UserMenu.svelte';
	import { m, setLocale } from '#lib/i18n/index.svelte.js';
	import { setAnimeTitle } from '#lib/titles.svelte.js';
	import { Bell } from '@lucide/svelte';

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

	// An app that stays open (a tab, the installed app) keeps running the version it was loaded
	// with – after an update of the server it would show new data with the old interface. So it
	// asks whether there is a new version (a small file of this server) after every change of
	// page and when it comes back to the foreground; if there is, the next change of page
	// loads the app afresh.
	const checkVersion = () => void updated.check().catch(() => {});
	// Its height, for what sticks below it (the headings of the library, its filter): it differs
	// per theme and grows on a phone with a notch. On a phone it is rarely a whole number of
	// pixels: rounded up, a sliver of the posters showed between header and heading. So the
	// exact height, one pixel less – what sticks slides that pixel under the header.
	let header = $state<HTMLElement>();
	$effect(() => {
		if (!header) return;
		const root = document.documentElement;
		const measure = () =>
			root.style.setProperty('--header-h', `${header!.getBoundingClientRect().height - 1}px`);
		const watcher = new ResizeObserver(measure);
		watcher.observe(header, { box: 'border-box' });
		measure();
		return () => watcher.disconnect();
	});

	afterNavigate(({ type, shallow }) => {
		if (shallow && type === 'goto') return;
		if (type !== 'enter') checkVersion();
	});

	beforeNavigate(({ willUnload, to, shallow, type }) => {
		if (shallow && type === 'goto') return;
		if (updated.current && !willUnload && to?.url) location.href = to.url.href;
	});

	// First part of the URL, e.g. "movies" for /movies?q=dune
	let section = $derived(page.url.pathname.split('/')[1]);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<ScrollThumb />
<svelte:document onvisibilitychange={() => document.visibilityState === 'visible' && checkVersion()}
></svelte:document>

{#if data.user && data.profile && !data.user.mustChangePassword}
	<!-- Stays at the top while scrolling -->
	<header
		bind:this={header}
		data-chrome="header"
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
			<!-- -mr-1: the picture itself (not its hover area) lines up with the content edge -->
			<div class="-mr-1 flex items-center gap-1 md:justify-self-end">
				<!-- The inbox; the number is what is unread plus invitations waiting for an answer -->
				<a
					href="/inbox"
					aria-label={m.inbox.open(data.open)}
					title={m.inbox.title}
					aria-current={section === 'inbox' ? 'page' : undefined}
					class="relative rounded-lg p-2 transition-colors hover:bg-zinc-800 hover:text-zinc-100 {section ===
					'inbox'
						? 'text-zinc-100'
						: 'text-zinc-400'}"
				>
					<Bell size={18} />
					{#if data.open > 0}
						<span
							class="absolute -top-0.5 -right-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] leading-4.5 font-semibold text-white"
							>{data.open > 99 ? '99+' : data.open}</span
						>
					{/if}
				</a>
				<UserMenu person={data.profile} username={data.user.username} />
			</div>
		</div>
	</header>

	<Toasts />

	<!-- pb-24 keeps content above the bottom navigation -->
	<div class="pb-24">
		{@render children()}
	</div>

	<!-- Above the page like the header (z-10): the sticking headings of the library have a level of
	     their own and would otherwise cover it -->
	<nav
		data-chrome="nav"
		class="fixed inset-x-0 bottom-0 z-10 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
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
