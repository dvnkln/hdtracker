<script lang="ts">
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import { m } from '$lib/i18n/index.svelte';
	import { MIN_PASSWORD_LENGTH } from '$lib/limits';
	import { ui } from '$lib/ui';
	import { Check } from '@lucide/svelte';

	// The two fields for choosing a password (fields "password" and "confirm"). They say while
	// typing whether it is long enough and whether both are the same – so nobody finds out only
	// after sending. The server checks the same again.
	type Props = { label?: string; repeatLabel?: string };
	let {
		label = m.auth.passwordMin(MIN_PASSWORD_LENGTH),
		repeatLabel = m.auth.passwordRepeat
	}: Props = $props();

	let password = $state('');
	let confirm = $state('');
	let missing = $derived(MIN_PASSWORD_LENGTH - password.length);
	let same = $derived(confirm.length > 0 && confirm === password);
	const typed = (set: (value: string) => void) => (event: Event) =>
		set((event.currentTarget as HTMLInputElement).value);
</script>

<label class={ui.label}>
	<span class={ui.labelText}>{label}</span>
	<PasswordInput
		name="password"
		autocomplete="new-password"
		minlength={MIN_PASSWORD_LENGTH}
		required
		oninput={typed((value) => (password = value))}
	/>
	<!-- Always there, so nothing jumps while typing -->
	<span class="flex min-h-4 items-center gap-1 text-xs" aria-live="polite">
		{#if missing <= 0}
			<span class="flex items-center gap-1 text-emerald-400"
				><Check size={14} />{m.auth.passwordLongEnough}</span
			>
		{:else if password.length}
			<span class="text-zinc-400">{m.auth.passwordMissing(missing)}</span>
		{/if}
	</span>
</label>
<label class={ui.label}>
	<span class={ui.labelText}>{repeatLabel}</span>
	<PasswordInput
		name="confirm"
		autocomplete="new-password"
		required
		oninput={typed((value) => (confirm = value))}
	/>
	<span class="flex min-h-4 items-center gap-1 text-xs" aria-live="polite">
		{#if same}
			<span class="flex items-center gap-1 text-emerald-400"
				><Check size={14} />{m.auth.passwordsMatch}</span
			>
		{:else if confirm.length}
			<span class="text-zinc-400">{m.auth.passwordsNoMatchYet}</span>
		{/if}
	</span>
</label>
