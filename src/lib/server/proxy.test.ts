import { describe, expect, it } from 'vitest';
import {
	addressFrom,
	forwardedAddress,
	isTrusted,
	keyMatches,
	parseGateway,
	parseProxies
} from './proxy';

describe('parseProxies', () => {
	it('accepts addresses and ranges, in any common notation', () => {
		expect(parseProxies(' 192.168.1.10, 172.18.0.0/16\n::ffff:10.0.0.1  fd00::/8 ')).toEqual({
			entries: ['192.168.1.10', '172.18.0.0/16', '10.0.0.1', 'fd00::/8'],
			invalid: []
		});
		expect(parseProxies('')).toEqual({ entries: [], invalid: [] });
	});
	it('names what it cannot read', () => {
		expect(
			parseProxies('proxy.local, 300.1.1.1, 10.0.0.0/33, 10.0.0.0/0, 10.0.0.1').invalid
		).toEqual(['proxy.local', '300.1.1.1', '10.0.0.0/33', '10.0.0.0/0']);
	});
});

describe('isTrusted', () => {
	const list = ['192.168.1.10', '172.18.0.0/16', 'fd00::/8'];
	it('matches single addresses and ranges', () => {
		expect(isTrusted('192.168.1.10', list)).toBe(true);
		expect(isTrusted('::ffff:192.168.1.10', list)).toBe(true);
		expect(isTrusted('172.18.5.9', list)).toBe(true);
		expect(isTrusted('fd12::1', list)).toBe(true);
	});
	it('refuses everything else', () => {
		expect(isTrusted('192.168.1.11', list)).toBe(false);
		expect(isTrusted('172.19.0.1', list)).toBe(false);
		expect(isTrusted('unknown', list)).toBe(false);
		expect(isTrusted('192.168.1.10', [])).toBe(false);
	});
});

describe('addressFrom', () => {
	const proxies = ['192.168.1.10'];
	it('believes the proxy that was entered', () => {
		expect(addressFrom('192.168.1.10', '203.0.113.7', proxies)).toBe('203.0.113.7');
		expect(addressFrom('::ffff:192.168.1.10', '203.0.113.7', proxies)).toBe('203.0.113.7');
	});
	it('ignores a made-up address from anybody else', () => {
		expect(addressFrom('192.168.1.55', '203.0.113.7', proxies)).toBe('192.168.1.55');
		expect(addressFrom('192.168.1.55', '203.0.113.7', [])).toBe('192.168.1.55');
	});
	it('takes what the proxy itself added, not what the visitor claimed before', () => {
		expect(addressFrom('192.168.1.10', '1.2.3.4, 203.0.113.7', proxies)).toBe('203.0.113.7');
	});
	it('works through two proxies in a row', () => {
		const two = ['192.168.1.10', '10.0.0.0/8'];
		expect(addressFrom('192.168.1.10', '1.2.3.4, 203.0.113.7, 10.0.0.5', two)).toBe('203.0.113.7');
	});
	it('falls back to the connection without a usable header', () => {
		expect(addressFrom('192.168.1.10', null, proxies)).toBe('192.168.1.10');
		expect(addressFrom('192.168.1.10', 'nonsense', proxies)).toBe('192.168.1.10');
	});
});

it('forwardedAddress reads the last entry of the header', () => {
	expect(forwardedAddress('1.2.3.4, 203.0.113.7')).toBe('203.0.113.7');
	expect(forwardedAddress(null)).toBeNull();
	expect(forwardedAddress('nonsense')).toBeNull();
});

describe('proxy key (where Docker hides the addresses)', () => {
	const gateway = '172.18.0.1'; // proxy and direct visitors all arrive from here
	it('believes a proxy that sent the right key, whatever its address', () => {
		expect(addressFrom(gateway, '203.0.113.7', [], true)).toBe('203.0.113.7');
	});
	it('without the key a made-up address is ignored', () => {
		expect(addressFrom(gateway, '203.0.113.7', [], false)).toBe(gateway);
	});
	it('still skips entered proxies further out (two proxies in a row)', () => {
		expect(addressFrom(gateway, '203.0.113.7, 10.0.0.5', ['10.0.0.0/8'], true)).toBe('203.0.113.7');
	});
	it('keyMatches accepts only the exact key, never an empty one', () => {
		expect(keyMatches('secret', 'secret')).toBe(true);
		expect(keyMatches('secreT', 'secret')).toBe(false);
		expect(keyMatches('secret-and-more', 'secret')).toBe(false);
		expect(keyMatches(null, 'secret')).toBe(false);
		expect(keyMatches('', '')).toBe(false);
		expect(keyMatches('anything', '')).toBe(false);
	});
});

it('parseGateway finds the default gateway in the routing table', () => {
	const routes =
		'Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT\n' +
		'eth0\t00000000\t010012AC\t0003\t0\t0\t0\t00000000\t0\t0\t0\n' +
		'eth0\t000012AC\t00000000\t0001\t0\t0\t0\t0000FFFF\t0\t0\t0\n';
	expect(parseGateway(routes)).toBe('172.18.0.1');
	expect(parseGateway('Iface\tDestination\tGateway\n')).toBeNull();
});
