import { config } from '#config';

const BASE = 'https://api.tatum.io/v3';

/**
 * @param {string} path
 * @returns {Promise<any>}
 */
async function fetchTatum(path) {
        const res = await fetch(`${BASE}${path}`, {
                headers: { 'x-api-key': config.tatum.apiKey },
        });
        if (!res.ok) {
                const body = await res.text().catch(() => res.statusText);
                throw new Error(`Tatum API error ${res.status}: ${body}`);
        }
        return res.json();
}

async function _evmBalance(network, address) {
        const data = await fetchTatum(`/${network}/account/balance/${address}`);
        return { balance: data.balance ?? '0', raw: data };
}

async function _utxoBalance(network, address) {
        const data = await fetchTatum(`/${network}/address/balance/${address}`);
        const bal = (parseFloat(data.incoming || 0) - parseFloat(data.outgoing || 0));
        return {
                balance: bal.toFixed(8),
                incoming: data.incoming,
                outgoing: data.outgoing,
                pendingIn: data.incomingPending,
                pendingOut: data.outgoingPending,
                raw: data,
        };
}

async function _evmTransactions(network, address, pageSize) {
        const data = await fetchTatum(`/${network}/account/transaction/${address}?pageSize=${pageSize}`);
        return (Array.isArray(data) ? data : []).map(tx => ({
                hash: tx.transactionHash || tx.hash,
                from: tx.from,
                to: tx.to,
                value: tx.value,
                status: tx.status,
                timestamp: tx.timestamp,
                gasUsed: tx.gasUsed,
                gasPrice: tx.gasPrice,
                type: 'evm',
        }));
}

async function _utxoTransactions(network, address, pageSize) {
        const data = await fetchTatum(`/${network}/transaction/address/${address}?pageSize=${pageSize}`);
        return (Array.isArray(data) ? data : []).map(tx => ({
                hash: tx.hash,
                inputs: tx.inputs,
                outputs: tx.outputs,
                timestamp: tx.time ? tx.time * 1000 : null,
                blockNumber: tx.blockNumber,
                type: 'utxo',
        }));
}

async function _xrpBalance(address) {
        const data = await fetchTatum(`/xrp/account/${address}`);
        const drops = data?.account_data?.Balance;
        return { balance: drops != null ? (parseInt(drops) / 1e6).toString() : '0', raw: data };
}

async function _xrpTransactions(address, pageSize) {
        const data = await fetchTatum(`/xrp/account/tx/${address}`);
        const txs = data?.transactions ?? [];
        return txs.slice(0, pageSize).map(t => ({
                hash: t.tx?.hash,
                from: t.tx?.Account,
                to: t.tx?.Destination,
                value: t.tx?.Amount,
                timestamp: t.tx?.date ? (t.tx.date + 946684800) * 1000 : null,
                type: 'xrp',
        }));
}

async function _xlmBalance(address) {
        const data = await fetchTatum(`/xlm/account/${address}`);
        const native = data?.balances?.find(b => b.asset_type === 'native');
        return { balance: native?.balance ?? '0', raw: data };
}

async function _xlmTransactions(address, pageSize) {
        const data = await fetchTatum(`/xlm/account/tx/${address}`);
        const txs = Array.isArray(data) ? data : (data?._embedded?.records ?? []);
        return txs.slice(0, pageSize).map(t => ({
                hash: t.id || t.hash,
                timestamp: t.created_at ? new Date(t.created_at).getTime() : null,
                type: 'xlm',
        }));
}

async function _tronBalance(address) {
        const data = await fetchTatum(`/tron/account/${address}`);
        const balance = data?.balance != null ? (data.balance / 1e6).toString() : '0';
        return { balance, raw: data };
}

async function _tronTransactions(address, pageSize) {
        const data = await fetchTatum(`/tron/transaction/account/${address}?pageSize=${pageSize}`);
        const txs = Array.isArray(data) ? data : (data?.transactions ?? []);
        return txs.slice(0, pageSize).map(tx => ({
                hash: tx.txID || tx.hash,
                from: tx.raw_data?.contract?.[0]?.parameter?.value?.owner_address,
                to: tx.raw_data?.contract?.[0]?.parameter?.value?.to_address,
                value: tx.raw_data?.contract?.[0]?.parameter?.value?.amount,
                timestamp: tx.raw_data?.timestamp ?? null,
                type: 'tron',
        }));
}

