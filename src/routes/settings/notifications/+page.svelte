<script lang="ts">
	import { onMount } from 'svelte';
	import { deserialize, enhance } from '$app/forms';
	import { autosave } from '$lib/autosave';
	import { invalidateAll } from '$app/navigation';
	import { formatDate, formatDateTime, m } from '$lib/i18n/index.svelte';
	import { FormFeedback, type Feedback } from '$lib/forms.svelte';
	import { ui } from '$lib/ui';
	import FeedbackText from '$lib/components/FeedbackText.svelte';
	import SubmitButton, {
		BUTTON_PRIMARY,
		BUTTON_SECONDARY
	} from '$lib/components/SubmitButton.svelte';
	import {
		Bell,
		BellOff,
		BellRing,
		CalendarClock,
		Check,
		MonitorSmartphone,
		Pencil,
		Send,
		Trash2,
		TriangleAlert
	} from '@lucide/svelte';

	let { data } = $props();

	const forms = new FormFeedback();
	const { card, heading, label, labelText, hint, actions, pageTitle } = ui;
	const MODES = ['off', 'single', 'digest'] as const;
	const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
	// What is chosen right now (decides whether the hour is shown)
	// svelte-ignore state_referenced_locally
	let mode = $state(data.prefs.mode);
	const WIKI = 'https://github.com/dvnkln/hdtracker/wiki/Privacy-and-security';

	// ---- This device ----
	// What this browser can do, found out after loading (the server cannot know it).
	type State = 'checking' | 'unsupported' | 'insecure' | 'blocked' | 'off' | 'on';
	let support = $state<State>('checking');
	// Address of this browser at its push service, if it is subscribed
	let endpoint = $state<string | null>(null);
	let busy = $state(false);
	let feedback = $state<Feedback | undefined>();

	// "On" only if the server knows this device too (it may have been removed elsewhere).
	// Device whose name is being changed
	let editing = $state<number | null>(null);
	const ICON_BUTTON =
		'ui-btn inline-flex shrink-0 items-center rounded-lg border border-zinc-700 p-2 transition-colors hover:bg-zinc-800';

	let known = $derived(data.devices.some((device) => device.endpoint === endpoint));

	async function check() {
		if (!window.isSecureContext) return (support = 'insecure');
		if (
			!('serviceWorker' in navigator) ||
			!('PushManager' in window) ||
			!('Notification' in window)
		) {
			return (support = 'unsupported');
		}
		if (Notification.permission === 'denied') return (support = 'blocked');
		const registration = await navigator.serviceWorker.getRegistration();
		const subscription = await registration?.pushManager.getSubscription();
		endpoint = subscription?.endpoint ?? null;
		support = subscription ? 'on' : 'off';
	}
	onMount(() => {
		check().catch(() => (support = 'unsupported'));
	});

	// Sends a form action without a form (the subscription comes from the browser, not from fields).
	async function post(action: string, fields: Record<string, string>) {
		const body = new FormData();
		for (const [key, value] of Object.entries(fields)) body.set(key, value);
		const response = await fetch(`?/${action}`, {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
		const result = deserialize(await response.text());
		const answer = (
			result.type === 'success' || result.type === 'failure' ? result.data : null
		) as {
			message?: string;
			error?: string;
		} | null;
		await invalidateAll();
		return answer?.error
			? { ok: false, text: answer.error }
			: { ok: result.type === 'success', text: answer?.message ?? '' };
	}

	async function enable() {
		busy = true;
		feedback = undefined;
		try {
			if ((await Notification.requestPermission()) !== 'granted') {
				support = Notification.permission === 'denied' ? 'blocked' : 'off';
				return;
			}
			const registration = await navigator.serviceWorker.getRegistration();
			if (!registration) {
				feedback = { ok: false, text: m.notifications.notReady };
				return;
			}
			// A subscription left over from before (e.g. made for another installation's key) would
			// make subscribing fail: start clean.
			await (await registration.pushManager.getSubscription())?.unsubscribe();
			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: data.publicKey
			});
			const answer = await post('subscribe', { subscription: JSON.stringify(subscription) });
			// The server did not take it: do not stay subscribed for nothing
			if (!answer.ok) await subscription.unsubscribe();
			feedback = answer;
			await check();
		} catch (err) {
			console.error(err);
			feedback = { ok: false, text: m.notifications.failed };
		} finally {
			busy = false;
		}
	}

	// Ends the subscription in this browser (used when this device is removed from the list).
	async function forget(removedEndpoint: string) {
		if (removedEndpoint !== endpoint) return;
		const registration = await navigator.serviceWorker.getRegistration();
		await (await registration?.pushManager.getSubscription())?.unsubscribe();
		await check();
	}

	const STATUS = $derived(
		{
			checking: { text: '…', tone: 'text-zinc-400', icon: Bell, note: '' },
			unsupported: {
				text: m.notifications.unsupported,
				tone: 'text-amber-400',
				icon: TriangleAlert,
				note: m.notifications.unsupportedHint
			},
			insecure: {
				text: m.notifications.needsHttps,
				tone: 'text-amber-400',
				icon: TriangleAlert,
				note: m.notifications.needsHttpsHint
			},
			blocked: {
				text: m.notifications.blocked,
				tone: 'text-red-400',
				icon: BellOff,
				note: m.notifications.blockedHint
			},
			off: { text: m.notifications.off, tone: 'text-zinc-400', icon: BellOff, note: '' },
			on: { text: m.notifications.on, tone: 'text-emerald-400', icon: BellRing, note: '' }
		}[support === 'on' && !known ? 'off' : support]
	);
