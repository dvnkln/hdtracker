<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import type { FormFeedback } from '$lib/forms.svelte';
	import { formatDateTime, formatDuration, formatFileSize, m } from '$lib/i18n/index.svelte';
	import { ui } from '$lib/ui';
	import FeedbackText from '$lib/components/FeedbackText.svelte';
	import SubmitButton, { BUTTON_SECONDARY } from '$lib/components/SubmitButton.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import { CircleAlert, CircleCheck, Play } from '@lucide/svelte';
	import type { PageData } from './$types';

	type Props = {
		task: PageData['tasks'][number];
		frequencies: PageData['frequencies'];
		forms: FormFeedback;
		// Extra fields (backup: how many to keep) and content below the form (backup list)
		fields?: Snippet;
		children?: Snippet;
	};
	let { task, frequencies, forms, fields, children }: Props = $props();

	const { card, label, labelText, hint, actions } = ui;
	let text = $derived(m.maintenance.tasks[task.key]);

	// Local copy, so the time/weekday fields can follow the chosen frequency right away.
	// svelte-ignore state_referenced_locally
	let frequency = $state(task.frequency);

	// Weekday names in the interface language, Monday first. 2023-01-01 was a Sunday.
	let weekdays = $derived(
		[1, 2, 3, 4, 5, 6, 0].map((day) => ({
			day,
			name: new Intl.DateTimeFormat(m.locale, { weekday: 'long' }).format(
				new Date(2023, 0, 1 + day)
			)
		}))
	);
</script>

<section class={card}>
	<form
		method="POST"
		action="?/save"
		use:enhance={forms.submit(task.key)}
		class="flex flex-col gap-4"
	>
		<input type="hidden" name="key" value={task.key} />

		<div class="flex items-start justify-between gap-4">
			<label for="enabled-{task.key}" class="flex cursor-pointer flex-col gap-1">
				<span class="text-lg font-semibold">{text.name}</span>
				<span class={hint}>{text.description}</span>
			</label>
			<Switch
				id="enabled-{task.key}"
				name="enabled"
				checked={task.enabled}
				locked={task.required}
			/>
		</div>

		<!-- Last and next run -->
		<div class="flex flex-col gap-1 text-sm">
			{#if task.running}
				<p class="text-zinc-300">{m.maintenance.running}</p>
			{:else if task.lastRunAt}
				<p class="flex items-center gap-1.5 {task.lastError ? 'text-red-400' : 'text-zinc-300'}">
					{#if task.lastError}
						<CircleAlert size={16} class="shrink-0" />
					{:else}
						<CircleCheck size={16} class="shrink-0 text-emerald-400" />
					{/if}
					{m.maintenance.lastRun(formatDateTime(task.lastRunAt))}
					{#if task.lastDurationMs !== null}
						<span class="text-zinc-500">· {formatDuration(task.lastDurationMs)}</span>
					{/if}
					{#if task.lastFreedBytes}
						<span class="text-zinc-500">
							· {m.maintenance.freed(formatFileSize(task.lastFreedBytes))}
						</span>
					{/if}
				</p>
				{#if task.lastError}
					<p class="text-xs break-words text-red-400">
						{m.maintenance.failed}
						{task.lastError}
					</p>
				{/if}
			{:else}
				<p class="text-zinc-500">{m.maintenance.neverRun}</p>
			{/if}
			<p class="text-zinc-500">
				{task.nextRunAt ? m.maintenance.nextRun(formatDateTime(task.nextRunAt)) : m.maintenance.off}
			</p>
			{#if task.used}
				{@const size = formatFileSize(task.used.bytes)}
				<p class="text-zinc-500">
					{task.used.kind === 'images' || task.used.kind === 'metadata'
						? m.maintenance.stored[task.used.kind](size, task.used.count)
						: m.maintenance.stored[task.used.kind](size)}
				</p>
			{/if}
		</div>

		<!-- Schedule -->
		<div class="grid grid-cols-2 gap-3">
			<label class={label}>
				<span class={labelText}>{m.maintenance.frequency}</span>
				<select name="frequency" bind:value={frequency}>
					{#each frequencies as value (value)}
						<option {value}>{m.maintenance.frequencies[value]}</option>
					{/each}
				</select>
			</label>
			{#if frequency === 'hourly'}
				<input type="hidden" name="time" value={task.time} />
			{:else}
				<label class={label}>
					<span class={labelText}>{m.maintenance.time}</span>
					<input type="time" name="time" value={task.time} required />
				</label>
			{/if}
			{#if frequency === 'weekly'}
				<label class="{label} col-span-2">
					<span class={labelText}>{m.maintenance.weekday}</span>
					<select name="weekday" value={task.weekday}>
						{#each weekdays as { day, name } (day)}
							<option value={day}>{name}</option>
						{/each}
					</select>
				</label>
			{:else}
				<input type="hidden" name="weekday" value={task.weekday} />
			{/if}
		</div>
		{#if frequency === 'hourly' || frequency === 'monthly'}
			<p class="-mt-2 {hint}">
				{frequency === 'hourly' ? m.maintenance.hourlyHint : m.maintenance.monthlyHint}
			</p>
		{/if}

		{@render fields?.()}

		<div class={actions}>
			<SubmitButton
				text={m.settings.save}
				busy={forms.busy === task.key && !forms.busyAction}
				disabled={forms.busy === task.key}
			/>
			<SubmitButton
				text={m.maintenance.runNow}
				icon={Play}
				style={BUTTON_SECONDARY}
				formaction="?/run"
				busy={(forms.busy === task.key && forms.busyAction === '?/run') || task.running}
				disabled={forms.busy === task.key}
			/>
			<FeedbackText feedback={forms.messages[task.key]} />
		</div>
		{#if task.usesApi}
			<p class="-mt-2 {hint}">{m.maintenance.apiHint}</p>
		{/if}
	</form>

	{@render children?.()}
</section>
