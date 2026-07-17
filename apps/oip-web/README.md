# @beep/oip-web

Next.js 16 canary app for the OIP public law-firm site, wired to the shared
`@beep/ui` shadcn/Tailwind setup.

## Development

```bash
# Shared portless URL
bun run dev

# Raw Next dev server
bun run dev:raw

# Turbopack production build
bun run build

# Webpack PWA build
bun run build:pwa
```

## Dev URL

`bun run dev` serves the app at `https://oip-web.localhost:1355`.

## React Grab

React Grab loads during development. Start with `bun run dev`, hover an
element, then press `Cmd+C` on macOS or `Ctrl+C` on Linux/Windows to copy source
context for refinement work. Use `NEXT_PUBLIC_REACT_GRAB=0 bun run dev` when
you need the dev overlay disabled for quiet browser QA.

## Launch Goal

The launch packet lives at `../../goals/oip-web-launch`.

V1 is a single-page, build-ready public site. Public claims, client marks,
selected matters, contact details, and disclaimers remain review-gated before
publishing.
