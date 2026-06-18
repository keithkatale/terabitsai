# Exness Trading Platform - AI Agent Guide

Complete guide for AI browser agents to interact with and execute trades on the Exness trading platform.

## Platform Overview

**Website:** https://www.exness.com  
**Supported Markets:** Forex, Crypto, Stocks, Metals, Indices  
**Account Types:** Standard, Pro, Professional  
**Platforms:** MetaTrader 4 (MT4), MetaTrader 5 (MT5), Web Terminal  
**Key Feature:** 1:1000 leverage available for professional accounts

---

## 1. Account Management

### 1.1 Login Process

**Steps for Browser Agent:**

```javascript
// Navigate to login page
1. Go to: https://www.exness.com/accounts
2. Look for: "Login" button (usually top-right)
3. Click login button → Opens login form

// Fill login form
4. Enter: Email address
   Selector: input[name="email"] OR input[type="email"]
5. Enter: Password
   Selector: input[name="password"] OR input[type="password"]
6. Check: "Remember me" (optional)
   Selector: input[type="checkbox"][name="remember"]
7. Click: "Login" button
   Selector: button[type="submit"] OR button containing "Login"

// Expected outcome
8. Wait: 2-3 seconds for redirect
9. Verify: Dashboard loads with account overview
10. Check: Account balance visible
```

**Alternative: Direct Login**
```
URL: https://app.exness.com/login
(Faster redirect to trading dashboard)
```

### 1.2 Account Overview

**After Login - Key Information Visible:**

```
Dashboard Layout:
├── Balance (Total account funds)
├── Equity (Balance + Unrealized profit/loss)
├── Used Margin (Capital tied up in open positions)
├── Free Margin (Available for new trades)
├── Margin Level (Equity / Used Margin %)
├── Open Positions (List of active trades)
├── Pending Orders (Unexecuted orders)
└── Recent Trades (Closed positions history)

Critical Metric: Margin Level
- > 200%: Safe
- 100-200%: Warning zone
- < 100%: Margin call (positions force closed)
- Target: Keep > 150% for safety
```

### 1.3 Account Settings

**Navigation Path:**
```
Dashboard → Settings (gear icon, usually top-right)
OR
Profile menu → Settings

Available Settings:
├── Personal Information
│   ├── Full name
│   ├── Email address
│   ├── Phone number
│   └── Date of birth
├── Security
│   ├── Change password
│   ├── Two-factor authentication (2FA)
│   ├── API keys (for automated trading)
│   └── Login history
├── Trading Settings
│   ├── Default leverage
│   ├── Account type preference
│   └── Notification preferences
├── Payment Methods
│   ├── Linked bank accounts
│   ├── Cryptocurrency wallets
│   ├── E-wallets (Skrill, Neteller)
│   └── Payment history
└── Verification
    ├── ID verification status
    ├── Address verification
    └── Trading experience level
```

### 1.4 Enable 2FA (Security Critical)

```
Steps:
1. Settings → Security
2. Click "Enable Two-Factor Authentication"
3. Scan QR code with authenticator app (Google Authenticator, Authy)
4. Enter 6-digit code to confirm
5. Save backup codes in secure location
6. Verify: "2FA Enabled" shows in security settings

For Agent: Store 2FA codes securely before operations
```

---

## 2. Account Funding (Deposits)

### 2.1 Deposit Methods

**Navigation:**
```
Dashboard → Deposit (usually green button, top)
OR
Account → Funding → Deposit
```

**Available Methods:**

```
1. Bank Transfer
   - Time: 1-3 business days
   - Min: $1-100 (varies by country)
   - Fee: Usually none
   - Best for: Large amounts

2. Credit/Debit Card (Visa, Mastercard)
   - Time: Instant
   - Min: $1-10
   - Fee: 1-3%
   - Best for: Quick funding

3. Cryptocurrency (BTC, ETH, USDT, etc.)
   - Time: 10-60 minutes
   - Min: 0.0001 BTC equivalent
   - Fee: Network fee only
   - Best for: Quick, borderless transfers

4. E-Wallets (Skrill, Neteller, Perfect Money)
   - Time: Instant
   - Min: $1-10
   - Fee: 1-2%
   - Best for: Multiple deposits

5. Local Payment Methods (varies by country)
   - Time: Varies
   - Includes: PIX (Brazil), Knect (South Africa), etc.
```

### 2.2 Deposit Process (Web Interface)

