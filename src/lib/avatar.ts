// What others see of a user: a name and a picture. Without a picture of their own, the first
// letter of the name stands on a colour that was given to the account at random.
export type Person = {
	id: number;
	name: string;
	// Hue of the placeholder, 0–359
	color: number;
	// Set if there is a picture of their own: its version, part of the picture's address so a
	// new picture is loaded at once
	picture: number | null;
};

// The background of the placeholder. Dark enough for a white letter in every hue – yellow
// and green tones need to be darker than the others for that.
export function avatarBackground(hue: number) {
	const h = ((Math.round(hue) % 360) + 360) % 360;
	return `hsl(${h} 60% ${h >= 35 && h <= 195 ? 27 : 38}%)`;
}

export const avatarLetter = (name: string) => [...name.trim()][0]?.toUpperCase() ?? '?';

// Where the picture of a person is loaded from.
export const avatarUrl = (person: Pick<Person, 'id' | 'picture'>) =>
	person.picture === null ? null : `/avatar/${person.id}?v=${person.picture}`;
