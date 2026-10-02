<script lang="ts">
	import { enhance } from '$app/forms';
	import { CATEGORIES, CATEGORY_KEYS, type Category } from '$lib/categories';
	import { LOCALES, m } from '$lib/i18n/index.svelte';
	import { FormFeedback } from '$lib/forms.svelte';
	import { ui } from '$lib/ui';
	import FeedbackText from '$lib/components/FeedbackText.svelte';
	import SubmitButton from '$lib/components/SubmitButton.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import { LayoutGrid, Monitor, SlidersHorizontal } from '@lucide/svelte';

	let { data } = $props();

	// "Gespeichert ✓" or an error message next to each form's button.
	const forms = new FormFeedback();

	// Areas switched on; the last one cannot be switched off.
	// svelte-ignore state_referenced_locally
	let areas = $state(
		Object.fromEntries(CATEGORY_KEYS.map((key) => [key, data.categories.includes(key)])) as Record<
			Category,
			boolean
		>
	);
	let areaCount = $derived(CATEGORY_KEYS.filter((key) => areas[key]).length);

	// Each interface language in its own language: "Deutsch", "English".
	const nativeName = (code: string) =>
		new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;

	const { card, heading, label, labelText, hint, actions, pageTitle } = ui;
</script>

<svelte:head><title>{m.settings.general} · hdtracker</title></svelte:head>

<h2 class={pageTitle}>{m.settings.general}</h2>

<!-- Display -->
<section class={card}>
	<h3 class={heading}><Monitor size={20} class="text-zinc-400" />{m.settings.display}</h3>

	<form
		method="POST"
		action="?/display"
		use:enhance={forms.submit('display')}
		class="mt-4 flex flex-col gap-4"
	>
		<label class={label}>
			<span class={labelText}>{m.settings.uiLanguage}</span>
			<select name="uiLanguage" value={data.values.uiLanguage}>
				{#each LOCALES as code (code)}
					<option value={code}>{nativeName(code)}</option>
				{/each}
			</select>
		</label>

		<fieldset class="flex flex-col gap-2">
			<legend class="{labelText} mb-1">{m.settings.animeTitle}</legend>
			{#each [['english', m.settings.animeTitleEnglish], ['romaji', m.settings.animeTitleRomaji]] as [value, text] (value)}
				<label
					class="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 px-3 py-2.5 transition-colors hover:border-zinc-600 has-checked:border-zinc-400"
				>
					<input
						type="radio"
						name="animeTitle"
						{value}
						checked={data.values.animeTitle === value}
						class="size-4 accent-zinc-100"
					/>
					<span class="text-sm">{text}</span>
				</label>
			{/each}
		</fieldset>

		<div class="flex items-start justify-between gap-4">
			<label for="hideSpoilers" class="flex cursor-pointer flex-col gap-1">
				<span class={labelText}>{m.settings.hideSpoilers}</span>
				<span class={hint}>{m.settings.hideSpoilersHint}</span>
			</label>
			<Switch id="hideSpoilers" name="hideSpoilers" checked={data.values.hideSpoilers} />
		</div>

		<div class={actions}>
			<SubmitButton text={m.settings.save} busy={forms.busy === 'display'} />
			<FeedbackText feedback={forms.messages.display} />
		</div>
	</form>
</section>

<!-- Behavior -->
<section class={card}>
	<h3 class={heading}>
		<SlidersHorizontal size={20} class="text-zinc-400" />{m.settings.behavior}
	</h3>

	<form method="POST" action="?/behavior" use:enhance={forms.submit('behavior')} class="mt-4">
		<div class="flex items-start justify-between gap-4">
			<label for="autoStatus" class="flex cursor-pointer flex-col gap-1">
				<span class={labelText}>{m.settings.autoStatus}</span>
				<span class={hint}>{m.settings.autoStatusHint}</span>
			</label>
			<Switch id="autoStatus" name="autoStatus" checked={data.values.autoStatus} />
		</div>
		<div class="mt-4">
			<div class={actions}>
				<SubmitButton text={m.settings.save} busy={forms.busy === 'behavior'} />
				<FeedbackText feedback={forms.messages.behavior} />
			</div>
		</div>
	</form>
</section>

<!-- Areas -->
<section class={card}>
	<h3 class={heading}><LayoutGrid size={20} class="text-zinc-400" />{m.settings.areas}</h3>
	<p class="mt-1 {hint}">{m.settings.areasHint}</p>

	<form
		method="POST"
		action="?/areas"
		use:enhance={forms.submit('areas')}
		class="mt-4 flex flex-col gap-3"
	>
		{#each CATEGORY_KEYS as key (key)}
			{@const cat = CATEGORIES[key]}
			<div class="flex items-center justify-between gap-4">
				<label for="area-{key}" class="flex cursor-pointer items-center gap-2 {labelText}">
					<cat.icon size={18} style="color: {cat.accent}" />
					{m.categories[key]}
				</label>
				<Switch
					id="area-{key}"
					name="categories"
					value={key}
					bind:checked={areas[key]}
					locked={areas[key] && areaCount === 1}
				/>
			</div>
			<!-- Switched off with entries in it: say what happens to them -->
			{#if !areas[key] && data.libraryCounts[key]}
				<Notice kind="warning" class="-mt-1">
					{m.settings.areaHiddenData(data.libraryCounts[key])}
				</Notice>
			{/if}
		{/each}
		<div class="mt-1 {actions}">
			<SubmitButton text={m.settings.save} busy={forms.busy === 'areas'} />
			<FeedbackText feedback={forms.messages.areas} />
		</div>
	</form>
</section>
