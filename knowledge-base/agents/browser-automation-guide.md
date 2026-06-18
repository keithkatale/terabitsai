# Exness Browser Automation Guide

Complete guide for automating browser interactions with the Exness trading platform using Python, JavaScript, or other frameworks.

## 1. Framework Selection

### 1.1 Selenium (Python)

**Best for:** Complex automation, multi-browser support, Python ecosystem

```python
# Installation
pip install selenium webdriver-manager

# Basic setup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# Initialize driver
driver = webdriver.Chrome(ChromeDriverManager().install())

# Navigate to Exness
driver.get("https://www.exness.com/accounts")

# Wait for element to load (up to 10 seconds)
element = WebDriverWait(driver, 10).until(
    EC.presence_of_element_located((By.ID, "login-button"))
)
element.click()
```

**Advantages:**
- ✅ Mature ecosystem
- ✅ Great documentation
- ✅ Works with all browsers
- ✅ Good for complex workflows

**Disadvantages:**
- ❌ Slower execution
- ❌ Can be flaky with dynamic content

### 1.2 Puppeteer (JavaScript/Node.js)

**Best for:** JavaScript, fast automation, headless mode

```javascript
// Installation
npm install puppeteer

// Basic setup
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false  // Set to true for headless mode
  });
  
  const page = await browser.newPage();
  await page.goto('https://www.exness.com/accounts');
  
  // Wait for element and click
  await page.waitForSelector('#login-button');
  await page.click('#login-button');
  
  await browser.close();
})();
```

**Advantages:**
- ✅ Very fast execution
- ✅ Great for JavaScript projects
- ✅ Excellent documentation
- ✅ Chrome DevTools integration

**Disadvantages:**
- ❌ Chrome/Chromium only
- ❌ Requires Node.js

### 1.3 Playwright (Python/JavaScript)

**Best for:** Modern approach, fastest, multi-browser

```python
# Installation
pip install playwright
playwright install

# Basic setup
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    
    page.goto("https://www.exness.com/accounts")
    page.click("#login-button")
    
    browser.close()
```

**Advantages:**
- ✅ Fastest execution
- ✅ Multi-browser support
- ✅ Modern API
- ✅ Better debugging tools

**Disadvantages:**
- ❌ Newer (less Stack Overflow help)
- ❌ Can be memory intensive

---

## 2. Login Automation

### 2.1 Basic Login (Selenium)

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

class ExnessBot:
    def __init__(self, email, password):
        self.email = email
        self.password = password
        self.driver = webdriver.Chrome()
    
    def login(self):
        """Automate login to Exness"""
        try:
            # Navigate to login page
            self.driver.get("https://www.exness.com/accounts")
            
            # Wait for email input and enter email
            email_input = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.NAME, "email"))
            )
            email_input.clear()
            email_input.send_keys(self.email)
            
            # Enter password
            password_input = self.driver.find_element(By.NAME, "password")
            password_input.clear()
            password_input.send_keys(self.password)
            
            # Click login button
            login_button = self.driver.find_element(
                By.XPATH, 
                "//button[contains(text(), 'Login')]"
            )
            login_button.click()
            
            # Wait for dashboard to load
            WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.CLASS_NAME, "dashboard"))
            )
            
            print("✓ Login successful")
            return True
            
        except Exception as e:
            print(f"✗ Login failed: {e}")
            return False
```

### 2.2 Login with 2FA

```python
def login_with_2fa(self, totp_secret=None):
    """Login with two-factor authentication"""
    try:
        # Step 1: Standard login
        self.login_without_2fa()
        
        # Step 2: Wait for 2FA prompt
        time.sleep(2)
        
        # Step 3: Get 2FA code from authenticator
        # Option A: Use pyotp library
        import pyotp
        totp = pyotp.TOTP(totp_secret)
        code = totp.now()
        
        # Option B: Manual input (for testing)
        # code = input("Enter 2FA code: ")
        
        # Step 4: Enter 2FA code
        code_input = WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.ID, "2fa-code-input"))
        )
        code_input.send_keys(code)
        
        # Step 5: Confirm
        confirm_button = self.driver.find_element(
            By.XPATH,
            "//button[contains(text(), 'Confirm')]"
        )
        confirm_button.click()
        
        # Wait for dashboard
        WebDriverWait(self.driver, 15).until(
            EC.presence_of_element_located((By.CLASS_NAME, "dashboard"))
        )
        
        print("✓ 2FA login successful")
        return True
        
    except Exception as e:
        print(f"✗ 2FA login failed: {e}")
        return False
