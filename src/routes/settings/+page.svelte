<script lang="ts">
	import { enhance } from '$app/forms';
	import { CATEGORY_KEYS } from '$lib/categories';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import { LOCALES, m } from '$lib/i18n/index.svelte';
	import { MIN_PASSWORD_LENGTH } from '$lib/limits';
	import { FormFeedback } from '$lib/forms.svelte';
	import { ui } from '$lib/ui';
	import FeedbackText from '$lib/components/FeedbackText.svelte';
	import SubmitButton, {
		BUTTON_DANGER,
		BUTTON_SECONDARY
	} from '$lib/components/SubmitButton.svelte';
	import Switch from '$lib/components/Switch.svelte';
	import {
		KeyRound,
		LogOut,
		Monitor,
		SlidersHorizontal,
		TriangleAlert,
		UserRound
	} from '@lucide/svelte';

	let { data } = $props();

	// "Gespeichert ✓" or an error message next to each form's button.
	const forms = new FormFeedback();

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

	const { card, heading, label, labelText, hint, actions } = ui;
</script>

<svelte:head><title>{m.settings.title} · hdtracker</title></svelte:head>

<main class="mx-auto max-w-screen-sm px-4 pb-4">
	<!-- Display -->
	<section class={card}>
		<h2 class={heading}><Monitor size={20} class="text-zinc-400" />{m.settings.display}</h2>

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
		<h2 class={heading}>
			<SlidersHorizontal size={20} class="text-zinc-400" />{m.settings.behavior}
		</h2>

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

	<!-- Account -->
	<section class={card}>
		<h2 class={heading}><UserRound size={20} class="text-zinc-400" />{m.settings.account}</h2>

		<form
			method="POST"
			action="?/password"
			use:enhance={forms.submit('password', true)}
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
				<PasswordInput name="current" autocomplete="current-password" required />
			</label>
			<label class={label}>
				<span class={labelText}>{m.settings.newPassword(MIN_PASSWORD_LENGTH)}</span>
				<PasswordInput
					name="password"
					autocomplete="new-password"
					minlength={MIN_PASSWORD_LENGTH}
					required
				/>
			</label>
			<label class={label}>
				<span class={labelText}>{m.settings.repeatPassword}</span>
				<PasswordInput
					name="confirm"
					autocomplete="new-password"
					minlength={MIN_PASSWORD_LENGTH}
					required
				/>
			</label>
			<div class={actions}>
				<SubmitButton
					text={m.settings.changePassword}
					busy={forms.busy === 'password'}
					icon={KeyRound}
				/>
				<FeedbackText feedback={forms.messages.password} />
			</div>
		</form>

		<form
			method="POST"
			action="?/logoutOthers"
			use:enhance={forms.submit('logoutOthers')}
			class="mt-6 border-t border-zinc-800 pt-4"
		>
			<h3 class="font-medium text-zinc-300">{m.settings.otherDevices}</h3>
			<p class="mt-1 {hint}">{m.settings.otherDevicesHint}</p>
			<div class="mt-4">
				<div class={actions}>
					<SubmitButton
						text={m.settings.logoutOthers}
						busy={forms.busy === 'logoutOthers'}
						icon={LogOut}
						style={BUTTON_SECONDARY}
					/>
					<FeedbackText feedback={forms.messages.logoutOthers} />
				</div>
			</div>
		</form>
	</section>

	<!-- Danger zone -->
	<section class="{card} border-red-900/70">
		<h2 class="{heading} text-red-400"><TriangleAlert size={20} />{m.settings.danger}</h2>

		<form
			method="POST"
			action="?/clear"
			use:enhance={forms.submit('clear', true)}
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
</main>
