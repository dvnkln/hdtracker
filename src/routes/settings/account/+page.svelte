<script lang="ts">
	import { enhance } from '$app/forms';
	import NewPassword from '#lib/components/NewPassword.svelte';
	import PasswordInput from '#lib/components/PasswordInput.svelte';
	import { m } from '#lib/i18n/index.svelte.js';
	import { MIN_PASSWORD_LENGTH } from '#lib/limits.js';
	import { FormFeedback } from '#lib/forms.svelte.js';
	import { ui } from '#lib/ui.js';
	import FeedbackText from '#lib/components/FeedbackText.svelte';
	import SubmitButton, { BUTTON_SECONDARY } from '#lib/components/SubmitButton.svelte';
	import { deserialize } from '$app/forms';
	import { refreshAll } from '$app/navigation';
	import Avatar from '#lib/components/Avatar.svelte';
	import type { Feedback } from '#lib/forms.svelte.js';
	import {
		AtSign,
		Dices,
		ImageUp,
		KeyRound,
		LoaderCircle,
		LogOut,
		MonitorSmartphone,
		Trash2,
		UserRound
	} from '@lucide/svelte';

	let { data, form } = $props();

	const forms = new FormFeedback();
	const { card, heading, label, labelText, hint, actions, pageTitle } = ui;

	// ---- Profile picture ----
	let picker = $state<HTMLInputElement>();
	let uploading = $state(false);
	let pictureFeedback = $state<Feedback | undefined>();

	// A photo from a phone has many megabytes; the picture shown is tiny. So the photo is
	// shrunk here, in the browser, and only that small copy travels to the server (which
	// checks it and cuts it to size once more).
	const SEND_SIZE = 512;
	async function shrink(file: File): Promise<Blob> {
		try {
			const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
			const scale = Math.min(1, SEND_SIZE / Math.min(image.width, image.height));
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(image.width * scale);
			canvas.height = Math.round(image.height * scale);
			canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
			const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.9));
			return blob ?? file;
		} catch {
			// A format this browser cannot draw: let the server try with the file as it is
			return file;
		}
	}

	async function upload() {
		const file = picker?.files?.[0];
		if (!file) return;
		uploading = true;
		pictureFeedback = undefined;
		try {
			const body = new FormData();
			body.set('picture', await shrink(file), 'picture.jpg');
			const response = await fetch('?/avatar', {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const result = deserialize(await response.text());
			if (result.type === 'failure') {
				const text = (result.data as { error?: string } | undefined)?.error;
				pictureFeedback = { ok: false, text: text ?? m.profile.uploadFailed };
			} else if (result.type !== 'success') {
				pictureFeedback = { ok: false, text: m.profile.uploadFailed };
			}
			await refreshAll();
		} catch {
			pictureFeedback = { ok: false, text: m.profile.uploadFailed };
		} finally {
			uploading = false;
			if (picker) picker.value = '';
		}
	}
</script>

<svelte:head><title>{m.settings.account} · hdtracker</title></svelte:head>

<h2 class={pageTitle}>{m.settings.account}</h2>

<!-- Profile: what the others see -->
<section class={card}>
	<h3 class={heading}>
		<UserRound size={20} class="text-zinc-400" />{m.profile.title}
		<FeedbackText feedback={pictureFeedback ?? forms.error('avatar')} />
	</h3>
	<div class="mt-4 flex items-center gap-4">
		<Avatar person={data.me} class="size-20 text-3xl" />
		<div class="flex min-w-0 flex-col gap-2">
			<!-- The photo is shrunk in the browser before it is sent (see upload) -->
			<input
				bind:this={picker}
				type="file"
				accept="image/*"
				class="hidden"
				onchange={upload}
				aria-label={m.profile.upload}
			/>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class="{BUTTON_SECONDARY} !px-3 !py-1.5 text-sm"
					disabled={uploading}
					onclick={() => picker?.click()}
				>
					{#if uploading}<LoaderCircle size={16} class="animate-spin" />{:else}<ImageUp
							size={16}
						/>{/if}{m.profile.upload}
				</button>
				{#if data.me.picture !== null}
					<form method="POST" action="?/avatarRemove" use:enhance={forms.submit('avatar')}>
						<button class="{BUTTON_SECONDARY} !px-3 !py-1.5 text-sm"
							><Trash2 size={16} />{m.profile.remove}</button
						>
					</form>
				{:else}
					<form method="POST" action="?/color" use:enhance={forms.submit('avatar')}>
						<button class="{BUTTON_SECONDARY} !px-3 !py-1.5 text-sm"
							><Dices size={16} />{m.profile.newColor}</button
						>
					</form>
				{/if}
			</div>
		</div>
	</div>

	<form
		method="POST"
		action="?/profile"
		use:enhance={forms.submit('profile')}
		class="mt-5 flex flex-col gap-4"
	>
		<label class={label}>
			<span class={labelText}>{m.profile.displayName}</span>
			<input
				name="displayName"
				value={data.displayName}
				maxlength={data.maxDisplayName}
				placeholder={data.user?.username}
				autocomplete="nickname"
			/>
			<span class={hint}>{m.profile.displayNameHint}</span>
		</label>
		<div class={actions}>
			<SubmitButton text={m.settings.save} busy={forms.busy === 'profile'} when="changed" />
			<FeedbackText feedback={forms.messages.profile} />
		</div>
	</form>
</section>

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
		<NewPassword
			label={m.settings.newPassword(MIN_PASSWORD_LENGTH)}
			repeatLabel={m.settings.repeatPassword}
		/>
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
