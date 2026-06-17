/**
 * Truncate a wallet address for display.
 * @param {string} addr
 * @param {number} [start=6]
 * @param {number} [end=4]
 * @returns {string}
 */
export function truncateAddress(addr, start = 6, end = 4) {
        if (!addr || addr.length <= start + end) return addr ?? '';
        return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

/**
 * Format a human-readable decimal balance string.
 * @param {string|number} value  Already-decimal value (e.g. "1.23456789")
 * @param {number} [maxDecimals=6]
 * @returns {string}
 */
export function formatBalance(value, maxDecimals = 6) {
        if (value == null || value === '') return '0';
        const num = parseFloat(value);
        if (isNaN(num)) return '0';
        if (num === 0) return '0';
        if (num < 1e-6) return num.toExponential(4);
        return num.toLocaleString('en-US', {
                maximumFractionDigits: maxDecimals,
                minimumFractionDigits: 0,
        });
}

/**
 * Convert a raw integer wei/satoshi/drops value to a decimal string.
 * Uses BigInt so it's safe for 18-decimal chains.
 * @param {string|number|bigint} raw
 * @param {number} decimals  e.g. 18 for ETH, 8 for BTC/DOGE
 * @param {number} [maxDecimals=6]
 * @returns {string}
 */
export function formatRawValue(raw, decimals, maxDecimals = 6) {
        if (!raw || raw === '0') return '0';
        try {
                const big = BigInt(raw.toString());
                const divisor = 10n ** BigInt(decimals);
                const whole = big / divisor;
                const remainder = big % divisor;
                if (remainder === 0n) return whole.toString();
                const fracFull = remainder.toString().padStart(decimals, '0');
                const frac = fracFull.slice(0, maxDecimals).replace(/0+$/, '');
                return frac ? `${whole}.${frac}` : whole.toString();
        } catch {
                return formatBalance(parseFloat(raw) / Math.pow(10, decimals), maxDecimals);
        }
}

/**
 * Format a Unix timestamp (seconds or ms) as a relative time string.
 * @param {number|null} ts
 * @param {boolean} [isMs=true]
 * @returns {string}
 */
export function formatTimestamp(ts, isMs = true) {
        if (!ts) return 'Unknown';
        const ms = isMs ? ts : ts * 1000;
        const diff = Math.floor((Date.now() - ms) / 1000);
        if (diff < 60)      return `${diff}s ago`;
        if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
        return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format a dollar value with K/M/B suffixes.
 * @param {number|string|null} value
 * @returns {string}
 */
export function formatUSD(value) {
        if (value == null) return 'N/A';
        const num = parseFloat(value);
        if (isNaN(num)) return 'N/A';
        if (num >= 1e9)  return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6)  return `$${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3)  return `$${(num / 1e3).toFixed(2)}K`;
        if (num >= 1)    return `$${num.toFixed(2)}`;
        return `$${num.toFixed(2)}`;
}

/**
 * Determine the direction of a UTXO transaction relative to a watched address.
 * Returns 'in', 'out', or 'self'.
 * @param {object} tx  Normalised UTXO tx from tatum.js
 * @param {string} address
 * @returns {'in'|'out'|'self'}
 */
export function utxoTxDirection(tx, address) {
        const addr = address.toLowerCase();
        const fromSelf = (tx.inputs ?? []).some(i => i.coin?.address?.toLowerCase() === addr);
        const toSelf   = (tx.outputs ?? []).some(o => o.address?.toLowerCase() === addr);
        if (fromSelf && toSelf) return 'self';
        if (fromSelf) return 'out';
        return 'in';
}

/**
 * Sum the output value sent to (or from) a specific address in a UTXO tx.
 * Returns the raw satoshi/unit integer as a string.
 * @param {object} tx
 * @param {string} address
 * @param {'in'|'out'} direction
 * @returns {string}
 */
export function utxoTxAmount(tx, address, direction) {
        const addr = address.toLowerCase();
        if (direction === 'in') {
                const total = (tx.outputs ?? [])
                        .filter(o => o.address?.toLowerCase() === addr)
                        .reduce((s, o) => s + BigInt(o.value ?? 0), 0n);
                return total.toString();
        }
        const total = (tx.inputs ?? [])
                .filter(i => i.coin?.address?.toLowerCase() === addr)
                .reduce((s, i) => s + BigInt(i.coin?.value ?? 0), 0n);
        return total.toString();
}
