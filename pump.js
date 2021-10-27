const chalk = require('chalk')
const readline = require('readline')
const Binance = require('node-binance-api')
const config = require('./config.js')
const pumpConfig = require('./pump-config.js')
const utils = require('./utils.js')

// For Console stamping features
//const console-stamp = require('console-stamp')

var opsys = process.platform;
if (opsys == "darwin") {
    opsys = "MacOS";
} else if (opsys == "win32") {
    opsys = "Windows";
} else if (opsys == "linux") {
    opsys = "Linux";
}

// for timestamping debugging only
// require('log-timestamp')

var log = console.log;

console.log = function () {
    var first_parameter = arguments[0];
    var other_parameters = Array.prototype.slice.call(arguments, 1);

    function formatConsoleDate (date) {
        var hour = date.getHours();
        var minutes = date.getMinutes();
        var seconds = date.getSeconds();
        var milliseconds = date.getMilliseconds();

        return chalk.magenta.bold('[') +
               ((hour < 10) ? '0' + hour: hour) +
               ':' +
               ((minutes < 10) ? '0' + minutes: minutes) +
               ':' +
               ((seconds < 10) ? '0' + seconds: seconds) +
               ':' +
               ('00' + milliseconds).slice(-2) +
               chalk.magenta.bold(']');
    }

    log.apply(console, [formatConsoleDate(new Date()) + first_parameter].concat(other_parameters));
};

const { API_KEY, API_SECRET, HTTP_INTERVAL } = config

if (!API_KEY || !API_SECRET) {
  console.log(chalk.red.bold('WARNING: API KEY & API SECRET IS MISSING!'))
  console.log(chalk.red.bold('PLEASE FILL YOUR API KEY & API SECRET IN config.js'))
  process.exit()
}

const {
  TRADE_IN,
  HARD_TAKE_PROFIT,
  HARD_STOP_LOSS,
  MAX_DRAWBACK,
  MAX_DRAWBACK_START,
  BUY_UPON_SYMBOL,
  // SOFT_TAKE_PROFIT
  // SOFT_TAKE_PROFIT_PERCENT
  PEAK_TAKE_PROFIT_THRESHOLD,
  PEAK_TAKE_PROFIT_TIMEOUT,
} = pumpConfig

// Globals
let TRADE_OUT = ''
let balance = {}
let exchangeInfo = {}
let tradingPairInfo = null
let lotSizeInfo = null
let marketLotSizeInfo = null
// Trading Symbol for the Trading Pair
let symbol = ''
// Price for TRADE_OUT Coins
let price = ''
let priceChangePercent = ''
let globalMarkets = {}

// Variables
let snapshot_buy_price = ''
// The max profit X we have made
let max_profit_times = 0
let initialBought = false
let lastPrice = 0
let timeout = null
let drawbackStarted = false
let softTakeProfitIndex = 0

// MANUAL CONTROL (set true if you want to do your own buy and your own sell strategies)
let manual = false

const binance = new Binance().options({
  APIKEY: API_KEY,
  APISECRET: API_SECRET,
  useServerTime: true,
  recvWindow: 5000,
  // verbose: true, // Add extra output when subscribing to WebSockets, etc
  log: (log) => {
    // console.log(log) // You can create your own logger here, or disable console output
  },
  /**
   * Proxy, uncomment for proxy usage
   */
  // Have your shadowsocks ON
  // proxy: {
  //   host: 'localhost',
  //   port: isWin ? '1084' : '1087',
  // },
})

function handlePrice() {
  if (symbol) {
    if (!price) return

    if (price) {
      if (BUY_UPON_SYMBOL && !initialBought) {
        initialBought = true
        market_buy() // You can put how much percentage you will buy inside of the parenthesis (eg. market_buy(0.75) for 75%)
      }
    }

    // console.log(price)
    process.stdout.clearLine()
    process.stdout.cursorTo(0)

    let colorFn = chalk.green.bold
    let colorFns = chalk.cyan.bold
    let colorFnx = chalk.yellow.bold
    let stampT = console.log
    let colorFnz = chalk.magenta.bold
    if (price < lastPrice) {
      colorFn = chalk.red
    }

    let times = calculateTimesAndTriggerOrders()

    process.stdout.write(
      `${colorFnz("[")}%%:%%:%%:%%${colorFnz("]")} ${colorFnx(symbolv3)}  ${colorFns(price)}  ${colorFn(priceChangePercent + '%')}  ${
        times ? `${colorFn(times.toFixed(2))}x` : ''
      }  ${
        max_profit_times ? `${chalk.magenta(max_profit_times.toFixed(2))}x` : ''
      }`
    )

    lastPrice = price
  }
}

