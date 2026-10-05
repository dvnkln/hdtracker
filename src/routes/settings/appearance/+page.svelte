<script lang="ts">
	import { enhance } from '$app/forms';
	import { autosave } from '$lib/autosave';
	import { m } from '$lib/i18n/index.svelte';
	import { FormFeedback } from '$lib/forms.svelte';
	import { ui } from '$lib/ui';
	import FeedbackText from '$lib/components/FeedbackText.svelte';
	import SubmitButton from '$lib/components/SubmitButton.svelte';
	import ThemePreview from '$lib/components/ThemePreview.svelte';
	import { THEME_KEYS, barColors, type Theme } from '$lib/themes';
	import { Palette } from '@lucide/svelte';

	let { data } = $props();

	const forms = new FormFeedback();
	const { card, heading, hint, actions, pageTitle } = ui;

	// A tap switches the whole app at once (no reload); saving is done by `use:autosave`.
	// svelte-ignore state_referenced_locally
	let theme = $state<Theme>(data.theme);
	function applyTheme(next: Theme) {
		theme = next;
		document.documentElement.dataset.theme = next;
		document
			.querySelectorAll('meta[name="theme-color"]')
			.forEach((meta, i) => meta.setAttribute('content', barColors(next)[i]));
	}
</script>

<svelte:head><title>{m.settings.appearance} · hdtracker</title></svelte:head>

<h2 class={pageTitle}>{m.settings.appearance}</h2>

<section class={card}>
	<div class="flex min-h-7 items-center justify-between gap-3">
		<h3 class={heading}><Palette size={20} class="text-zinc-400" />{m.settings.theme}</h3>
		<FeedbackText feedback={forms.error('theme')} />
	</div>
	<p class="mt-1 {hint}">{m.settings.themeHint}</p>

	<form
		method="POST"
		action="?/theme"
		use:enhance={forms.submit('theme')}
		use:autosave
		class="mt-4"
	>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
			{#each THEME_KEYS as key (key)}
				<label
					class="ui-btn flex cursor-pointer flex-col gap-2 rounded-xl border p-2 transition-colors {theme ===
					key
						? 'border-zinc-300 bg-zinc-800/60'
						: 'border-zinc-800 hover:border-zinc-600'}"
				>
					<ThemePreview theme={key} />
					<span class="flex items-center gap-2 px-1 text-sm font-medium">
						<input
							type="radio"
							name="theme"
							value={key}
							checked={theme === key}
							onchange={() => applyTheme(key)}
							class="accent-zinc-100"
						/>
						{m.settings.themes[key]}
					</span>
				</label>
			{/each}
		</div>
		<!-- Only needed without JavaScript: a tap on a theme saves by itself -->
		<noscript><div class="mt-4 {actions}"><SubmitButton text={m.settings.save} /></div></noscript>
	</form>
</section>
