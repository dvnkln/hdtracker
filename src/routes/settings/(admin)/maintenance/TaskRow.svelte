<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import type { FormFeedback } from '#lib/forms.svelte.js';
	import { formatDateTime, formatDuration, formatFileSize, m } from '#lib/i18n/index.svelte.js';
	import { ui } from '#lib/ui.js';
	import FeedbackText from '#lib/components/FeedbackText.svelte';
	import SubmitButton, { BUTTON_SECONDARY } from '#lib/components/SubmitButton.svelte';
	import Switch from '#lib/components/Switch.svelte';
	import { autosave } from '#lib/autosave.js';
	import {
		ChevronDown,
		CircleAlert,
		CircleCheck,
		CircleDashed,
		LoaderCircle,
		Play,
		RotateCcw
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	type Props = {
		task: PageData['tasks'][number];
		frequencies: PageData['frequencies'];
		forms: FormFeedback;
		// Whether the row is unfolded, and what a tap on it does
		open: boolean;
		ontoggle: () => void;
		// Extra fields (backup: how many to keep) and content below the form (backup list)
		fields?: Snippet;
		children?: Snippet;
	};
	let { task, frequencies, forms, open, ontoggle, fields, children }: Props = $props();

	const { label, labelText, hint, actions } = ui;
	let text = $derived(m.maintenance.tasks[task.key]);

	// Local copy, so the time/weekday fields can follow the chosen frequency right away.
	// svelte-ignore state_referenced_locally
	let frequency = $state(task.frequency);
	// ... and follows the saved value again when that changes (e.g. after a reset).
	$effect.pre(() => {
		frequency = task.frequency;
	});

	let mainForm = $state<HTMLFormElement>();

	// The line under the name: when it runs and how the last run went – or what is wrong
	let schedule = $derived.by(() => {
		if (!task.enabled) return m.maintenance.off;
		const often = m.maintenance.frequencies[task.frequency];
		if (task.frequency === 'hourly') return often;
		const day =
			task.frequency === 'weekly'
				? ` ${weekdays.find((w) => w.day === task.weekday)?.name ?? ''},`
				: '';
		return `${often}${day} ${task.time}`;
	});
	let summary = $derived(
		task.running
			? m.maintenance.running
			: task.lastError
				? `${m.maintenance.failed} ${task.lastError}`
				: `${schedule} · ${
						task.lastRunAt
							? m.maintenance.lastRun(formatDateTime(task.lastRunAt))
							: m.maintenance.neverRun
					}`
	);

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

<!-- One task: a row that says how it stands; a tap unfolds everything about it -->
<li class="py-3">
	<div class="flex items-center gap-3">
		<button
			type="button"
			class="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
			aria-expanded={open}
			onclick={ontoggle}
		>
			{#if task.running}
				<LoaderCircle size={20} class="shrink-0 animate-spin text-zinc-400" />
			{:else if task.lastError}
				<CircleAlert size={20} class="shrink-0 text-red-400" />
			{:else if task.lastRunAt && task.enabled}
				<CircleCheck size={20} class="shrink-0 text-emerald-400" />
			{:else}
				<CircleDashed size={20} class="shrink-0 text-zinc-600" />
			{/if}
			<span class="min-w-0 flex-1">
				<span class="block truncate font-medium">{text.name}</span>
				<span class="line-clamp-2 text-xs {task.lastError ? 'text-red-400' : 'text-zinc-500'}">
					{summary}
				</span>
			</span>
		</button>
		<!-- On or off is saved the moment it is switched -->
		<form method="POST" action="?/toggle" use:enhance={forms.submit(task.key)} use:autosave>
			<input type="hidden" name="key" value={task.key} />
			<span class="sr-only"><label for="enabled-{task.key}">{text.name}</label></span>
			<Switch
				id="enabled-{task.key}"
				name="enabled"
				checked={task.enabled}
				locked={task.required}
			/>
		</form>
		<button
			type="button"
			class="rounded-lg p-1 text-zinc-500 hover:text-zinc-200"
			aria-label={text.name}
			aria-expanded={open}
			tabindex="-1"
			onclick={ontoggle}
		>
			<ChevronDown size={18} class="transition-transform {open ? 'rotate-180' : ''}" />
		</button>
	</div>

	{#if open}
		<div class="mt-3 rounded-lg border border-zinc-800 p-3">
			<p class={hint}>{text.description}</p>

			<!-- Own little form for the reset arrow (a second submit button inside the main form would
	     be the one the Enter key presses). -->
			<form
				id="reset-{task.key}"
				method="POST"
				action="?/resetSchedule"
				hidden
				use:enhance={(input) => {
					const done = forms.submit(task.key)(input);
					return async (answer) => {
						if (typeof done === 'function') await done(answer);
						// The main form now shows the saved state again
						if (answer.result.type === 'success') mainForm?.dispatchEvent(new Event('saved'));
					};
				}}
			>
				<input type="hidden" name="key" value={task.key} />
			</form>

			<form
				bind:this={mainForm}
				method="POST"
				action="?/save"
				use:enhance={forms.submit(task.key)}
				class="mt-3 flex flex-col gap-4"
			>
				<input type="hidden" name="key" value={task.key} />

				<!-- Last and next run -->
				<div class="flex flex-col gap-1 text-sm">
					{#if task.running}
						<p class="text-zinc-300">{m.maintenance.running}</p>
					{:else if task.lastRunAt}
						<p
							class="flex items-center gap-1.5 {task.lastError ? 'text-red-400' : 'text-zinc-300'}"
						>
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
						{task.nextRunAt
							? m.maintenance.nextRun(formatDateTime(task.nextRunAt))
							: m.maintenance.off}
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
					<div class={label}>
						<div class="flex items-center gap-2">
							<label for="frequency-{task.key}" class={labelText}>{m.maintenance.frequency}</label>
							{#if task.customSchedule}
								<!-- Small on purpose: the cards are full enough -->
								<button
									form="reset-{task.key}"
									class="ui-btn rounded p-0.5 text-zinc-500 transition-colors hover:text-zinc-100"
									aria-label={m.maintenance.resetSchedule}
									title={m.maintenance.resetSchedule}
								>
									<RotateCcw size={14} />
								</button>
							{/if}
						</div>
						<select id="frequency-{task.key}" name="frequency" bind:value={frequency}>
							{#each frequencies as value (value)}
								<option {value}>{m.maintenance.frequencies[value]}</option>
							{/each}
						</select>
					</div>
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
						when="changed"
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
		</div>
	{/if}
</li>