function calculateTimesAndTriggerOrders() {
  let times = null

  if (snapshot_buy_price && price) {
    times = price / snapshot_buy_price
  }

  if (times) {
    if (times > max_profit_times) {
      max_profit_times = times
    }
    if (!manual) {
      if (HARD_TAKE_PROFIT > 0 && times >= HARD_TAKE_PROFIT) {
        console.log(chalk.green.bold('TRIGGER HARD TAKE PROFIT'))
        market_sell()
      } else if (times <= HARD_STOP_LOSS) {
        console.log(chalk.red.bold('TRIGGER HARD STOP LOSS'))
        market_sell()
      }

// ONLY ENABLE THIS ONE IF YOU ENABLED SOFT TAKE PROFIT IN YOUR CONFIG //

      // if (
      //   SOFT_TAKE_PROFIT &&
      //   SOFT_TAKE_PROFIT.length > 0 &&
      //   SOFT_TAKE_PROFIT[softTakeProfitIndex]
      // ) {
      //   if (times > SOFT_TAKE_PROFIT[softTakeProfitIndex]) {
      //     console.log(
      //       '\nTRIGGER SOFT TAKE PROFIT ' +
      //         SOFT_TAKE_PROFIT[softTakeProfitIndex] +
      //         'x'
      //     )
      //     market_sell((1 / SOFT_TAKE_PROFIT.length) * SOFT_TAKE_PROFIT_PERCENT)
      //     softTakeProfitIndex += 1
      //   }
      // }

      if (times > PEAK_TAKE_PROFIT_THRESHOLD) {
        try {
          console.log(
            `${
              timeout ? 'Refreshing' : 'Triggering'
            } PEAK_TAKE_PROFIT countdown `
          )
          if (timeout) {
            clearTimeout(timeout)
          }

          timeout = setTimeout(() => {
            console.log(chalk.green.bold('TRIGGER PEAK TAKE PROFIT'))
            market_sell()
          }, PEAK_TAKE_PROFIT_TIMEOUT)
        } catch (err) {
          console.log(err)
        }
      }

      if (drawbackStarted && max_profit_times - times > MAX_DRAWBACK) {
        console.log(chalk.cyan.bold('TRIGGER DRAWBACK TAKE PROFIT'))
        market_sell()
      }

      if (
        !drawbackStarted &&
        MAX_DRAWBACK_START > 0 &&
        times > MAX_DRAWBACK_START
      ) {
        console.log(
          `Reached ${MAX_DRAWBACK_START}, now will take profit when ${MAX_DRAWBACK}x drawback`
        )
        drawbackStarted = true
      }
    }

    return times
  } else {
    return ''
  }
}

function tickPriceHttp() {
  if (symbol) {
    binance.prices(symbol, function (error, ticker) {
      if (error) {
        // console.log('Error fetching price')
        return
      }
      if (price !== ticker[symbol]) {
        price = ticker[symbol]
      }
      handlePrice()
    })
    binance.prevDay(symbol, (error, prevDay, returnSymbol) => {
      if (error) {
        // console.log('Error fetching prevDay')
        return
      }
      priceChangePercent = prevDay.priceChangePercent
      if (returnSymbol !== symbol) {
        console.log(
          chalk.red.bold.inverse(
            `WARNING: symbol is ${returnSymbol}, expected${symbol}`
          )
        )
        symbol = returnSymbol
      }
      handlePrice()
    })
  }
}

function tickPriceWS() {
  if (symbol) {
    binance.websockets.prevDay(symbol, (error, response) => {
      if (error) {
        try {
          console.log(chalk.red(`WS ERROR ${error.split('\n')[0]}`))
        } catch (err) {
          console.log(err)
        }
        return
      }
      price = response.close
      priceChangePercent = response.percentChange
      handlePrice()
    })
  }
}

