<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { CATEGORY_KEYS } from '$lib/categories';
	import { LOCALES, m } from '$lib/i18n/index.svelte';
	import { MIN_PASSWORD_LENGTH } from '$lib/limits';
	import {
		KeyRound,
		LoaderCircle,
		LogOut,
		Monitor,
		SlidersHorizontal,
		TriangleAlert,
		UserRound
	} from '@lucide/svelte';

	let { data } = $props();

	type Section = 'display' | 'behavior' | 'password' | 'logoutOthers' | 'clear';

	// Result message below each form ("Gespeichert ✓" or an error), and which form is busy.
	let feedback = $state<Partial<Record<Section, { ok: boolean; text: string }>>>({});
	let busy = $state<Section | null>(null);

	// Submit in the background and show the server's answer next to the button.
	// Success messages disappear after a few seconds.
	function submit(section: Section, reset = false): SubmitFunction {
		return () => {
			busy = section;
			feedback[section] = undefined;
			return async ({ result, update }) => {
				await update({ reset });
				busy = null;
				if (result.type !== 'success' && result.type !== 'failure') return;
				const answer = result.data as { message?: string; error?: string } | undefined;
				const entry = answer?.error
					? { ok: false, text: answer.error }
					: { ok: true, text: answer?.message ?? '' };
				feedback[section] = entry;
				if (entry.ok) {
					setTimeout(() => {
						if (feedback[section] === entry) feedback[section] = undefined;
					}, 5000);
				}
			};
		};
	}

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

	// Each interface language in its own language: "Deutsch", "English".
	const nativeName = (code: string) =>
		new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;

	// The delete button only works once the confirmation word is typed in.
	let confirmText = $state('');
	let confirmOk = $derived(confirmText.trim().toUpperCase() === m.settings.confirmWord);

	const card = 'mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4';
	const heading = 'flex items-center gap-2 text-lg font-semibold';
	const label = 'flex flex-col gap-1';
	const labelText = 'text-sm font-medium';
	const hint = 'text-xs text-zinc-500';
	const saveButton =
		'inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-zinc-300 active:bg-zinc-400 disabled:opacity-50';
</script>

<svelte:head><title>{m.settings.title} · hdtracker</title></svelte:head>

<!-- Submit button with loading spinner, and the result message next to it -->
{#snippet actions(
	section: Section,
	text: string,
	Icon?: typeof LogOut,
	style = saveButton,
	enabled = true
)}
	<div class="flex flex-wrap items-center gap-3">
		<button class={style} disabled={busy === section || !enabled}>
			{#if busy === section}
				<LoaderCircle size={18} class="animate-spin" />
			{:else if Icon}
				<Icon size={18} />
			{/if}
			{text}
		</button>
		{#if feedback[section]}
			<p role="status" class="text-sm {feedback[section].ok ? 'text-emerald-400' : 'text-red-400'}">
				{feedback[section].text}
			</p>
		{/if}
	</div>
{/snippet}

<main class="mx-auto max-w-screen-sm p-4">
	<h1 class="text-2xl font-bold">{m.settings.title}</h1>

	<!-- Display -->
	<section class={card}>
		<h2 class={heading}><Monitor size={20} class="text-zinc-400" />{m.settings.display}</h2>

		<form
			method="POST"
			action="?/display"
			use:enhance={submit('display')}
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
				<p class="rounded-lg border border-amber-900 bg-amber-950 p-3 text-sm text-amber-300">
					{m.settings.listsUnavailable}
				</p>
			{/if}

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

			{@render actions('display', m.settings.save)}
		</form>
	</section>

	<!-- Behavior -->
	<section class={card}>
		<h2 class={heading}>
			<SlidersHorizontal size={20} class="text-zinc-400" />{m.settings.behavior}
		</h2>

		<form method="POST" action="?/behavior" use:enhance={submit('behavior')} class="mt-4">
			<label class="flex cursor-pointer items-start justify-between gap-4">
				<span class="flex flex-col gap-1">
					<span class={labelText}>{m.settings.autoStatus}</span>
					<span class={hint}>{m.settings.autoStatusHint}</span>
				</span>
				<!-- Switch: a checkbox styled as a sliding toggle -->
				<input
					type="checkbox"
					name="autoStatus"
					checked={data.values.autoStatus}
					class="peer sr-only"
				/>
				<span
					aria-hidden="true"
					class="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-zinc-700 transition-colors peer-checked:bg-emerald-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zinc-300 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5 hover:brightness-125"
				></span>
			</label>
			<div class="mt-4">{@render actions('behavior', m.settings.save)}</div>
		</form>
	</section>

	<!-- Account -->
	<section class={card}>
		<h2 class={heading}><UserRound size={20} class="text-zinc-400" />{m.settings.account}</h2>

		<form
			method="POST"
			action="?/password"
			use:enhance={submit('password', true)}
			class="mt-4 flex flex-col gap-4"
		>
			<h3 class="font-medium text-zinc-300">{m.settings.changePassword}</h3>
			<!-- Hidden username helps password managers to update the right entry -->
			<input
				type="text"
				name="username"
				value={data.user?.username}
				autocomplete="username"
				hidden
				readonly
			/>
			<label class={label}>
				<span class={labelText}>{m.settings.currentPassword}</span>
				<input name="current" type="password" autocomplete="current-password" required />
			</label>
			<label class={label}>
				<span class={labelText}>{m.settings.newPassword(MIN_PASSWORD_LENGTH)}</span>
				<input
					name="password"
					type="password"
					autocomplete="new-password"
					minlength={MIN_PASSWORD_LENGTH}
					required
				/>
			</label>
			<label class={label}>
				<span class={labelText}>{m.settings.repeatPassword}</span>
				<input
					name="confirm"
					type="password"
					autocomplete="new-password"
					minlength={MIN_PASSWORD_LENGTH}
					required
				/>
			</label>
			{@render actions('password', m.settings.changePassword, KeyRound)}
		</form>

		<form
			method="POST"
			action="?/logoutOthers"
			use:enhance={submit('logoutOthers')}
			class="mt-6 border-t border-zinc-800 pt-4"
		>
			<h3 class="font-medium text-zinc-300">{m.settings.otherDevices}</h3>
			<p class="mt-1 {hint}">{m.settings.otherDevicesHint}</p>
			<div class="mt-4">
				{@render actions(
					'logoutOthers',
					m.settings.logoutOthers,
					LogOut,
					'inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 font-medium transition-colors hover:bg-zinc-800 disabled:opacity-50'
				)}
			</div>
		</form>
	</section>

	<!-- Danger zone -->
	<section class="{card} border-red-900/70">
		<h2 class="{heading} text-red-400"><TriangleAlert size={20} />{m.settings.danger}</h2>

		<form
			method="POST"
			action="?/clear"
			use:enhance={submit('clear', true)}
			onreset={() => (confirmText = '')}
			class="mt-4 flex flex-col gap-4"
		>
			<div>
				<h3 class="font-medium text-zinc-300">{m.settings.clearLibrary}</h3>
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
			{@render actions(
				'clear',
				m.settings.clearButton,
				TriangleAlert,
				'inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors enabled:hover:bg-red-500 enabled:active:bg-red-700 disabled:opacity-40',
				confirmOk
			)}
		</form>
	</section>
</main>
