import * as Blockly from 'blockly';

export const vmGenerator = new Blockly.Generator('DSL');

// ─────────────────────────────
// PRECEDENCE
// ─────────────────────────────
vmGenerator.ORDER_ATOMIC = 0;
vmGenerator.ORDER_NONE = 99;

// ─────────────────────────────
// HELPERS
// ─────────────────────────────
const val = (block, name, fallback = '0') => {
    let v = vmGenerator.valueToCode(block, name, vmGenerator.ORDER_NONE);

    if (v === null || v === undefined) return fallback;
    if (Array.isArray(v)) v = v[0];
    if (typeof v !== 'string') v = String(v);
    if (!v || v === 'null') return fallback;

    return v;
};

const getVarName = (block, field = 'VAR') => {
    const varId = block.getFieldValue(field);
    const varModel = block.workspace.getVariableMap().getVariableById(varId);
    const rawName = varModel ? varModel.name : varId;

    return `VAR_${rawName}`;
};

// ensures no empty {}
const ensureBody = (code) => {
    if (!code || !code.trim()) {
        return '    stop;\n';
    }
    return code;
};

// ─────────────────────────────
// VARIABLE TRACKING (for declarations)
// ─────────────────────────────
let declaredVars = new Set();

const registerVar = (name) => {
    declaredVars.add(name);
};

// ─────────────────────────────
// CURRENCY
// ─────────────────────────────
vmGenerator.forBlock['currency_literal'] = (block) => {
    const c = block.getFieldValue('CURRENCY');
    return [`'${c}'`, vmGenerator.ORDER_ATOMIC];
};

// ─────────────────────────────
// NUMBERS
// ─────────────────────────────
vmGenerator.forBlock['num_literal'] = (block) => {
    return [block.getFieldValue('VALUE'), vmGenerator.ORDER_ATOMIC];
};

vmGenerator.forBlock['num_arithmetic'] = (block) => {
    const left = val(block, 'LEFT');
    const right = val(block, 'RIGHT');

    const ops = {
        ADD: '+',
        SUBTRACT: '-',
        MULTIPLY: '*',
        DIVIDE: '/',
        MOD: '%',
        DIV: '//'
    };

    return [`(${left} ${ops[block.getFieldValue('OP')]} ${right})`, vmGenerator.ORDER_NONE];
};

// ─────────────────────────────
// BOOLEAN
// ─────────────────────────────
vmGenerator.forBlock['bool_compare'] = (block) => {
    const left = val(block, 'LEFT');
    const right = val(block, 'RIGHT');

    const ops = {
        GT: '>',
        LT: '<',
        GTE: '>=',
        LTE: '<=',
        EQ: '==',
        NEQ: '!='
    };

    return [`(${left} ${ops[block.getFieldValue('OP')]} ${right})`, vmGenerator.ORDER_NONE];
};

vmGenerator.forBlock['bool_logic'] = (block) => {
    const left = val(block, 'LEFT');
    const right = val(block, 'RIGHT');
    const op = block.getFieldValue('OP') === 'AND' ? 'and' : 'or';

    return [`(${left} ${op} ${right})`, vmGenerator.ORDER_NONE];
};

vmGenerator.forBlock['bool_not'] = (block) => {
    return [`(not ${val(block, 'VALUE')})`, vmGenerator.ORDER_NONE];
};

// ─────────────────────────────
// VARIABLES (Blockly native)
// ─────────────────────────────
vmGenerator.forBlock['variables_get'] = (block) => {
    const name = getVarName(block);
    registerVar(name);
    return [name, vmGenerator.ORDER_ATOMIC];
};

vmGenerator.forBlock['variables_set'] = (block) => {
    const name = getVarName(block);
    registerVar(name);
    return `${name} := ${val(block, 'VALUE', '0')};\n`;
};

// ─────────────────────────────
// CONTROL FLOW
// ─────────────────────────────

vmGenerator.forBlock['ctrl_on_start'] = (block) => {
    const body = ensureBody(vmGenerator.statementToCode(block, 'BODY'));
    return `start {\n${body}}\n`;
};

vmGenerator.forBlock['ctrl_if'] = (block) => {
    const condition = val(block, 'CONDITION');
    const body = ensureBody(vmGenerator.statementToCode(block, 'THEN'));

    return `if (${condition}) {\n${body}}\n`;
};

