---
version: 1.0
name: Reactive-Inspired Design System (Reflex, Standing Orders, Helm)
description: >
  A design system for our three Reactive Omni Buildathon apps, taken from what Reactive Network
  ships today: reactive.network, Reactscan (lasna.reactscan.net), the docs site, and the
  official press-page brand kit. Pure-black canvas, near-white Inter type set at regular weight,
  Roboto Mono for every label and on-chain value, hairline borders instead of shadows, ASCII-art
  motifs, bracket syntax ("// LABEL", "[ ACTION ]"), and one blue-cyan-lilac brand gradient used
  very sparingly. Built so our apps feel at home next to Reactive's own products while keeping our
  own product names and marks.
source:
  observed: "reactive.network, lasna.reactscan.net, dev.reactive.network — inspected 2026-11-12"
  brand-kit: "https://reactive.network/press (official colors and logo rules)"

colors:
  # --- Official brand colors (Reactive press kit) ---
  royal-600: "#2756FC"      # primary brand blue
  maya-300: "#62D0FF"       # cyan; used on-site for "[ New ]" tags and highlights
  quartz-200: "#CBB5FF"     # lilac; end of the logo gradient
  malachite-400: "#00C853"  # brand green
  bland-950: "#101010"      # near-black surface
  bland-50: "#F5F5F7"       # near-white ink
  # --- Logo gradient as drawn on the site (do not apply to the logo yourself) ---
  gradient-start: "#62D0FF"
  gradient-mid: "#3C2EFF"
  gradient-end: "#CBB5FF"
  # --- Surfaces (observed) ---
  canvas: "#000000"         # page background (html)
  surface: "#101010"        # cards, panels (Bland 950)
  surface-raised: "#1C1C1D" # stat tiles, heatmap cells (Reactscan)
  surface-input: "#242426"  # search / input fields
  surface-active: "#2F2F31" # active cell, hover fill
  card-gradient-from: "#1D1D1F"
  card-gradient-to: "#101010"
  # --- Text (observed; alpha values over black) ---
  ink: "#F5F5F7"                         # headlines, key numbers
  ink-default: "rgba(255,255,255,0.87)"  # default body text
  text-secondary: "rgba(245,245,247,0.70)" # paragraphs
  text-mono: "rgba(245,245,247,0.75)"    # mono data rows
  text-muted: "rgba(245,245,247,0.50)"   # labels, captions, "// SECTION"
  text-faint: "rgba(245,245,247,0.30)"   # decorative only, never for meaning
  gray-500: "#86868B"
  gray-600: "#6E6E73"
  # --- Lines ---
  hairline: "rgba(245,245,247,0.20)"     # card + panel borders, section dividers
  hairline-soft: "rgba(245,245,247,0.10)"
  border-strong: "#777777"
  border-quiet: "#333333"
  # --- Status (observed on Reactscan unless noted) ---
  success: "#1A9F44"        # "(v) SUCCESS", positive deltas
  success-brand: "#00C853"  # Malachite, for large success moments
  danger: "#BC001D"         # negative deltas, failures (fills, icons, large text)
  danger-text: "#FF5A6A"    # OUR ADJUSTMENT — #BC001D is only ~3:1 on black; use this for small text
  warning: "#F5A524"        # OUR ADDITION — Reactive shows no warning color
  info: "#62D0FF"           # Maya
  ai: "#CBB5FF"             # OUR ADDITION of meaning — Quartz marks AI-generated content (Helm)

typography:
  families:
    sans: '"Inter Variable", Inter, system-ui, Avenir, Helvetica, Arial, sans-serif'
    mono: '"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
  display-xl:   { fontFamily: sans, fontSize: 96px, fontWeight: 400, lineHeight: 1.0,  letterSpacing: -0.02em }
  display-lg:   { fontFamily: sans, fontSize: 64px, fontWeight: 400, lineHeight: 1.0,  letterSpacing: -0.01em }
  heading:      { fontFamily: sans, fontSize: 30px, fontWeight: 400, lineHeight: 1.25 }
  title:        { fontFamily: sans, fontSize: 24px, fontWeight: 500, lineHeight: 32px }
  card-title:   { fontFamily: sans, fontSize: 20px, fontWeight: 500, lineHeight: 28px }
  body-lg:      { fontFamily: sans, fontSize: 18px, fontWeight: 400, lineHeight: 1.375 }
  body:         { fontFamily: sans, fontSize: 16px, fontWeight: 400, lineHeight: 24px }
  body-strong:  { fontFamily: sans, fontSize: 16px, fontWeight: 700, lineHeight: 24px }
  stat:         { fontFamily: sans, fontSize: 30px, fontWeight: 400, lineHeight: 1.2, fontVariantNumeric: tabular-nums }
  mono-label:   { fontFamily: mono, fontSize: 14px, fontWeight: 400, lineHeight: 20px, textTransform: uppercase }
  mono-nav:     { fontFamily: mono, fontSize: 14px, fontWeight: 500, lineHeight: 20px, textTransform: uppercase }
  mono-data:    { fontFamily: mono, fontSize: 14px, fontWeight: 400, lineHeight: 20px }
  mono-data-lg: { fontFamily: mono, fontSize: 16px, fontWeight: 400, lineHeight: 24px }
  mono-caption: { fontFamily: mono, fontSize: 12px, fontWeight: 400, lineHeight: 16px, textTransform: uppercase }

