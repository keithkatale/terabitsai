# Canvas Design System — Dark Terminal Edition

AI design guidelines for the Terabits Canvas whiteboard. Adapted from Claude's design system for a dark terminal aesthetic.

---

## Core Philosophy

The Canvas is a **precision instrument** — data-dense, high-information, terminal-inspired UI. Think Bloomberg Terminal meets modern dark mode: sharp typography, subtle neon accents, generous negative space, zero decoration.

### Visual Language
- **Dark terminal palette**: near-black backgrounds, zinc/slate mid-tones, white/cyan text
- **Flat & precise**: no gradients, no shadows (except subtle glows on accent elements)
- **Information density**: pack more data into less space with clear hierarchy
- **Subtle motion**: minimal animations; pulse on live elements only

---

## CSS Design Tokens

All tokens are injected as CSS variables by `CanvasDocument`. Use these variables instead of hard-coded colors.

### Color Palette

#### Backgrounds
```css
--canvas-bg-primary: #09090b       /* Near-black page bg */
--canvas-bg-secondary: #18181b     /* Surface/card bg */
--canvas-bg-tertiary: #27272a      /* Nested surface */
```

#### Text
```css
--canvas-text-primary: #fafafa     /* High-contrast white */
--canvas-text-secondary: #a1a1aa   /* Mid-tone zinc (labels, captions) */
--canvas-text-tertiary: #71717a    /* Low-contrast zinc (hints, footnotes) */
```

#### Borders
```css
--canvas-border-primary: rgba(255, 255, 255, 0.1)    /* Strong borders */
--canvas-border-secondary: rgba(255, 255, 255, 0.06) /* Default borders */
--canvas-border-tertiary: rgba(255, 255, 255, 0.04)  /* Subtle dividers */
```

#### Accent Colors (Neon Highlights)
```css
--canvas-cyan-500: #06b6d4        /* Primary brand/info */
--canvas-cyan-400: #22d3ee        
--canvas-violet-500: #8b5cf6      /* Secondary/analysis */
--canvas-violet-400: #a78bfa
--canvas-emerald-500: #10b981     /* Success/profit */
--canvas-emerald-400: #34d399
--canvas-rose-500: #f43f5e        /* Error/loss */
--canvas-rose-400: #fb7185
--canvas-amber-500: #f59e0b       /* Warning/alert */
--canvas-amber-400: #fbbf24
```

#### Semantic Shortcuts
```css
--canvas-color-info: var(--canvas-cyan-400)
--canvas-color-success: var(--canvas-emerald-400)
--canvas-color-warning: var(--canvas-amber-400)
--canvas-color-danger: var(--canvas-rose-400)
```

### Spacing Scale
```css
--canvas-spacing-xs: 0.25rem   /* 4px - tight gaps */
--canvas-spacing-sm: 0.5rem    /* 8px - compact spacing */
--canvas-spacing-md: 1rem      /* 16px - default spacing */
--canvas-spacing-lg: 1.5rem    /* 24px - section spacing */
--canvas-spacing-xl: 2rem      /* 32px - major sections */
```

### Border Radius
```css
--canvas-radius-sm: 0.375rem   /* 6px - small components */
--canvas-radius-md: 0.5rem     /* 8px - cards, inputs */
--canvas-radius-lg: 0.75rem    /* 12px - large cards */
--canvas-radius-xl: 1rem       /* 16px - modal/hero */
```

### Typography
```css
--canvas-font-sans: ui-sans-serif, system-ui, -apple-system, sans-serif
--canvas-font-mono: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace
```

---

## Component Patterns

### 1. Metric Card (Data Summary)

Use for KPIs, stats, summaries.

```html
<div style="
  background: var(--canvas-bg-secondary);
  border: 1px solid var(--canvas-border-secondary);
  border-radius: var(--canvas-radius-md);
  padding: var(--canvas-spacing-md);
">
  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--canvas-text-secondary); margin-bottom: 4px;">
    Total P&L
  </div>
  <div style="font-size: 28px; font-weight: 700; font-family: var(--canvas-font-mono); color: var(--canvas-emerald-400);">
    +$12,450
  </div>
  <div style="font-size: 12px; color: var(--canvas-text-tertiary); margin-top: 4px;">
    +8.2% since open
  </div>
</div>
```

