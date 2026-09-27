<script lang="ts">
	import { flushSync } from 'svelte';
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { CATEGORIES, CATEGORY_KEYS, isCategory, type Category } from '$lib/categories';
	import { m } from '$lib/i18n/index.svelte';
	import { ChevronDown, LoaderCircle, Search, X } from '@lucide/svelte';

	const STORAGE_KEY = 'hdtracker.searchCategory';

	// Area to search in: the current one on a category page, otherwise the last one used.
	let section = $derived(page.url.pathname.split('/')[1]);
	let category = $state<Category>('movies');

	$effect(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved && isCategory(saved)) category = saved;
		} catch {
			// storage blocked: keep the default
		}
	});
	$effect(() => {
		if (isCategory(section)) category = section;
	});

	function choose(key: Category) {
		category = key;
		try {
			localStorage.setItem(STORAGE_KEY, key);
		} catch {
			// storage blocked: only remembered until reload
		}
	}

	// Text in the field follows the URL (e.g. after going back to a previous search).
	let query = $state('');
	$effect(() => {
		query = page.url.searchParams.get('q') ?? '';
	});

	let searching = $derived(!!navigating.to?.url.searchParams.get('q'));
	let accent = $derived(CATEGORIES[category].accent);
	let CurrentIcon = $derived(CATEGORIES[category].icon);

	// Desktop: menu for choosing the area (closes on a click elsewhere or Esc).
	let menuOpen = $state(false);
	let placeholder = $derived(m.library.searchPlaceholder(m.categories[category]));

	// ---- Mobile: search panel sliding in from the top ----
	let open = $state(false);
	let desktopInput: HTMLInputElement;
	let mobileInput: HTMLInputElement;

	// Focus right inside the tap, so phones show the keyboard.
	function openPanel() {
		open = true;
		flushSync();
		mobileInput.focus();
	}

	// Close the panel whenever the page changes.
	$effect(() => {
		void page.url;
		open = false;
	});

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const q = query.trim();
		open = false;
		(document.activeElement as HTMLElement | null)?.blur();
		goto(q ? `/${category}?q=${encodeURIComponent(q)}` : `/${category}`);
	}

	// Emptying the field (e.g. with its x button) on a results page goes back to the library.
	function onInput() {
		if (query === '' && page.url.searchParams.get('q')) {
			goto(`/${category}`, { keepFocus: true });
		}
	}

	// Moves the panel to the end of <body>: inside the header (which has a blur effect) a
	// fixed element would only cover the header, not the whole screen.
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}

	// "/" jumps into the search field, Esc closes the panel.
	function onKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		const typing = target.closest('input, textarea, select, [contenteditable]');
		if (e.key === '/' && !typing) {
			e.preventDefault();
			if (desktopInput.offsetParent) desktopInput.focus();
			else openPanel();
		} else if (e.key === 'Escape') {
			open = false;
			menuOpen = false;
		}
	}
</script>

<svelte:window
	onkeydown={onKeydown}
	onclick={(e) => {
		if (menuOpen && !(e.target as HTMLElement).closest('[aria-haspopup], [role=menu]'))
			menuOpen = false;
	}}
/>

