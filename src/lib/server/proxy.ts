import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { BlockList, isIP } from 'node:net';

// Behind a reverse proxy every request reaches us from the proxy. The proxy passes the
// visitor's own address along (header X-Forwarded-For) – but anybody can send that header.
// So it is only believed when the proxy has proven itself, in one of two ways:
//  - by address: the connection comes from a proxy the admin has entered (setting
//    `trustedProxies`: addresses or ranges like 192.168.1.10 or 172.18.0.0/16);
//  - by key: the request carries the secret of the setting `proxyKey` in the header below.
//    Needed where Docker hides all addresses (see defaultGateway).
export const PROXY_KEY_HEADER = 'X-Hdtracker-Proxy-Key';

// Compares in constant time; an empty key never matches.
export function keyMatches(sent: string | null, key: string) {
	if (!sent || !key) return false;
	const a = Buffer.from(sent);
	const b = Buffer.from(key);
	return a.length === b.length && timingSafeEqual(a, b);
}

// "::ffff:192.168.1.5" (IPv4 over an IPv6 socket) -> "192.168.1.5"; trims spaces and brackets.
export function normalizeAddress(address: string) {
	const plain = address.trim().replace(/^\[|\]$/g, '');
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(plain);
	return mapped ? mapped[1] : plain;
}

// One entry: an address or a range in CIDR form. Returns it normalised, or null if invalid.
function parseEntry(entry: string) {
	const [rawAddress, prefix, ...rest] = entry.trim().split('/');
	const address = normalizeAddress(rawAddress);
	const version = isIP(address);
	if (!version || rest.length) return null;
	if (prefix === undefined) return address;
	const bits = Number(prefix);
	const max = version === 4 ? 32 : 128;
	if (!/^\d{1,3}$/.test(prefix) || bits < 1 || bits > max) return null;
	return `${address}/${bits}`;
}

// Checks a list typed by the admin (separated by commas, spaces or line breaks).
export function parseProxies(text: string) {
	const entries: string[] = [];
	const invalid: string[] = [];
	for (const raw of text.split(/[\s,;]+/).filter(Boolean)) {
		const entry = parseEntry(raw);
		if (!entry) invalid.push(raw);
		else if (!entries.includes(entry)) entries.push(entry);
	}
	return { entries, invalid };
}

let cache: { key: string; list: BlockList } | null = null;
function blockList(entries: string[]) {
	const key = entries.join(',');
	if (cache?.key === key) return cache.list;
	const list = new BlockList();
	for (const entry of entries) {
		const [address, prefix] = entry.split('/');
		const family = isIP(address) === 4 ? 'ipv4' : 'ipv6';
		if (prefix) list.addSubnet(address, Number(prefix), family);
		else list.addAddress(address, family);
	}
	cache = { key, list };
	return list;
}

export function isTrusted(address: string, entries: string[]) {
	const plain = normalizeAddress(address);
	const version = isIP(plain);
	if (!version || entries.length === 0) return false;
	return blockList(entries).check(plain, version === 4 ? 'ipv4' : 'ipv6');
}

// The visitor's address as passed along by the proxy directly in front of us (the last entry
// of X-Forwarded-For), whether we believe it or not. Null without a usable header.
export function forwardedAddress(forwardedFor: string | null) {
	const last = forwardedFor?.split(',').at(-1);
	const address = last ? normalizeAddress(last) : '';
	return isIP(address) ? address : null;
}

// The address a request really comes from. `peer` is the other end of the connection.
// Only if a proxy has proven itself (the connection comes from an entered proxy, or `byKey`),
// X-Forwarded-For counts: read from the right, the first address that is not itself an
// entered proxy (so two proxies in a row work as well).
export function addressFrom(
	peer: string,
	forwardedFor: string | null,
	entries: string[],
	byKey = false
) {
	const direct = normalizeAddress(peer);
	if (!forwardedFor || !(byKey || isTrusted(direct, entries))) return direct;
	const hops = forwardedFor
		.split(',')
		.map(normalizeAddress)
		.filter((hop) => isIP(hop));
	for (let i = hops.length - 1; i >= 0; i--) {
		if (!isTrusted(hops[i], entries)) return hops[i];
	}
	return hops[0] ?? direct;
}

// The default gateway from the kernel's routing table (/proc/net/route): the line with
// destination 00000000; the gateway is written as hex with the bytes reversed.
export function parseGateway(routes: string) {
	for (const line of routes.split('\n').slice(1)) {
		const [, destination, gateway] = line.trim().split(/\s+/);
		if (destination !== '00000000' || !/^[0-9A-Fa-f]{8}$/.test(gateway ?? '')) continue;
		const bytes = gateway.match(/../g)!.map((hex) => Number.parseInt(hex, 16));
		return bytes.reverse().join('.');
	}
	return null;
}

// In a container, connections that Docker forwards itself (rootless Docker, access from the
// Docker host, IPv6) all arrive from the gateway of the container's network: the real
// addresses are hidden, and a proxy cannot be told from a direct visitor by its address.
let gateway: string | null | undefined;
export function defaultGateway() {
	if (gateway === undefined) {
		try {
			gateway = parseGateway(readFileSync('/proc/net/route', 'utf8'));
		} catch {
			gateway = null;
		}
	}
	return gateway;
}
