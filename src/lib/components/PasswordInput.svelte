<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { m } from '$lib/i18n/index.svelte';
	import { Eye, EyeOff } from '@lucide/svelte';

	// Same attributes as a normal <input> (name, autocomplete, minlength, ...).
	let props: Omit<HTMLInputAttributes, 'type'> = $props();
	let visible = $state(false);
</script>

<!-- Password field with an eye button to show/hide what was typed -->
<span class="relative flex">
	<input {...props} type={visible ? 'text' : 'password'} class="min-w-0 flex-1 pr-11" />
	<button
		type="button"
		class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-zinc-400 transition-colors hover:text-zinc-100"
		aria-label={visible ? m.common.hidePassword : m.common.showPassword}
		title={visible ? m.common.hidePassword : m.common.showPassword}
		aria-pressed={visible}
		onclick={() => (visible = !visible)}
	>
		{#if visible}<EyeOff size={18} />{:else}<Eye size={18} />{/if}
	</button>
</span>
