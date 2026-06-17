import fs from 'fs';

const TOKEN = 'MTUxNjg1ODI3MjgxNDk5MzQ2OQ.Gja-2E.Hvm_vyXZmkji4ZdksiLSIif05TQ4Atj39UjTXI';
const CLIENT_ID = '1516858272814993469';
const DISCORD_API = 'https://discord.com/api/v10';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const UNSUPPORTED = new Set([
    'coin_tia', 'coin_cfx', 'coin_atom', 'coin_dcr', 'coin_figr_heloc',
    'coin_fil', 'coin_hype', 'coin_icp', 'coin_iota', 'coin_kas',
    'coin_pi', 'coin_qnt', 'coin_vet', 'coin_ylds',
    'coin_bsv', 'coin_tao', 'coin_stx', 'coin_cc', 'coin_lunc',
    'coin_theta', 'coin_xdc', 'coin_neo', 'coin_hash', 'coin_mon', 'coin_xpl',
]);

const main = async () => {
    const res = await fetch(`${DISCORD_API}/applications/${CLIENT_ID}/emojis`, {
        headers: { Authorization: `Bot ${TOKEN}` },
    });
    const data = await res.json();
    const emojis = data.items || [];
    console.log(`Total emojis: ${emojis.length}`);

    const toDelete = emojis.filter((e) => UNSUPPORTED.has(e.name));
    const toKeep = emojis.filter((e) => !UNSUPPORTED.has(e.name));

    console.log(`To delete: ${toDelete.length}`);
    console.log(`To keep: ${toKeep.length}\n`);

    for (const emoji of toDelete) {
        process.stdout.write(`Deleting :${emoji.name}: (${emoji.id}) ... `);
        const r = await fetch(`${DISCORD_API}/applications/${CLIENT_ID}/emojis/${emoji.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bot ${TOKEN}` },
        });
        if (r.status === 204) console.log('OK');
        else console.log(`FAIL ${r.status}`);
        await sleep(300);
    }

    const lines = toKeep
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((e) => `${e.name} | <:${e.name}:${e.id}>`);

    fs.writeFileSync('./scripts/supported-coins.txt', lines.join('\n') + '\n');
    console.log(`\nDone. ${toKeep.length} supported coin emojis saved to scripts/supported-coins.txt`);
};

main().catch((e) => { console.error(e); process.exit(1); });