```javascript
// Navigate to deposit
1. Click "Deposit" button on dashboard
2. Select payment method from list
3. Enter amount (in USD or local currency)
4. Review exchange rate (if applicable)
5. Click "Continue" or "Deposit Now"

// For cryptocurrency deposit:
6. Select: Cryptocurrency type (BTC, ETH, USDT, etc.)
7. Copy: Deposit address shown
8. Send: Exact amount from your wallet to address
9. Wait: 10-60 minutes for confirmation
10. Check: Balance updates after network confirmation

// For card deposit:
6. Enter: Card details (card number, expiry, CVV)
7. Enter: Billing address
8. Click: "Deposit"
9. Wait: Processing (usually instant)
10. Check: Balance updated
```

### 2.3 Withdrawal Process

**Navigation:**
```
Dashboard → Withdraw (red button, usually top)
OR
Account → Funding → Withdraw
```

**Steps:**

```javascript
1. Click "Withdraw" button
2. Select: Withdrawal method (same as deposit method)
3. Enter: Amount to withdraw
4. Verify: Fees shown (usually 0%)
5. Check: Minimum withdrawal met (usually $1-10)
6. Confirm: Account details (bank, wallet, etc.)
7. Click: "Withdraw" to submit

// Withdrawal times:
Bank Transfer: 2-5 business days
Cryptocurrency: 10-60 minutes
E-Wallet: 1-24 hours
Card: 3-7 business days

// Agent check:
- Wait for confirmation email
- Verify in "Recent Transactions"
- Track via bank/wallet confirmation
```

---

## 3. Trading Interface

### 3.1 Web Terminal (Browser-Based Trading)

**Access:**
```
Option 1: Dashboard → "Trade Now" button
Option 2: https://trader.exness.com/
Option 3: Dashboard → Open Trading Terminal
```

**Main Interface Sections:**

```
┌─────────────────────────────────────────────┐
│  Account Selector | Balance: $X | Margin    │ ← Top bar
├─────────────────────────────────────────────┤
│  Search    │ Symbols List        │ Charts   │
│  Bar       │ (Currencies, Metals) │ Area    │
│            │                      │         │
│ EURUSD     │ EURUSD              │ [Chart] │
│ GBPUSD     │ GBPUSD              │         │
│ USDJPY     │ USDJPY              │ ←─Candlestick
│ GOLD       │ GOLD                │ Chart with
│ ...        │ ...                 │ Price action
├─────────────────────────────────────────────┤
│  Order Entry Panel (Bottom/Right)            │
│                                             │
│  Symbol: EURUSD ▼                          │
│  Type: ● Market  ○ Pending                 │
│  Volume: [____]  Lots                      │
│  Stop Loss: [____] Pips                    │
│  Take Profit: [____] Pips                  │
│                                             │
│  [BUY] [SELL] [CANCEL ALL]                │
└─────────────────────────────────────────────┘
```

### 3.2 Symbol Selection

**Finding Symbols:**

```
Method 1: Search bar
1. Click search/find bar
2. Type: "EURUSD" or "Gold" or "Bitcoin"
3. Press Enter or click result
4. Symbol loads in chart

Method 2: Browse list
1. Look at left panel (symbol list)
2. Click: Desired symbol
3. Chart updates automatically

Available Symbol Categories:
├── Forex (Currency pairs)
│   └── EURUSD, GBPUSD, USDJPY, etc.
├── Metals
│   └── GOLD, SILVER
├── Commodities
│   └── Oil, Natural Gas
├── Stocks
│   └── AAPL, MSFT, TSLA, etc.
├── Crypto
│   └── BTCUSD, ETHUSD, etc.
├── Indices
│   └── SPX500, DAX40, etc.
└── Energy
    └── Crude Oil, Gas
```

### 3.3 Market vs Limit Orders

**Market Order (Immediate Execution):**

```javascript
// Place market order
1. Select symbol: EURUSD
2. Choose type: ● Market (selected)
3. Direction: 
   - Click [BUY] for long position
   - Click [SELL] for short position
4. Volume: Enter lot size (0.01 = micro lot)
5. Stop Loss: Enter pips below entry (if long)
6. Take Profit: Enter pips above entry
7. Click: [BUY] or [SELL]
8. Confirm: Order fills at market price
9. Check: Position appears in "Open Positions"

// Market order execution
- Executes immediately at current market price
- Price shown before confirmation
- Slippage possible during high volatility
- Best for: Quick entries when price at key level
```

**Pending Order (Conditional Entry):**

