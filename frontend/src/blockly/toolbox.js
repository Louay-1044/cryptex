// Blockly toolbox configuration
// Defines all categories and blocks shown in the sidebar

export const toolbox = {
    kind: 'categoryToolbox',
    contents: [

        // ── MATH ──────────────────────────────────────────────────────────────
        {
            kind: 'category',
            name: 'Math',
            colour: '#E8A838',
            contents: [
                { kind: 'block', type: 'num_literal' },
                { kind: 'block', type: 'num_arithmetic' },
                { kind: 'block', type: 'num_math_function' },
                { kind: 'block', type: 'num_random' },
                { kind: 'block', type: 'num_round' },
            ],
        },

        // ── LOGIC ─────────────────────────────────────────────────────────────
        {
            kind: 'category',
            name: 'Logic',
            colour: '#5B8CFF',
            contents: [
                { kind: 'block', type: 'bool_compare' },
                { kind: 'block', type: 'bool_logic' },
                { kind: 'block', type: 'bool_not' },
            ],
        },

        // ── VARIABLES ─────────────────────────────────────────────────────────
        {
            kind: 'category',
            name: 'Variables',
            colour: '#3DBE7A',
            custom: 'VARIABLE',
        },

        // ── CONTROL FLOW ──────────────────────────────────────────────────────
        {
            kind: 'category',
            name: 'Control',
            colour: '#E85454',
            contents: [
                { kind: 'block', type: 'ctrl_on_start' },
                { kind: 'block', type: 'ctrl_stop' },
                { kind: 'block', type: 'ctrl_repeat' },
                { kind: 'block', type: 'ctrl_while' },
                { kind: 'block', type: 'ctrl_until' },
                { kind: 'block', type: 'ctrl_forever' },
                { kind: 'block', type: 'ctrl_foreach_currency' },
                { kind: 'block', type: 'ctrl_wait' },
                { kind: 'block', type: 'ctrl_if' },
                { kind: 'block', type: 'ctrl_if_else' },
            ],
        },

        // ── TRADE FLOW ────────────────────────────────────────────────────────
        {
            kind: 'category',
            name: 'Trade',
            colour: '#20C4C4',
            contents: [
                { kind: "block", type: "currency_literal" },
                { kind: 'block', type: 'trade_get_price' },
                { kind: 'block', type: 'trade_get_price_ago' },
                { kind: 'block', type: 'trade_buy' },
                { kind: 'block', type: 'trade_sell' },
                { kind: 'block', type: 'trade_amount_owned' },
                { kind: 'block', type: 'trade_virtual_balance' },
            ],
        },

        // ── FUNCTIONS ─────────────────────────────────────────────────────────
        {
            kind: 'category',
            name: 'Functions',
            colour: '#FF6B9D',
            contents: [
                { kind: 'block', type: 'func_define' },
                { kind: 'block', type: 'func_call' },
            ],
        },
    ],
};