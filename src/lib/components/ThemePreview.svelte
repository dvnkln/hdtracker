<script lang="ts">
	import { CATEGORIES, CATEGORY_KEYS } from '$lib/categories';
	import type { Theme } from '$lib/themes';

	let { theme }: { theme: Theme } = $props();
</script>

<!-- Tiny sketch of the app, drawn with the same colour classes as the real interface. The
     data-theme attribute makes it show the colours of that theme, whatever theme is active. -->
{#snippet sketch(shown: Theme, extra: string)}
	<div
		data-theme={shown}
		class="flex w-full flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 {extra}"
	>
		<!-- Header: wordmark and search field -->
		<div class="flex items-center gap-1.5 border-b border-zinc-800 px-2 py-1.5">
			<span class="h-1.5 w-2 rounded-full bg-linear-to-r from-[#ec4899] to-[#3b82f6]"></span>
			<span class="h-1.5 w-6 rounded-full bg-zinc-100"></span>
			<span class="ui-primary ml-auto h-2.5 w-1/4 rounded"></span>
		</div>
		<!-- Library: section heading and posters with title and year -->
		<div class="flex flex-col gap-1.5 px-2 py-1.5">
			<span class="ui-heading-bar h-1.5 w-1/3 rounded-full"></span>
			<div class="grid grid-cols-4 gap-1.5">
				{#each CATEGORY_KEYS as key (key)}
					<div class="flex flex-col gap-1">
						<span
							class="aspect-[2/3] rounded-sm bg-zinc-800 ring-1 ring-zinc-700"
							style:box-shadow="inset 0 -3px 0 {CATEGORIES[key].accent}"
						></span>
						<span class="h-1 w-full rounded-full bg-zinc-100"></span>
						<span class="h-1 w-1/2 rounded-full bg-zinc-500"></span>
					</div>
				{/each}
			</div>
		</div>
		<!-- Bottom navigation in the colours of the four areas -->
		<div class="flex justify-around border-t border-zinc-800 bg-zinc-900 px-2 py-1.5">
			{#each CATEGORY_KEYS as key (key)}
				<span class="size-2 rounded-full" style:background={CATEGORIES[key].accent}></span>
			{/each}
		</div>
	</div>
{/snippet}

<div aria-hidden="true" class="relative">
	{#if theme === 'system'}
		<!-- Follows the device: shown as half dark, half light -->
		{@render sketch('dark', '')}
		{@render sketch('light', 'absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]')}
	{:else}
		{@render sketch(theme, '')}
	{/if}
</div>