function market_buy(percent) {
  if (percent === undefined || percent === null || isNaN(percent)) {
    percent = 1
  }
  if (balance[TRADE_IN]) {
    const available = balance[TRADE_IN].available

    const fullQuantity = (available / price) * percent

    binance.marketBuy(
      symbol,
      getCorrectQuantity(fullQuantity * 1),
      (error, response) => {
        if (error) {
          console.log("")
          console.log(`                                             `, chalk.red.bold.inverse(`ERROR: BUY FAILED`), chalk.yellow.bold.inverse(`@ ${price}`))
          return
        }
        console.log("")
        console.log(`                                             `, chalk.green.bold(`Market Buy`), chalk.yellow.inverse(`@ ${price}`), chalk.green.bold.inverse(` ${percent * 100 * 1}% SUCCESS`))
        if (price) {
          snapshot_buy_price = (' ' + price).slice(1)
        }
        setTimeout(getBalance, 1500)
      }
    )
  } else {
    console.log("")
    console.log(chalk.red.bold.inverse(`NO ${TRADE_IN} AVAILABLE`))
  }
}

function market_sell(percent, retry = true) {
  if (percent === undefined || percent === null || isNaN(percent)) {
    percent = 1
  }
  if (balance[TRADE_OUT]) {
    const available = balance[TRADE_OUT].available

    const quantity = getCorrectQuantity(available * percent)

    binance.marketSell(symbol, quantity, (error, response) => {
      if (error) {
        console.log("")
        console.log(`                                             `, chalk.red.bold.inverse(`ERROR: SELL FAILED`), chalk.cyan.yellow.inverse(`@ ${price}`))
        if (retry) {
          getBalance(false, () => {
            console.log(`                                             `, chalk.green.bold('RETRYING...'))
            market_sell(percent)
          })
        }

        return
      }
      console.log("")
      console.log(`                                             `, chalk.red.bold(`Market Sell`), chalk.cyan.yellow.inverse(`@ ${price}`), chalk.red.bold(` ${percent * 100}% SUCCESS`))
      setTimeout(getBalance, 1500)
    })
  } else {
    console.log("")
    console.log(`                                             `, chalk.red.bold.inverse(`NO ${TRADE_OUT} AVAILABLE`))
  }
}

function resetStatistics() {
  console.log(`                                             `, chalk.yellow.bold.inverse('RESETTING'))
  if (snapshot_buy_price) {
    snapshot_buy_price = ''
  }
  if (max_profit_times) {
    max_profit_times = 0
  }

  if (timeout) {
    try {
      clearTimeout(timeout)
      timeout = null
    } catch (err) {
      console.log(err)
    }
  }
}

function getCorrectQuantity(quantity) {
  let minQty
  let maxQty
  let stepSize
  if (lotSizeInfo) {
    minQty = lotSizeInfo.minQty
    maxQty = lotSizeInfo.maxQty
    stepSize = lotSizeInfo.stepSize
  } else {
    console.log(chalk.red.bold('NO LOT SIZE INFO'))
    minQty = '0.01'
    maxQty = '99999999999'
    stepSize = '0.01'
  }

  if (marketLotSizeInfo) {
    if (parseFloat(maxQty) > parseFloat(marketLotSizeInfo.maxQty)) {
      maxQty = marketLotSizeInfo.maxQty
    }
    if (parseFloat(minQty) < parseFloat(marketLotSizeInfo.minQty)) {
      minQty = marketLotSizeInfo.minQty
    }
  }

  let decimals = parseFloat(stepSize).countDecimals()
  if (decimals === 0 && parseFloat(stepSize) > 0) {
    decimals = 'INT'
  }

  if (quantity > maxQty) {
    console.info("")
    console.log(`                                             `, chalk.red.bold.inverse('WARN: wallet quantity is LARGER than min'))
    //console.log(chalk.red.inverse())
    quantity = maxQty
  } else if (quantity < parseFloat(minQty)) {
    console.info("")
    console.log(`                                             `, chalk.red.bold.inverse('WARN: wallet quantity is SMALLER than min'))
    //console.log(chalk.red.inverse())
    quantity = minQty
  }

  return decimals === 'INT'
    ? Math.floor(parseFloat(quantity))
    : parseFloat(quantity).toFixedDown(decimals)
}

