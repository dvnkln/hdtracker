// Lines to add to a reverse proxy's configuration so it proves itself to hdtracker with the
// proxy key (Settings → Server → Connection). `where` says where the lines go (text in the
// i18n files, settings.snippetWhere).
export type SnippetPlace = 'npm' | 'caddy' | 'traefik' | 'nginx';

// What is shown instead of the key until the admin asks to see it.
const DOTS = '••••••••••••';

// `code` is the real line (for copying), `masked` the same line with the key hidden.
export function proxySnippets(header: string, key: string) {
	return lines(header, key).map((snippet, i) => ({
		...snippet,
		masked: lines(header, DOTS)[i].code
	}));
}

function lines(header: string, key: string) {
	return [
		{
			name: 'Nginx Proxy Manager',
			where: 'npm' as SnippetPlace,
			code: `proxy_set_header ${header} "${key}";`
		},
		{
			name: 'Caddy',
			where: 'caddy' as SnippetPlace,
			code: `header_up ${header} "${key}"`
		},
		{
			name: 'Traefik',
			where: 'traefik' as SnippetPlace,
			code: `traefik.http.middlewares.hdtracker-key.headers.customrequestheaders.${header}=${key}\ntraefik.http.routers.hdtracker.middlewares=hdtracker-key`
		},
		{
			name: 'nginx',
			where: 'nginx' as SnippetPlace,
			code: `proxy_set_header ${header} "${key}";`
		}
	];
}