rounded:
  none: 0px
  sm: 4px     # heatmap cells, small chips
  md: 6px     # inputs, buttons
  lg: 8px     # app panels (Reactscan)
  xl: 12px    # marketing cards
  2xl: 16px
  full: 9999px # floating nav pill, round tags

borders:
  card: "2px solid rgba(245,245,247,0.20)"   # marketing cards (reactive.network)
  panel: "1px solid rgba(245,245,247,0.20)"  # app panels (Reactscan)
  divider: "1px solid rgba(245,245,247,0.20)"

spacing:
  base: 4px
  scale: [4, 8, 12, 16, 24, 32, 48, 64, 96, 128]
  page-gutter: 24px
  card-padding: 16px      # 24px for large feature cards
  section-gap: 96px
  container-max: 1536px

motion:
  ease: "cubic-bezier(0.4, 0, 0.2, 1)"
  duration-fast: 150ms
  duration-base: 300ms     # color, border, background transitions
  duration-slow: 450ms     # width / layout transitions
---

# Reactive-Inspired Design System

## Overview

Reactive's look is **a terminal that went to design school**. The canvas is pure black. Headlines are huge but set at *regular* weight in Inter, so they feel calm rather than loud. Every label, number, address and status is in Roboto Mono, often uppercase and wrapped in code-like syntax: `// SECTION`, `[ ACTION ]`, `[+]`, `view all >>`. Decoration comes from ASCII art, dot grids and one soft blue glow, never from shadows or glossy gradients. Color is almost absent; when it appears it means something.

There are two modes of the same language:
- **Marketing mode** (reactive.network): big type, wide spacing, 12px cards with 2px hairline borders, ASCII illustrations, animated text-scramble headlines.
- **App mode** (Reactscan): dense dashboards, mono everywhere, 8px panels with 1px hairlines, stat tiles, heatmap grids, grey bar charts, green/red deltas.

**Our three apps are in app mode.** Use marketing mode only for each app's landing/hero section.

### Brand and naming rules (important)