```

---

## 3. Trading Execution Automation

### 3.1 Place Market Order

```python
def place_market_order(self, symbol, direction, volume, sl_pips, tp_pips):
    """
    Place a market order
    Args:
        symbol: "EURUSD", "GOLD", etc.
        direction: "BUY" or "SELL"
        volume: 0.01 (lot size)
        sl_pips: 50 (stop loss pips)
        tp_pips: 100 (take profit pips)
    """
    try:
        # Click on trading terminal
        terminal_button = self.driver.find_element(
            By.XPATH,
            "//button[contains(text(), 'Trade Now')]"
        )
        terminal_button.click()
        
        # Switch to terminal window/frame if needed
        time.sleep(1)
        
        # Select symbol
        symbol_input = WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.ID, "symbol-search"))
        )
        symbol_input.clear()
        symbol_input.send_keys(symbol)
        time.sleep(0.5)
        
        # Click symbol from dropdown
        symbol_option = self.driver.find_element(
            By.XPATH,
            f"//div[contains(text(), '{symbol}')]"
        )
        symbol_option.click()
        
        # Select order type: Market
        market_radio = self.driver.find_element(
            By.XPATH,
            "//input[@value='market']/.."
        )
        market_radio.click()
        
        # Enter volume
        volume_input = WebDriverWait(self.driver, 5).until(
            EC.presence_of_element_located((By.ID, "order-volume"))
        )
        volume_input.clear()
        volume_input.send_keys(str(volume))
        
        # Enter stop loss
        sl_input = self.driver.find_element(By.ID, "stop-loss")
        sl_input.clear()
        sl_input.send_keys(str(sl_pips))
        
        # Enter take profit
        tp_input = self.driver.find_element(By.ID, "take-profit")
        tp_input.clear()
        tp_input.send_keys(str(tp_pips))
        
        # Click BUY or SELL button
        order_button = self.driver.find_element(
            By.XPATH,
            f"//button[contains(text(), '{direction}')]"
        )
        order_button.click()
        
        # Wait for confirmation
        WebDriverWait(self.driver, 5).until(
            EC.presence_of_element_located((By.CLASS_NAME, "position-opened"))
        )
        
        print(f"✓ {direction} order placed: {volume} {symbol}")
        return True
        
    except Exception as e:
        print(f"✗ Order placement failed: {e}")
        return False
