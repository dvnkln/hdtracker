<script lang="ts">
	import { onMount } from 'svelte';
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { autosave } from '$lib/autosave';
	import { formatDateTime, m } from '$lib/i18n/index.svelte';
	import { FormFeedback, type Feedback } from '$lib/forms.svelte';
	import { ui } from '$lib/ui';
	import DeviceFilter from '$lib/components/DeviceFilter.svelte';
	import FeedbackText from '$lib/components/FeedbackText.svelte';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import SubmitButton, {
		BUTTON_DANGER,
		BUTTON_SECONDARY
	} from '$lib/components/SubmitButton.svelte';
	import {
		BellOff,
		BellRing,
		ChevronDown,
		Megaphone,
		MonitorSmartphone,
		Plus,
		Send,
		Trash2,
		Webhook
	} from '@lucide/svelte';

	// Where notifications go – one list for everything: this and other devices (push messages
	// of the app itself), Pushover, ntfy, ... Every target has a name and a switch; a tap opens what
	// can be set for it, with a test and "remove". Form actions live on the settings page.
	type Target = {
		key: string;
		kind: 'device' | 'pushover' | 'ntfy' | 'webhook';
		name: string;
		enabled: boolean;
		lastOkAt: string | null;
		lastError: string | null;
		endpoint: string | null;
		fields: {
			devices: string;
			known: string[];
			picture: boolean;
			url: string;
			body: string;
			hasHeader: boolean;
			server: string;
			topic: string;
			icon: string;
			hasToken: boolean;
		};
	};
	// paused: notifications are switched off altogether – the switches of the targets then
	// decide nothing, and a line above the list says so (the list itself stays as it is: it
	// can still be worked with, so greying it out would be a contradiction)
	type Props = { targets: Target[]; publicKey: string; paused: boolean };
	let { targets, publicKey, paused }: Props = $props();

	const forms = new FormFeedback();
	const { label, labelText, hint, actions } = ui;
	const ICONS = {
		device: MonitorSmartphone,
		pushover: BellRing,
		ntfy: Megaphone,
		webhook: Webhook
	};

	// The one target whose settings are shown (others stay closed), and what is being added
	let open = $state<string | null>(null);
	let adding = $state<null | 'choose' | 'pushover' | 'ntfy' | 'webhook'>(null);
	const NTFY_WIKI = 'https://github.com/dvnkln/hdtracker/wiki/Notifications#ntfy';
	const WEBHOOK_WIKI = 'https://github.com/dvnkln/hdtracker/wiki/Notifications#webhook';
	const PLACEHOLDERS = '{{title}}, {{message}}, {{url}}, {{image}}, {{count}}, {{test}}';
	const DEFAULT_BODY =
		'{\n  "title": "{{title}}",\n  "message": "{{message}}",\n  "url": "{{url}}"\n}';

	// ---- This device ----
	// What this browser can do, found out after loading (the server cannot know it).
	type Support = 'checking' | 'unsupported' | 'insecure' | 'blocked' | 'ready';
	let support = $state<Support>('checking');
	// Address of this browser at its push service, if it is subscribed
	let endpoint = $state<string | null>(null);
	let busy = $state(false);
	let deviceFeedback = $state<Feedback | undefined>();
	// Listed already (it may have been removed elsewhere while the browser still subscribes)
	let listed = $derived(targets.some((target) => target.endpoint && target.endpoint === endpoint));

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
		endpoint = (await registration?.pushManager.getSubscription())?.endpoint ?? null;
		support = 'ready';
	}
	onMount(() => {
		check().catch(() => (support = 'unsupported'));
	});
	// Why "this device" cannot be added here (one sentence), if so
	let deviceNote = $derived(
		{
			checking: '',
			ready: '',
			unsupported: m.notifications.unsupportedHint,
			insecure: m.notifications.needsHttpsHint,
			blocked: m.notifications.blockedHint
		}[support]
	);

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
			error?: string;
		} | null;
		await invalidateAll();
		return { ok: result.type === 'success', text: answer?.error ?? '' };
	}

	async function addThisDevice() {
		busy = true;
		deviceFeedback = undefined;
		try {
			if ((await Notification.requestPermission()) !== 'granted') return void (await check());
			const registration = await navigator.serviceWorker.getRegistration();
			if (!registration) {
				deviceFeedback = { ok: false, text: m.notifications.notReady };
				return;
			}
			// A subscription left over from before (e.g. made for another installation's key) would
			// make subscribing fail: start clean.
			await (await registration.pushManager.getSubscription())?.unsubscribe();
			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: publicKey
			});
			const answer = await post('subscribe', { subscription: JSON.stringify(subscription) });
			// The server did not take it: do not stay subscribed for nothing
			if (!answer.ok) {
				await subscription.unsubscribe();
				deviceFeedback = { ok: false, text: answer.text || m.notifications.failed };
			} else {
				adding = null;
			}
			await check();
		} catch (err) {
			console.error(err);
			deviceFeedback = { ok: false, text: m.notifications.failed };
		} finally {
			busy = false;
		}
	}

	// Ends the subscription in this browser when its own entry is removed from the list.
	async function forget(removedEndpoint: string | null) {
		if (!removedEndpoint || removedEndpoint !== endpoint) return;
		const registration = await navigator.serviceWorker.getRegistration();
		await (await registration?.pushManager.getSubscription())?.unsubscribe();
		await check();
	}

	// What was said about a target that is no longer in the list (it was removed, or a test
	// found that the push service does not know the device any more): shown below the list,
	// as its own row is gone.
	let aboutGone = $derived(
		Object.entries(forms.messages)
			.filter(([key, said]) => said && key !== 'new' && !targets.some((t) => t.key === key))
			.map(([, said]) => said)
			.at(-1)
	);

	// Like forms.submit(id), plus something to do when the server said yes.
	function submit(id: string, done: (data: Record<string, unknown>) => unknown): SubmitFunction {
		return async (input) => {
			const after = await forms.submit(id)(input);
			return async (output) => {
				if (after) await after(output);
				// The list shows the newest state either way (e.g. a device that turned out to be gone)
				await invalidateAll();
				if (output.result.type === 'success') await done(output.result.data ?? {});
			};
		};
	}
