const COINGECKO_IDS = {
        btc:  'bitcoin',
        eth:  'ethereum',
        ltc:  'litecoin',
        bch:  'bitcoin-cash',
        doge: 'dogecoin',
        zec:  'zcash',
        dash: 'dash',
        xrp:  'ripple',
        xlm:  'stellar',
        trx:  'tron',
        sol:  'solana',
        bnb:  'binancecoin',
        pol:  'matic-network',
        avax: 'avalanche-2',
        algo: 'algorand',
        ada:  'cardano',
        xtz:  'tezos',
        xmr:  'monero',
        dot:  'polkadot',
        near: 'near',
        flr:  'flare-networks',
        kaia: 'kaia',
        cro:  'crypto-com-chain',
        arb:  'arbitrum',
        op:   'optimism',
        inj:  'injective-protocol',
        sui:  'sui',
        apt:  'aptos',
        sei:  'sei-network',
        mnt:  'mantle',
        hbar: 'hedera-hashgraph',
        kcs:  'kucoin-shares',
};

const CACHE_TTL = 5 * 60 * 1000;
const priceCache = new Map();

export async function getPrice(chainKey) {
        const id = COINGECKO_IDS[chainKey];
        if (!id) return { price: 0, change24h: 0 };

        const cached = priceCache.get(id);
        if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

        try {
                const res = await fetch(
                        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
                        { signal: AbortSignal.timeout(8000) }
                );
                if (!res.ok) return { price: 0, change24h: 0 };
                const json = await res.json();
                const coin = json[id];
                const data = {
                        price:    coin?.usd           ?? 0,
                        change24h: coin?.usd_24h_change ?? 0,
                };
                priceCache.set(id, { ts: Date.now(), data });
                return data;
        } catch {
                return { price: 0, change24h: 0 };
        }
}
