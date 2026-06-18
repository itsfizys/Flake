export const emoji = {
        check:     '✅',
        cross:     '❌',
        info:      'ℹ️',
        code:      '💻',
        activity:  '📊',
        settings:  '⚙️',
        warn:      '⚠️',

        upi:       '<:upi1:1517045940610138225><:upi2:1517045942983983104><:upi3:1517045944720556113>',

        arrowup:   '<:arrowup:1516882251026010234>',
        arrowdown: '<:arrowdown:1516872424371650591>',
        plus:      '<:plus:1516882253039403320>',
        minus:     '<:minus:1516872427483959327>',

        get(name, fallback = '') {
                return this[name] || fallback;
        },
};

export default emoji;
