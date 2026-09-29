<script lang="ts" module>
	export const BUTTON_PRIMARY =
		'inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-zinc-300 active:bg-zinc-400 disabled:opacity-50';
	export const BUTTON_SECONDARY =
		'inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 font-medium transition-colors enabled:hover:bg-zinc-800 disabled:opacity-50';
	export const BUTTON_DANGER =
		'inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors enabled:hover:bg-red-500 enabled:active:bg-red-700 disabled:opacity-40';
</script>

<script lang="ts">
	import { LoaderCircle } from '@lucide/svelte';
	import type { Component } from 'svelte';

	type Props = {
		text: string;
		busy?: boolean;
		disabled?: boolean;
		icon?: Component<{ size?: number }>;
		style?: string;
		formaction?: string;
		// Several buttons in one form: which one was pressed
		name?: string;
		value?: string;
	};
	let {
		text,
		busy = false,
		disabled = false,
		icon: Icon,
		style = BUTTON_PRIMARY,
		formaction,
		name,
		value
	}: Props = $props();
</script>

<!-- Submit button that shows a spinner while the form is being sent -->
<button class={style} disabled={busy || disabled} {formaction} {name} {value}>
	{#if busy}
		<LoaderCircle size={18} class="animate-spin" />
	{:else if Icon}
		<Icon size={18} />
	{/if}
	{text}
</button>