```javascript
// Place pending order
1. Select symbol: EURUSD
2. Choose type: ○ Pending (select this)
3. Pending type:
   - Buy Limit: Buy at price ≤ specified price
   - Buy Stop: Buy at price ≥ specified price
   - Sell Limit: Sell at price ≥ specified price
   - Sell Stop: Sell at price ≤ specified price
4. Entry price: Specify where to enter
5. Volume: Lot size
6. Stop Loss: Pips below entry
7. Take Profit: Pips above entry
8. Expiration: When order expires (if not filled)
9. Click: [Create Order]
10. Check: Order in "Pending Orders" section

// Pending order execution
- Waits for price to reach specified level
- Auto-executes when level touched
- Best for: Support/resistance bounces
- Cancel if price moves away from level
```

### 3.4 Order Parameters

**Key Settings for Every Trade:**

```
Symbol: Which instrument (EURUSD, GOLD, BTC)
├── Critical: Verify correct symbol selected

Volume: Position size in lots
├── 0.01 = 1,000 units (micro lot)
├── 0.1 = 10,000 units (mini lot)
├── 1.0 = 100,000 units (standard lot)
├── Rule: Start with 0.01 lots for testing
└── Max: Never exceed 10% account risk

Stop Loss: Maximum loss protection
├── Distance in pips from entry
├── Example: Entry 1.1000, SL -20 pips = 1.0980
├── Critical: ALWAYS set stop loss
├── Rule: 2 × ATR or support level
└── Agent: Must be included in every order

Take Profit: Target exit level
├── Distance in pips above entry
├── Example: Entry 1.1000, TP +50 pips = 1.1050
├── Rule: Min 1:2 risk-reward (50 pips TP, 25 pips SL)
├── Ideal: 1:2.5 or better
└── Agent: Helps automate partial closes

Order Type: Market vs Pending
├── Market: Immediate execution
├── Pending: Conditional execution
├── Agent: Use pending for precise levels

Leverage: 1:1 to 1:1000 (varies by account type)
├── Rule: Keep position sizing low, don't increase leverage
├── Default: 1:1 (no leverage) for safety
└── Agent: Adjust via position size, not leverage
```

---

## 4. Managing Open Positions

### 4.1 Open Positions Panel

**Location:** Bottom of trading terminal  
**Shows:** All active trades with details

```
Columns shown:
├── # (Position ID)
├── Symbol (EURUSD, GOLD, etc.)
├── Volume (Lot size)
├── Entry (Price when opened)
├── Current (Current market price)
├── P/L (Profit/Loss in USD)
├── P/L % (Profit/Loss as percentage)
├── Stop Loss (Level where position closes if losses hit)
├── Take Profit (Target level)
└── Open Time (When position was opened)

Color coding:
├── Green: Profitable position (P/L > 0)
├── Red: Losing position (P/L < 0)
├── Gray: Breakeven or closed
```

### 4.2 Modify Position

**To adjust stop loss or take profit:**

```javascript
1. Click on position in "Open Positions" list
2. Right-click OR click position menu (⋮)
3. Select: "Modify" or "Edit"
4. Change:
   ├── Stop Loss: New SL level (in pips or price)
   ├── Take Profit: New TP level
   └── Volume: Sometimes can add to position
5. Click: "Apply" or "Update"
6. Confirm: Position modified successfully

// Moving stop loss
- Can move SL closer to entry (tighter stop) ✓
- Can move SL away from entry only to lock profits
- Cannot move SL to lose more than original ✗

// Moving take profit
- Can adjust TP to any level
- Common: Trail TP as price moves in your favor
- Strategy: Move TP up when 50% of target hit
```

### 4.3 Close Position

**To exit a trade early:**

```javascript
1. Click on position in list
2. Right-click → "Close" OR click close button (X)
3. Choose close option:
   ├── Close full position (entire trade)
   ├── Close partial (close half, keep half open)
   └── Close at: Specify exact price (pending order to close)
4. Click: "Confirm"
5. Position closes at market price
6. Check: Position removed from "Open Positions"
7. See: Trade appears in "Closed Trades" history

// Agent logic for closing:
- Check P/L before closing
- Consider: 1:2.5 risk-reward targets
- Don't close: If SL would be hit in minutes (let it run)
- Do close: If thesis invalidated or TP hit
```

---

## 5. Pending Orders Management

### 5.1 Pending Orders Panel

**Shows:** All unexecuted conditional orders

```
Columns:
├── Order # (Unique ID)
├── Symbol (EURUSD, etc.)
├── Order Type (Buy Stop, Sell Limit, etc.)
├── Volume (Lot size)
├── Entry Level (Price to trigger order)
├── Stop Loss
├── Take Profit
├── Expiration (When order expires)
└── Created (When order was placed)

Status:
├── Active: Waiting for price to reach entry
├── Expired: Time-based expiration passed
├── Pending: Queued for execution
```

