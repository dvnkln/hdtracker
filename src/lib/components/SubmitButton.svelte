<script lang="ts" module>
	export const BUTTON_PRIMARY =
		'ui-btn ui-primary inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-zinc-300 active:bg-zinc-400 disabled:opacity-50';
	export const BUTTON_SECONDARY =
		'ui-btn inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 font-medium transition-colors enabled:hover:bg-zinc-800 disabled:opacity-50';
	export const BUTTON_DANGER =
		'ui-btn inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors enabled:hover:bg-red-500 enabled:active:bg-red-700 disabled:opacity-40';
</script>

<script lang="ts">
	import { LoaderCircle } from '@lucide/svelte';
	import { tick, type Component } from 'svelte';

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
		// Only clickable once there is something to send: 'changed' = a field of the form differs
		// from what is saved, 'filled' = all required fields are filled in correctly.
		when?: 'changed' | 'filled';
	};
	let {
		text,
		busy = false,
		disabled = false,
		icon: Icon,
		style = BUTTON_PRIMARY,
		formaction,
		name,
		value,
		when
	}: Props = $props();

	let button = $state<HTMLButtonElement>();
	let ready = $state(true);

	// Watches the form the button belongs to. The saved state is what the form looked like when
	// the page was drawn, and again after every successful save (event "saved", see FormFeedback).
	$effect(() => {
		const form = button?.form;
		if (!when || !form) return;
		const snapshot = () =>
			JSON.stringify(
				[...new FormData(form)].map(([key, v]) => [
					key,
					v instanceof File ? `${v.name}:${v.size}` : v
				])
			);
		let saved = snapshot();
		const check = () => {
			ready = when === 'filled' ? form.checkValidity() : snapshot() !== saved;
		};
		const reset = async () => {
			await tick();
			saved = snapshot();
			check();
		};
		check();
		form.addEventListener('input', check);
		form.addEventListener('change', check);
		form.addEventListener('saved', reset);
		form.addEventListener('reset', reset);
		return () => {
			form.removeEventListener('input', check);
			form.removeEventListener('change', check);
			form.removeEventListener('saved', reset);
			form.removeEventListener('reset', reset);
		};
	});
</script>

<!-- Submit button that shows a spinner while the form is being sent; with `when` it stays
     greyed out until there is something to send -->
<button
	bind:this={button}
	class={style}
	disabled={busy || disabled || !ready}
	{formaction}
	{name}
	{value}
>
	{#if busy}
		<LoaderCircle size={18} class="animate-spin" />
	{:else if Icon}
		<Icon size={18} />
	{/if}
	{text}
</button>