</script>

<!-- The fields of a Pushover target (new or existing) -->
{#snippet pushoverFields(target: Target | null)}
	<label class={label}>
		<span class={labelText}>{m.notifications.name}</span>
		<input
			name="name"
			value={target?.name ?? m.notifications.kinds.pushover}
			maxlength="40"
			required
		/>
	</label>
	<label class={label}>
		<span class={labelText}>{m.notifications.token}</span>
		<PasswordInput
			name="token"
			autocomplete="off"
			required={!target}
			placeholder={target ? m.notifications.kept : ''}
		/>
		<span class={hint}>{target ? m.notifications.keptHint : m.notifications.tokenHint}</span>
	</label>
	<label class={label}>
		<span class={labelText}>{m.notifications.user}</span>
		<PasswordInput
			name="user"
			autocomplete="off"
			required={!target}
			placeholder={target ? m.notifications.kept : ''}
		/>
		<span class={hint}>{target ? m.notifications.keptHint : m.notifications.userHint}</span>
	</label>
	<DeviceFilter value={target?.fields.devices ?? ''} known={target?.fields.known ?? []} />
	<div class="flex items-start justify-between gap-4">
		<label for="picture-{target?.key ?? 'new'}" class="flex cursor-pointer flex-col gap-1">
			<span class={labelText}>{m.notifications.picture}</span>
			<span class={hint}>{m.notifications.pictureHint}</span>
		</label>
		<Switch
			id="picture-{target?.key ?? 'new'}"
			name="picture"
			checked={target?.fields.picture ?? true}
		/>
	</div>
{/snippet}

{#if paused && targets.length}
	<p class="mt-3 flex items-start gap-2 text-sm text-amber-400">
		<BellOff size={18} class="mt-px shrink-0" />{m.notifications.paused}
	</p>
{/if}
<!-- The fields of an ntfy target (new or existing) -->
{#snippet ntfyFields(target: Target | null)}
	<label class={label}>
		<span class={labelText}>{m.notifications.name}</span>
		<input name="name" value={target?.name ?? m.notifications.kinds.ntfy} maxlength="40" required />
	</label>
	<label class={label}>
		<span class={labelText}>{m.notifications.server}</span>
		<input
			name="server"
			type="url"
			value={target?.fields.server ?? 'https://ntfy.sh'}
			autocapitalize="off"
			autocomplete="off"
			spellcheck="false"
			required
		/>
	</label>
	<label class={label}>
		<span class={labelText}>{m.notifications.topic}</span>
		<input
			name="topic"
			value={target?.fields.topic ?? ''}
			maxlength="64"
			pattern="[A-Za-z0-9_\-]+"
			autocapitalize="off"
			autocomplete="off"
			spellcheck="false"
			required
		/>
		<span class={hint}>
			{m.notifications.topicHint} ·
			<a class="underline" href={NTFY_WIKI} target="_blank" rel="noreferrer"
				>{m.notifications.ntfyGuide}</a
			>
		</span>
	</label>
	<label class={label}>
		<span class={labelText}>{m.notifications.ntfyToken}</span>
		<PasswordInput
			name="token"
			autocomplete="off"
			placeholder={target?.fields.hasToken ? m.notifications.kept : ''}
		/>
		<span class={hint}>
			{target?.fields.hasToken ? m.notifications.keptHint : m.notifications.ntfyTokenHint}
		</span>
	</label>
	{#if target?.fields.hasToken}
		<label class="-mt-2 flex cursor-pointer items-center gap-2 text-sm">
			<input type="checkbox" name="clearToken" value="1" class="size-4 accent-zinc-100" />
			{m.notifications.clearToken}
		</label>
	{/if}
	<label class={label}>
		<span class={labelText}>{m.notifications.icon}</span>
		<input
			name="icon"
			type="url"
			value={target?.fields.icon ?? ''}
			placeholder="https://"
			autocapitalize="off"
			autocomplete="off"
			spellcheck="false"
		/>
		<span class={hint}>{m.notifications.iconHint}</span>
	</label>
	<div class="flex items-start justify-between gap-4">
		<label for="picture-{target?.key ?? 'new'}" class="flex cursor-pointer flex-col gap-1">
			<span class={labelText}>{m.notifications.picture}</span>
			<span class={hint}>{m.notifications.ntfyPictureHint}</span>
		</label>
		<Switch
			id="picture-{target?.key ?? 'new'}"
			name="picture"
			checked={target?.fields.picture ?? true}
		/>
	</div>
{/snippet}

<!-- The fields of a webhook target (new or existing) -->
{#snippet webhookFields(target: Target | null)}
	<label class={label}>
		<span class={labelText}>{m.notifications.name}</span>
		<input
			name="name"
			value={target?.name ?? m.notifications.kinds.webhook}
			maxlength="40"
			required
		/>
	</label>
	<label class={label}>
		<span class={labelText}>{m.notifications.url}</span>
		<input
			name="url"
			type="url"
			value={target?.fields.url ?? ''}
			placeholder="https://"
			autocapitalize="off"
			autocomplete="off"
			spellcheck="false"
			required
		/>
		<span class={hint}>{m.notifications.urlHint}</span>
	</label>
	<label class={label}>
		<span class={labelText}>{m.notifications.body}</span>
		<textarea
			name="body"
			rows="6"
			class="font-mono text-sm"
			autocapitalize="off"
			autocomplete="off"
			spellcheck="false"
			required>{target?.fields.body ?? DEFAULT_BODY}</textarea
		>
		<span class={hint}>
			{m.notifications.bodyHint(PLACEHOLDERS)} ·
			<a class="underline" href={WEBHOOK_WIKI} target="_blank" rel="noreferrer"
				>{m.notifications.templates}</a
			>
		</span>
	</label>
	<label class={label}>
		<span class={labelText}>{m.notifications.header}</span>
		<PasswordInput
			name="header"
			autocomplete="off"
			placeholder={target?.fields.hasHeader ? m.notifications.kept : ''}
		/>
		<span class={hint}>
			{target?.fields.hasHeader ? m.notifications.keptHint : m.notifications.headerHint}
		</span>
	</label>
	{#if target?.fields.hasHeader}
		<label class="-mt-2 flex cursor-pointer items-center gap-2 text-sm">
			<input type="checkbox" name="clearHeader" value="1" class="size-4 accent-zinc-100" />
			{m.notifications.clearHeader}
		</label>
	{/if}
{/snippet}

<ul class="mt-3 flex flex-col divide-y divide-zinc-800">
	{#each targets as target (target.key)}
		{@const Icon = ICONS[target.kind]}
		{@const isOpen = open === target.key}
		<li class="py-2.5">
			<div class="flex items-center gap-3">
				<!-- The row: opens and closes what can be set for this target -->
				<button
					type="button"
					class="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-opacity {target.enabled
						? ''
						: 'opacity-50'}"
					aria-expanded={isOpen}
					onclick={() => (open = isOpen ? null : target.key)}
				>
					<Icon size={20} class="shrink-0 text-zinc-400" />
					<span class="min-w-0 flex-1">
						<span class="flex items-center gap-1.5 text-sm font-medium">
							<span class="truncate">{target.name}</span>
							{#if target.endpoint && target.endpoint === endpoint}
								<span class="shrink-0 font-normal text-emerald-400">· {m.notifications.here}</span>
							{/if}
						</span>
						<span
							class="block truncate text-xs {target.lastError ? 'text-red-400' : 'text-zinc-500'}"
						>
							{#if target.lastError}
								{m.notifications.lastError(target.lastError)}
							{:else if target.lastOkAt}
								{m.notifications.lastReached(formatDateTime(target.lastOkAt))}
							{:else}
								{m.notifications.neverReached}
							{/if}
						</span>
					</span>
					<ChevronDown
						size={18}
						class="shrink-0 text-zinc-500 transition-transform {isOpen ? 'rotate-180' : ''}"
					/>
				</button>
				<!-- The switch: saved at once; off keeps everything about the target -->
				<form
					method="POST"
					action="?/targetToggle"
					use:enhance={forms.submit(target.key)}
					use:autosave
				>
					<input type="hidden" name="key" value={target.key} />
					<label for="on-{target.key}" class="sr-only">
						{m.notifications.switchLabel(target.name)}
					</label>
					<Switch id="on-{target.key}" name="enabled" checked={target.enabled} />
				</form>
			</div>

			{#if isOpen}
				<div class="mt-3 flex flex-col gap-4 rounded-lg border border-zinc-800 p-3">
					{#if target.kind === 'device'}
						<form
							method="POST"
							action="?/deviceRename"
							use:enhance={forms.submit(target.key)}
							class="flex flex-col gap-4"
						>
							<input type="hidden" name="key" value={target.key} />
							<label class={label}>
								<span class={labelText}>{m.notifications.name}</span>
								<input name="name" value={target.name} maxlength="40" required />
							</label>
							<div class={actions}>
								<SubmitButton
									text={m.notifications.save}
									busy={forms.busy === target.key && forms.busyAction === null}
									when="changed"
								/>
							</div>
						</form>
					{:else}
						<form
							method="POST"
							action="?/channelSave"
							use:enhance={forms.submit(target.key)}
							class="flex flex-col gap-4"
						>
							<input type="hidden" name="key" value={target.key} />
							<input type="hidden" name="kind" value={target.kind} />
							{#if target.kind === 'webhook'}
								{@render webhookFields(target)}
							{:else if target.kind === 'ntfy'}
								{@render ntfyFields(target)}
							{:else}
								{@render pushoverFields(target)}
							{/if}
							<div class={actions}>
								<SubmitButton
									text={m.notifications.save}
									busy={forms.busy === target.key}
									when="changed"
								/>
							</div>
						</form>
					{/if}

					<!-- Try it out, or take it off the list -->
					<div class="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3">
						<form method="POST" action="?/targetTest" use:enhance={submit(target.key, () => {})}>
							<input type="hidden" name="key" value={target.key} />
							<button class={BUTTON_SECONDARY}><Send size={16} />{m.notifications.test}</button>
						</form>
						<form
							method="POST"
							action="?/targetRemove"
							use:enhance={submit(target.key, () => {
								open = null;
								return forget(target.endpoint);
							})}
						>
							<input type="hidden" name="key" value={target.key} />
							<button class={BUTTON_DANGER}><Trash2 size={16} />{m.notifications.remove}</button>
						</form>
					</div>
					<FeedbackText feedback={forms.messages[target.key]} />
				</div>
			{:else}
				<!-- Closed: only something that went wrong is mentioned (e.g. the switch) -->
				<FeedbackText feedback={forms.error(target.key)} />
			{/if}
		</li>
	{:else}
		<li class="py-2 text-sm text-zinc-500">{m.notifications.noTargets}</li>
	{/each}
</ul>

<FeedbackText feedback={aboutGone} />

<!-- Adding: first which kind, then – for kinds that have settings – its fields -->
<div class="mt-3">
	{#if adding === null}
		<button type="button" class={BUTTON_SECONDARY} onclick={() => (adding = 'choose')}>
			<Plus size={16} />{m.notifications.addTarget}
		</button>
	{:else if adding === 'choose'}
		<div class="flex flex-col gap-2 rounded-lg border border-zinc-800 p-3">
			{#if !listed}
				<button
					type="button"
					class="ui-btn flex items-start gap-3 rounded-lg border border-zinc-800 p-3 text-left transition-colors enabled:hover:border-zinc-600 disabled:opacity-50"
					disabled={busy || support !== 'ready'}
					onclick={addThisDevice}
				>
					<MonitorSmartphone size={20} class="mt-0.5 shrink-0 text-zinc-400" />
					<span>
						<span class="block text-sm font-medium">{m.notifications.kinds.device}</span>
						<span class={hint}>{deviceNote || m.notifications.kindHints.device}</span>
					</span>
				</button>
			{/if}
			<button
				type="button"
				class="ui-btn flex items-start gap-3 rounded-lg border border-zinc-800 p-3 text-left transition-colors hover:border-zinc-600"
				onclick={() => (adding = 'pushover')}
			>
				<BellRing size={20} class="mt-0.5 shrink-0 text-zinc-400" />
				<span>
					<span class="block text-sm font-medium">{m.notifications.kinds.pushover}</span>
					<span class={hint}>{m.notifications.kindHints.pushover}</span>
				</span>
			</button>
			<button
				type="button"
				class="ui-btn flex items-start gap-3 rounded-lg border border-zinc-800 p-3 text-left transition-colors hover:border-zinc-600"
				onclick={() => (adding = 'ntfy')}
			>
				<Megaphone size={20} class="mt-0.5 shrink-0 text-zinc-400" />
				<span>
					<span class="block text-sm font-medium">{m.notifications.kinds.ntfy}</span>
					<span class={hint}>{m.notifications.kindHints.ntfy}</span>
				</span>
			</button>
			<button
				type="button"
				class="ui-btn flex items-start gap-3 rounded-lg border border-zinc-800 p-3 text-left transition-colors hover:border-zinc-600"
				onclick={() => (adding = 'webhook')}
			>
				<Webhook size={20} class="mt-0.5 shrink-0 text-zinc-400" />
				<span>
					<span class="block text-sm font-medium">{m.notifications.kinds.webhook}</span>
					<span class={hint}>{m.notifications.kindHints.webhook}</span>
				</span>
			</button>
			<FeedbackText feedback={deviceFeedback} />
			<div>
				<button type="button" class={BUTTON_SECONDARY} onclick={() => (adding = null)}>
					{m.common.cancel}
				</button>
			</div>
		</div>
	{:else}
		<form
			method="POST"
			action="?/channelSave"
			use:enhance={submit('new', (data) => {
				adding = null;
				open = typeof data.key === 'string' ? data.key : null;
			})}
			class="flex flex-col gap-4 rounded-lg border border-zinc-800 p-3"
		>
			<input type="hidden" name="kind" value={adding} />
			{#if adding === 'webhook'}
				{@render webhookFields(null)}
			{:else if adding === 'ntfy'}
				{@render ntfyFields(null)}
			{:else}
				{@render pushoverFields(null)}
			{/if}
			<div class={actions}>
				<SubmitButton text={m.notifications.save} busy={forms.busy === 'new'} when="filled" />
				<button type="button" class={BUTTON_SECONDARY} onclick={() => (adding = null)}>
					{m.common.cancel}
				</button>
			</div>
			<FeedbackText feedback={forms.messages.new} />
		</form>
	{/if}
</div>
