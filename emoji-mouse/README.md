# emoji mouse

A browser extension that makes emoji icons fall and trail behind your mouse cursor on any web page. Works on Chrome and Edge.

## How It Works

When enabled, moving your mouse creates a trail of falling emoji icons that animate downward and fade out. Configure which emojis to display, how fast they drop, their size, and opacity — all from the options page.

- **Popup**: Quick toggle to enable/disable emoji on the current tab
- **Options page**: Full configuration — emoji list, drop interval, animation duration, size range, opacity
- **Global on/off**: Master switch to disable the extension entirely

## Getting Started

```bash
pnpm install
pnpm dev
```

Load `build/chrome-mv3-dev/` as an unpacked extension in Chrome.

## Build

```bash
pnpm build      # Production build → build/chrome-mv3-prod/
pnpm package    # Build + create .zip for store submission
```

## Tech Stack

Vue 3 · Ant Design Vue · Tailwind CSS · TypeScript · Plasmo
