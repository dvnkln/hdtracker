<script lang="ts">
	import { page } from '$app/state';
	import { Users } from '@lucide/svelte';
	import type { Person } from '#lib/avatar.js';
	import { m } from '#lib/i18n/index.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';

	// Marks a title that is tracked together: the profile pictures of the others, or – for
	// whoever finds those too loud (personal setting `sharedMarker`) – just a small symbol.
	// Who it is stands in the tooltip either way.
	type Props = {
		people: Person[];
		// So many pictures are shown, the rest is counted ("+2")
		max?: number;
		// Small, for the lower right corner of a poster (place it there with `class`): one only
		// has to guess who it is, not recognise them. Otherwise the size for a row of a list.
		corner?: boolean;
		class?: string;
	};
	let { people, max = 2, corner = false, class: extra = '' }: Props = $props();
	let subtle = $derived(page.data.sharedMarker === 'subtle');
	let names = $derived(m.share.together(people.map((person) => person.name).join(', ')));
	// On a picture: white, with a shadow that keeps it readable on a light poster
	const onPicture = 'text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]';
</script>

{#if people.length > 0 && corner}
	<span data-together={subtle ? 'subtle' : 'pictures'} title={names} class="flex items-end {extra}">
		{#if subtle}
			<!-- The two figures of Lucide's "users", cut to their outline: the icon as it comes
			     has air around the figures, so they would not sit where the pictures sit. -->
			<svg
				viewBox="1 2 22 20"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				class="h-3.5 w-auto {onPicture}"
			>
				<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
				<path d="M16 3.128a4 4 0 0 1 0 7.744" />
				<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
				<circle cx="9" cy="7" r="4" />
			</svg>
			<span class="sr-only">{names}</span>
		{:else}
			<!-- "+1" stands before the pictures, so the last picture sits in the corner -->
			{#if people.length > max}
				<span class="pr-0.5 text-[9px] leading-none font-semibold {onPicture}"
					>+{people.length - max}</span
				>
			{/if}
			<span class="flex -space-x-1">
				{#each people.slice(0, max) as person (person.id)}
					<Avatar {person} class="size-4 text-[9px] ring-1 ring-zinc-950" />
				{/each}
			</span>
		{/if}
	</span>
{:else if people.length > 0}
	<span
		data-together={subtle ? 'subtle' : 'pictures'}
		title={names}
		class="flex shrink-0 items-center {subtle ? '' : '-space-x-1.5'} {extra}"
	>
		{#if subtle}
			<Users size={16} class="text-zinc-500" aria-hidden="true" />
			<span class="sr-only">{names}</span>
		{:else}
			{#each people.slice(0, max) as person (person.id)}
				<Avatar {person} class="size-6 text-[10px] ring-2 ring-zinc-950" />
			{/each}
			{#if people.length > max}
				<span
					class="flex size-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold ring-2 ring-zinc-950"
					>+{people.length - max}</span
				>
			{/if}
		{/if}
	</span>
{/if}
