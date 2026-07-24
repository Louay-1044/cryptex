import * as Blockly from 'blockly';

// ─── COLOUR PALETTE ───────────────────────────────────────────────────────────
const COLOURS = {
  numerical: '#E8A838',
  boolean:   '#5B8CFF',
  crypto:    '#A259FF',
  variable:  '#3DBE7A',
  control:   '#E85454',
  trade:     '#20C4C4',
  function:  '#FF6B9D',
};

// ─── CURRENCY LOADING ─────────────────────────────────────────────────────────
let CURRENCY_OPTIONS = [['Loading...', 'LOADING']];
let currenciesLoaded = false;

// API base URL - adjust to match your backend
const API_BASE = 'http://localhost:8000';

// Function to update all currency dropdown blocks with fresh data
function updateCurrencyDropdowns() {
  // Find all blocks that have a currency dropdown and update them
  const workspace = Blockly.getMainWorkspace();
  if (!workspace) return;
  
  const allBlocks = workspace.getAllBlocks();
  allBlocks.forEach(block => {
    if (block.getField('CURRENCY')) {
      const currentValue = block.getFieldValue('CURRENCY');
      // Update the dropdown options
      block.getField('CURRENCY').setOptions(CURRENCY_OPTIONS);
      // If current value is invalid, reset to first valid option
      if (currentValue === 'LOADING' || !CURRENCY_OPTIONS.some(opt => opt[1] === currentValue)) {
        if (CURRENCY_OPTIONS.length > 0 && CURRENCY_OPTIONS[0][1] !== 'LOADING') {
          block.setFieldValue(CURRENCY_OPTIONS[0][1], 'CURRENCY');
        }
      }
    }
  });
}

