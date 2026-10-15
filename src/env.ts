import { defineEnvVars } from '@sveltejs/kit/env';

// The secrets from .env. Read when the server starts, never written into the build (the
// Docker image is the same for everybody). Missing ones are an empty string here; the code that
// needs them says what is wrong (getSecret() stops the start without SECRET).
export const variables = defineEnvVars({
	SECRET: { schema: (input) => input ?? '' },
	TMDB_API_TOKEN: { schema: (input) => input ?? '' },
	IGDB_CLIENT_ID: { schema: (input) => input ?? '' },
	IGDB_CLIENT_SECRET: { schema: (input) => input ?? '' }
});