### 2. Data Table (Dense Information)

Tables are core to terminal UX. Keep them tight and monospace.

```html
<table style="width: 100%; border-collapse: collapse; font-family: var(--canvas-font-mono); font-size: 13px;">
  <thead>
    <tr style="border-bottom: 1px solid var(--canvas-border-primary);">
      <th style="text-align: left; padding: 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--canvas-text-secondary);">Symbol</th>
      <th style="text-align: right; padding: 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--canvas-text-secondary);">Price</th>
      <th style="text-align: right; padding: 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--canvas-text-secondary);">Change</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom: 1px solid var(--canvas-border-tertiary);">
      <td style="padding: 8px; color: var(--canvas-text-primary);">BTCUSD</td>
      <td style="padding: 8px; text-align: right; color: var(--canvas-text-primary);">$67,250</td>
      <td style="padding: 8px; text-align: right; color: var(--canvas-emerald-400);">+2.4%</td>
    </tr>
  </tbody>
</table>
```

### 3. Section Header (Hierarchy)

```html
<div style="
  border-bottom: 1px solid var(--canvas-border-secondary);
  padding-bottom: var(--canvas-spacing-sm);
  margin-bottom: var(--canvas-spacing-md);
">
  <h2 style="
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--canvas-text-primary);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  ">
    <span style="display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: var(--canvas-cyan-400); animation: pulse 2s infinite;"></span>
    Market Analysis
  </h2>
</div>
```

### 4. Live Indicator (Pulsing Badge)

For real-time data or active status.

```html
<div style="
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: var(--canvas-radius-sm);
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--canvas-cyan-400);
">
  <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--canvas-cyan-400); animation: pulse 2s infinite;"></span>
  LIVE
</div>
```

### 5. Callout/Alert (Semantic Messaging)

```html
<div style="
  background: rgba(251, 113, 133, 0.05);
  border: 1px solid rgba(251, 113, 133, 0.2);
  border-radius: var(--canvas-radius-md);
  padding: var(--canvas-spacing-md);
">
  <div style="font-weight: 700; font-size: 13px; color: var(--canvas-rose-400); margin-bottom: 4px;">
    Risk Alert
  </div>
  <div style="font-size: 13px; line-height: 1.5; color: var(--canvas-text-secondary);">
    Portfolio exposure exceeds 80% of available capital. Consider reducing position sizes.
  </div>
</div>
```

### 6. Grid Layout (Multi-Column)

```html
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--canvas-spacing-md);">
  <!-- Metric cards go here -->
</div>
```

---

## Component Slots (Data Wiring)

These slots let you embed **live data components** (React widgets with real quotes/charts) into your custom HTML layout.

### Available Slots

#### 1. `AssetPriceChart`
Live price chart with OHLCV from Capital.com.

```html
<div 
  data-component="AssetPriceChart" 
  data-props='{"symbol": "BTCUSD", "range": "1M", "variant": "area"}'
  style="min-height: 300px;"
></div>
```

Props:
- `symbol` (required): e.g. "BTCUSD", "US500", "GOLD"
- `range`: "1D", "1W", "1M", "3M", "6M", "1Y" (default "1M")
- `variant`: "line" | "area" (default "area")

#### 2. `AssetComparativeChart`
Compare two assets side-by-side.

```html
<div 
  data-component="AssetComparativeChart" 
  data-props='{"symbol1": "BTCUSD", "symbol2": "ETHUSD", "range": "6M"}'
  style="min-height: 300px;"
></div>
```

Props:
- `symbol1`, `symbol2` (required)
- `range`: "1M", "3M", "6M", "1Y" (default "6M")

#### 3. `PortfolioBreakdown`
Portfolio allocation pie chart.

```html
<div 
  data-component="PortfolioBreakdown" 
  data-props='{}'
  style="min-height: 300px;"
></div>
```

