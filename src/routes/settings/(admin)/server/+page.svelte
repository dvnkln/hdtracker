<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/i18n/index.svelte';
	import { FormFeedback } from '$lib/forms.svelte';
	import { ui } from '$lib/ui';
	import FeedbackText from '$lib/components/FeedbackText.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import SubmitButton from '$lib/components/SubmitButton.svelte';
	import { Globe } from '@lucide/svelte';

	let { data } = $props();

	const forms = new FormFeedback();
	const { card, heading, label, labelText, hint, actions, pageTitle } = ui;

	// Names in the current interface language, sorted A–Z. Unknown codes are shown as they are.
	function named(codes: string[], type: 'region' | 'language') {
		const names = new Intl.DisplayNames([m.locale], { type });
		return codes
			.map((code) => {
				let name = code;
				try {
					name = names.of(code) ?? code;
				} catch {
					// invalid code: keep it
				}
				return { code, name };
			})
			.sort((a, b) => a.name.localeCompare(b.name, m.locale));
	}

	let regions = $derived(named(data.regions, 'region'));
	let languages = $derived(named(data.languages, 'language'));
</script>

<svelte:head><title>{m.settings.server} · hdtracker</title></svelte:head>

<h2 class={pageTitle}>{m.settings.server}</h2>

<section class={card}>
	<h3 class={heading}><Globe size={20} class="text-zinc-400" />{m.settings.content}</h3>

	<form
		method="POST"
		action="?/content"
		use:enhance={forms.submit('content')}
		class="mt-4 flex flex-col gap-4"
	>
		<label class={label}>
			<span class={labelText}>{m.settings.contentLanguage}</span>
			<select name="language" value={data.values.language}>
				{#each languages as lang (lang.code)}
					<option value={lang.code}>{lang.name}</option>
				{/each}
			</select>
			<span class={hint}>{m.settings.contentLanguageHint}</span>
		</label>

		<label class={label}>
			<span class={labelText}>{m.settings.region}</span>
			<select name="region" value={data.values.region}>
				{#each regions as region (region.code)}
					<option value={region.code}>{region.name}</option>
				{/each}
			</select>
			<span class={hint}>{m.settings.regionHint}</span>
		</label>

		{#if data.listsFailed}
			<Notice kind="warning">{m.settings.listsUnavailable}</Notice>
		{/if}

		<div class={actions}>
			<SubmitButton text={m.settings.save} busy={forms.busy === 'content'} />
			<FeedbackText feedback={forms.messages.content} />
		</div>
	</form>
</section>
