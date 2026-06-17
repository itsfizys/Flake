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

// ─── Transaction by hash ────────────────────────────────────────────────────

async function _evmTransaction(network, hash) {
        const tx = await fetchTatum(`/${network}/transaction/${hash}`);
        const gasUsed  = BigInt(tx.gasUsed  || tx.gas || 0);
        const gasPrice = BigInt(tx.gasPrice || tx.effectiveGasPrice || 0);
        const feeWei   = (gasUsed * gasPrice).toString();
        let status = 'Pending';
        if (tx.status === '0x1' || tx.status === true  || tx.status === 1) status = 'Confirmed';
        if (tx.status === '0x0' || tx.status === false || tx.status === 0) status = 'Failed';
        return {
                hash:      tx.hash || tx.transactionHash || hash,
                from:      tx.from  || null,
                to:        tx.to    || null,
                amount:    tx.value || '0',
                fee:       feeWei,
                status,
                timestamp: tx.timestamp ? Number(tx.timestamp) : null,
                type:      'evm',
        };
}

async function _utxoTransaction(network, hash) {
        const tx = await fetchTatum(`/${network}/transaction/${hash}`);
        const from = tx.inputs?.[0]?.coin?.address ?? null;
        const to   = tx.outputs?.[0]?.address ?? null;
        const totalOut = (tx.outputs || []).reduce((s, o) => s + parseFloat(o.value || 0), 0);
        const status   = tx.blockNumber != null ? 'Confirmed' : 'Pending';
        return {
                hash:      tx.hash || hash,
                from,
                to,
                amount:    totalOut.toString(),
                fee:       tx.fee ?? null,
                status,
                timestamp: tx.time ?? null,
                type:      'utxo',
        };
}

async function _xrpTransaction(hash) {
        const tx = await fetchTatum(`/xrp/transaction/${hash}`);
        const result = tx.meta?.TransactionResult ?? '';
        const status = result === 'tesSUCCESS' ? 'Confirmed' : result ? 'Failed' : 'Pending';
        const tsRaw  = tx.date != null ? tx.date + 946684800 : null;
        return {
                hash:      tx.hash || hash,
                from:      tx.Account      || null,
                to:        tx.Destination  || null,
                amount:    tx.Amount != null ? (parseInt(tx.Amount) / 1e6).toString() : '0',
                fee:       tx.Fee    != null ? (parseInt(tx.Fee)    / 1e6).toString() : null,
                status,
                timestamp: tsRaw,
                type:      'xrp',
        };
}

async function _tronTransaction(hash) {
        const tx = await fetchTatum(`/tron/transaction/${hash}`);
        const contract  = tx.raw_data?.contract?.[0]?.parameter?.value ?? {};
        const ret       = tx.ret?.[0]?.contractRet ?? '';
        const status    = ret === 'SUCCESS' ? 'Confirmed' : ret ? 'Failed' : 'Pending';
        const tsMs      = tx.raw_data?.timestamp ?? null;
        return {
                hash:      tx.txID || hash,
                from:      contract.owner_address || null,
                to:        contract.to_address    || null,
                amount:    contract.amount != null ? (contract.amount / 1e6).toString() : '0',
                fee:       null,
                status,
                timestamp: tsMs != null ? Math.floor(tsMs / 1000) : null,
                type:      'tron',
        };
}

async function _solanaTransaction(hash) {
        const tx = await fetchTatum(`/solana/transaction/${hash}`);
        const keys  = tx.transaction?.message?.accountKeys ?? [];
        const meta  = tx.meta ?? {};
        const fee   = meta.fee != null ? (meta.fee / 1e9).toString() : null;
        const status = meta.err === null ? 'Confirmed' : meta.err != null ? 'Failed' : 'Pending';
        // Derive amount from balance delta of first non-fee-payer account
        let amount = '0';
        if (meta.preBalances && meta.postBalances && meta.preBalances.length > 1) {
                const delta = Math.abs(meta.postBalances[1] - meta.preBalances[1]);
                amount = (delta / 1e9).toString();
        }
        return {
                hash:      tx.transaction?.signatures?.[0] ?? hash,
                from:      keys[0] ?? null,
                to:        keys[1] ?? null,
                amount,
                fee,
                status,
                timestamp: tx.blockTime ?? null,
                type:      'solana',
        };
}

/**
 * Fetch a single transaction by hash for a given chain.
 * Returns a normalised object: { hash, from, to, amount, fee, status, timestamp, type }
 * - amount / fee are decimal strings in the chain's native unit
 * - timestamp is unix seconds (or null)
 */
export async function getTransaction(chainCfg, hash) {
        if (!chainCfg.tatumNetwork) throw new Error(`${chainCfg.symbol} not supported.`);
        const n = chainCfg.tatumNetwork;
        switch (chainCfg.addressType) {
                case 'evm':    return _evmTransaction(n, hash);
                case 'utxo':   return _utxoTransaction(n, hash);
                case 'xrp':    return _xrpTransaction(hash);
                case 'tron':   return _tronTransaction(hash);
                case 'solana': return _solanaTransaction(hash);
                default: throw new Error(`Transaction lookup not supported for ${chainCfg.symbol}`);
        }
}

// ─── Balance ─────────────────────────────────────────────────────────────────

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