// Load currencies with proper error handling
export async function loadCurrencies() {
  try {
    console.log('Loading currencies from:', `${API_BASE}/api/currency/list/`);
    
    const response = await fetch(`${API_BASE}/api/currency/list/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Currency API response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Currencies received:', data);
    
    if (Array.isArray(data) && data.length > 0) {
      CURRENCY_OPTIONS = data.map(c => [`${c.name} (${c.ticker})`, c.ticker]);
      currenciesLoaded = true;
      console.log('Currencies loaded successfully:', CURRENCY_OPTIONS);
      
      // Update existing blocks with new options
      updateCurrencyDropdowns();
    } else {
      console.warn('No currencies found in API response');
      CURRENCY_OPTIONS = [['No currencies found', 'NONE']];
    }
  } catch (e) {
    console.error('Failed to load currencies:', e);
    // Provide fallback currencies for development/demo
    CURRENCY_OPTIONS = [
      ['Bitcoin (BTC)', 'BTC'],
      ['Ethereum (ETH)', 'ETH'],
      ['Cardano (ADA)', 'ADA'],
      ['Solana (SOL)', 'SOL'],
      ['Ripple (XRP)', 'XRP'],
    ];
    currenciesLoaded = true;
    console.log('Using fallback currencies:', CURRENCY_OPTIONS);
    updateCurrencyDropdowns();
  }
}

// Dynamic dropdown function that returns current options
const currencyDropdown = () => {
  // If still loading, trigger a load
  if (!currenciesLoaded && CURRENCY_OPTIONS[0]?.[1] === 'LOADING') {
    loadCurrencies().catch(console.error);
  }
  return CURRENCY_OPTIONS;
};

// Helper to refresh dropdowns (call this after workspace loads)
export function refreshCurrencyDropdowns() {
  if (currenciesLoaded) {
    updateCurrencyDropdowns();
  } else {
    loadCurrencies().then(() => updateCurrencyDropdowns());
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NUMERICAL EXPRESSION BLOCKS  (output: 'NUM')
// ═══════════════════════════════════════════════════════════════════════════════

Blockly.Blocks['num_literal'] = {
  init() {
    this.appendDummyInput()
      .appendField(new Blockly.FieldNumber(0, -Infinity, Infinity, 0.01), 'VALUE');
    this.setOutput(true, 'NUM');
    this.setColour(COLOURS.numerical);
    this.setTooltip('A number value.');
  }
};

Blockly.Blocks['num_arithmetic'] = {
  init() {
    this.appendValueInput('LEFT').setCheck('NUM');
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([
        ['+', 'ADD'], ['-', 'SUBTRACT'],
        ['×', 'MULTIPLY'], ['÷', 'DIVIDE'],
        ['mod', 'MOD'], ['div', 'DIV'],
      ]), 'OP');
    this.appendValueInput('RIGHT').setCheck('NUM');
    this.setInputsInline(true);
    this.setOutput(true, 'NUM');
    this.setColour(COLOURS.numerical);
    this.setTooltip('Arithmetic operation between two numbers.');
  }
};

Blockly.Blocks['num_math_function'] = {
  init() {
    this.appendValueInput('VALUE')
      .setCheck('NUM')
      .appendField(new Blockly.FieldDropdown([
        ['abs', 'ABS'], ['floor', 'FLOOR'], ['ceiling', 'CEILING'],
        ['sqrt', 'SQRT'], ['sin', 'SIN'], ['cos', 'COS'], ['tan', 'TAN'],
        ['asin', 'ASIN'], ['acos', 'ACOS'], ['atan', 'ATAN'], ['ln', 'LN'],
      ]), 'FUNC');
    this.setOutput(true, 'NUM');
    this.setColour(COLOURS.numerical);
    this.setTooltip('Apply a mathematical function to a number.');
  }
};

Blockly.Blocks['num_random'] = {
  init() {
    this.appendDummyInput().appendField('pick random from');
    this.appendValueInput('FROM').setCheck('NUM');
    this.appendDummyInput().appendField('to');
    this.appendValueInput('TO').setCheck('NUM');
    this.setInputsInline(true);
    this.setOutput(true, 'NUM');
    this.setColour(COLOURS.numerical);
    this.setTooltip('Pick a random number between two values.');
  }
};

Blockly.Blocks['num_round'] = {
  init() {
    this.appendValueInput('VALUE')
      .setCheck('NUM')
      .appendField('round');
    this.setOutput(true, 'NUM');
    this.setColour(COLOURS.numerical);
    this.setTooltip('Round a number to the nearest integer.');
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// BOOLEAN EXPRESSION BLOCKS  (output: 'BOOL')
// ═══════════════════════════════════════════════════════════════════════════════

Blockly.Blocks['bool_compare'] = {
  init() {
    this.appendValueInput('LEFT').setCheck('NUM');
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([
        ['>', 'GT'], ['<', 'LT'],
        ['≥', 'GTE'], ['≤', 'LTE'],
        ['=', 'EQ'], ['≠', 'NEQ'],
      ]), 'OP');
    this.appendValueInput('RIGHT').setCheck('NUM');
    this.setInputsInline(true);
    this.setOutput(true, 'BOOL');
    this.setColour(COLOURS.boolean);
    this.setTooltip('Compare two numbers.');
  }
};

Blockly.Blocks['bool_logic'] = {
  init() {
    this.appendValueInput('LEFT').setCheck('BOOL');
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([
        ['and', 'AND'],
        ['or',  'OR'],
      ]), 'OP');
    this.appendValueInput('RIGHT').setCheck('BOOL');
    this.setInputsInline(true);
    this.setOutput(true, 'BOOL');
    this.setColour(COLOURS.boolean);
    this.setTooltip('Combine two boolean expressions.');
  }
};

Blockly.Blocks['bool_not'] = {
  init() {
    this.appendValueInput('VALUE')
      .setCheck('BOOL')
      .appendField('not');
    this.setOutput(true, 'BOOL');
    this.setColour(COLOURS.boolean);
    this.setTooltip('Negate a boolean expression.');
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// VARIABLE BLOCKS
// ═══════════════════════════════════════════════════════════════════════════════

Blockly.Blocks['var_declare'] = {
  init() {
    this.appendDummyInput()
      .appendField('global var')
      .appendField(new Blockly.FieldVariable('myVar'), 'VAR');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.variable);
    this.setTooltip('Declare a global variable (default 0.0).');
  }
};

Blockly.Blocks['var_get'] = {
  init() {
    this.appendDummyInput()
      .appendField(new Blockly.FieldVariable('myVar'), 'VAR');
    this.setOutput(true, 'NUM');
    this.setColour(COLOURS.variable);
    this.setTooltip('Get the value of a variable.');
  }
};

Blockly.Blocks['var_set'] = {
  init() {
    this.appendValueInput('VALUE')
      .setCheck('NUM')
      .appendField('set')
      .appendField(new Blockly.FieldVariable('myVar'), 'VAR')
      .appendField('to');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.variable);
    this.setTooltip('Set the value of a variable.');
  }
};

Blockly.Blocks['var_increase'] = {
  init() {
    this.appendValueInput('VALUE')
      .setCheck('NUM')
      .appendField('increase')
      .appendField(new Blockly.FieldVariable('myVar'), 'VAR')
      .appendField('by');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.variable);
    this.setTooltip('Increase a variable by a value.');
  }
};

Blockly.Blocks['var_decrease'] = {
  init() {
    this.appendValueInput('VALUE')
      .setCheck('NUM')
      .appendField('decrease')
      .appendField(new Blockly.FieldVariable('myVar'), 'VAR')
      .appendField('by');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.variable);
    this.setTooltip('Decrease a variable by a value.');
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROL FLOW BLOCKS
// ═══════════════════════════════════════════════════════════════════════════════
Blockly.Blocks['ctrl_on_start'] = {
  init() {
    this.appendDummyInput().appendField('on start');
    this.appendStatementInput('BODY').setCheck(null);
    this.setNextStatement(false, null);
    this.setPreviousStatement(false, null);
    this.setColour(COLOURS.control);
    this.setTooltip('Entry point of the algorithm.');
  }
};

Blockly.Blocks['ctrl_stop'] = {
  init() {
    this.appendDummyInput().appendField('stop');
    this.setPreviousStatement(true, null);
    this.setNextStatement(false, null);
    this.setColour(COLOURS.control);
    this.setTooltip('Stop execution.');
  }
};

Blockly.Blocks['ctrl_repeat'] = {
  init() {
    this.appendValueInput('TIMES')
      .setCheck('NUM')
      .appendField('repeat');
    this.appendDummyInput().appendField('times');
    this.appendStatementInput('BODY').setCheck(null);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.control);
    this.setTooltip('Repeat a block of code N times.');
  }
};

Blockly.Blocks['ctrl_while'] = {
  init() {
    this.appendValueInput('CONDITION')
      .setCheck('BOOL')
      .appendField('repeat while');
    this.appendStatementInput('BODY').setCheck(null);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.control);
    this.setTooltip('Repeat while a condition is true.');
  }
};

Blockly.Blocks['ctrl_until'] = {
  init() {
    this.appendValueInput('CONDITION')
      .setCheck('BOOL')
      .appendField('repeat until');
    this.appendStatementInput('BODY').setCheck(null);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.control);
    this.setTooltip('Repeat until a condition is true.');
  }
};

Blockly.Blocks['ctrl_forever'] = {
  init() {
    this.appendDummyInput().appendField('repeat forever');
    this.appendStatementInput('BODY').setCheck(null);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.control);
    this.setTooltip('Repeat forever.');
  }
};

// Uses FieldVariable so the loop body can reference `currency` as a variable
Blockly.Blocks['ctrl_foreach_currency'] = {
  init() {
    this.appendDummyInput()
      .appendField('for all currencies as')
      .appendField(new Blockly.FieldVariable('currency'), 'VAR');
    this.appendStatementInput('BODY').setCheck(null);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.control);
    this.setTooltip('Iterate over all currencies.');
  }
};

Blockly.Blocks['ctrl_wait'] = {
  init() {
    this.appendValueInput('DURATION')
      .setCheck('NUM')
      .appendField('wait for');
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([
        ['seconds', 'SECONDS'], ['minutes', 'MINUTES'],
        ['hours',   'HOURS'],   ['days',    'DAYS'],
        ['weeks',   'WEEKS'],
      ]), 'UNIT');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.control);
    this.setTooltip('Wait for a duration.');
  }
};

Blockly.Blocks['ctrl_if'] = {
  init() {
    this.appendValueInput('CONDITION')
      .setCheck('BOOL')
      .appendField('if');
    this.appendDummyInput().appendField('then');
    this.appendStatementInput('THEN').setCheck(null);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.control);
    this.setTooltip('Execute if condition is true.');
  }
};

Blockly.Blocks['ctrl_if_else'] = {
  init() {
    this.appendValueInput('CONDITION')
      .setCheck('BOOL')
      .appendField('if');
    this.appendDummyInput().appendField('then');
    this.appendStatementInput('THEN').setCheck(null);
    this.appendDummyInput().appendField('else');
    this.appendStatementInput('ELSE').setCheck(null);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.control);
    this.setTooltip('Execute one branch or another based on condition.');
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CURRENCY VALUE BLOCK (NEW)
// ═══════════════════════════════════════════════════════════════════════════════

Blockly.Blocks['currency_literal'] = {
  init() {
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown(currencyDropdown), 'CURRENCY');
    this.setOutput(true, 'CURRENCY'); // typed output
    this.setColour(COLOURS.crypto);
    this.setTooltip('A currency value (e.g. BTC, ETH).');
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE FLOW BLOCKS (UPDATED — NO DROPDOWNS)
// ═══════════════════════════════════════════════════════════════════════════════

Blockly.Blocks['trade_get_price'] = {
  init() {
    this.appendValueInput('CURRENCY')
      .setCheck('CURRENCY')
      .appendField('price of');
    this.setOutput(true, 'NUM');
    this.setColour(COLOURS.trade);
    this.setTooltip('Get the current price of a currency.');
  }
};

Blockly.Blocks['trade_get_price_ago'] = {
  init() {
    this.appendValueInput('CURRENCY')
      .setCheck('CURRENCY')
      .appendField('price of');
    this.appendValueInput('AMOUNT').setCheck('NUM');
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([
        ['seconds', 'SECONDS'], ['minutes', 'MINUTES'],
        ['hours',   'HOURS'],   ['days',    'DAYS'],
        ['weeks',   'WEEKS'],
      ]), 'UNIT')
      .appendField('ago');
    this.setInputsInline(true);
    this.setOutput(true, 'NUM');
    this.setColour(COLOURS.trade);
    this.setTooltip('Get the price of a currency N time units ago.');
  }
};

Blockly.Blocks['trade_buy'] = {
  init() {
    this.appendValueInput('AMOUNT')
      .setCheck('NUM')
      .appendField('buy');
    this.appendValueInput('CURRENCY')
      .setCheck('CURRENCY')
      .appendField('of');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.trade);
    this.setTooltip('Buy an amount of a currency.');
  }
};

Blockly.Blocks['trade_sell'] = {
  init() {
    this.appendValueInput('AMOUNT')
      .setCheck('NUM')
      .appendField('sell');
    this.appendValueInput('CURRENCY')
      .setCheck('CURRENCY')
      .appendField('of');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.trade);
    this.setTooltip('Sell an amount of a currency.');
  }
};

Blockly.Blocks['trade_amount_owned'] = {
  init() {
    this.appendValueInput('CURRENCY')
      .setCheck('CURRENCY')
      .appendField('amount owned of');
    this.setOutput(true, 'NUM');
    this.setColour(COLOURS.trade);
    this.setTooltip('Get the amount of a currency you own.');
  }
};

Blockly.Blocks['trade_virtual_balance'] = {
  init() {
    this.appendDummyInput().appendField('virtual balance');
    this.setOutput(true, 'NUM');
    this.setColour(COLOURS.trade);
    this.setTooltip('Get your virtual currency balance.');
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION BLOCKS
// ═══════════════════════════════════════════════════════════════════════════════

Blockly.Blocks['func_define'] = {
  init() {
    this.appendDummyInput()
      .appendField('function')
      .appendField(new Blockly.FieldTextInput('myFunction'), 'NAME');
    this.appendStatementInput('BODY').setCheck(null);
    this.setPreviousStatement(false, null);
    this.setNextStatement(false, null);
    this.setColour(COLOURS.function);
    this.setTooltip('Define a reusable function.');
  }
};

Blockly.Blocks['func_call'] = {
  init() {
    this.appendDummyInput()
      .appendField('call')
      .appendField(new Blockly.FieldTextInput('myFunction'), 'NAME');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(COLOURS.function);
    this.setTooltip('Call a function by name.');
  }
};