### 5.2 Modify Pending Order

```javascript
1. Click pending order in list
2. Right-click → "Modify"
3. Can change:
   ├── Entry level (price to trigger)
   ├── Stop loss
   ├── Take profit
   ├── Volume
   └── Expiration time
4. Click: "Apply"
5. Order updated

// Common modifications:
- Move entry level (e.g., from 1.1050 to 1.1040)
- Tighten stop loss (reduce potential loss)
- Extend expiration (keep order active longer)
- Increase volume (if account has more capital)
```

### 5.3 Cancel Pending Order

```javascript
1. Click pending order
2. Right-click → "Cancel" OR click cancel button
3. Confirm cancellation
4. Order removed from pending list
5. No position opened
6. No capital tied up

// When to cancel:
- Price moved against order (unlikely to fill)
- Signal invalidated (pattern failed)
- Better opportunity found (place new order instead)
- Risk changed (market volatility increased)
```

---

## 6. Charts and Technical Analysis

### 6.1 Chart Interface

**Default:** Candlestick chart showing price action

```
Chart Controls (Usually top-left of chart):
├── Timeframe selector
│   ├── M1, M5, M15, M30
│   ├── H1, H4
│   ├── D (Daily)
│   ├── W (Weekly)
│   └── MN (Monthly)
├── Chart type selector
│   ├── Candlesticks
│   ├── Line
│   └── Bars
├── Zoom controls
│   ├── + (Zoom in)
│   └── - (Zoom out)
└── View options
    ├── Full screen
    ├── Crosshair tool
    └── Measurement tools
```

### 6.2 Add Technical Indicators

**To add indicators to chart:**

```javascript
1. Right-click on chart
2. Select: "Add Indicator" OR "Indicators"
3. Choose indicator:
   ├── Moving Averages (SMA, EMA)
   ├── RSI (Relative Strength Index)
   ├── MACD
   ├── Bollinger Bands
   ├── Stochastic
   ├── ATR (Average True Range)
   └── More... (full list)
4. Set parameters:
   ├── Period (e.g., 14 for RSI)
   ├── Color
   ├── Thickness
   └── Apply
5. Indicator displays on chart
6. Can add multiple indicators simultaneously

// Common setup:
- EMA 20, EMA 50 (trend lines)
- RSI 14 (momentum)
- Bollinger Bands (volatility, support/resistance)
- MACD (trend confirmation)
```

### 6.3 Draw Tools

**For marking support/resistance:**

```javascript
1. Right-click on chart
2. Select: "Drawing Tools" or "Drawings"
3. Available tools:
   ├── Trend Line (connect lows or highs)
   ├── Horizontal Line (support/resistance)
   ├── Vertical Line (time marker)
   ├── Rectangle (mark consolidation)
   ├── Text (add notes)
   └── More...
4. Click chart to place:
   - First click: Start point
   - Second click: End point (for lines)
   - Adjust by dragging
5. Right-click drawing to:
   ├── Edit properties
   ├── Change color
   ├── Delete
   └── Lock in place

// Agent use:
- Mark support levels (visual confirmation)
- Mark resistance levels
- Draw trend lines (for pattern analysis)
- Not critical for automated trading
```

---

## 7. Account Monitoring

### 7.1 Real-Time Metrics

**Key metrics to monitor continuously:**

```
Balance: Total account funds
├── Formula: Previous balance + Deposits - Withdrawals + Closed trades P/L
├── Updates: When trades closed or deposits arrive
├── Check: Dashboard top-right corner
└── Agent: Monitor for available capital

Equity: Current account value
├── Formula: Balance + Open positions P/L (unrealized)
├── Updates: Real-time as market moves
├── Importance: Critical for margin level calculation
└── Agent: Check before opening new trades

Used Margin: Capital tied up in open positions
├── Formula: Sum of all open position values × leverage
├── High used margin: Limits ability to open new trades
├── Agent: Should not exceed 50% of balance
└── Target: Keep < 30-40% for safety margin

Free Margin: Available to open new trades
├── Formula: Equity - Used Margin
├── Must be > 0 to open new position
├── Agent: Check Free Margin before each trade
└── Rule: Never trade with < 2% free margin buffer

Margin Level: Equity / Used Margin (%)
├── Formula: (Equity / Used Margin) × 100
├── Critical threshold: > 100% (positions stay open)
├── Warning: 50-100% (positions close if hit)
├── Liquidation: < 50% (forced position closeout)
├── Target: Keep > 150-200% for comfort
├── Agent: CRITICAL - monitor constantly
└── Action if < 100%: Close positions immediately
```

### 7.2 Dashboard Overview