async function _solanaBalance(address) {
        const data = await fetchTatum(`/solana/account/balance/${address}`);
        return { balance: data?.balance != null ? data.balance.toString() : '0', raw: data };
}

async function _solanaTransactions(address, pageSize) {
        const data = await fetchTatum(`/solana/account/transaction/${address}?pageSize=${pageSize}`);
        const txs = Array.isArray(data) ? data : [];
        return txs.slice(0, pageSize).map(tx => ({
                hash: tx.transaction?.signatures?.[0] ?? tx.signature,
                timestamp: tx.blockTime ? tx.blockTime * 1000 : null,
                status: tx.meta?.err === null,
                type: 'solana',
        }));
}

async function _algorandBalance(address) {
        const data = await fetchTatum(`/algorand/account/${address}`);
        const balance = data?.amount != null ? (data.amount / 1e6).toString() : '0';
        return { balance, raw: data };
}

async function _adaBalance(address) {
        const data = await fetchTatum(`/ada/account/${address}`);
        const balance = data?.balance != null ? (parseInt(data.balance) / 1e6).toString() : '0';
        return { balance, raw: data };
}

async function _tezosBalance(address) {
        const data = await fetchTatum(`/tezos/account/${address}`);
        const balance = data?.balance != null ? (data.balance / 1e6).toString() : '0';
        return { balance, raw: data };
}

async function _nearBalance(address) {
        const data = await fetchTatum(`/near/account/balance/${address}`);
        return { balance: data?.balance ?? '0', raw: data };
}

async function _hbarBalance(address) {
        const data = await fetchTatum(`/hbar/account/${address}`);
        const balance = data?.balance?.balance != null ? (data.balance.balance / 1e8).toString() : '0';
        return { balance, raw: data };
}

/**
 * Fetch the native balance for a given chain + address.
 * @param {{ tatumNetwork: string, addressType: string }} chainCfg
 * @param {string} address
 * @returns {Promise<{ balance: string, raw?: any, incoming?: string, outgoing?: string }>}
 */
export async function getBalance(chainCfg, address) {
        if (!chainCfg.tatumNetwork) throw new Error(`${chainCfg.symbol} is not supported via Tatum.`);
        const n = chainCfg.tatumNetwork;

        switch (chainCfg.addressType) {
                case 'evm':       return _evmBalance(n, address);
                case 'utxo':      return _utxoBalance(n, address);
                case 'xrp':       return _xrpBalance(address);
                case 'xlm':       return _xlmBalance(address);
                case 'tron':      return _tronBalance(address);
                case 'solana':    return _solanaBalance(address);
                case 'algorand':  return _algorandBalance(address);
                case 'ada':       return _adaBalance(address);
                case 'tezos':     return _tezosBalance(address);
                case 'near':      return _nearBalance(address);
                case 'hbar':      return _hbarBalance(address);
                default:          throw new Error(`Address type "${chainCfg.addressType}" not yet implemented.`);
        }
}

/**
 * Fetch recent transactions for a given chain + address.
 * @param {{ tatumNetwork: string, addressType: string }} chainCfg
 * @param {string} address
 * @param {number} [pageSize=5]
 * @returns {Promise<Array>}
 */
export async function getTransactions(chainCfg, address, pageSize = 5) {
        if (!chainCfg.tatumNetwork) return [];
        const n = chainCfg.tatumNetwork;

        switch (chainCfg.addressType) {
                case 'evm':    return _evmTransactions(n, address, pageSize);
                case 'utxo':   return _utxoTransactions(n, address, pageSize);
                case 'xrp':    return _xrpTransactions(address, pageSize);
                case 'xlm':    return _xlmTransactions(address, pageSize);
                case 'tron':   return _tronTransactions(address, pageSize);
                case 'solana': return _solanaTransactions(address, pageSize);
                default:       return [];
        }
}