<!-- Desktop: search field centred in the free space of the header, with the current area on its left -->
<div class="mx-4 hidden flex-1 justify-center md:flex">
	<form
		role="search"
		onsubmit={submit}
		style:--accent={accent}
		class="flex w-full max-w-xl items-center rounded-lg border border-zinc-700 bg-zinc-900 transition-colors focus-within:border-(--accent)"
	>
		<!-- Current area; click opens a menu with the four areas -->
		<div class="relative border-r border-zinc-700 px-1.5">
			<button
				type="button"
				onclick={() => (menuOpen = !menuOpen)}
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				aria-label={m.categories[category]}
				title={m.categories[category]}
				class="flex items-center gap-0.5 rounded-md p-1.5 text-(--accent) transition-colors hover:bg-zinc-800"
			>
				<CurrentIcon size={17} />
				<ChevronDown
					size={14}
					class="text-zinc-500 transition-transform {menuOpen ? 'rotate-180' : ''}"
				/>
			</button>
			{#if menuOpen}
				<ul
					role="menu"
					class="absolute top-full left-0 z-20 mt-2 w-44 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl shadow-black/50"
				>
					{#each CATEGORY_KEYS as key (key)}
						{@const cat = CATEGORIES[key]}
						<li role="none">
							<button
								type="button"
								role="menuitemradio"
								aria-checked={category === key}
								onclick={() => {
									choose(key);
									menuOpen = false;
									desktopInput.focus();
								}}
								style:--cat={cat.accent}
								class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-zinc-800 {category ===
								key
									? 'text-(--cat)'
									: 'text-zinc-300'}"
							>
								<cat.icon size={17} class="text-(--cat)" />
								{m.categories[key]}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
		<input
			bind:this={desktopInput}
			bind:value={query}
			oninput={onInput}
			type="search"
			{placeholder}
			aria-label={placeholder}
			autocomplete="off"
			enterkeyhint="search"
			class="min-w-0 flex-1 border-0 bg-transparent py-2 focus:border-0"
		/>
		<kbd
			class="mr-1 hidden rounded border border-zinc-700 px-1.5 text-xs text-zinc-500 lg:block"
			aria-hidden="true">/</kbd
		>
		<button
			class="flex items-center self-stretch rounded-r-lg px-3 text-zinc-400 transition-colors hover:bg-(--accent) hover:text-white"
			aria-label={m.common.search}
		>
			{#if searching}<LoaderCircle size={18} class="animate-spin" />{:else}<Search size={18} />{/if}
		</button>
	</form>
</div>

<!-- Mobile: magnifier button -->
<button
	type="button"
	onclick={openPanel}
	class="ml-auto rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
	aria-label={m.common.search}
	title={m.common.search}
	aria-expanded={open}
>
	{#if searching}<LoaderCircle size={18} class="animate-spin" />{:else}<Search size={18} />{/if}
</button>

<!-- Mobile: panel that slides in from the top, page behind it darkened.
     Always rendered (only hidden), so the field can get the focus within the tap. -->
<div
	use:portal
	class="fixed inset-0 z-30 md:hidden {open ? '' : 'pointer-events-none'}"
	inert={!open}
	data-search-panel
>
	<button
		type="button"
		tabindex="-1"
		aria-label={m.common.close}
		onclick={() => (open = false)}
		class="absolute inset-0 cursor-default bg-black/60 transition-opacity duration-200 {open
			? 'opacity-100'
			: 'opacity-0'}"
	></button>
	<div
		style:--accent={accent}
		class="absolute inset-x-0 top-0 border-b border-zinc-800 bg-zinc-950 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-4 shadow-2xl shadow-black transition duration-200 ease-out {open
			? 'translate-y-0 opacity-100'
			: '-translate-y-full opacity-0'}"
	>
		<form role="search" onsubmit={submit} class="flex items-center gap-2">
			<div
				class="flex flex-1 items-center rounded-lg border border-zinc-700 bg-zinc-900 transition-colors focus-within:border-(--accent)"
			>
				<Search size={18} class="ml-3 shrink-0 text-(--accent)" />
				<input
					bind:this={mobileInput}
					bind:value={query}
					oninput={onInput}
					type="search"
					{placeholder}
					aria-label={placeholder}
					autocomplete="off"
					enterkeyhint="search"
					class="min-w-0 flex-1 border-0 bg-transparent focus:border-0"
				/>
			</div>
			<button
				type="button"
				onclick={() => (open = false)}
				class="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
				aria-label={m.common.close}
			>
				<X size={22} />
			</button>
		</form>
		<!-- Which area to search in -->
		<div class="mt-3 grid grid-cols-4 gap-2">
			{#each CATEGORY_KEYS as key (key)}
				{@const cat = CATEGORIES[key]}
				<button
					type="button"
					onclick={() => {
						choose(key);
						mobileInput.focus();
					}}
					style:--cat={cat.accent}
					aria-pressed={category === key}
					class="flex flex-col items-center gap-1 rounded-lg border py-2 text-xs transition-colors {category ===
					key
						? 'border-(--cat) bg-(--cat)/15 text-(--cat)'
						: 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}"
				>
					<cat.icon size={20} />
					{m.categories[key]}
				</button>
			{/each}
		</div>
	</div>
</div>