**At a glance account status:**

```
Display shows (usually top section):
├── Account #: Unique account ID
├── Account Type: Standard, Pro, Professional
├── Currency: USD, EUR, etc.
├── Balance: Total funds
├── Equity: Current value
├── Margin Level: % (color-coded)
├── Open Positions: # of active trades
├── Pending Orders: # of waiting orders
├── P&L Today: Daily profit/loss
├── Trading Hours: Hours left in current day
└── Last Trade: Time since last closed position

Visual indicators:
├── Green: Account healthy, all good
├── Yellow: Caution, margin level 100-150%
├── Red: Danger, margin level < 100%
└── Blinking red: Margin call in progress
```

### 7.3 History and Reports

**Accessing trade history:**

```
Navigation: Dashboard → History
OR: Trading Terminal → Closed Trades

Available data:
├── Closed Trades list
│   ├── Symbol
│   ├── Open time
│   ├── Close time
│   ├── Volume
│   ├── Entry price
│   ├── Exit price
│   ├── P&L (profit/loss)
│   └── Details
├── Statements
│   ├── Monthly statements
│   ├── Trade summaries
│   ├── Deposit/withdrawal history
│   └── Fee breakdowns
└── Reports
    ├── Daily P&L
    ├── Monthly returns
    ├── Win rate
    └── Export to CSV/PDF

// Agent data extraction:
- Track win rate (wins / total trades)
- Calculate Sharpe ratio (returns / volatility)
- Monitor drawdown (peak-to-trough decline)
- Check fees vs returns
```

---

## 8. Common Tasks for AI Agent

### 8.1 Pre-Trade Checklist

**Before executing ANY trade:**

```javascript
// Step 1: Account health check
✓ Margin level > 150%?
✓ Free margin sufficient for trade?
✓ Balance > Account risk limit?
✓ No pending liquidation?

// Step 2: Market conditions
✓ Market hours? (Check session times)
✓ Volume normal? (Check recent candles)
✓ No news event in next 4 hours?
✓ Volatility acceptable? (Check ATR)

// Step 3: Signal validation
✓ 2+ indicators confirm signal?
✓ Price at support/resistance?
✓ Volume confirming?
✓ Pattern complete?

// Step 4: Risk parameters
✓ Position size = 2% risk max?
✓ Stop loss set (2×ATR or support)?
✓ Take profit set (1:2.5+ ratio)?
✓ Risk-reward acceptable?

// Step 5: Final checks
✓ Correct symbol selected?
✓ Correct direction (BUY/SELL)?
✓ Correct volume entered?
✓ All parameters visible and correct?

// If all YES → Execute trade
// If any NO → SKIP trade
```

### 8.2 Trading Workflow Example

**Complete trade execution flow:**

```javascript
1. Market Analysis
   - Load EURUSD chart
   - Set timeframe to 4H
   - Add EMA 20, EMA 50, RSI 14
   - Identify support level at 1.0950

2. Signal Detection
   - Price breaks below EMA 50
   - RSI < 30 (oversold)
   - Price touching support 1.0950
   - Volume increasing on down candle

3. Pre-Trade Checklist
   - ✓ Margin level: 250% (good)
   - ✓ Free margin: $5,000 available
   - ✓ 4H timeframe (good for swing trades)
   - ✓ 3 signals aligned (strong)

4. Determine Position Size
   - Stop loss: 1.0950 (support) = 50 pips
   - Account size: $10,000
   - Risk per trade: 2% = $200
   - Position size: $200 / 50 pips = 0.04 lots
   - Volume to enter: 0.04 lots

5. Place Order
   - Symbol: EURUSD
   - Type: Market order (price at support)
   - Direction: SELL (price down)
   - Volume: 0.04 lots
   - Stop loss: 1.0950 + 5 pips = 1.0955 (buffer)
   - Take profit: 1.0900 (1:2 risk-reward)
   - Execute

6. Monitor Trade
   - Check position opened
   - Verify SL and TP visible
   - Monitor margin level
   - Set timer for review (1 hour)

7. Active Management
   - Price at 1.0925 (good)
   - Move SL to 1.0945 (lock in profit)
   - Monitor for trend reversal
   - Plan exit if signal fails

8. Close Trade
   - Take profit hit at 1.0900
   - Position closes automatically
   - Record: Win, +200 pips profit
   - Review: What worked? What didn't?

9. Post-Trade
   - Update win/loss record
   - Check margin level (should improve)
   - Analyze: Entry, exit, signal quality
   - Plan: Next trade based on lessons
```

### 8.3 Risk Management Example

**Monitoring and adjustment:**