```

### 3.2 Place Pending Order

```python
def place_pending_order(self, symbol, order_type, entry_price, volume, 
                       sl_pips, tp_pips, expiration_hours=24):
    """
    Place a pending order
    Args:
        symbol: "EURUSD"
        order_type: "BUY_LIMIT", "BUY_STOP", "SELL_LIMIT", "SELL_STOP"
        entry_price: 1.1050 (exact price to trigger)
        volume: 0.01
        sl_pips: 50
        tp_pips: 100
        expiration_hours: 24 (when order expires if not filled)
    """
    try:
        # Navigate to pending orders section
        pending_tab = self.driver.find_element(
            By.XPATH,
            "//tab[contains(text(), 'Pending Orders')]"
        )
        pending_tab.click()
        
        # Click "New Pending Order"
        new_order_button = self.driver.find_element(
            By.XPATH,
            "//button[contains(text(), 'New Order')]"
        )
        new_order_button.click()
        
        # Select symbol
        symbol_input = WebDriverWait(self.driver, 5).until(
            EC.presence_of_element_located((By.ID, "pending-symbol"))
        )
        symbol_input.send_keys(symbol)
        
        # Select order type
        type_dropdown = self.driver.find_element(By.ID, "pending-type")
        type_dropdown.click()
        type_option = self.driver.find_element(
            By.XPATH,
            f"//option[contains(text(), '{order_type}')]"
        )
        type_option.click()
        
        # Enter entry price
        entry_input = self.driver.find_element(By.ID, "entry-price")
        entry_input.send_keys(str(entry_price))
        
        # Enter volume
        volume_input = self.driver.find_element(By.ID, "pending-volume")
        volume_input.send_keys(str(volume))
        
        # Enter stop loss and take profit
        sl_input = self.driver.find_element(By.ID, "pending-sl")
        sl_input.send_keys(str(sl_pips))
        
        tp_input = self.driver.find_element(By.ID, "pending-tp")
        tp_input.send_keys(str(tp_pips))
        
        # Set expiration
        expiration_input = self.driver.find_element(By.ID, "expiration-hours")
        expiration_input.clear()
        expiration_input.send_keys(str(expiration_hours))
        
        # Create order
        create_button = self.driver.find_element(
            By.XPATH,
            "//button[contains(text(), 'Create Order')]"
        )
        create_button.click()
        
        # Wait for confirmation
        WebDriverWait(self.driver, 5).until(
            EC.presence_of_element_located((By.CLASS_NAME, "order-created"))
        )
        
        print(f"✓ Pending {order_type} order created: {volume} {symbol}")
        return True
        
    except Exception as e:
        print(f"✗ Pending order creation failed: {e}")
        return False
```

---

## 4. Position Management

### 4.1 Get Open Positions

```python
def get_open_positions(self):
    """Retrieve all open positions"""
    try:
        positions = []
        
        # Wait for positions table to load
        position_rows = WebDriverWait(self.driver, 10).until(
            EC.presence_of_all_elements_located(
                (By.XPATH, "//table[@id='positions']//tbody/tr")
            )
        )
        
        for row in position_rows:
            cells = row.find_elements(By.TAG_NAME, "td")
            position = {
                'symbol': cells[1].text,
                'volume': float(cells[2].text),
                'entry_price': float(cells[3].text),
                'current_price': float(cells[4].text),
                'pnl': float(cells[5].text),
                'pnl_percent': float(cells[6].text),
                'stop_loss': float(cells[7].text),
                'take_profit': float(cells[8].text),
                'open_time': cells[9].text
            }
            positions.append(position)
        
        print(f"✓ Retrieved {len(positions)} open positions")
        return positions
        
    except Exception as e:
        print(f"✗ Failed to get positions: {e}")
        return []
```

### 4.2 Close Position

```python
def close_position(self, position_id):
    """Close a specific position"""
    try:
        # Find and click the position row
        position_row = self.driver.find_element(
            By.XPATH,
            f"//tr[@data-position-id='{position_id}']"
        )
        
        # Right-click to open context menu
        from selenium.webdriver.common.action_chains import ActionChains
        actions = ActionChains(self.driver)
        actions.context_click(position_row).perform()
        
        # Click "Close" option
        close_option = WebDriverWait(self.driver, 5).until(
            EC.presence_of_element_located(
                (By.XPATH, "//div[contains(text(), 'Close')]")
            )
        )
        close_option.click()
        
        # Confirm closure
        confirm_button = WebDriverWait(self.driver, 5).until(
            EC.presence_of_element_located(
                (By.XPATH, "//button[contains(text(), 'Confirm')]")
            )
        )
        confirm_button.click()
        
        # Wait for position to be removed
        WebDriverWait(self.driver, 5).until(
            EC.invisibility_of_element(position_row)
        )
        
        print(f"✓ Position {position_id} closed")
        return True
        
    except Exception as e:
        print(f"✗ Failed to close position: {e}")
        return False
