import fs from 'fs';

const TOKEN = 'MTUxNjg1ODI3MjgxNDk5MzQ2OQ.Gja-2E.Hvm_vyXZmkji4ZdksiLSIif05TQ4Atj39UjTXI';
const CLIENT_ID = '1516858272814993469';
const DISCORD_API = 'https://discord.com/api/v10';
const RESULTS_FILE = './scripts/emoji-upload-results.json';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cleanEmojiName = (symbol) => {
        const cleaned = symbol
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');
        const name = `coin_${cleaned}`;
        return name.slice(0, 32);
};

const fetchCoins = async () => {
        console.log('Fetching top 200 coins from CoinGecko...');
        const res = await fetch(
                'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false',
                { headers: { Accept: 'application/json' } },
        );
        if (!res.ok) throw new Error(`CoinGecko error: ${res.status} ${await res.text()}`);
        const coins = await res.json();
        console.log(`Got ${coins.length} coins.`);
        return coins;
};

const downloadImageAsBase64 = async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = res.headers.get('content-type') || 'image/png';
        return `data:${contentType};base64,${base64}`;
};

const uploadEmoji = async (name, imageDataUri) => {
        const res = await fetch(`${DISCORD_API}/applications/${CLIENT_ID}/emojis`, {
                method: 'POST',
                headers: {
                        Authorization: `Bot ${TOKEN}`,
                        'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, image: imageDataUri }),
        });

        if (res.status === 429) {
                const data = await res.json();
                const retryAfter = (data.retry_after || 5) * 1000;
                console.log(`  Rate limited. Waiting ${retryAfter}ms...`);
                await sleep(retryAfter + 500);
                return uploadEmoji(name, imageDataUri);
        }

        const data = await res.json();
        if (!res.ok) throw new Error(`Discord error ${res.status}: ${JSON.stringify(data)}`);
        return data;
};

const getExistingEmojis = async () => {
        const res = await fetch(`${DISCORD_API}/applications/${CLIENT_ID}/emojis`, {
                headers: { Authorization: `Bot ${TOKEN}` },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.items || []).map((e) => e.name);
};

const main = async () => {
        const coins = await fetchCoins();
        const existingNames = await getExistingEmojis();
        console.log(`Already uploaded emojis: ${existingNames.length}`);

        const results = { success: [], failed: [], skipped: [] };

        for (let i = 0; i < coins.length; i++) {
                const coin = coins[i];
                const emojiName = cleanEmojiName(coin.symbol);
                const label = `[${i + 1}/200] ${coin.name} (${coin.symbol.toUpperCase()}) → :${emojiName}:`;

                if (existingNames.includes(emojiName)) {
                        console.log(`  SKIP ${label} (already exists)`);
                        results.skipped.push({ name: coin.name, symbol: coin.symbol, emojiName });
                        continue;
                }

                try {
                        process.stdout.write(`  UP   ${label} ... `);
                        const imageDataUri = await downloadImageAsBase64(coin.image);
                        const emoji = await uploadEmoji(emojiName, imageDataUri);
                        console.log(`OK (id: ${emoji.id})`);
                        results.success.push({ name: coin.name, symbol: coin.symbol, emojiName, id: emoji.id });
                } catch (err) {
                        console.log(`FAIL — ${err.message}`);
                        results.failed.push({ name: coin.name, symbol: coin.symbol, emojiName, error: err.message });
                }

                await sleep(300);
        }

        fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

        console.log('\n=== DONE ===');
        console.log(`✅ Success : ${results.success.length}`);
        console.log(`⏭  Skipped : ${results.skipped.length}`);
        console.log(`❌ Failed  : ${results.failed.length}`);
        if (results.failed.length > 0) {
                console.log('\nFailed coins:');
                results.failed.forEach((f) => console.log(`  ${f.name} (${f.symbol}): ${f.error}`));
        }
        console.log(`\nResults saved to ${RESULTS_FILE}`);
};

main().catch((err) => {
        console.error('Fatal error:', err);
        process.exit(1);
});