- Our products keep **their own names and wordmarks**: Reflex, Standing Orders, Helm. Never use the Reactive logo as our logo, and never present our apps as official Reactive products.
- To credit the platform, use a small **"Built on Reactive"** badge with the official logotype from the [media kit](https://reactive.network/press). Per Reactive's rules: keep clear space equal to the symbol's height; don't recolor, rotate, stretch or add effects; on busy backgrounds use the solid white logotype instead of the gradient one.

## Colors

### Brand and accent

| Token | Hex | Use |
| --- | --- | --- |
| Royal 600 | `#2756FC` | Primary buttons, focus rings, the one key action per screen |
| Maya 300 | `#62D0FF` | Highlights, `[ New ]` tags, active links, live indicators |
| Quartz 200 | `#CBB5FF` | Secondary accent; in Helm it marks AI-generated content |
| Malachite 400 | `#00C853` | Big success moments (loan protected, funds saved) |

The **logo gradient** (`#62D0FF → #3C2EFF → #CBB5FF`) belongs to the logo. Use it at most once per app, for example as a 1px top border on the hero card or a soft glow behind it. Never on text, never on buttons.

### Surfaces

Pure black `#000000` page → `#101010` cards and panels → `#1C1C1D` tiles → `#242426` inputs → `#2F2F31` hover/active. Depth comes from these steps plus hairlines, **not shadows**.

### Text

Text is near-white with opacity, not grey hex values:
- `#F5F5F7` for headlines and key numbers
- 87% white for default text, 70% for paragraphs, 50% for labels and captions
- 30% only for decoration (ASCII art, placeholder dots), never for anything a user must read

### Semantic

| Meaning | Color | Example |
| --- | --- | --- |
| Success / up | `#1A9F44` | `(v) SUCCESS`, `^ 1.01% (24h)` |
| Danger / down | `#BC001D` fills; `#FF5A6A` for small text *(our adjustment for contrast)* | `v 4.36% (24h)`, failed callback, price shock |
| Warning | `#F5A524` *(our addition)* | Guardian warning, low REACT balance |
| Info / live | `#62D0FF` | Live loop in progress, "new" tags |

Always pair color with a symbol or word (`^`, `v`, `(v)`, `(x)`, `[!]`): never rely on color alone.

## Typography

### Families
- **Inter Variable** for headlines, body and big numbers. Load with `@fontsource-variable/inter` or `next/font/google` (Inter).
- **Roboto Mono** for labels, navigation, addresses, hashes, timestamps, statuses and data rows. Load with `@fontsource/roboto-mono` or `next/font/google`.

### Hierarchy (app mode)

| Role | Style |
| --- | --- |
| Page title | Inter 30/37.5, weight 400, `#F5F5F7` |
| Section label | Roboto Mono 14, uppercase, 50%, prefixed `// ` |
| Stat value | Inter 30, weight 400, tabular numbers |
| Stat delta | Inter 14, success or danger color, `^`/`v` prefix |
| Card title | Inter 20/28, weight 500 |
| Body | Inter 16/24, 87% |
| Data row | Roboto Mono 14/20, 75% |
| Caption / time | Roboto Mono 12–14, 50% ("4 seconds ago") |

### Principles
- **Big type stays at weight 400.** Reactive's 96px and 64px headlines are regular weight. Bold is only for short emphasis inside body text.
- **Anything on-chain is mono.** Addresses, hashes, block numbers, amounts with units (`0 REACT`), latency (`1.2s`).
- **Labels are uppercase mono; content is sentence-case sans.**
- **Shorten addresses** the Reactscan way: `0x038E06...F9bD6B82` (first 6–8 + last 6–8).

## Layout

- **Container:** up to 1536px wide, 24px page gutters.
- **Grid:** 12 columns. Reactscan uses a 4-up stat row, then a 1/2 + 1/2 row, then a 1/3 + 2/3 row.
- **Sections** are separated by a full-width 1px hairline and generous space (~96px in marketing mode, 32–48px in app mode).
- **Spacing:** 4px base; most gaps are 8, 16 or 24.
- **Breakpoints:** stack to one column under 768px; stat row becomes 2×2; keep the mono labels.

## Elevation and depth

There are **no drop shadows**. Depth comes from:
1. Surface steps (black → `#101010` → `#1C1C1D`).
2. Hairline borders at 20% white.
3. A blurred translucent background on floating elements (the nav pill, modals): `background: rgba(16,16,16,0.7); backdrop-filter: blur(12px)`.
4. One soft blue glow plus a dot grid in the hero (decorative only).

## Shapes

| Radius | Where |
| --- | --- |
| 4px | Heatmap cells, tiny chips |
| 6px | Inputs, buttons |
| 8px | App panels and tables |
| 12px | Marketing cards, hero card |
| 9999px | Floating nav pill |

## Components

### Navigation
- **Top bar:** logo/product name on the left (sans, 20px), links on the right in mono uppercase 14px, separated by thin vertical hairlines. A wallet button styled as `[ CONNECT WALLET ]`.
- **On scroll**, the links collapse into a **floating centered pill** (radius 9999px, blurred dark background, 24px side padding).
- **Status dot:** a small green square before `STATUS` shows the network is live.

### Section label
```
// LATEST TRANSACTIONS            view all >>
```
Mono 14, uppercase, 50% white. Optional right-aligned link or meta (`last 100 days · log scale`).

### Buttons and links
- **Primary button:** Royal `#2756FC` fill, white Inter 16/500 text, 6px radius, 40px tall. Use once per screen.
- **Bracket button (default):** transparent, mono uppercase 14px, text `[ ACTION ]`, 87% white, hover to 100% white and a `#2F2F31` background. Examples: `[ CONNECT WALLET ]`, `[ TRIGGER SHOCK ]`, `[ I'M ALIVE ]`.
- **Inline link:** mono uppercase with `↗` for external (`READ MORE ↗`) or lowercase mono with `>>` for "see all" (`view all transactions >>`).
- **Transitions:** 300ms on color, background and border, with `cubic-bezier(0.4, 0, 0.2, 1)`.

### Cards and panels
- **App panel:** `#000` or `#101010` background, 1px hairline border, 8px radius, 16px padding, a `// TITLE` label inside the top-left.
- **Marketing card:** 2px hairline border, 12px radius, 16–24px padding; optional subtle gradient `#1D1D1F → #101010`; an ASCII illustration at the top, then a 20px/500 title and a 16px 70% description.
- **Feature card:** a small outlined check-circle icon in the top-left corner, with the title and copy at the bottom.

### Stat tile
```
// TOTAL BLOCKS
8 129 166
^ 1.01% (24h)
```
Label in mono 14 at 50%; value in Inter 30 with a thin space as thousands separator; delta in success or danger color. Numbers **roll like an odometer** when they change.

### Data list / table
- Rows separated by space, not lines; each row has a mono primary line (hash) and a smaller secondary line (`4 seconds ago | (v) SUCCESS`).
- From/To pairs as mono, with the label at 50% (`From:`) and the value at 87%.
- Amount right-aligned in mono (`0 REACT`).
- Checkbox-style lists use `[ ]` prefixes (Top Reactive Contracts).

### Status tokens
Write status as text plus symbol in mono: `(v) SUCCESS`, `(x) FAILED`, `(~) PENDING`, `[!] WARNING`. Color only the symbol and word.

### Inputs
`#242426` background, 6px radius, no border (or a 1px hairline on focus with a Royal focus ring), Inter 16 text, a 50% placeholder, and a mono keyboard hint chip on the right (`/`).

### Charts
- **Monochrome first:** grey bars (`#2F2F31` up to 50% white), no gridlines, mono 12px axis labels.
- Use **one** accent color for the series that matters (Maya for "now", Royal for "ours").
- **Heatmap:** a grid of 4px-radius squares; empty cells `#1C1C1D`, filled cells step up in brightness; the current cell gets a 1px white outline.

### Loaders and empty states
- **ASCII spinner:** a small rotating set of characters (`+:+`, `:+:`, `+.+`) centered over a mono caption ("Loading latest transactions").
- **Empty state:** an ASCII drawing at 30% white, then one sentence and a bracket button.

### Signature motifs (use these so the apps feel "Reactive")
1. **`// LABEL` section headers** in mono uppercase.
2. **Bracket syntax:** `[ ACTION ]`, `[ New ]` (in Maya), `[ MORE COMING SOON ]`.
3. **Expandable list markers:** `[+]` collapsed, `[>]` active with a thin vertical bar beside the expanded text.
4. **ASCII art** illustrations in card headers and empty states, at 30–50% white.
5. **Text scramble:** headlines decode from random characters into the real text over ~600ms on first view.
6. **Odometer numbers** for live stats.
7. **Dot-grid hero with a soft blue glow** (one per app, landing page only).
8. **Hairline section dividers** across the full container width.

## Applying it to our three apps

### Reflex (Every Second Counts)
- **Hero stat row:** `// SHOCK LEVEL`, `// POOL B FEE`, `// POSITIONS EXITED`, `// LOANS RESCUED`.
- **Live event feed** in the Reactscan list style: each step (`SHOCK`, `PROTECT`, `EXIT`, `RESCUE`, `RECOVER`) as a mono row with tx hash, timestamp and `(v) SUCCESS`.
- **Shock = danger red, protective actions = Maya.** Latency numbers in mono, large, with the chain path underneath (`Unichain → Lasna → Base · 1.4s`).
- **Replay chart** (1s / 3s / 7s): grey bars, with the 1s bar in Maya.
- Primary action: `[ TRIGGER SHOCK ]` (demo only).

### Standing Orders (Set It and Forget It)
- Warmer use of the same system: more whitespace, plain-language sentences, fewer data rows.
- **Rule cards** (marketing-card style) for Pay yourself first, Claim and secure, Guardian, each with a small ASCII icon and an on/off toggle.
- **Guardian states:** Active = success green, Warning = warning amber, Released = Quartz. Countdown in mono (`89d 04h until warning`).
- **Vault balance** as the one large stat (Inter 64 / 400).
- Primary action: `[ I'M ALIVE ]`.

### Helm (Reactive Meets AI)
- **AI content is Quartz:** anything the model or LLM produced (proposals, explanations) sits in a panel with a 1px Quartz left border and a `// AI PROPOSAL` label.
- **Contract enforcement is Maya:** clamped values show the original struck through at 50% and the enforced value in Maya, with `[ CLAMPED BY CONTRACT ]`.
- **Cycle log** in the Reactscan list style: trigger → proposal → check → callback → explanation.
- **Limits panel:** the user's sentence in quotes (Inter 18 italic, 70%) above the structured limits in mono.

## Implementation snippets

### CSS variables
```css
:root {
  --canvas: #000000; --surface: #101010; --surface-raised: #1C1C1D;
  --surface-input: #242426; --surface-active: #2F2F31;
  --ink: #F5F5F7; --ink-default: rgba(255,255,255,.87);
  --text-secondary: rgba(245,245,247,.70); --text-muted: rgba(245,245,247,.50);
  --text-faint: rgba(245,245,247,.30);
  --hairline: rgba(245,245,247,.20);
  --royal: #2756FC; --maya: #62D0FF; --quartz: #CBB5FF; --malachite: #00C853;
  --success: #1A9F44; --danger: #BC001D; --danger-text: #FF5A6A; --warning: #F5A524;
  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px; --radius-xl: 12px;
  --ease: cubic-bezier(.4,0,.2,1);
  --font-sans: "Inter Variable", Inter, system-ui, sans-serif;
  --font-mono: "Roboto Mono", ui-monospace, monospace;
}
html { background: var(--canvas); color: var(--ink-default); font-family: var(--font-sans); }
.label { font: 400 14px/20px var(--font-mono); text-transform: uppercase; color: var(--text-muted); }
.label::before { content: "// "; }
.panel { border: 1px solid var(--hairline); border-radius: var(--radius-lg); padding: 16px; }
.btn-bracket { font: 400 14px/20px var(--font-mono); text-transform: uppercase; color: var(--ink-default);
  padding: 8px 12px; border-radius: var(--radius-md); transition: all .3s var(--ease); }
.btn-bracket:hover { color: #fff; background: var(--surface-active); }
.num { font-variant-numeric: tabular-nums; }
```

### Tailwind theme extension
```js
// tailwind.config.js (theme.extend)
colors: {
  canvas: '#000000', surface: { DEFAULT: '#101010', raised: '#1C1C1D', input: '#242426', active: '#2F2F31' },
  ink: { DEFAULT: '#F5F5F7', default: 'rgba(255,255,255,.87)', secondary: 'rgba(245,245,247,.70)',
         muted: 'rgba(245,245,247,.50)', faint: 'rgba(245,245,247,.30)' },
  hairline: 'rgba(245,245,247,.20)',
  royal: '#2756FC', maya: '#62D0FF', quartz: '#CBB5FF', malachite: '#00C853',
  success: '#1A9F44', danger: { DEFAULT: '#BC001D', text: '#FF5A6A' }, warning: '#F5A524',
},
fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
              mono: ['"Roboto Mono"', 'ui-monospace', 'monospace'] },
borderRadius: { sm: '4px', md: '6px', lg: '8px', xl: '12px' },
transitionTimingFunction: { reactive: 'cubic-bezier(.4,0,.2,1)' },
```
With shadcn/ui, map `--background` to canvas, `--card` to surface, `--border` to hairline, `--primary` to Royal, `--ring` to Maya, and set `--radius: 0.5rem`.

## Do's and don'ts

### Do
- Keep the page pure black and let hairlines and surface steps create structure.
- Set every label, address, hash, timestamp and status in Roboto Mono.
- Use `// LABEL` headers and `[ ACTION ]` buttons consistently across all three apps.
- Keep big headlines at weight 400.
- Use color only to mean something, and always with a symbol or word.
- Use ASCII art for illustration and loading states.
- Show real data: real tx hashes, real timestamps, real latency.

### Don't
- Don't add drop shadows, glassy gradients on cards, or neon glows on text.
- Don't use the logo gradient on buttons or text, or more than once per app.
- Don't use bold 700 for large headings.
- Don't use the Reactive logo as our product's logo, recolor it, or imply our app is an official Reactive product.
- Don't use 30% text for anything a user needs to read; it fails contrast. The same goes for `#BC001D` red on small text: use `#FF5A6A`.
- Don't mix in other accent colors (pink, orange, purple beyond Quartz) outside the semantic warning amber.
- Don't use emoji in the UI; use mono symbols (`^ v (v) (x) [!] >> ↗`).

## Sources
- [reactive.network](https://reactive.network): homepage styles inspected in the browser on 2026-11-12
- [lasna.reactscan.net](https://lasna.reactscan.net): app/dashboard patterns
- [dev.reactive.network](https://dev.reactive.network): docs styling
- [reactive.network/press](https://reactive.network/press): official brand colors, logo rules, media kit
