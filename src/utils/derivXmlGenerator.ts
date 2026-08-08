import { DBotStrategy } from '../types/deriv';

/**
 * Generates a complete, valid Deriv DBot / Binary Bot (.xml) file
 * that can be directly imported into bot.deriv.com / app.deriv.com/bot / bot.binary.com.
 */
export function generateDerivBotXml(bot: DBotStrategy): string {
  const isXXYPattern = bot.id.includes('xxy') || bot.name.toLowerCase().includes('xxy');
  const symbol = bot.symbol || 'R_100';
  const initialStake = bot.initialStake || 10;
  const martingaleFactor = bot.martingaleFactor || 11.5;
  const takeProfit = bot.takeProfit || 50;
  const stopLoss = bot.stopLoss || 100;
  const prediction = bot.rules?.paramValue ?? 2;

  // Clean XML Header conforming to standard Blockly format recognized by DBot
  return `<?xml version="1.0" encoding="UTF-8"?>
<xml xmlns="http://www.w3.org/1999/xhtml" collection="false">
  <variables>
    <variable type="" id="var_initial_stake">Initial Stake</variable>
    <variable type="" id="var_stake">Stake</variable>
    <variable type="" id="var_martingale">Martingale Factor</variable>
    <variable type="" id="var_take_profit">Target Profit</variable>
    <variable type="" id="var_stop_loss">Stop Loss</variable>
    <variable type="" id="var_total_profit">Total Profit</variable>
    <variable type="" id="var_prediction">Prediction Digit</variable>
    <variable type="" id="var_xxy_ready">XXY Ready</variable>
  </variables>

  <!-- ========================================================== -->
  <!-- BLOCK 1: TRADE DEFINITION & INITIALIZATION                 -->
  <!-- ========================================================== -->
  <block type="trade" id="trade_main_definition" x="0" y="0">
    <field name="MARKET_LIST">synthetic_index</field>
    <field name="SUBMARKET_LIST">random_index</field>
    <field name="SYMBOL_LIST">${symbol}</field>
    <field name="TRADETYPECAT_LIST">digits</field>
    <field name="TRADETYPE_LIST">matchesdiffers</field>
    <field name="TYPE_LIST">DIGITDIFF</field>
    <field name="CANDLEINTERVAL_LIST">60</field>
    <field name="TIME_MACHINE_ENABLED">FALSE</field>
    <field name="RESTARTONERROR">TRUE</field>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="init_stake_val">
        <field name="VAR" id="var_initial_stake" variabletype="">Initial Stake</field>
        <value name="VALUE">
          <block type="math_number" id="num_init_stake">
            <field name="NUM">${initialStake}</field>
          </block>
        </value>
        <next>
          <block type="variables_set" id="init_current_stake">
            <field name="VAR" id="var_stake" variabletype="">Stake</field>
            <value name="VALUE">
              <block type="variables_get" id="get_init_stake">
                <field name="VAR" id="var_initial_stake" variabletype="">Initial Stake</field>
              </block>
            </value>
            <next>
              <block type="variables_set" id="init_martingale">
                <field name="VAR" id="var_martingale" variabletype="">Martingale Factor</field>
                <value name="VALUE">
                  <block type="math_number" id="num_martingale">
                    <field name="NUM">${martingaleFactor}</field>
                  </block>
                </value>
                <next>
                  <block type="variables_set" id="init_tp">
                    <field name="VAR" id="var_take_profit" variabletype="">Target Profit</field>
                    <value name="VALUE">
                      <block type="math_number" id="num_tp">
                        <field name="NUM">${takeProfit}</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="init_sl">
                        <field name="VAR" id="var_stop_loss" variabletype="">Stop Loss</field>
                        <value name="VALUE">
                          <block type="math_number" id="num_sl">
                            <field name="NUM">${stopLoss}</field>
                          </block>
                        </value>
                        <next>
                          <block type="variables_set" id="init_prediction">
                            <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
                            <value name="VALUE">
                              <block type="math_number" id="num_prediction">
                                <field name="NUM">${prediction}</field>
                              </block>
                            </value>
                            <next>
                              <block type="variables_set" id="init_xxy_ready">
                                <field name="VAR" id="var_xxy_ready" variabletype="">XXY Ready</field>
                                <value name="VALUE">
                                  <block type="logic_boolean" id="bool_xxy_init">
                                    <field name="BOOL">FALSE</field>
                                  </block>
                                </value>
                              </block>
                            </next>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="tradeOptions" id="trade_options_config">
        <field name="DURATIONTYPE_LIST">t</field>
        <field name="CURRENCY_LIST">USD</field>
        <value name="DURATION">
          <block type="math_number" id="duration_num">
            <field name="NUM">1</field>
          </block>
        </value>
        <value name="AMOUNT">
          <block type="variables_get" id="get_amount_var">
            <field name="VAR" id="var_stake" variabletype="">Stake</field>
          </block>
        </value>
        <value name="PREDICTION">
          <block type="variables_get" id="get_pred_var">
            <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
          </block>
        </value>
      </block>
    </statement>
  </block>

  <!-- ========================================================== -->
  <!-- BLOCK 2: BEFORE PURCHASE / ANALYSIS (XXY DIGIT PATTERN)   -->
  <!-- ========================================================== -->
  <block type="before_purchase" id="before_purchase_main" x="0" y="550">
    <statement name="BEFOREPURCHASE_STACK">
      ${
        isXXYPattern
          ? `<!-- XXY PATTERN STRATEGY: UPDATE PREDICTION DIGIT ON EVERY TICK AND PURCHASE DIGITDIFF(Y) ON FRESH XXY PATTERN -->
      <block type="variables_set" id="set_pred_current_tick_y">
        <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
        <value name="VALUE">
          <block type="lists_getIndex" id="get_last_y_every_tick">
            <mutation statement="false" at="true"></mutation>
            <field name="MODE">GET</field>
            <field name="WHERE">FROM_END</field>
            <value name="VALUE">
              <block type="lastDigitList" id="ld_list_always"></block>
            </value>
            <value name="AT">
              <block type="math_number" id="idx_1_y_always"><field name="NUM">1</field></block>
            </value>
          </block>
        </value>
        <next>
          <block type="controls_if" id="check_xxy_pattern">
            <value name="IF0">
              <block type="logic_operation" id="op_and_pattern" inline="true">
                <field name="OP">AND</field>
                <!-- Condition 1: 3rd last digit == 2nd last digit (X == X) -->
                <value name="A">
                  <block type="logic_compare" id="cmp_xx">
                    <field name="OP">EQ</field>
                    <value name="A">
                      <block type="lists_getIndex" id="get_digit_3">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_1"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_3"><field name="NUM">3</field></block>
                        </value>
                      </block>
                    </value>
                    <value name="B">
                      <block type="lists_getIndex" id="get_digit_2">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_2"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_2"><field name="NUM">2</field></block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
                <!-- Condition 2: 2nd last digit != last digit (X != Y) -->
                <value name="B">
                  <block type="logic_compare" id="cmp_xy">
                    <field name="OP">NEQ</field>
                    <value name="A">
                      <block type="lists_getIndex" id="get_digit_2_sub">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_3"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_2_b"><field name="NUM">2</field></block>
                        </value>
                      </block>
                    </value>
                    <value name="B">
                      <block type="lists_getIndex" id="get_digit_1">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_4"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_1"><field name="NUM">1</field></block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="variables_set" id="set_pred_y_on_match">
                <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
                <value name="VALUE">
                  <block type="lists_getIndex" id="get_unique_current_y">
                    <mutation statement="false" at="true"></mutation>
                    <field name="MODE">GET</field>
                    <field name="WHERE">FROM_END</field>
                    <value name="VALUE">
                      <block type="lastDigitList" id="ld_list_5"></block>
                    </value>
                    <value name="AT">
                      <block type="math_number" id="idx_1_y"><field name="NUM">1</field></block>
                    </value>
                  </block>
                </value>
                <next>
                  <block type="notify" id="notify_xxy_detected">
                    <field name="NOTIFICATION_TYPE">info</field>
                    <field name="NOTIFICATION_SOUND">silent</field>
                    <value name="MESSAGE">
                      <block type="text" id="txt_xxy_detected">
                        <field name="TEXT">🎯 XXY Pattern Detected [X, X, Y]! Prediction Digit set to current unique digit Y. Executing DIGITDIFF contract (Differ Y)...</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="clear_ready_before_buy">
                        <field name="VAR" id="var_xxy_ready" variabletype="">XXY Ready</field>
                        <value name="VALUE">
                          <block type="logic_boolean" id="bool_false_clear">
                            <field name="BOOL">FALSE</field>
                          </block>
                        </value>
                        <next>
                          <block type="purchase" id="buy_digitdiff_xxy">
                            <field name="PURCHASE_LIST">DIGITDIFF</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </next>
      </block>`
          : `<block type="purchase" id="purchase_default">
        <field name="PURCHASE_LIST">${bot.contractType || 'DIGITDIFF'}</field>
      </block>`
      }
    </statement>
  </block>

  <!-- ========================================================== -->
  <!-- BLOCK 3: DURING PURCHASE WATCHDOG                         -->
  <!-- ========================================================== -->
  <block type="during_purchase" id="during_purchase_main" x="0" y="950"></block>

  <!-- ========================================================== -->
  <!-- BLOCK 4: AFTER PURCHASE / MARTINGALE & RISK MANAGEMENT    -->
  <!-- ========================================================== -->
  <block type="after_purchase" id="after_purchase_main" x="0" y="1050">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="check_trade_result">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="contract_check_result" id="check_win">
            <field name="CHECK_RESULT">win</field>
          </block>
        </value>
        <statement name="DO0">
          <block type="notify" id="notify_win">
            <field name="NOTIFICATION_TYPE">success</field>
            <field name="NOTIFICATION_SOUND">earned-money</field>
            <value name="MESSAGE">
              <block type="text" id="txt_win">
                <field name="TEXT">✅ TRADE WIN! Resetting stake to initial base level.</field>
              </block>
            </value>
            <next>
              <block type="variables_set" id="reset_stake">
                <field name="VAR" id="var_stake" variabletype="">Stake</field>
                <value name="VALUE">
                  <block type="variables_get" id="get_base_stake">
                    <field name="VAR" id="var_initial_stake" variabletype="">Initial Stake</field>
                  </block>
                </value>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="notify" id="notify_loss">
            <field name="NOTIFICATION_TYPE">warn</field>
            <field name="NOTIFICATION_SOUND">job-done</field>
            <value name="MESSAGE">
              <block type="text" id="txt_loss">
                <field name="TEXT">⚠️ TRADE LOSS! Multiplying stake by Martingale Factor.</field>
              </block>
            </value>
            <next>
              <block type="variables_set" id="apply_martingale">
                <field name="VAR" id="var_stake" variabletype="">Stake</field>
                <value name="VALUE">
                  <block type="math_arithmetic" id="mult_stake">
                    <field name="OP">MULTIPLY</field>
                    <value name="A">
                      <block type="variables_get" id="get_curr_stake">
                        <field name="VAR" id="var_stake" variabletype="">Stake</field>
                      </block>
                    </value>
                    <value name="B">
                      <block type="variables_get" id="get_m_factor">
                        <field name="VAR" id="var_martingale" variabletype="">Martingale Factor</field>
                      </block>
                    </value>
                  </block>
                </value>
              </block>
            </next>
          </block>
        </statement>
        <next>
          ${
            isXXYPattern
              ? `<block type="variables_set" id="reset_xxy_ready_after_trade">
            <field name="VAR" id="var_xxy_ready" variabletype="">XXY Ready</field>
            <value name="VALUE">
              <block type="logic_boolean" id="bool_false_after">
                <field name="BOOL">FALSE</field>
              </block>
            </value>
            <next>
              <block type="trade_again" id="trade_again_loop"></block>
            </next>
          </block>`
              : `<block type="trade_again" id="trade_again_loop"></block>`
          }
        </next>
      </block>
    </statement>
  </block>
</xml>
`;
}