```javascript
// Initial state
- Balance: $10,000
- Margin level: 250%
- Open positions: 2 trades

// Market moves against positions
- Equity drops to $9,800 (2% loss)
- Margin level: 200% (still OK)
- Action: Monitor closely

// Continued losses
- Equity drops to $9,500 (5% loss)
- Margin level: 150% (warning zone)
- Action: Close worst-performing trade

// Further decline (extreme scenario)
- Equity drops to $9,000 (10% loss)
- Margin level: 100% (critical!)
- Action: 
  1. Close ALL positions immediately
  2. Stop trading for the day
  3. Re-evaluate strategy
  4. Wait for margin level to stabilize

// Recovery mode
- After closing: Balance = $9,000, Margin = unlimited
- Reduce next trade size by 50%
- Tighten stop losses
- Only trade high-confidence signals
- Rebuild capital before scaling up
```

---

## 9. Advanced Features

### 9.1 API Trading (For Developers)

**For fully automated bot execution:**

```
API Access: Requires professional account
├── Generate API key in settings
├── Set IP whitelist for security
├── Use REST API or WebSocket connection
├── Libraries: Python (requests), JavaScript (axios), etc.

Example API Call (Python):
```python
import requests
import json

API_KEY = "your_api_key_here"
BASE_URL = "https://api.exness.com"

# Get account details
response = requests.get(
    f"{BASE_URL}/api/account",
    headers={"Authorization": f"Bearer {API_KEY}"}
)
account_data = response.json()

# Place market order
order_data = {
    "symbol": "EURUSD",
    "order_type": "market",
    "side": "buy",
    "volume": 0.01,
    "stop_loss": 1.0950,
    "take_profit": 1.1100
}

response = requests.post(
    f"{BASE_URL}/api/orders",
    json=order_data,
    headers={"Authorization": f"Bearer {API_KEY}"}
)

if response.status_code == 201:
    order_id = response.json()['id']
    print(f"Order placed: {order_id}")
else:
    print(f"Error: {response.text}")
```

**Security:**
- Never expose API key in code
- Use environment variables
- Whitelist IP addresses
- Enable 2FA on account
- Rotate keys regularly

### 9.2 Trading Signals Integration

**For signal-based automated trading:**

```javascript
// Workflow
1. Signal source (your algorithm, TradingView, etc.)
2. Signal arrives (BUY EURUSD, SL=1.0950, TP=1.1050)
3. Validate signal (Check: time, quality, correlation)
4. Execute trade (If valid, place order)
5. Log trade (Record: signal, entry, exit)
6. Monitor trade (Track: P&L, margin, news)
7. Close trade (At SL, TP, or signal reversal)

// Signal validation rules (before trading):
- Require 2+ indicators aligned
- Check position not too correlated with existing
- Verify account margin sufficient
- Confirm risk-reward adequate (>= 1:2)
- Check no major news event in next 4 hours
```

### 9.3 Risk Alerts

**Automatic notifications for agent:**

```
Set alerts in settings for:
├── Margin level < 100% (CRITICAL)
├── Drawdown > 5% (WARNING)
├── Single trade loss > 3% account (WARNING)
├── Equity drop > 10% (CRITICAL)
├── Position P&L > 20% (Take profit reminder)
└── Market event approaching (News calendar)

Agent action on alerts:
├── Margin alert: Close 1-2 smallest positions
├── Drawdown alert: Reduce position size next trade
├── Loss alert: Review trade logic, check for errors
├── Equity alert: Stop trading immediately
├── Profit alert: Consider closing at least partial position
└── News alert: Widen stops or close positions
```

---

## 10. Troubleshooting for AI Agent

### 10.1 Common Errors

**Error: "Insufficient Margin"**
- Problem: Free margin < order requirement
- Solution: Close a position or wait for existing trade P&L
- Agent action: Reduce position size by 50%

**Error: "Order rejected"**
- Problem: Price moved beyond order parameters
- Solution: Resubmit with updated parameters
- Agent action: Check current price, adjust entry level

**Error: "Trade pending - wait for confirmation"**
- Problem: Previous order still processing
- Solution: Wait 1-2 seconds then check
- Agent action: Implement 2-second delay before re-checking

**Error: "Market is closed"**
- Problem: Trading outside market hours
- Solution: Check session times, wait for market open
- Agent action: Implement session time checking

**Error: "Connection timeout"**
- Problem: Network issue or server overload
- Solution: Retry connection
- Agent action: Implement exponential backoff retry (1s, 2s, 4s, 8s)

### 10.2 Session Hours by Market

```
FOREX (24/5 trading):
├── Sunday: 5 PM - Friday 5 PM EST
├── Sydney: Sun 5 PM - Mon 1 AM EST
├── Tokyo: Sun 7 PM - Mon 3 AM EST
├── London: Mon 3 AM - Fri 12 PM EST
├── New York: Mon 8 AM - Fri 5 PM EST
└── Best: London-NY overlap (8 AM - 12 PM EST)

