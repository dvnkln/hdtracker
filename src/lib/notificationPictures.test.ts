import { describe, expect, it } from 'vitest';
import { avatarKey, avatarOwner } from './notificationPictures';

describe('profile pictures kept for notifications', () => {
	it('keeps a picture under its person and version, whatever the address carries', () => {
		expect(avatarKey('/avatar/3?v=1792000000000')).toBe('/avatar/3?v=1792000000000');
		expect(avatarKey('/avatar/3?v=1792000000000&e=1792600000&s=abc')).toBe(
			'/avatar/3?v=1792000000000'
		);
		expect(avatarKey('https://tracker.example/avatar/12?e=1&v=7&s=x')).toBe('/avatar/12?v=7');
	});

	it('knows nothing else', () => {
		expect(avatarKey('/icons/share.png')).toBeNull();
		expect(avatarKey('/avatar/3')).toBeNull();
		expect(avatarKey('/avatar/3?v=abc')).toBeNull();
		expect(avatarKey('/avatar/x?v=1')).toBeNull();
		expect(avatarKey('/img?u=https%3A%2F%2Fimage.tmdb.org%2Fa.jpg&s=x')).toBeNull();
	});

	it('names the person of a kept picture', () => {
		expect(avatarOwner('/avatar/3?v=7')).toBe('/avatar/3');
	});
});
