<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	// What a place shows while there is nothing in it: a plain pictogram that fits the place
	// (an empty shopping basket, so to speak), a few words, at most one short line – instead of
	// a paragraph explaining things. The pictogram is never the symbol that already stands for
	// the same thing next to it (e.g. the area's icon in the navigation).
	type Props = {
		icon: Component<{ size?: number; strokeWidth?: number; class?: string }>;
		title: string;
		text?: string;
		// 'small': inside a card or list
		size?: 'large' | 'small';
		// Draw the pictogram in the accent colour of the area (--accent must be set around it)
		tinted?: boolean;
		// An action, if there is an obvious one
		children?: Snippet;
	};
	let { icon: Icon, title, text, size = 'large', tinted = false, children }: Props = $props();
	let small = $derived(size === 'small');
</script>

<div class="flex flex-col items-center text-center {small ? 'gap-2 py-4' : 'gap-3 px-4 py-14'}">
	<span
		class="flex items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-800 {small
			? 'size-12'
			: 'size-24'} {tinted ? 'text-(--accent)' : 'text-zinc-400'}"
	>
		<Icon size={small ? 22 : 44} strokeWidth={1.5} />
	</span>
	{#if small}
		<p class="text-sm font-medium text-zinc-300">{title}</p>
	{:else}
		<h2 class="text-lg font-semibold">{title}</h2>
	{/if}
	{#if text}<p class="max-w-xs text-sm text-zinc-500">{text}</p>{/if}
	{@render children?.()}
</div>