STOCKS (US):
├── Regular: 9:30 AM - 4:00 PM EST
├── Pre-market: 4:00 AM - 9:30 AM (low volume)
├── After-hours: 4:00 PM - 8:00 PM (low volume)
└── Recommended: 10 AM - 3 PM EST

CRYPTO:
├── 24/7 trading (always open)
├── Higher volume: 8 AM - 6 PM EST (US hours)
└── Best liquidity: During peak trading hours

METALS/INDICES:
├── Similar to FOREX (24/5)
├── Some gaps at market open/close
└── London session: Most active
```

### 10.3 Performance Optimization

**For faster execution:**

```javascript
// Optimization tips for agent:
1. Pre-load symbols before needed
   - Load EURUSD, GOLD, SPX500 on startup
   - Faster chart loading when signal arrives

2. Use pending orders instead of market
   - Specify exact entry level
   - Avoids slippage from market order
   - Automatic execution when reached

3. Batch operations when possible
   - Don't: Place 5 orders in 5 separate calls
   - Do: Group related orders if possible

4. Cache current prices
   - Update every 1 second (not every 100ms)
   - Reduces API calls
   - Balances responsiveness vs. load

5. Close unnecessary charts
   - Only active symbol loaded
   - Reduces browser memory
   - Faster performance

6. Monitor system resources
   - If lag > 2 seconds: Reduce complexity
   - Close background tabs
   - Clear browser cache monthly
```

---

## 11. Agent Decision Matrix

### 11.1 Trade Execution Decision

```javascript
SHOULD_EXECUTE_TRADE = () => {
  
  // Block 1: Account health (MUST PASS)
  if (margin_level < 100) return false; // Margin call
  if (free_margin < position_size_requirement) return false;
  if (daily_loss > account_daily_limit) return false;
  if (total_open_risk > 3%) return false;
  
  // Block 2: Signal quality (MUST PASS)
  if (signal_confirmations < 2) return false; // Need 2+ indicators
  if (!price_at_support_resistance) return false;
  if (volume < average_volume) return false;
  
  // Block 3: Risk parameters (MUST PASS)
  if (risk_percent > 2%) return false; // Max 2% per trade
  if (risk_reward_ratio < 1.5) return false; // Min 1:2 ratio
  if (stop_loss_not_set) return false; // Always require SL
  
  // Block 4: Market conditions (MUST PASS)
  if (!is_market_open_for_symbol) return false;
  if (is_news_event_in_next_4_hours) return false;
  if (is_extreme_volatility && correlation_high) return false;
  
  // All blocks passed
  return true;
}

// Execute trade ONLY if all blocks return true
```

### 11.2 Position Management Decision

```javascript
MANAGE_OPEN_POSITION = (position) => {
  
  current_pnl_percent = position.pnl / account_balance;
  current_margin_level = equity / used_margin;
  
  // Critical situation
  if (current_margin_level < 100) {
    CLOSE_POSITION_IMMEDIATELY(position);
    return;
  }
  
  // Warning situation
  if (current_margin_level < 150) {
    CLOSE_WORST_PERFORMING_POSITION();
    return;
  }
  
  // Normal management
  if (position.pnl > target_profit) {
    CLOSE_POSITION_AT_TARGET();
    return;
  }
  
  if (position.pnl < -stop_loss) {
    CLOSE_AT_STOP_LOSS();
    return;
  }
  
  if (signal_reversed) {
    CLOSE_POSITION_REVERSE_SIGNAL();
    return;
  }
  
  // Trail stop loss if in profit
  if (position.pnl > 0) {
    TRAIL_STOP_LOSS(distance = 1.5 * ATR);
    return;
  }
  
  // Otherwise, hold and monitor
  CONTINUE_MONITORING();
}
```

---

## 12. Exness-Specific Best Practices

### 12.1 Leverage Strategy

```
Account Type Leverage:
├── Standard: 1:500 max
├── Pro: 1:500 max
└── Professional: 1:1000 max

Recommendation for agent:
├── Use 1:1 leverage (no leverage)
├── Let position sizing control exposure
├── Never increase leverage
├── Keeps margin safe and predictable

