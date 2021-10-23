# binance-pump-bot

Automation for Binance p&d(pump and dump) activity, ensures fastest purchase and provides auto selling functionality to lockdown profit during these events.

## Important notes

Read these before you proceed.

- Pump and dumps are SCAM (idk but yeah, admin bought first then member xD)
- You are very likely to lose money.
- Invest only what you can afford to lose.

But, `if you think there is a profit window in pump & dumps`, like I did, here's a little tool for you.

## Prerequisites

### Node.js Installation

You must have (Node.js)[https://nodejs.org/en/] installed!

```bash
sudo apt-get install npm -y
npm install node
````

## Installation

`Clone` or `download` this repository, then:

```bash
cd <to_bot_src>
npm install
```

Meanwhile, You need to put your own Binance.com API Key and API Secret in your local `config.js` for the script to run.

You can request for one after logging into their [official site](binance.com).

`This gives the script access to your account.`

And then you're all set.

## Configuration

See `pump-config.js`, the `TRADE_IN` is important, it's the coin to trade for the pumped coin, usually it's `BTC or USDT`.

default configurations are as follow, you can tweak these settings as you like:

```js
let config = {}

// Config HERE
// !!! The coin to trade in, make sure you have some in your balance
config.TRADE_IN = 'USDT'
// Should market price BUY ALL upon symbol
config.BUY_UPON_SYMBOL = true
// How much percentage to take profit? (0.1 is 10% - 0.25 is 25% - 0.5 is 50% - 0.75 is 75% - 1.0 is 100%)
config.HARD_TAKE_PROFIT = 1.0
// Where to stop loss (0.1 is 10% - 0.25 is 25% - 0.5 is 50% - 0.75 is 75% - 1.0 is 100%)
config.HARD_STOP_LOSS = 0.75
// Soft stop loss (Array, please put in ascending order, orders will be put in quantity of divide of the array length, e.g length = 3 then sell 1/3 every time)
// Not used anymore, bugs exist
// config.SOFT_TAKE_PROFIT = [5, 6, 7, 8]
// config.SOFT_TAKE_PROFIT_PERCENT = 0.7 // How many * available are selling
// Peak take profit
config.PEAK_TAKE_PROFIT_THRESHOLD = 2
// After Peak threshold, if TIMEOUT ms later the profit times is not greater than right now, SELL ALL
config.PEAK_TAKE_PROFIT_TIMEOUT = 700
// Max drawback starting point
config.MAX_DRAWBACK_START = 2
// Max drawback to trigger take profit
config.MAX_DRAWBACK = 0.7

module.exports = config
```

## Usage

### Running

First `make sure you have available balance` for the trading pair.

For example, you know the trading pair is XXXX/BTC XXXX/USDT, then you need to have BTC or USDT in your available balance. (Command output will show this).

Then, just run the following command 1~2 minutes before the pump starts:

```bash
npm start
```

`For Windows, compatibility is better with Windows PowerShell or Git Bash. Using these two command line tools is recommended.`

I personally don't use Windows that much, if you find trouble running the script, try `Windows PowerShell` or `Git Bash`.

### The Process

Have the discord or Telegram or any communication tool that your group uses on the side,

and follow the command output instructions.

(`Inserting the coin name will trigger a 100% market buy immediately.`)

`The coin name is case ignored, you can input lower case.`

Sell orders are triggered automatically by configuration in `pump-config.js`, or manually with hotkeys(`check command line output`).

All orders placed by this script will show up in your Binance app or Binance.com as well. You can review these for next-time-better-strategies.

## Hotkeys

When the initial purchase is made, hotkeys are enabled:

```bash
1 - SELL ALL
2 - SELL HALF
3 - SELL QUARTER
4 - SELL 10%
5 - BUY ALL(based on your balance)
6 - BUY HALF
7 - BUY QUARTER

b - SHOW TRADING PAIR BROWSER LINK (WHEN USING VIRTUAL MACHINE)
l - OPEN BROWSER LINK WITH THE TRADING PAIR (WHEN NOT USING VIRTUAL MACHINE)
m - Toggle Manual(no take profits or stop losses)
```
Primary Note: `Hotkeys case is full ignored, you can input upper or lower case`
Note: `the script is not ready for second-entry during pumps, operate only with your first purchase.`

## Proxy/VPN Usage(For CN Users especially)

Search for `Proxy` in `pump.js`, change them to your local VPN port.

## Contribution

Any feature add/improvements are welcome, just send a PR.

## Donation

If this script helped you make profits or you simply want to support, feel free to donate to these addresses:

- BTC(BTC): 3ArtipkmThLP37VAwNY3baAgKDG5EFrFU4
- BTC(TRC20): TLzMANsugpyXaBfDNSjvV7Et9FzVezczF6
- ETH(ERC20): 0x040c8732cbd6d00bd012f507cb86bf55e152f1ba
- USDT(ERC20): 0x71e8b4845587e2f9154f6c81ea7af2359e641357
- XRP(XRP) ADDRESS: rNFugeoj3ZN8Wv6xhuLegUBBPXKCyWLRkB  |  TAG ADDRESS: 1892320962
- SHIB (ERC20): 0x040c8732cbd6d00bd012f507cb86bf55e152f1ba
