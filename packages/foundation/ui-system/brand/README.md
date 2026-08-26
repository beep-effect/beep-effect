# @beep/brand

The beep brand identity as data: forest-green scales on zinc surfaces, Inter and
JetBrains Mono, and the lambda-with-pixel-glasses mark. Everything an app ships
(the theme stylesheet, the SVG mark, favicon, and wordmarks) is rendered from one
schema-decoded identity, and a test fails when a checked-in file drifts from its render.

## Entrypoints

| Entrypoint | Purpose | Purity |
| --- | --- | --- |
| `@beep/brand` | Identity schemas, the `beep` tokens, and the CSS/SVG encoders | Framework- and DOM-free |
| `@beep/brand/react` | `BeepMark` and `BeepWordmark` components | React 19 |
| `@beep/brand/styles/brand.css` | Generated Tailwind v4 `@theme` plus `.dark` scheme | Stylesheet |
| `@beep/brand/styles/bridge.css` | Opt-in mapping of `@beep/ui` shadcn tokens onto the brand scale | Stylesheet |
| `@beep/brand/styles/fonts.css` | Self-hosted Inter Variable and JetBrains Mono Variable | Stylesheet |
| `@beep/brand/assets/*` | `mark.svg`, `favicon.svg`, `wordmark.svg`, `wordmark-light.svg`, and the PNG icon set | Static files |

## Usage

Stylesheet order matters: fonts first, then `@beep/ui`, then the brand theme, then the
bridge so its `var()` references resolve.

```css
@import "@beep/brand/styles/fonts.css";
@import "@beep/ui/styles/globals.css";
@import "@beep/brand/styles/brand.css";
@import "@beep/brand/styles/bridge.css";
```

```tsx
import { beep } from "@beep/brand"
import { BeepMark } from "@beep/brand/react"

export const Header = () => (
  <header style={{ background: beep.dark.surface["0"] }}>
    <BeepMark className="size-8 text-brand-400" />
  </header>
)
```

The theme declares the light scheme in `@theme`, so Tailwind mints `bg-brand-500`,
`text-fg-muted`, `border-border-hover`, and `font-brand-mono`, and redeclares the dark
scheme under `.dark`, the same custom variant `@beep/ui` uses. Glow layers are
`--beep-glow-{primary,secondary,tertiary}-{start,mid}` as `color-mix()` references into
the brand scale.

## Changing the brand

1. Edit `src/Brand.tokens.ts` (or the schemas in `src/Brand.schema.ts`).
2. Run `bun run render` to regenerate `styles/brand.css` and the SVG assets.
3. Rasterise `assets/favicon.svg` into the PNG icon set when the mark changes.
4. `bun run test` proves the checked-in files match their render.

## Consumers

- `apps/labs/trustgraph-workbench`: favicon set, theme, bridge, and `BeepMark` in the shell.
- `apps/storybook`: manager `brandImage` and favicon from `assets/`.

## Placement

A `foundation/ui-system` package: repo identity is a design-system role, not product
domain language, so it lives beside `@beep/ui` rather than inside it. `@beep/ui` stays
brand-neutral because `apps/oip-web` consumes it under a different identity; the bridge is
how an app opts in. See `standards/architecture/07-non-slice-families.md`.

## Development

```bash
bun run build
bun run check
bun run test
bun run lint:fix
bun run render
```

Unit tests stay outside `test/integration`. Tests import package source through
`@beep/brand` and `@beep/brand/react`; relative imports are for local helpers only.

## License

MIT
