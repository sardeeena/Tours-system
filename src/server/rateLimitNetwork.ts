import { isIP } from 'node:net';

/**
 * Build a stable rate-limit principal from an IP address.
 * IPv4 remains per-address; IPv6 is grouped by its /64 allocation so privacy
 * address rotation inside one network cannot mint fresh rate-limit buckets.
 */
export function rateLimitNetworkKey(address: string): string {
  const value = address.trim().toLowerCase();
  if (isIP(value) === 4) return `ipv4:${value}`;
  if (isIP(value) !== 6) throw new Error('A valid IP address is required for rate limiting.');

  const expandIpv4Tail = (parts: string[]): string[] => {
    const last = parts[parts.length - 1];
    if (!last?.includes('.')) return parts;
    const octets = last.split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      throw new Error('Invalid embedded IPv4 address.');
    }
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    return [...parts.slice(0, -1), high, low];
  };

  let groups: string[];
  const compressionIndex = value.indexOf('::');
  if (compressionIndex >= 0) {
    const left = expandIpv4Tail(value.slice(0, compressionIndex).split(':').filter(Boolean));
    const right = expandIpv4Tail(value.slice(compressionIndex + 2).split(':').filter(Boolean));
    const missing = 8 - left.length - right.length;
    if (missing < 1) throw new Error('Invalid compressed IPv6 address.');
    groups = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    groups = expandIpv4Tail(value.split(':'));
  }

  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
    throw new Error('Invalid IPv6 address.');
  }

  const numericGroups = groups.map((group) => Number.parseInt(group, 16));
  // Treat IPv4-mapped IPv6 forms as their IPv4 principal, including hex notation.
  if (numericGroups.slice(0, 5).every((group) => group === 0) && numericGroups[5] === 0xffff) {
    const a = numericGroups[6] >> 8;
    const b = numericGroups[6] & 0xff;
    const c = numericGroups[7] >> 8;
    const d = numericGroups[7] & 0xff;
    return `ipv4:${a}.${b}.${c}.${d}`;
  }

  const networkPrefix = numericGroups
    .slice(0, 4)
    .map((group) => group.toString(16).padStart(4, '0'))
    .join(':');
  return `ipv6:${networkPrefix}::/64`;
}
