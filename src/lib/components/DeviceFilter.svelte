<script lang="ts">
	import { tick } from 'svelte';
	import { Check } from '@lucide/svelte';
	import { m } from '$lib/i18n/index.svelte';
	import { ui } from '$lib/ui';

	// Pushover's optional device filter: a text field (one device name, or several with
	// commas; empty = all devices) and, below it, the device names Pushover reported for the
	// account. A tap on a name puts it into the field, another tap takes it out again.
	type Props = { value: string; known: string[] };
	let { value, known }: Props = $props();

	// svelte-ignore state_referenced_locally
	let text = $state(value);
	let chosen = $derived(
		text
			.split(',')
			.map((name) => name.trim())
			.filter(Boolean)
	);
	let field = $state<HTMLInputElement>();
	async function toggle(device: string) {
		text = (
			chosen.includes(device) ? chosen.filter((name) => name !== device) : [...chosen, device]
		).join(',');
		// Tell the form that something changed, as typing would (wakes its "Save" button)
		await tick();
		field?.dispatchEvent(new Event('input', { bubbles: true }));
	}
</script>

<label class={ui.label}>
	<span class={ui.labelText}>{m.notifications.devices}</span>
	<input
		name="devices"
		bind:this={field}
		bind:value={text}
		autocapitalize="off"
		autocomplete="off"
		spellcheck="false"
	/>
	<span class={ui.hint}>{m.notifications.devicesHint}</span>
</label>
{#if known.length}
	<p class="-mt-2 flex flex-wrap items-center gap-1.5 {ui.hint}">
		{m.notifications.known}
		{#each known as device (device)}
			{@const on = chosen.includes(device)}
			<button
				type="button"
				aria-pressed={on}
				class="ui-btn inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors {on
					? 'ui-keep border-emerald-400 text-emerald-400'
					: 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}"
				onclick={() => toggle(device)}
			>
				{#if on}<Check size={12} strokeWidth={3} />{/if}{device}
			</button>
		{/each}
	</p>
{/if}
