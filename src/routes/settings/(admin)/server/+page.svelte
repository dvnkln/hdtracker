<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDateTime, formatFileSize, m } from '$lib/i18n/index.svelte';
	import { FormFeedback } from '$lib/forms.svelte';
	import { proxySnippets } from '$lib/proxySnippets';
	import { ui } from '$lib/ui';
	import FeedbackText from '$lib/components/FeedbackText.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import SubmitButton, { BUTTON_SECONDARY } from '$lib/components/SubmitButton.svelte';
	import {
		Activity,
		Check,
		CircleCheck,
		Copy,
		Eye,
		EyeOff,
		Globe,
		Info,
		Network,
		TriangleAlert
	} from '@lucide/svelte';

	let { data, form } = $props();

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

	// ---- Overview ----
	const WIKI = 'https://github.com/dvnkln/hdtracker/wiki';
	// Where a check that is not fine can be dealt with
	const CHECK_LINKS: Record<string, string> = {
		https: `${WIKI}/HTTPS-and-installing-as-an-app`,
		proxy: '#connection',
		sources: `${WIKI}/Installation`,
		tasks: '/settings/maintenance',
		library: '',
		missing: ''
	};
	let todo = $derived(data.overview.checks.filter((check) => check.level === 'action').length);
	let facts = $derived([
		{
			label: m.settings.infoVersion,
			value: data.overview.version,
			href: `https://github.com/dvnkln/hdtracker/releases/tag/v${data.overview.version}`
		},
		{
			label: m.settings.infoRunning,
			value: formatDateTime(data.overview.info.startedAt),
			href: ''
		},
		{ label: m.settings.infoTitles, value: String(data.overview.info.titles), href: '' },
		{ label: m.settings.infoStorage, value: formatFileSize(data.overview.info.bytes), href: '' }
	]);

	// ---- Connection: how this request reached hdtracker ----
	let c = $derived(data.connection);
	// A proxy passed an address along
	let viaProxy = $derived(c.forwarded !== null);
	let confirmed = $derived(viaProxy && c.via !== null);
	let pending = $derived(viaProxy && c.via === null);
	// Direct visitors that Docker forwards itself all arrive from one address and share one block.
	let shared = $derived(!viaProxy && c.hidden);
	// "Recognised as" is the address wrong passwords are counted for. What an unconfirmed proxy
	// reports is shown as well, but clearly as not used yet.
	let rows = $derived(
		[
			{ label: m.settings.recognisedAs, value: c.address, note: '' },
			pending && {
				label: m.settings.proxyReports,
				value: c.forwarded!,
				note: m.settings.notUsedYet
			},
			confirmed && {
				label: m.settings.confirmedBy,
				value: c.via === 'key' ? m.settings.byKey : m.settings.byAddress,
				note: ''
			}
		].filter((row) => !!row)
	);

	// Ready-made lines for the proxy's configuration, with the key filled in. Each of them was
	// tried against the real proxy (see the wiki, "HTTPS and installing as an app").
	let SNIPPETS = $derived(proxySnippets(data.proxyKeyHeader, data.proxyKey));
	let proxy = $state('Nginx Proxy Manager');
	let current = $derived(SNIPPETS.find((s) => s.name === proxy) ?? SNIPPETS[0]);
	let keyOpen = $state(false);
	let listOpen = $state(false);
	let copied = $state(false);
	// The key is hidden until asked for; copying always takes the real line.
	let keyShown = $state(false);
	async function copy() {
		try {
			await navigator.clipboard.writeText(current.code);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// No clipboard without https: show the key, so the line can be marked and copied by hand.
			keyShown = true;
		}
	}

	let regions = $derived(named(data.regions, 'region'));
	let languages = $derived(named(data.languages, 'language'));
</script>

<svelte:head><title>{m.settings.server} · hdtracker</title></svelte:head>

<h2 class={pageTitle}>{m.settings.server}</h2>