function getBalance(init = false, cb) {
  binance.balance((error, balances) => {
    if (error) return console.log(error)
    let newBalance = balances

    if (init) {
      if (newBalance[TRADE_IN]) {
        console.clear()
        console.log(chalk.yellow.bold.inverse(`BINANCE CURRENT WALLET BALANCE:`))
        console.log(chalk.green.bold(` - ${newBalance[TRADE_IN].available} ${TRADE_IN}`))
      } else {
        console.log(chalk.red(`WARNING: YOU DO NOT HAVE ANY ${TRADE_IN}`))
        // process.exit()
      }
    } else {
      if (
        balance[TRADE_OUT] &&
        newBalance[TRADE_OUT] &&
        newBalance[TRADE_OUT].available !== balance[TRADE_OUT].available
      ) {
        console.log(
          chalk.yellow.bold(
            `NOW YOU HAVE ${newBalance[TRADE_OUT].available} ${TRADE_OUT}`
          )
        )

        try {
          let minQty
          if (lotSizeInfo) {
            minQty = lotSizeInfo.minQty
          } else {
            minQty = '0.01'
          }

          if (marketLotSizeInfo) {
            if (parseFloat(minQty) < parseFloat(marketLotSizeInfo.minQty)) {
              minQty = marketLotSizeInfo.minQty
            }
          }

          if (
            parseFloat(newBalance[TRADE_OUT].available) < parseFloat(minQty)
          ) {
            // can no longer make sell orders
            resetStatistics()
          }
        } catch (err) {
          console.log(err)
          console.log('Reset statistics failed')
        }
      }
      if (
        balance[TRADE_IN] &&
        newBalance[TRADE_IN] &&
        newBalance[TRADE_IN].available !== balance[TRADE_IN].available
      ) {
        console.log(
          chalk.yellow.bold(
            `NOW YOU HAVE ${newBalance[TRADE_IN].available} ${TRADE_IN}`
          )
        )
      }
    }

    balance = newBalance

    if (cb) {
      cb(newBalance)
    }
  })
}
Binance_Web = "https://www.binance.com/en/trade/"
Binance_Pro = "?layout=pro"
function start() {
  binance.exchangeInfo(function (error, data) {
    if (error) {
      console.log(chalk.red(`GET exchangeInfo failed, exiting...`))
      // process.exit()
    }

    exchangeInfo = data.symbols
    console.log("")
    console.log("")
    console.log(chalk.yellow.bold.inverse('BINANCE PRO'))
    console.log("")
    console.log(chalk.white.dim('STATUS:'))
    console.log(chalk.green.bold('  - CONNECTED!  ' ))
    console.log("")
    console.log(chalk.white.dim('NOTES:'))
    console.log(chalk.red.bold('  - PLEASE DOUBLE CHECK YOUR CONFIG BEFORE STARTING!'))
    console.log(chalk.red.bold('  - PLEASE DO SOME TESTING WITH BLANK WALLET!'))
    console.log("")
    console.log("")
    console.log(chalk.yellow.bold.inverse(' INSERT COIN NAME (CASE IS IGNORED): '))

    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    })

    const ChromeLauncher = require('chrome-launcher')

    rl.question(chalk.yellow.bold.inverse('[ COIN NAME ] '), function (line) {
      if (!TRADE_OUT) {
        TRADE_OUT = line.toUpperCase()
        symbol = `${TRADE_OUT}${TRADE_IN}`
        symbolv2 = `${TRADE_OUT}_${TRADE_IN}`
        symbolv3 = `${TRADE_OUT}/${TRADE_IN}`
        tradingPairInfo = exchangeInfo.filter(
          (item) => item.symbol == symbol
        )[0]

        if (tradingPairInfo) {
          lotSizeInfo = tradingPairInfo.filters.filter(
            (item) => item.filterType === 'LOT_SIZE'
          )[0]
          marketLotSizeInfo = tradingPairInfo.filters.filter(
            (item) => item.filterType === 'MARKET_LOT_SIZE'
          )[0]
        } else {
          console.log(chalk.black.bold.bgRed('WARN: NO AVAILABLE TRADING PAIR'))
	  console.log(chalk.black.bold.bgRed('PLEASE CHECK TRADING PAIR!'))
          process.exit()
        }

        console.log("")
        console.log(chalk.cyan.bold('TRADING PAIR SET: ', chalk.green.bold(`${TRADE_OUT}/${TRADE_IN}`)))

        if (globalMarkets && globalMarkets[symbol]) {
          price = globalMarkets[symbol].close
          console.log(`GLOBAL PRICE OF`, chalk.green.bold(`${TRADE_OUT}/${TRADE_IN}`) + ` is `, chalk.cyan.bold(`${globalMarkets[symbol].close}`))
          handlePrice()
        }

        tickPriceHttp()
        tickPriceWS()
        console.info("")
        console.log("")
        console.log(chalk.white.bold(' HOTKEY AVAILABLE OPTION:'))
        console.log("")
        console.log(chalk.white.bold(' 1'), chalk.white.dim(' - '), chalk.yellow.bold.inverse(' SELL ALL '))
        console.log(chalk.white.bold(' 2'), chalk.white.dim(' - '), chalk.yellow.bold.inverse(' SELL HALF '))
        console.log(chalk.white.bold(' 3'), chalk.white.dim(' - '), chalk.yellow.bold.inverse(' SELL QUARTER '))
        console.log(chalk.white.bold(' 4'), chalk.white.dim(' - '), chalk.yellow.bold.inverse(' SELL 10% '))
        console.log(chalk.white.bold(' 5'), chalk.white.dim(' - '), chalk.yellow.bold.inverse(' BUY ALL '))
        console.log(chalk.white.bold(' 6'), chalk.white.dim(' - '), chalk.yellow.bold.inverse(' BUY HALF '))
        console.log(chalk.white.bold(' 7'), chalk.white.dim(' - '), chalk.yellow.bold.inverse(' BUY QUARTER '))
        console.log("")
        console.log(chalk.white.bold(' 8'), chalk.white.dim(' - '), chalk.yellow.bold.inverse(' SHOW TRADING PAIR BROWSER LINK (Virtual Machine Only) '))
        console.log(chalk.white.bold(' 9'), chalk.white.dim(' - '), chalk.yellow.bold.inverse(' OPEN BROWSER LINK WITH THE TRADING PAIR (Non-Virtual Machine) '))
        console.log(chalk.white.bold(' m'), chalk.white.dim(' - '), chalk.yellow.bold.inverse(' Toggle Manual(manual sell & buy [no take profit or stop loss]) '))
        console.log("")

        rl.close()

        var stdin = process.stdin
        stdin.setRawMode(true)
        stdin.resume()
        stdin.setEncoding('utf8')
        stdin.on('data', function (key) {
          if (key === '1') {
            market_sell(1, false)
          }
          if (key === '2') {
            market_sell(0.5, false)
          }
          if (key === '3') {
            market_sell(0.25, false)
          }
          if (key === '4') {
            market_sell(0.1, false)
          }
          if (key === '5') {
            market_buy()
          }
          if (key === '6') {
            market_buy(0.5)
          }
          if (key === '7') {
            market_buy(0.25)
          }
          if (key === 'm') {
            manual = !manual
            if (manual) {
              if (timeout) {
                clearTimeout(timeout)
              }
              console.log(chalk.yellow.bold.inverse('MANUAL TRADING:', chalk.green.bold.inverse('ON')))
            } else {
              console.log(chalk.yellow.bold.inverse('MANUAL TRADING:', chalk.red.bold.inverse('OFF')))
            }
          }
          if (key === 'M') {
            manual = !manual
            if (manual) {
              if (timeout) {
                clearTimeout(timeout)
              }
              console.log(chalk.yellow.bold.inverse('MANUAL TRADING:', chalk.green.bold.inverse('ON')))
            } else {
              console.log(chalk.yellow.bold.inverse('MANUAL TRADING:', chalk.red.bold.inverse('OFF')))
            }
          }
          if (key === '8') {
            console.log(chalk.yellow.bold.inverse(`${Binance_Web}${symbolv2}${Binance_Pro}`))
          }
          if (key === '9') {
	    console.log(chalk.red.bold.inverse("WARN: Use key 0; proceed with caution"))
          }
          if (key === '0') {
            ChromeLauncher.launch({
              startingUrl: `https://www.binance.com/en/trade/${TRADE_OUT}_${TRADE_IN}?layout=pro`,
            })
          }
          // ctrl-c EXIT
	  if (key === 's') {
	    getBalance()
	  }
          if (key === '\u0003') {
            getBalance(true)
            process.exit()
          }
        })
      }
    })
  })

  setInterval(tickPriceHttp, HTTP_INTERVAL)

  setInterval(getBalance, HTTP_INTERVAL * 3)

  getBalance(true)

  // start getting prices
  binance.websockets.miniTicker((markets) => {
    try {
      if (symbol && markets[symbol]) {
        price = markets[symbol].close
      } else {
        globalMarkets = { ...globalMarkets, ...markets }
      }
    } catch (err) {
      // console.log(err)
    }
  })
}

start()
