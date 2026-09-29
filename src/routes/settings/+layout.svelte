<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/i18n/index.svelte';
	import { settingsGroups } from '$lib/settingsNav';
	import { ChevronLeft } from '@lucide/svelte';

	let { data, children } = $props();

	// "Administration" only for admins (today: the single account).
	let groups = $derived(
		settingsGroups().filter((g) => g.items.length && (g.items[0].group !== 'admin' || data.isAdmin))
	);
	let isOverview = $derived(page.url.pathname === '/settings');
</script>

<!-- Computers: sidebar on the left, the chosen area on the right. Large screens (xl): the area
     exactly in the middle of the screen (same axis as the search field and the bottom
     navigation), the sidebar right next to it. Phones: /settings shows the list of areas; each
     area has a back link. -->
<h1 class="sr-only">{m.settings.title}</h1>
<div class="app-width px-4 pt-4 pb-4 md:pt-6">
	<div
		class="mx-auto max-w-screen-lg md:flex md:gap-8 xl:grid xl:max-w-none xl:grid-cols-[minmax(13rem,1fr)_minmax(0,48rem)_minmax(13rem,1fr)] xl:gap-8"
	>
		<nav aria-label={m.settings.title} class="hidden w-52 shrink-0 md:block xl:justify-self-end">
			<div class="sticky top-20 flex flex-col gap-5">
				{#each groups as group, i (i)}
					<div>
						{#if group.title}
							<p class="px-3 pb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
								{group.title}
							</p>
						{/if}
						{#each group.items as item (item.href)}
							{@const active = page.url.pathname.startsWith(item.href)}
							<a
								href={item.href}
								aria-current={active ? 'page' : undefined}
								class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors {active
									? 'bg-zinc-800 font-medium text-zinc-100'
									: 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}"
							>
								<item.icon size={18} class="shrink-0" />
								{item.label}
							</a>
						{/each}
					</div>
				{/each}
			</div>
		</nav>

		<div class="min-w-0 flex-1">
			{#if !isOverview}
				<a
					href="/settings"
					class="mb-3 inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-zinc-100 md:hidden"
				>
					<ChevronLeft size={16} />{m.settings.title}
				</a>
			{/if}
			{@render children()}
		</div>
	</div>
</div>