<!-- Overview: is everything fine? -->
<section class={card}>
	<h3 class={heading}><Activity size={20} class="text-zinc-400" />{m.settings.overview}</h3>
	<p
		class="mt-3 flex items-center gap-2 font-medium {todo ? 'text-amber-400' : 'text-emerald-400'}"
	>
		{#if todo}<TriangleAlert size={18} />{:else}<CircleCheck size={18} />{/if}
		{todo ? m.settings.needsAttention(todo) : m.settings.allFine}
	</p>
	<ul class="mt-3 flex flex-col gap-1.5 text-sm">
		{#each data.overview.checks as check (check.key)}
			{@const link = CHECK_LINKS[check.key]}
			<li class="flex items-start gap-2">
				{#if check.level === 'ok'}
					<Check size={16} class="mt-0.5 shrink-0 text-emerald-400" />
				{:else if check.level === 'hint'}
					<Info size={16} class="mt-0.5 shrink-0 text-zinc-400" />
				{:else}
					<TriangleAlert size={16} class="mt-0.5 shrink-0 text-amber-400" />
				{/if}
				<!-- Text, then (only if not fine) the titles concerned or a link to deal with it -->
				<p class="min-w-0 {check.level === 'ok' ? 'text-zinc-400' : 'text-zinc-100'}">
					{m.settings.checks[check.key][check.level](check.count ?? 0, check.names ?? [])}
					{#if check.level !== 'ok'}
						{#each check.items ?? [] as item, i (item.href)}{i ? ', ' : ''}<a
								class="text-zinc-400 underline"
								href={item.href}>{item.title}</a
							>{/each}
						{#if link}
							<a
								class="ml-1 text-zinc-400 underline"
								href={link}
								target={link.startsWith('http') ? '_blank' : undefined}
								rel="noreferrer"
								>{check.level === 'action' ? m.settings.fix : m.settings.learnMore}</a
							>
						{/if}
					{/if}
				</p>
			</li>
		{/each}
	</ul>
	<dl
		class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-zinc-800 pt-4 text-sm sm:grid-cols-4"
	>
		{#each facts as fact (fact.label)}
			<div>
				<dt class="text-xs text-zinc-500">{fact.label}</dt>
				<dd class="text-zinc-100">
					{#if fact.href}
						<a class="underline" href={fact.href} target="_blank" rel="noreferrer">{fact.value}</a>
					{:else}{fact.value}{/if}
				</dd>
			</div>
		{/each}
	</dl>
</section>

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
			<SubmitButton text={m.settings.save} busy={forms.busy === 'content'} when="changed" />
			<FeedbackText feedback={forms.messages.content} />
		</div>
	</form>
</section>

<!-- Numbered step of the key set-up -->
{#snippet step(n: number, title: string, done = false)}
	<p class="flex items-center gap-2.5 text-sm font-medium">
		<span
			class="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold {done
				? 'bg-emerald-400 text-zinc-950'
				: 'bg-zinc-800 text-zinc-100'}"
		>
			{#if done}<Check size={14} strokeWidth={3} />{:else}{n}{/if}
		</span>
		{title}
	</p>
{/snippet}

<!-- The proxy proves itself with a key: create it, add one line to the proxy, reload -->
{#snippet keySteps()}
	<div class="flex flex-col gap-4">
		<div>
			{@render step(1, m.settings.keyStep1, !!data.proxyKey)}
			<form
				method="POST"
				action="?/proxyKey"
				use:enhance={(input) => {
					keyOpen = true;
					return forms.submit('proxyKey')(input);
				}}
				class="mt-2 ml-8.5 {actions}"
			>
				{#if data.proxyKey}
					<button class="text-sm text-zinc-400 underline transition-colors hover:text-zinc-100"
						>{m.settings.newKey}</button
					>
					<button
						name="remove"
						value="1"
						class="text-sm text-zinc-400 underline transition-colors hover:text-red-400"
						>{m.settings.removeKey}</button
					>
				{:else}
					<SubmitButton text={m.settings.createKey} busy={forms.busy === 'proxyKey'} />
				{/if}
			</form>
		</div>

		{#if data.proxyKey}
			<div>
				{@render step(2, m.settings.keyStep2)}
				<div class="mt-2 ml-8.5">
					<div class="flex flex-wrap gap-1">
						{#each SNIPPETS as snippet (snippet.name)}
							<button
								type="button"
								class="ui-btn rounded-lg px-3 py-1.5 text-sm transition-colors {proxy ===
								snippet.name
									? 'ui-keep bg-zinc-100 font-medium text-zinc-900'
									: 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}"
								aria-pressed={proxy === snippet.name}
								onclick={() => (proxy = snippet.name)}>{snippet.name}</button
							>
						{/each}
					</div>
					<div class="ui-card mt-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
						<pre
							class="font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-zinc-100">{keyShown
								? current.code
								: current.masked}</pre>
						<p class="{hint} mt-2">{m.settings.snippetWhere[current.where]}</p>
						<div class="mt-3 flex items-center gap-2">
							<button
								type="button"
								class="ui-btn flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm transition-colors hover:border-zinc-500 hover:text-zinc-100"
								onclick={copy}
							>
								{#if copied}<Check size={16} class="text-emerald-400" />{m.settings
										.copied}{:else}<Copy size={16} />{m.settings.copy}{/if}
							</button>
							<button
								type="button"
								class="ui-btn rounded-lg border border-zinc-700 p-2 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-100"
								aria-pressed={keyShown}
								aria-label={keyShown ? m.settings.hideKey : m.settings.showKey}
								title={keyShown ? m.settings.hideKey : m.settings.showKey}
								onclick={() => (keyShown = !keyShown)}
							>
								{#if keyShown}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
							</button>
						</div>
					</div>
				</div>
			</div>
			<div>
				{@render step(3, m.settings.keyStep3, confirmed)}
			</div>
		{/if}
	</div>
{/snippet}

<section class={card} id="connection">
	<h3 class={heading}><Network size={20} class="text-zinc-400" />{m.settings.connection}</h3>

	<!-- Status at a glance -->
	<p
		class="mt-3 flex items-center gap-2 font-medium {pending
			? 'text-amber-400'
			: shared
				? 'text-zinc-100'
				: 'text-emerald-400'}"
	>
		{#if pending}<TriangleAlert size={18} />{:else if shared}<Info size={18} />{:else}<CircleCheck
				size={18}
			/>{/if}
		{confirmed ? m.settings.proxyConfirmed : pending ? m.settings.proxyPending : m.settings.direct}
	</p>
	<p class="mt-1.5 text-sm text-zinc-400">
		{pending ? m.settings.pendingWhy : shared ? m.settings.sharedWhy : m.settings.ownBlock}
	</p>

	<dl class="mt-4 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
		{#each rows as row (row.label)}
			<dt class="text-zinc-500">{row.label}</dt>
			<dd class="text-zinc-100">
				{row.value}
				{#if row.note}<span class="ml-1 text-zinc-500">{row.note}</span>{/if}
			</dd>
		{/each}
	</dl>
	{#if !viaProxy}<p class="{hint} mt-3">{m.settings.directHint}</p>{/if}

	{#if pending && !c.hidden}
		<!-- The proxy has an address of its own: one click enters it -->
		<form method="POST" action="?/proxies" use:enhance={forms.submit('confirm')} class="mt-4">
			<input
				type="hidden"
				name="proxies"
				value={[data.trustedProxies, c.peer].filter(Boolean).join(', ')}
			/>
			<SubmitButton text={m.settings.confirmProxy} busy={forms.busy === 'confirm'} />
		</form>
	{:else if pending}
		<!-- Docker hides the proxy's address: it proves itself with a key -->
		<div class="mt-5 border-t border-zinc-800 pt-4">{@render keySteps()}</div>
	{:else if confirmed && c.via === 'key'}
		<details class="mt-5 border-t border-zinc-800 pt-4" open={keyOpen}>
			<summary class="cursor-pointer text-sm font-medium transition-colors hover:text-zinc-100">
				{m.settings.manageKey}
			</summary>
			<div class="mt-4">{@render keySteps()}</div>
		</details>
	{/if}

	<!-- By address: only where addresses are visible at all (or something was entered) -->
	{#if (viaProxy && !c.hidden) || data.trustedProxies}
		<details class="mt-4 border-t border-zinc-800 pt-4" open={listOpen}>
			<summary class="cursor-pointer text-sm font-medium transition-colors hover:text-zinc-100">
				{m.settings.trustedProxies}
			</summary>
			<form
				method="POST"
				action="?/proxies"
				use:enhance={(input) => {
					listOpen = true;
					return forms.submit('proxies')(input);
				}}
				class="mt-3 flex flex-col gap-4"
			>
				<label class={label}>
					<span class={hint}>{m.settings.trustedProxiesHint}</span>
					<input
						name="proxies"
						aria-label={m.settings.trustedProxies}
						value={form?.section === 'proxies' && 'proxies' in form
							? form.proxies
							: data.trustedProxies}
						placeholder="192.168.1.10, 172.18.0.0/16"
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
					/>
				</label>
				<div class={actions}>
					<SubmitButton text={m.settings.save} busy={forms.busy === 'proxies'} when="changed" />
					<FeedbackText feedback={forms.messages.proxies} />
				</div>
			</form>
		</details>
	{/if}

	<p class="{hint} mt-4">
		<a
			class="underline"
			href="https://github.com/dvnkln/hdtracker/wiki/HTTPS-and-installing-as-an-app"
			target="_blank"
			rel="noreferrer">{m.settings.learnMore}</a
		>
	</p>
</section>
