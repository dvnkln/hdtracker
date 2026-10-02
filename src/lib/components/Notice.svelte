<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Info, TriangleAlert } from '@lucide/svelte';

	type Props = { kind?: 'info' | 'warning'; class?: string; children: Snippet };
	let { kind = 'info', class: extra = '', children }: Props = $props();
</script>

<!-- Hint box: neutral dark card with an icon in front (grey "i" or yellow warning triangle) -->
<div
	class="ui-card flex gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300 {extra}"
>
	{#if kind === 'warning'}
		<TriangleAlert size={18} class="mt-px shrink-0 text-amber-400" />
	{:else}
		<Info size={18} class="mt-px shrink-0 text-zinc-400" />
	{/if}
	<div class="min-w-0 flex-1">{@render children()}</div>
</div>
