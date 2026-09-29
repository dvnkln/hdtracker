// Rules shared by the forms in the browser and the checks on the server.
export const MIN_PASSWORD_LENGTH = 10;

// Usernames: 3–32 characters, only letters, digits, _ . -
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;
