import { describe, expect, it } from 'vitest';
import { avatarBackground, avatarLetter, avatarUrl } from './avatar';

// Relative luminance and contrast as WCAG defines them
function luminance(css: string) {
	const [h, s, l] = /hsl\((\d+) (\d+)% (\d+)%\)/.exec(css)!.slice(1).map(Number);
	const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
	const channel = (n: number) => {
		const k = (n + h / 30) % 12;
		const value = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
}

describe('the placeholder picture', () => {
	it('keeps a white letter readable on every colour an account can get', () => {
		for (let hue = 0; hue < 360; hue++) {
			const contrast = 1.05 / (luminance(avatarBackground(hue)) + 0.05);
			expect(contrast, `hue ${hue}`).toBeGreaterThanOrEqual(4.5);
		}
	});
	it('takes any number as a hue', () => {
		expect(avatarBackground(370)).toBe(avatarBackground(10));
		expect(avatarBackground(-10)).toBe(avatarBackground(350));
	});
	it('shows the first letter of the name, also for names that start with something else', () => {
		expect(avatarLetter('anna')).toBe('A');
		expect(avatarLetter('  émile')).toBe('É');
		expect(avatarLetter('🎬 Kino')).toBe('🎬');
		expect(avatarLetter('')).toBe('?');
	});
	it('loads a picture of one’s own from an address that changes with the picture', () => {
		expect(avatarUrl({ id: 7, picture: null })).toBeNull();
		expect(avatarUrl({ id: 7, picture: 123 })).toBe('/avatar/7?v=123');
	});
});
