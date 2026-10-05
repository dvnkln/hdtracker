<script lang="ts">
	import { enhance } from '$app/forms';
	import { autosave } from '$lib/autosave';
	import { m } from '$lib/i18n/index.svelte';
	import { FormFeedback } from '$lib/forms.svelte';
	import { ui } from '$lib/ui';
	import FeedbackText from '$lib/components/FeedbackText.svelte';
	import TargetList from '$lib/components/TargetList.svelte';
	import { CalendarClock, Send } from '@lucide/svelte';

	let { data } = $props();

	const forms = new FormFeedback();
	const { card, heading, label, labelText, hint, pageTitle } = ui;
	const WIKI = 'https://github.com/dvnkln/hdtracker/wiki/Privacy-and-security#push-notifications';
	const MODES = ['off', 'single', 'digest'] as const;
	const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
	// What is chosen right now (decides whether the hour is shown)
	// svelte-ignore state_referenced_locally
	let mode = $state(data.prefs.mode);
</script>

<svelte:head><title>{m.notifications.title} · hdtracker</title></svelte:head>

<h2 class={pageTitle}>{m.notifications.title}</h2>

<!-- What to be told, and when -->
<section class={card}>
	<!-- (Should saving fail, the reason is shown up here.) -->
	<div class="flex min-h-7 items-center justify-between gap-3">
		<h3 class={heading}>
			<CalendarClock size={20} class="text-zinc-400" />{m.notifications.releases}
		</h3>
		<FeedbackText feedback={forms.error('prefs')} />
	</div>
	<form
		method="POST"
		action="?/prefs"
		use:enhance={forms.submit('prefs')}
		use:autosave
		class="mt-4 flex flex-col gap-4"
	>
		<fieldset class="flex flex-col gap-2">
			<legend class="{labelText} mb-2">{m.notifications.mode}</legend>
			{#each MODES as option (option)}
				<label
					class="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 px-3 py-2.5 transition-colors hover:border-zinc-600 has-checked:border-zinc-400"
				>
					<input type="radio" name="mode" value={option} bind:group={mode} />
					<span class="text-sm">{m.notifications.modes[option]}</span>
				</label>
			{/each}
			<span class={hint}>{m.notifications.what}</span>
		</fieldset>
		<!-- The hour only matters while messages are on -->
		{#if mode === 'off'}
			<input type="hidden" name="hour" value={data.prefs.hour} />
		{:else}
			<label class={label}>
				<span class={labelText}>{m.notifications.hour}</span>
				<select name="hour" value={data.prefs.hour}>
					{#each HOURS as hour (hour)}
						<option value={hour}>{m.notifications.oclock(hour)}</option>
					{/each}
				</select>
			</label>
		{/if}
	</form>
</section>

<!-- Where to: devices, Pushover, ... as one list -->
<section class={card}>
	<h3 class={heading}><Send size={20} class="text-zinc-400" />{m.notifications.targets}</h3>
	<TargetList targets={data.targets} publicKey={data.publicKey} paused={mode === 'off'} />
	<p class="mt-4 {hint}">
		<a class="underline" href={WIKI} target="_blank" rel="noreferrer">{m.notifications.learnMore}</a
		>
	</p>
</section>
