import { Database, Info, Palette, Server, Settings2, UserRound, Wrench } from '@lucide/svelte';
import { m } from '$lib/i18n/index.svelte';

// Areas of the settings, in display order. "personal": for each user; "admin": for the whole
// installation (later only for admins); "about" stands on its own at the end.
// A new area only needs one more line here (and its page under src/routes/settings/).
export function settingsSections() {
	return [
		{
			href: '/settings/general',
			group: 'personal',
			icon: Settings2,
			label: m.settings.general,
			hint: m.settings.generalHint
		},
		{
			href: '/settings/appearance',
			group: 'personal',
			icon: Palette,
			label: m.settings.appearance,
			hint: m.settings.appearanceHint
		},
		{
			href: '/settings/account',
			group: 'personal',
			icon: UserRound,
			label: m.settings.account,
			hint: m.settings.accountHint
		},
		{
			href: '/settings/data',
			group: 'personal',
			icon: Database,
			label: m.settings.data,
			hint: m.settings.dataHint
		},
		{
			href: '/settings/server',
			group: 'admin',
			icon: Server,
			label: m.settings.server,
			hint: m.settings.serverHint
		},
		{
			href: '/settings/maintenance',
			group: 'admin',
			icon: Wrench,
			label: m.maintenance.title,
			hint: m.settings.maintenanceHint
		},
		{
			href: '/settings/about',
			group: 'about',
			icon: Info,
			label: m.about.title,
			hint: m.settings.aboutHint
		}
	] as const;
}

export type SettingsSection = ReturnType<typeof settingsSections>[number];

// Sections grouped for the sidebar / list, with the group title (none for "about").
export function settingsGroups() {
	const sections = settingsSections();
	return [
		{ title: m.settings.groupPersonal, items: sections.filter((s) => s.group === 'personal') },
		{ title: m.settings.groupAdmin, items: sections.filter((s) => s.group === 'admin') },
		{ title: null, items: sections.filter((s) => s.group === 'about') }
	];
}
