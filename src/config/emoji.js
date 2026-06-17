export const emoji = {
        check:     '✅',
        cross:     '❌',
        info:      'ℹ️',
        code:      '💻',
        activity:  '📊',
        settings:  '⚙️',
        warn:      '⚠️',

        arrowup:   '<:arrowup:1516872751556722789>',
        arrowdown: '<:arrowdown:1516872424371650591>',
        minus:     '<:minus:1516872427483959327>',

        get(name, fallback = '') {
                return this[name] || fallback;
        },
};

export default emoji;
