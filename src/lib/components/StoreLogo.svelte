<script lang="ts">
	// The logo of a game store as a tile in its brand colour – the counterpart to the logos of
	// streaming services. Size through `class` (default: the size of the streaming logos).
	import { STORES, type StoreKey } from '#lib/stores.js';

	let { store, class: cls = 'size-11 rounded-lg' }: { store: StoreKey; class?: string } = $props();
	const look = $derived(STORES[store]);
</script>

<span
	class="flex shrink-0 items-center justify-center {cls}"
	style:background-color={look.color}
	style:color={look.ink}
	role="img"
	aria-label={look.name}
>
	<svg viewBox="0 0 24 24" class="size-[55%]" aria-hidden="true">
		{#if look.stroke}
			<path
				d={look.glyph}
				fill="none"
				stroke="currentColor"
				stroke-width={look.stroke}
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
		{:else}
			<path d={look.glyph} fill="currentColor" />
		{/if}
	</svg>
</span>
