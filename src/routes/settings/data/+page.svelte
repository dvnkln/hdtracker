<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { CATEGORIES, CATEGORY_KEYS, type Category } from '$lib/categories';
	import { m } from '$lib/i18n/index.svelte';
	import { ui } from '$lib/ui';
	import { FormFeedback } from '$lib/forms.svelte';
	import FeedbackText from '$lib/components/FeedbackText.svelte';
	import SubmitButton, {
		BUTTON_DANGER,
		BUTTON_PRIMARY,
		BUTTON_SECONDARY
	} from '$lib/components/SubmitButton.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import {
		CircleCheck,
		Download,
		FileDown,
		FileUp,
		LoaderCircle,
		TriangleAlert,
		Upload
	} from '@lucide/svelte';

	let { data, form } = $props();

	const { card, heading, label, labelText, hint, actions, pageTitle } = ui;

	// "Gespeichert ✓" / error next to the delete button
	const forms = new FormFeedback();

	// The delete button only works once the confirmation word is typed in.
	let confirmText = $state('');
	let confirmOk = $derived(confirmText.trim().toUpperCase() === m.settings.confirmWord);
	let busy = $state(false);

	// "9 Anime und 3 Spiele" – titles of hidden areas found in the file
	function hiddenList(counts: Partial<Record<Category, number>>) {
		const parts = CATEGORY_KEYS.filter((key) => counts[key]).map(
			(key) => `${counts[key]} × ${m.categories[key]}`
		);
		return new Intl.ListFormat(m.locale, { type: 'conjunction' }).format(parts);
	}

	// While titles still wait for their details (e.g. after an import): ask every few seconds
	// how many are left. Depends only on the server, so it also shows after leaving the page.
	let sawLoading = $state(false);
	$effect(() => {
		if (data.pending === 0) return;
		sawLoading = true;
		const timer = setInterval(() => invalidateAll(), 3000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head><title>{m.settings.data} · hdtracker</title></svelte:head>

<h2 class={pageTitle}>{m.settings.data}</h2>

<section class={card}>
	<h3 class={heading}><FileUp size={20} class="text-zinc-400" />{m.importData.title}: Yamtrack</h3>
	<p class="mt-1 {hint}">{m.importData.intro}</p>

	<form
		method="POST"
		action="?/yamtrack"
		enctype="multipart/form-data"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
		class="mt-4 flex flex-col gap-4"
	>
		<label class={label}>
			<span class={labelText}>{m.importData.file}</span>
			<input
				type="file"
				name="file"
				accept=".csv,text/csv"
				required
				class="file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-zinc-100 hover:file:bg-zinc-700"
			/>
		</label>
		<p class={hint}>{m.importData.notes}</p>

		<!-- The file contains titles of hidden areas: ask what to do -->
		{#if form?.hidden}
			<Notice kind="warning">
				<p>{m.importData.hiddenFound(hiddenList(form.hidden))}</p>
				<!-- Phones: buttons stacked in full width; computers: side by side -->
				<div class="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
					<SubmitButton
						text={m.importData.hiddenSkip}
						style="{BUTTON_PRIMARY} justify-center"
						{busy}
						name="hidden"
						value="skip"
					/>
					<SubmitButton
						text={m.importData.hiddenEnable}
						style="{BUTTON_SECONDARY} justify-center"
						name="hidden"
						value="enable"
						disabled={busy}
					/>
					<SubmitButton
						text={m.importData.hiddenImport}
						style="{BUTTON_SECONDARY} justify-center"
						name="hidden"
						value="import"
						disabled={busy}
					/>
				</div>
			</Notice>
		{/if}

		<div class={actions}>
			<SubmitButton text={m.importData.start} icon={Upload} {busy} when="filled" />
			{#if form?.error}
				<p role="status" class="text-sm text-red-400">{form.error}</p>
			{/if}
		</div>
	</form>
</section>

<!-- Posters, descriptions and dates load in the background after an import -->
{#if data.pending > 0}
	<section class={card}>
		<p class="flex items-center gap-2 text-sm text-zinc-300">
			<LoaderCircle size={16} class="shrink-0 animate-spin" />
			{m.importData.loading(data.pending, Math.ceil(data.seconds / 60))}
		</p>
		<p class="mt-1 {hint}">{m.importData.loadingHint}</p>
	</section>
{:else if sawLoading || form?.report}
	<section class={card}>
		<p class="flex items-center gap-2 text-sm text-emerald-400">
			<CircleCheck size={16} class="shrink-0" />{m.importData.loaded}
		</p>
	</section>
{/if}

{#if form?.report}
	{@const report = form.report}
	<section class="{card} border-emerald-900/70">
		<h3 class="flex items-center gap-2 text-lg font-semibold text-emerald-400">
			<CircleCheck size={20} />{m.importData.done}
		</h3>

		<h4 class="mt-4 text-sm font-medium text-zinc-300">{m.importData.imported}</h4>
		<ul class="mt-1 flex flex-col gap-1 text-sm">
			{#each CATEGORY_KEYS as key (key)}
				{@const cat = CATEGORIES[key]}
				<li class="flex items-center gap-2">
					<cat.icon size={16} style="color: {cat.accent}" />
					{m.categories[key]}: {report.imported[key]}
				</li>
			{/each}
			<li class="text-zinc-400">{m.importData.episodes(report.episodes)}</li>
			{#each CATEGORY_KEYS.filter((key) => report.hiddenSkipped[key]) as key (key)}
				<li class="text-zinc-400">
					{m.importData.hiddenSkipped(report.hiddenSkipped[key]!, m.categories[key])}
				</li>
			{/each}
			{#if report.existing}
				<li class="text-zinc-400">{m.importData.existing(report.existing)}</li>
			{/if}
		</ul>

		{#if report.skipped.length}
			<h4 class="mt-4 text-sm font-medium text-zinc-300">
				{m.importData.skipped(report.skipped.length)}
			</h4>
			<ul class="mt-1 flex flex-col gap-1 text-sm">
				{#each report.skipped as entry, i (i)}
					<li>
						{entry.title}
						<span class="text-zinc-500">– {m.importData.reasons[entry.reason]}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<!-- Export: a plain download, nothing is asked from any API -->
<section class={card}>
	<h3 class={heading}><FileDown size={20} class="text-zinc-400" />{m.exportData.title}</h3>
	<p class="mt-1 {hint}">{m.exportData.intro}</p>
	<div class="mt-4 {actions}">
		<a
			href="/settings/data/export"
			download
			class="{BUTTON_SECONDARY} inline-flex items-center gap-2"
		>
			<Download size={18} />
			{m.exportData.download}
		</a>
	</div>
	{#if data.exportGaps.loading}
		<p class="mt-3 {hint}">{m.exportData.animeLoading(data.exportGaps.loading)}</p>
	{/if}
	{#if data.exportGaps.unknown}
		<p class="mt-3 {hint}">{m.exportData.animeUnknown(data.exportGaps.unknown)}</p>
	{/if}
</section>

<!-- Danger zone -->
<section class="{card} border-red-900/70">
	<h3 class="{heading} text-red-400"><TriangleAlert size={20} />{m.settings.danger}</h3>

	<form
		method="POST"
		action="?/clear"
		use:enhance={forms.submit('clear', true)}
		onreset={() => (confirmText = '')}
		class="mt-4 flex flex-col gap-4"
	>
		<div>
			<h4 class="font-medium text-zinc-300">{m.settings.clearLibrary}</h4>
			<p class="mt-1 {hint}">{m.settings.clearHint}</p>
		</div>
		<label class={label}>
			<span class={labelText}>{m.settings.clearWhat}</span>
			<select name="target">
				{#each CATEGORY_KEYS as key (key)}
					<option value={key}>{m.categories[key]}</option>
				{/each}
				<option value="all">{m.settings.clearAll}</option>
			</select>
		</label>
		<label class={label}>
			<span class={labelText}>{m.settings.confirmPrompt(m.settings.confirmWord)}</span>
			<input
				name="confirm"
				bind:value={confirmText}
				autocomplete="off"
				autocapitalize="characters"
				spellcheck="false"
				placeholder={m.settings.confirmWord}
			/>
		</label>
		<div class={actions}>
			<SubmitButton
				text={m.settings.clearButton}
				busy={forms.busy === 'clear'}
				icon={TriangleAlert}
				style={BUTTON_DANGER}
				disabled={!confirmOk}
			/>
			<FeedbackText feedback={forms.messages.clear} />
		</div>
	</form>
</section>
