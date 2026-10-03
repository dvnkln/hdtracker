<script lang="ts">
	import { enhance } from '$app/forms';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import { m } from '$lib/i18n/index.svelte';
	import { MIN_PASSWORD_LENGTH } from '$lib/limits';
	import { FormFeedback } from '$lib/forms.svelte';
	import { ui } from '$lib/ui';
	import FeedbackText from '$lib/components/FeedbackText.svelte';
	import SubmitButton, { BUTTON_SECONDARY } from '$lib/components/SubmitButton.svelte';
	import { AtSign, KeyRound, LogOut, MonitorSmartphone } from '@lucide/svelte';

	let { data, form } = $props();

	const forms = new FormFeedback();
	const { card, heading, label, labelText, hint, actions, pageTitle } = ui;
</script>

<svelte:head><title>{m.settings.account} · hdtracker</title></svelte:head>

<h2 class={pageTitle}>{m.settings.account}</h2>

<!-- Username -->
<section class={card}>
	<h3 class={heading}><AtSign size={20} class="text-zinc-400" />{m.settings.changeUsername}</h3>
	<form
		method="POST"
		action="?/username"
		use:enhance={forms.submit('username')}
		class="mt-4 flex flex-col gap-4"
	>
		<label class={label}>
			<span class={labelText}>{m.settings.newUsername}</span>
			<input
				name="username"
				value={form?.section === 'username' && form.username ? form.username : data.user?.username}
				autocomplete="username"
				autocapitalize="off"
				required
			/>
			<span class={hint}>{m.auth.usernameRule}</span>
		</label>
		<label class={label}>
			<span class={labelText}>{m.settings.currentPasswordConfirm}</span>
			<PasswordInput name="current" autocomplete="current-password" required />
		</label>
		<div class={actions}>
			<SubmitButton
				text={m.settings.changeUsername}
				busy={forms.busy === 'username'}
				when="filled"
			/>
			<FeedbackText feedback={forms.messages.username} />
		</div>
	</form>
</section>

<!-- Password -->
<section class={card}>
	<h3 class={heading}><KeyRound size={20} class="text-zinc-400" />{m.settings.changePassword}</h3>
	<form
		method="POST"
		action="?/password"
		use:enhance={forms.submit('password', true)}
		class="mt-4 flex flex-col gap-4"
	>
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
				when="filled"
				icon={KeyRound}
			/>
			<FeedbackText feedback={forms.messages.password} />
		</div>
	</form>
</section>

<!-- Other devices -->
<section class={card}>
	<h3 class={heading}>
		<MonitorSmartphone size={20} class="text-zinc-400" />{m.settings.otherDevices}
	</h3>
	<form
		method="POST"
		action="?/logoutOthers"
		use:enhance={forms.submit('logoutOthers')}
		class="mt-2"
	>
		<p class={hint}>{m.settings.otherDevicesHint}</p>
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
