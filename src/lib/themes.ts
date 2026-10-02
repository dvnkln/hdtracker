// Colour themes of the interface. A theme replaces the grey scale everything is drawn with
// (and, for some, corners and font) – see the [data-theme] blocks in routes/layout.css. The
// accent colours of the four areas stay the same colours in every theme.
//
// scheme: what the browser draws itself (scrollbars, form controls);
// background: page background, used for the browser's own bar on phones.
export const THEMES = {
	// Follows the device: "dark" or "light" (backgroundLight is used on light devices)
	system: { scheme: 'dark', background: '#09090b', backgroundLight: '#f4f4f5' },
	dark: { scheme: 'dark', background: '#09090b' },
	light: { scheme: 'light', background: '#f4f4f5' },
	tokyonight: { scheme: 'dark', background: '#1a1b26' },
	// Well-known free colour palettes (credited on the About page)
	dracula: { scheme: 'dark', background: '#282a36' },
	synthwave: { scheme: 'dark', background: '#262335' },
	cyberpunk: { scheme: 'dark', background: '#0d0608' },
	// Old computer interfaces; these also change corners and font
	retro95: { scheme: 'light', background: '#c0c0c0' },
	terminal: { scheme: 'dark', background: '#04140c' },
	c64: { scheme: 'dark', background: '#352879' }
} as const satisfies Record<
	string,
	{ scheme: string; background: string; backgroundLight?: string }
>;

export type Theme = keyof typeof THEMES;
export const THEME_KEYS = Object.keys(THEMES) as Theme[];
// New installations follow the device (dark or light).
export const DEFAULT_THEME: Theme = 'system';

export function isTheme(value: unknown): value is Theme {
	return typeof value === 'string' && Object.hasOwn(THEMES, value);
}

// Colours of the browser's bar: [on dark devices, on light devices] (the same unless "system").
export function barColors(theme: Theme): [string, string] {
	const t: { background: string; backgroundLight?: string } = THEMES[theme];
	return [t.background, t.backgroundLight ?? t.background];
}