vmGenerator.forBlock['ctrl_if_else'] = (block) => {
    const condition = val(block, 'CONDITION');
    const thenBody = ensureBody(vmGenerator.statementToCode(block, 'THEN'));
    const elseBody = ensureBody(vmGenerator.statementToCode(block, 'ELSE'));

    return `if (${condition}) {\n${thenBody}} else {\n${elseBody}}\n`;
};

vmGenerator.forBlock['ctrl_repeat'] = (block) => {
    const times = val(block, 'TIMES', '1');
    const body = ensureBody(vmGenerator.statementToCode(block, 'BODY'));

    return `repeat ${times} {\n${body}}\n`;
};

vmGenerator.forBlock['ctrl_while'] = (block) => {
    const condition = val(block, 'CONDITION');
    const body = ensureBody(vmGenerator.statementToCode(block, 'BODY'));

    return `while ${condition} {\n${body}}\n`;
};

vmGenerator.forBlock['ctrl_until'] = (block) => {
    const condition = val(block, 'CONDITION');
    const body = ensureBody(vmGenerator.statementToCode(block, 'BODY'));

    return `while not ${condition} {\n${body}}\n`;
};

vmGenerator.forBlock['ctrl_forever'] = (block) => {
    const body = ensureBody(vmGenerator.statementToCode(block, 'BODY'));

    return `forever {\n${body}}\n`;
};

vmGenerator.forBlock['ctrl_foreach_currency'] = (block) => {
    const name = getVarName(block); // ✅ FIX

    const body = ensureBody(vmGenerator.statementToCode(block, 'BODY'));

    return `foreach ${name} {\n${body}}\n`;
};

vmGenerator.forBlock['ctrl_wait'] = (block) => {
    return `time.wait(${val(block, 'DURATION', '1')});\n`;
};

vmGenerator.forBlock['ctrl_stop'] = () => {
    return `stop;\n`;
};

// ─────────────────────────────
// TRADE
// ─────────────────────────────
vmGenerator.forBlock['trade_get_price'] = (block) => {
    return [val(block, 'CURRENCY'), vmGenerator.ORDER_ATOMIC];
};

vmGenerator.forBlock['trade_get_price_ago'] = (block) => {
    const currency = val(block, 'CURRENCY');
    const amount = val(block, 'AMOUNT');
    const unit = block.getFieldValue('UNIT');

    const secondsMap = {
        'SECONDS': 1,
        'MINUTES': 60,
        'HOURS': 3600,
        'DAYS': 86400,
        'WEEKS': 604800
    };

    const seconds = secondsMap[unit];

    return [
        `trade.get_price(${currency}, ${amount} * ${seconds})`,
        vmGenerator.ORDER_ATOMIC
    ];
};


vmGenerator.forBlock['trade_buy'] = (block) => {
    const currency = val(block, 'CURRENCY');
    const amount = val(block, 'AMOUNT');

    return `user.buy(${currency}, ${amount});\n`;
};

vmGenerator.forBlock['trade_sell'] = (block) => {
    const currency = val(block, 'CURRENCY');
    const amount = val(block, 'AMOUNT');

    return `user.sell(${currency}, ${amount});\n`;
};

vmGenerator.forBlock['trade_amount_owned'] = (block) => {
    const currency = val(block, 'CURRENCY');

    return [`user.amount_owned(${currency})`, vmGenerator.ORDER_ATOMIC];
};

vmGenerator.forBlock['trade_virtual_balance'] = () => {
    return ['user.get_balance()', vmGenerator.ORDER_ATOMIC];
};

// ─────────────────────────────
// FUNCTIONS
// ─────────────────────────────
vmGenerator.forBlock['func_define'] = (block) => {
    const name = `FUNC_${block.getFieldValue('NAME')}`;
    const body = ensureBody(vmGenerator.statementToCode(block, 'BODY'));

    return `fn ${name}() {\n${body}}\n`;
};

vmGenerator.forBlock['func_call'] = (block) => {
    const name = `FUNC_${block.getFieldValue('NAME')}`;
    return `${name}();\n`;
};

// ─────────────────────────────
// EXPORT
// ─────────────────────────────
export const getCode = (workspace) => {
    declaredVars.clear();

    const code = vmGenerator.workspaceToCode(workspace);

    // generate declarations at top
    let declarations = '';
    declaredVars.forEach(v => {
        declarations += `var ${v} number;\n`;
    });

    return declarations + '\n' + code;
};