```

### 4.3 Modify Position

```python
def modify_position(self, position_id, new_sl=None, new_tp=None):
    """Modify stop loss and/or take profit of a position"""
    try:
        # Find position row
        position_row = self.driver.find_element(
            By.XPATH,
            f"//tr[@data-position-id='{position_id}']"
        )
        
        # Right-click to open context menu
        from selenium.webdriver.common.action_chains import ActionChains
        actions = ActionChains(self.driver)
        actions.context_click(position_row).perform()
        
        # Click "Modify"
        modify_option = WebDriverWait(self.driver, 5).until(
            EC.presence_of_element_located(
                (By.XPATH, "//div[contains(text(), 'Modify')]")
            )
        )
        modify_option.click()
        
        # Wait for modify dialog
        dialog = WebDriverWait(self.driver, 5).until(
            EC.presence_of_element_located((By.CLASS_NAME, "modify-dialog"))
        )
        
        # Update stop loss if provided
        if new_sl is not None:
            sl_input = dialog.find_element(By.ID, "new-sl")
            sl_input.clear()
            sl_input.send_keys(str(new_sl))
        
        # Update take profit if provided
        if new_tp is not None:
            tp_input = dialog.find_element(By.ID, "new-tp")
            tp_input.clear()
            tp_input.send_keys(str(new_tp))
        
        # Click Apply/Update
        apply_button = dialog.find_element(
            By.XPATH,
            "//button[contains(text(), 'Apply')]"
        )
        apply_button.click()
        
        # Wait for update confirmation
        WebDriverWait(self.driver, 5).until(
            EC.invisibility_of_element(dialog)
        )
        
        print(f"✓ Position {position_id} modified")
        return True
        
    except Exception as e:
        print(f"✗ Failed to modify position: {e}")
        return False
```

---

## 5. Account Monitoring

### 5.1 Get Account Metrics

```python
def get_account_metrics(self):
    """Retrieve key account metrics"""
    try:
        metrics = {}
        
        # Get balance
        balance_elem = WebDriverWait(self.driver, 5).until(
            EC.presence_of_element_located((By.ID, "balance"))
        )
        metrics['balance'] = float(balance_elem.text.replace('$', '').replace(',', ''))
        
        # Get equity
        equity_elem = self.driver.find_element(By.ID, "equity")
        metrics['equity'] = float(equity_elem.text.replace('$', '').replace(',', ''))
        
        # Get used margin
        used_margin_elem = self.driver.find_element(By.ID, "used-margin")
        metrics['used_margin'] = float(used_margin_elem.text.replace('%', ''))
        
        # Get free margin
        free_margin_elem = self.driver.find_element(By.ID, "free-margin")
        metrics['free_margin'] = float(free_margin_elem.text.replace('$', '').replace(',', ''))
        
        # Get margin level
        margin_level_elem = self.driver.find_element(By.ID, "margin-level")
        metrics['margin_level'] = float(margin_level_elem.text.replace('%', ''))
        
        # Calculate derived metrics
        metrics['pnl'] = metrics['equity'] - metrics['balance']
        metrics['pnl_percent'] = (metrics['pnl'] / metrics['balance'] * 100) if metrics['balance'] > 0 else 0
        
        print(f"✓ Account Metrics: Balance=${metrics['balance']:.2f}, Margin Level={metrics['margin_level']:.1f}%")
        return metrics
        
    except Exception as e:
        print(f"✗ Failed to get account metrics: {e}")
        return None
```

### 5.2 Monitor Margin Level

```python
def monitor_margin_level(self, alert_threshold=100):
    """
    Monitor margin level continuously
    Alert if margin level drops below threshold
    """
    import time
    
    while True:
        try:
            metrics = self.get_account_metrics()
            
            if metrics and metrics['margin_level'] < alert_threshold:
                print(f"⚠️ ALERT: Margin level {metrics['margin_level']:.1f}% - Below threshold {alert_threshold}%")
                
                # Trigger action (e.g., close positions)
                if metrics['margin_level'] < 100:
                    print("🚨 CRITICAL: Margin call level - closing positions")
                    self.close_all_positions()
                    return False
            
            # Check every 10 seconds
            time.sleep(10)
            
        except Exception as e:
            print(f"✗ Monitoring error: {e}")
            time.sleep(10)