</script>

<svelte:head><title>{m.notifications.title} · hdtracker</title></svelte:head>

<h2 class={pageTitle}>{m.notifications.title}</h2>

<!-- This device: status in colour, one button -->
<section class={card}>
	<h3 class={heading}><Bell size={20} class="text-zinc-400" />{m.notifications.thisDevice}</h3>
	<p class="mt-3 flex items-center gap-2 font-medium {STATUS.tone}">
		<STATUS.icon size={18} />{STATUS.text}
	</p>
	{#if STATUS.note}<p class="mt-1 {hint}">{STATUS.note}</p>{/if}
	{#if support === 'off' || (support === 'on' && !known)}
		<div class="mt-4 {actions}">
			<button type="button" class={BUTTON_PRIMARY} disabled={busy} onclick={enable}>
				{m.notifications.enable}
			</button>
			<FeedbackText {feedback} />
		</div>
	{:else if feedback}
		<div class="mt-3"><FeedbackText {feedback} /></div>
	{/if}
	<p class="mt-4 {hint}">
		<a class="underline" href={WIKI} target="_blank" rel="noreferrer">{m.notifications.learnMore}</a
		>
	</p>
</section>

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

<!-- All devices of the user, with a test message -->
<section class={card}>
	<h3 class={heading}>
		<MonitorSmartphone size={20} class="text-zinc-400" />{m.notifications.devices}
	</h3>
	{#if data.devices.length === 0}
		<p class="mt-3 text-sm text-zinc-500">{m.notifications.noDevices}</p>
	{:else}
		<ul class="mt-3 flex flex-col divide-y divide-zinc-800">
			{#each data.devices as device (device.id)}
				<li class="flex items-center justify-between gap-3 py-2.5">
					{#if editing === device.id}
						<!-- Renaming: the name becomes a field; Enter or the tick saves -->
						<form
							method="POST"
							action="?/rename"
							use:enhance={async (input) => {
								const after = await forms.submit('devices')(input);
								return async (output) => {
									if (after) await after(output);
									if (output.result.type === 'success') editing = null;
								};
							}}
							class="flex min-w-0 flex-1 items-center gap-2"
						>
							<input type="hidden" name="id" value={device.id} />
							<!-- svelte-ignore a11y_autofocus -->
							<input
								name="label"
								value={device.label}
								maxlength="40"
								required
								autofocus
								aria-label={m.notifications.name}
								class="min-w-0 flex-1"
								onkeydown={(e) => e.key === 'Escape' && (editing = null)}
							/>
							<button class={ICON_BUTTON} title={m.settings.save} aria-label={m.settings.save}>
								<Check size={18} />
							</button>
						</form>
					{:else}
						<div class="min-w-0 flex-1">
							<p class="flex items-center gap-1.5 text-sm font-medium">
								<span class="truncate">{device.label}</span>
								<button
									type="button"
									class="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
									title={m.notifications.rename}
									aria-label={m.notifications.rename}
									onclick={() => (editing = device.id)}
								>
									<Pencil size={14} />
								</button>
								{#if device.endpoint === endpoint}
									<span class="shrink-0 font-normal text-emerald-400">· {m.notifications.here}</span
									>
								{/if}
							</p>
							<p class={hint}>
								{m.notifications.added(formatDate(device.createdAt.slice(0, 10)))} ·
								{device.lastOkAt
									? m.notifications.lastReached(formatDateTime(device.lastOkAt))
									: m.notifications.neverReached}
							</p>
						</div>
					{/if}
					<form
						method="POST"
						action="?/unsubscribe"
						use:enhance={async (input) => {
							const after = await forms.submit('devices')(input);
							return async (output) => {
								if (after) await after(output);
								if (output.result.type === 'success') await forget(device.endpoint);
							};
						}}
					>
						<input type="hidden" name="id" value={device.id} />
						<button
							class={ICON_BUTTON}
							title={m.notifications.remove}
							aria-label={m.notifications.remove}
						>
							<Trash2 size={18} />
						</button>
					</form>
				</li>
			{/each}
		</ul>
		<form
			method="POST"
			action="?/test"
			use:enhance={async (input) => {
				const after = await forms.submit('test')(input);
				return async (output) => {
					if (after) await after(output);
					// A device the push service no longer knows was removed: show the list as it is now
					await invalidateAll();
				};
			}}
			class="mt-4 {actions}"
		>
			<SubmitButton text={m.notifications.test} busy={forms.busy === 'test'} icon={Send} />
			<FeedbackText feedback={forms.messages.test ?? forms.messages.devices} />
		</form>
	{/if}
</section>