#### 4. `TradingViewChart`
TradingView embedded chart.

```html
<div 
  data-component="TradingViewChart" 
  data-props='{"symbol": "NASDAQ:AAPL", "interval": "D"}'
  style="min-height: 400px;"
></div>
```

Props:
- `symbol`: TradingView symbol (e.g. "NASDAQ:AAPL", "BINANCE:BTCUSDT")
- `interval`: "1", "5", "15", "60", "D", "W" (default "D")

---

## Interactive Actions

Wire buttons to send prompts back to the AI.

```html
<button 
  data-action="prompt" 
  data-prompt="Analyze Bitcoin technicals on 4H"
  style="
    background: transparent;
    border: 1px solid var(--canvas-cyan-500);
    border-radius: var(--canvas-radius-md);
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--canvas-cyan-400);
    cursor: pointer;
    transition: all 0.15s;
  "
  onmouseover="this.style.background='rgba(6, 182, 212, 0.1)'"
  onmouseout="this.style.background='transparent'"
>
  Analyze BTC
</button>
```

---

## Layout Guidelines

### 1. Information Hierarchy
- **Title/Hero**: 20-28px, bold, top of canvas
- **Section headers**: 14px, uppercase, heavy tracking
- **Body text**: 13-14px, line-height 1.5
- **Captions/footnotes**: 11-12px, secondary color

### 2. Spacing Strategy
- **Sections**: 24px (`--canvas-spacing-lg`) vertical gap
- **Cards**: 16px (`--canvas-spacing-md`) padding
- **Inline gaps**: 8px (`--canvas-spacing-sm`) between related items

### 3. Responsive Columns
Use CSS Grid with auto-fit for responsive layouts:

```html
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
  <!-- Cards here -->
</div>
```

### 4. Terminal Typography
- **Monospace for data**: prices, percentages, codes, symbols
- **Sans-serif for labels**: headers, descriptions, body text
- **Font weight hierarchy**: 700 (headers) → 600 (emphasis) → 400 (body)

---

## Complexity Budget

### Hard Limits
- **Sections per canvas**: ≤ 6 major sections (use tabs/toggles for more)
- **Colors per canvas**: ≤ 3 accent colors (cyan + 2 others)
- **Table columns**: ≤ 8 columns (more → horizontal scroll)
- **Metric cards in a row**: ≤ 4 at desktop width

### Best Practices
- **One chart per section**: don't cram 3 charts side-by-side
- **White space > decoration**: generous margins, clean borders, no fills
- **Hierarchy via size/weight**: not color variety

---

## Common Patterns

### Full-Width Hero Dashboard

```html
<div style="margin-bottom: var(--canvas-spacing-xl);">
  <!-- Header -->
  <div style="margin-bottom: var(--canvas-spacing-lg);">
    <h1 style="font-size: 24px; font-weight: 700; color: var(--canvas-text-primary); margin: 0 0 8px 0;">
      Portfolio Overview
    </h1>
    <p style="font-size: 13px; color: var(--canvas-text-secondary); margin: 0;">
      Real-time position monitoring and risk metrics
    </p>
  </div>

  <!-- Metric Grid -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
    <!-- Metric cards here -->
  </div>

  <!-- Chart Section -->
  <div style="background: var(--canvas-bg-secondary); border: 1px solid var(--canvas-border-secondary); border-radius: var(--canvas-radius-lg); padding: 16px;">
    <div data-component="AssetPriceChart" data-props='{"symbol": "US500", "range": "1M"}' style="min-height: 300px;"></div>
  </div>
</div>
```

---

## Animation (Minimal)

Only animate **state changes** and **live data**. No decorative motion.

```html
<style>
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>

<span style="animation: pulse 2s infinite;">●</span> LIVE
```

---

## Accessibility

- **Contrast**: maintain 4.5:1 minimum for body text
- **Interactive elements**: visible focus states, ≥44px touch targets
- **Semantic HTML**: use `<table>`, `<section>`, `<h1-6>` tags
- **Alt text**: describe chart/data content in text fallbacks
