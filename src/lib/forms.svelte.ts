import type { SubmitFunction } from '@sveltejs/kit';

export type Feedback = { ok: boolean; text: string };

// Result messages of several forms on one page ("Gespeichert ✓" or an error), and which
// form is currently being sent. Success messages disappear after a few seconds.
export class FormFeedback {
	messages = $state<Record<string, Feedback | undefined>>({});
	busy = $state<string | null>(null);
	// formaction of the pressed button, when one form has several buttons (e.g. "?/run")
	busyAction = $state<string | null>(null);

	// For use:enhance: submit in the background, then show the server's answer under `id`.
	// The server answers with { message } or fail(..., { error }).
	submit(id: string, reset = false): SubmitFunction {
		return ({ submitter }) => {
			this.busy = id;
			this.busyAction = submitter?.getAttribute('formaction') ?? null;
			this.messages[id] = undefined;
			return async ({ result, update }) => {
				await update({ reset });
				this.busy = null;
				this.busyAction = null;
				if (result.type !== 'success' && result.type !== 'failure') return;
				const answer = result.data as { message?: string; error?: string } | undefined;
				if (!answer?.error && !answer?.message) return;
				const entry = answer.error
					? { ok: false, text: answer.error }
					: { ok: true, text: answer.message! };
				this.messages[id] = entry;
				if (entry.ok) {
					setTimeout(() => {
						if (this.messages[id] === entry) this.messages[id] = undefined;
					}, 5000);
				}
			};
		};
	}
}