Example:
├── Account: $10,000
├── Without leverage: Can open 0.1 lot (100,000 units)
├── With 1:100 leverage: Could open 10 lots
├── Solution: Just open 0.1 lot instead
├── Result: Same exposure, simpler math, safer
```

### 12.2 Spread Optimization

```
Typical Exness Spreads:
├── EURUSD: 0.3-0.5 pips
├── GBPUSD: 0.3-0.5 pips
├── GOLD: 0.3-0.5 pips
├── Most forex: 0.5-1.5 pips
└── Volatile periods: Can spike 5-20x

Spread cost calculation:
├── 0.5 pips × 100,000 units = $5 cost
├── On 0.01 lot: $0.50 cost per round trip
├── Need 1 pip move to profit (hard!)
├── On 0.1 lot: $5 cost per round trip
├── Need 0.1 pip move to profit

Agent strategy:
├── Only trade signals with 20+ pip potential
├── Don't scalp (spreads too wide)
├── Minimum profit target: 1% of account
├── Consider spread in risk-reward calc
```

### 12.3 Notifications and Alerts

```
Enable in settings:
├── Trade execution alerts (order filled)
├── Position P&L alerts (when up 2%)
├── Margin alerts (when < 150%)
├── News events (upcoming economic data)
├── Withdrawal confirmations
└── Login alerts (security monitoring)

Agent integration:
├── Monitor alert popups
├── Parse alert messages
├── Take action based on alerts
├── Log alerts for analysis
```

---

## 13. Exness Safety Checklist

**Before any live trading:**

```
Account Security:
- [ ] Email verified
- [ ] 2FA enabled (Google Authenticator or Authy)
- [ ] Password changed (strong, unique)
- [ ] Recovery codes saved (offline location)
- [ ] Withdrawal address verified (bank/wallet)
- [ ] IP whitelist enabled

Platform Setup:
- [ ] Test deposit/withdrawal process (small amount)
- [ ] Verify all spreads acceptable
- [ ] Confirm trading hours for desired instruments
- [ ] Check leverage settings (recommend 1:1)
- [ ] Review commission structure (if pro account)

Agent Configuration:
- [ ] Risk parameters set (2% per trade max)
- [ ] Stop loss on every trade (automated)
- [ ] Position sizing calculated (based on ATR)
- [ ] Margin alert threshold set (150%)
- [ ] Daily loss limit configured (3%)
- [ ] Time zone correct (for session trading)

Testing:
- [ ] Backtest strategy 1+ year data
- [ ] Paper trade 1 week without loss > 5%
- [ ] Live trade 1 week with micro lots (0.01)
- [ ] Monitor daily - no automation surprises
- [ ] Only scale up after 1 month success

Go/No-Go Decision:
- [ ] All items above completed
- [ ] Backtested successfully (Sharpe > 1.5)
- [ ] Paper trading successful
- [ ] Comfortable with potential loss
- [ ] Ready to trade live

If not ready → Continue testing
If ready → Begin live trading with caution
```

---

## 14. Quick Reference Commands

**Fast lookup for agent:**

```
NAVIGATE TO:
- Login page: exness.com/accounts
- Trading terminal: trader.exness.com
- Account dashboard: app.exness.com
- Deposit: app.exness.com → Deposit button
- Withdraw: app.exness.com → Withdraw button
- Settings: gear icon → Settings
- Trading history: Dashboard → History

QUICK CHECKS:
- Balance: Top-right of dashboard
- Margin Level: Dashboard center
- Open trades: Bottom of terminal
- Pending orders: Bottom of terminal
- Chart: Center of terminal
- Account size: Settings → Account info

PLACE TRADE:
1. Select symbol (EURUSD, etc.)
2. Set volume (0.01 for testing)
3. Set SL (support level)
4. Set TP (1:2.5 risk-reward)
5. Click BUY or SELL
6. Confirm

CLOSE TRADE:
1. Find in "Open Positions"
2. Right-click → Close
3. Confirm
4. Check closed

MODIFY TRADE:
1. Find in "Open Positions"
2. Right-click → Modify
3. Change SL or TP
4. Apply

MONITOR:
- Every 10 minutes: Check margin level
- Hourly: Review open positions
- End of day: Check daily P&L
- Weekly: Review win rate and results
```

---

## Conclusion

This guide provides all information an AI browser agent needs to:
✅ Navigate the Exness platform  
✅ Manage account and positions  
✅ Execute trades with proper risk management  
✅ Monitor performance and adapt  
✅ Handle errors and edge cases  
✅ Make data-driven decisions  

**Key Principle:** Always prioritize **capital preservation** over profits. The best traders make money by NOT losing it first.

Good luck! 🚀
