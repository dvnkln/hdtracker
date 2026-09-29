<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { CATEGORIES, CATEGORY_KEYS } from '$lib/categories';
	import { m } from '$lib/i18n/index.svelte';
	import { ui } from '$lib/ui';
	import SubmitButton from '$lib/components/SubmitButton.svelte';
	import { CircleCheck, LoaderCircle, Upload } from '@lucide/svelte';

	let { data, form } = $props();

	const { card, label, labelText, hint, actions } = ui;
	let busy = $state(false);

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

<svelte:head><title>{m.importData.title} · hdtracker</title></svelte:head>

<main class="mx-auto max-w-screen-sm px-4 pb-4">
	<section class={card}>
		<h2 class="text-lg font-semibold">Yamtrack</h2>
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
			<div class={actions}>
				<SubmitButton text={m.importData.start} icon={Upload} {busy} />
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
			<h2 class="flex items-center gap-2 text-lg font-semibold text-emerald-400">
				<CircleCheck size={20} />{m.importData.done}
			</h2>

			<h3 class="mt-4 text-sm font-medium text-zinc-300">{m.importData.imported}</h3>
			<ul class="mt-1 flex flex-col gap-1 text-sm">
				{#each CATEGORY_KEYS as key (key)}
					{@const cat = CATEGORIES[key]}
					<li class="flex items-center gap-2">
						<cat.icon size={16} color={cat.accent} />
						{m.categories[key]}: {report.imported[key]}
					</li>
				{/each}
				<li class="text-zinc-400">{m.importData.episodes(report.episodes)}</li>
				{#if report.existing}
					<li class="text-zinc-400">{m.importData.existing(report.existing)}</li>
				{/if}
			</ul>

			{#if report.skipped.length}
				<h3 class="mt-4 text-sm font-medium text-zinc-300">
					{m.importData.skipped(report.skipped.length)}
				</h3>
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
</main>
