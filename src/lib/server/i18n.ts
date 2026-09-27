import { MESSAGES, isLocale } from '$lib/i18n/index.svelte';
import { getSetting } from './settings';

// Texts in the configured interface language, for messages created on the server
// (form errors, API errors).
export function serverMessages() {
	const locale = getSetting('uiLanguage');
	return MESSAGES[isLocale(locale) ? locale : 'en'];
}