```

---

## 6. Error Handling and Retries

### 6.1 Robust Login with Retry

```python
def login_with_retry(self, max_retries=3, retry_delay=2):
    """Login with automatic retry on failure"""
    for attempt in range(1, max_retries + 1):
        try:
            print(f"Login attempt {attempt}/{max_retries}")
            
            if self.login():
                return True
                
        except Exception as e:
            print(f"Attempt {attempt} failed: {e}")
            
            if attempt < max_retries:
                time.sleep(retry_delay)
                # Restart driver for fresh browser
                self.driver.quit()
                self.driver = webdriver.Chrome()
            else:
                print("✗ Login failed after all retries")
                return False
    
    return False
```

### 6.2 Exponential Backoff for API Calls

```python
import time
from functools import wraps

def retry_with_backoff(max_retries=3):
    """Decorator for retry with exponential backoff"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries:
                        raise
                    
                    wait_time = 2 ** (attempt - 1)  # 1s, 2s, 4s, 8s
                    print(f"Attempt {attempt} failed: {e}. Retrying in {wait_time}s")
                    time.sleep(wait_time)
        
        return wrapper
    return decorator

# Usage
@retry_with_backoff(max_retries=3)
def place_order_safe(self, **kwargs):
    return self.place_market_order(**kwargs)
```

---

## 7. Complete Trading Bot Example

```python
import time
from datetime import datetime

class AutomatedTradingBot:
    def __init__(self, email, password, totp_secret=None):
        self.email = email
        self.password = password
        self.totp_secret = totp_secret
        self.driver = None
        self.is_running = False
        self.trades_log = []
    
    def start(self):
        """Initialize bot and login"""
        print("🤖 Starting Trading Bot...")
        
        self.driver = webdriver.Chrome()
        
        if not self.login_with_2fa():
            print("✗ Failed to login")
            return False
        
        print("✓ Bot started successfully")
        self.is_running = True
        return True
    
    def trading_loop(self, check_interval=60):
        """Main trading loop"""
        while self.is_running:
            try:
                # 1. Get account metrics
                metrics = self.get_account_metrics()
                if not metrics:
                    time.sleep(check_interval)
                    continue
                
                # 2. Check if account healthy
                if metrics['margin_level'] < 100:
                    print("🚨 Margin call - stopping")
                    self.is_running = False
                    break
                
                # 3. Check for trading signals (your logic here)
                signal = self.check_trading_signals()
                
                # 4. Execute trade if signal exists
                if signal:
                    self.execute_trade(signal)
                
                # 5. Manage open positions
                self.manage_positions()
                
                # 6. Log metrics
                self.log_metrics(metrics)
                
                # 7. Wait before next iteration
                time.sleep(check_interval)
                
            except Exception as e:
                print(f"✗ Trading loop error: {e}")
                time.sleep(check_interval)
    
    def check_trading_signals(self):
        """Check for trading signals - implement your logic here"""
        # This is where your technical analysis code goes
        # Return signal dict if trade should be executed
        # Format: {
        #     'symbol': 'EURUSD',
        #     'direction': 'BUY',
        #     'volume': 0.01,
        #     'sl_pips': 50,
        #     'tp_pips': 100
        # }
        return None
    
    def execute_trade(self, signal):
        """Execute a trade signal"""
        if self.place_market_order(**signal):
            self.trades_log.append({
                'timestamp': datetime.now(),
                'signal': signal,
                'status': 'executed'
            })
    
    def manage_positions(self):
        """Manage open positions"""
        positions = self.get_open_positions()
        
        for position in positions:
            # Your position management logic here
            # E.g., trail stops, take partial profits, etc.
            pass
    
    def log_metrics(self, metrics):
        """Log account metrics"""
        print(f"[{datetime.now()}] Balance: ${metrics['balance']:.2f} | "
              f"Equity: ${metrics['equity']:.2f} | "
              f"Margin: {metrics['margin_level']:.1f}%")
    
    def stop(self):
        """Stop bot and cleanup"""
        print("🛑 Stopping bot...")
        self.is_running = False
        
        # Close all open positions
        self.close_all_positions()
        
        # Close browser
        if self.driver:
            self.driver.quit()
        
        print("✓ Bot stopped")

# Usage
if __name__ == "__main__":
    bot = AutomatedTradingBot(
        email="your@email.com",
        password="your_password",
        totp_secret="your_totp_secret"
    )
    
    if bot.start():
        try:
            bot.trading_loop(check_interval=60)
        except KeyboardInterrupt:
            bot.stop()
```

---

## 8. Best Practices

### 8.1 Security

```python
# ✓ DO: Use environment variables for credentials
import os
from dotenv import load_dotenv

load_dotenv()
email = os.getenv('EXNESS_EMAIL')
password = os.getenv('EXNESS_PASSWORD')
totp_secret = os.getenv('EXNESS_TOTP_SECRET')

# ✗ DON'T: Hardcode credentials
# email = "user@example.com"
# password = "plaintext_password"

# ✓ DO: Use headless mode for production
driver = webdriver.Chrome(options={'headless': True})

# ✓ DO: Implement proper error logging
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
```

### 8.2 Stability

```python
# ✓ DO: Use explicit waits
element = WebDriverWait(driver, 10).until(
    EC.presence_of_element_located((By.ID, "element"))
)

# ✗ DON'T: Use sleep to wait
time.sleep(5)

# ✓ DO: Handle stale elements
from selenium.common.exceptions import StaleElementReferenceException

try:
    element.click()
except StaleElementReferenceException:
    element = driver.find_element(By.ID, "element")
    element.click()

# ✓ DO: Close browser properly
try:
    driver.quit()
except:
    driver.close()
```

### 8.3 Monitoring

```python
# ✓ DO: Log all trades
import json
from datetime import datetime

def log_trade(trade_data):
    timestamp = datetime.now().isoformat()
    log_entry = {
        'timestamp': timestamp,
        **trade_data
    }
    
    with open('trades.log', 'a') as f:
        f.write(json.dumps(log_entry) + '\n')

# ✓ DO: Monitor system resources
import psutil

def check_system_resources():
    cpu_percent = psutil.cpu_percent(interval=1)
    memory_percent = psutil.virtual_memory().percent
    
    if cpu_percent > 80 or memory_percent > 80:
        print(f"⚠️ High resource usage: CPU {cpu_percent}%, Mem {memory_percent}%")
        return False
    return True
```

---

## 9. Testing

### 9.1 Unit Tests

```python
import unittest
from unittest.mock import patch, MagicMock

class TestExnessBot(unittest.TestCase):
    
    def setUp(self):
        self.bot = ExnessBot("test@test.com", "password")
    
    def tearDown(self):
        if self.bot.driver:
            self.bot.driver.quit()
    
    def test_position_sizing_calculation(self):
        """Test position size calculation"""
        position_size = self.bot.calculate_position_size(
            account_size=10000,
            risk_percent=2,
            stop_loss_pips=50
        )
        self.assertEqual(position_size, 0.04)
    
    @patch('selenium.webdriver.Chrome')
    def test_login_success(self, mock_driver):
        """Test successful login"""
        mock_driver.return_value.find_element.return_value = MagicMock()
        result = self.bot.login()
        self.assertTrue(result)

if __name__ == '__main__':
    unittest.main()
```

---

## Conclusion

This guide provides a complete framework for automating Exness trading platform interactions. Key principles:

1. **Security** - Never hardcode credentials, use environment variables
2. **Stability** - Use explicit waits, handle errors gracefully
3. **Monitoring** - Log all trades, monitor system resources
4. **Testing** - Test thoroughly before live trading
5. **Simplicity** - Start with basic automation, add complexity gradually

Choose Playwright for new projects, Selenium for legacy support, and Puppeteer for JavaScript environments.

Good luck with your automated trading! 🚀
