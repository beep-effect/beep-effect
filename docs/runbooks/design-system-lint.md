# Design-system lint

The design-system lint lane runs [`@shadcn/lint`](https://github.com/shadcn-ui/lint)
as an oxlint JS plugin over every Tailwind surface in `apps/` and `packages/`.
It enforces one contract: components own their appearance, pages own layout,
and every color, size, and class comes from the theme.

- Policy: [`.oxlintrc.shadcn.json`](../../.oxlintrc.shadcn.json)
- Theme: [`packages/foundation/ui-system/ui/src/styles/globals.css`](../../packages/foundation/ui-system/ui/src/styles/globals.css)
  plus app stylesheets that `@import "@beep/ui/styles/globals.css"`
- Design-system components: anything imported from `@beep/ui/components/*`
  (`settings.shadcn.ui`)
- Command: `bun run lint:shadcn`
- Hosted context: **Shadcn Lint** (non-required until promoted)

Every diagnostic ends with a pointer back to this file.

## What the lane enforces

All six rules run at `error`, and the run passes `--deny-warnings`, so a
plugin configuration warning also fails it.

| Rule | Severity | What it reports |
| --- | --- | --- |
| `shadcn/no-restyle` | error, `allow: ["layout"]` | Non-layout classes passed to a design-system component (`<Button className="p-4 border">`). |
| `shadcn/no-raw-colors` | error | Palette colors (`bg-zinc-100`), undeclared color tokens, raw SVG colors (`fill="#fff"`). |
| `shadcn/no-arbitrary-values` | error | Arbitrary values (`h-[200px]`, `ring-[3px]`, `text-[var(--x)]`). |
| `shadcn/no-inline-styles` | error | `style={{ ... }}` props and `<style>` elements. |
| `shadcn/require-static-classes` | error | Class values on components that the linter cannot read statically (`className={buttonVariants()}`). |
| `shadcn/no-unknown-classes` | error | Classes the workspace's Tailwind cannot generate (`no-scrollbar`, `xs:w-4`, typos). |

`allow: ["layout"]` admits margin, width/height, position, display, flex/grid
item placement, transforms, text alignment, and the `group`/`peer` markers.
Color, typography, spacing (padding, gap), shape (rounded, border, ring),
effects, motion, and unclassified classes are reported.

There are no contracts, no allow-lists, and no `eslint-disable` or
`oxlint-disable` comments. A finding is fixed in the code or the theme.

### Scopes and overrides

| Files | Change from the base rules |
| --- | --- |
| `**/*.tsx`, `**/*.jsx`, `apps/**/*.ts`, `packages/foundation/ui-system/**/*.ts`, `packages/*/ui/**/*.ts` | `no-raw-colors` and `no-arbitrary-values` run with `scanAllStrings: true`: every string literal is a class site, so lookup tables, variant maps, and theme objects are checked too. |
| `packages/foundation/ui-system/ui/src/themes/**/*.ts` | `scanAllStrings` is off again. These are MUI theme objects whose `transitions.create([...])` arguments are CSS property names, not classes. Recognized class sites are still checked. |
| `packages/foundation/ui-system/ui/src/components/**` | `no-restyle` and `require-static-classes` are off, so components can style themselves and call their own variant factories. Raw colors, arbitrary values, inline styles, and unknown classes are still errors. |

Build output and generated code are ignored (`dist`, `build`, `.next`,
`.turbo`, `coverage`, `generated`, `_generated`, `*.gen.*`, `src-tauri`,
`node_modules`), as are `.repos/`, `.codex/`, and `.claude/`.

## Run it locally

```sh
bun run lint:shadcn
```

The script is
`oxlint --disable-nested-config --deny-warnings -c .oxlintrc.shadcn.json apps packages`.
`--disable-nested-config` keeps package-level `.oxlintrc.json` files out of
this lane.

Scope a run to the files you touched:

```sh
bunx oxlint -c .oxlintrc.shadcn.json --disable-nested-config --deny-warnings \
  apps/oip-web/src packages/foundation/ui-system/ui/src/components/button.tsx
```

Machine-readable output (one object per diagnostic, `code` is
`shadcn(<rule>)`):

```sh
bunx oxlint -c .oxlintrc.shadcn.json --disable-nested-config --deny-warnings \
  --format json apps packages
```

The same command runs through Turbo as `bunx turbo run //#lint:shadcn`. The
task is uncached (`cache: false`): the plugin reads the theme, `components.json`,
tsconfig paths, and package exports, which a file-hash cache would track only
approximately.

## Fix recipes

Apply them in this order; the diagnostic names the rule.

### `no-raw-colors`

Map the color to the semantic token that carries its meaning: `background`,
`foreground`, `muted`, `muted-foreground`, `accent`, `primary`, `secondary`,
`destructive`, `destructive-text`, `success`, `success-text`, `warning`,
`warning-text`, `border`, `input`, `ring`, `card`, `popover`, `sidebar-*`,
`chart-1` to `chart-5`. Amber is `warning`, green is `success`, red is
`destructive`, the zinc scale is `muted`/`foreground`. Never change a color's
meaning to make the finding go away.

When no token fits, add one to the theme (see
[Add a theme token or variant](#add-a-theme-token-or-variant)) and use it.

SVG: `fill="currentColor"` plus a text color class, or
`fill="var(--color-<token>)"`.

### `no-arbitrary-values`

1. Use the scale step the diagnostic suggests (`h-[200px]` -> `h-50`,
   `ring-[3px]` -> `ring-3`, `max-w-[80%]` -> `max-w-4/5`).
2. A CSS-variable shorthand is not arbitrary: `text-(--oip-gold)`.
3. Better: declare the token in the theme (`--color-oip-gold: var(--oip-gold);`
   under `@theme`) and use `text-oip-gold`.
4. `color-mix(in oklab, var(--x) 22%, transparent)` -> an opacity modifier on
   a token: `border-oip-on-soil/22`.
5. Font families -> `font-<token>` after `--font-<token>` is in `@theme`.
6. Structural values with no scale step
   (`rounded-[min(var(--radius-md),12px)]`) -> a theme token
   (`--radius-control`) and the matching utility (`rounded-control`).
7. `calc()`-only sizes -> a spacing step or a token.

### `no-inline-styles`

- Static styles become classes.
- Dynamic values move into CSS custom properties on `style`
  (`style={{ "--pane-left": `${x}px` }}`), read by a class
  (`left-(--pane-left)`) or by the package's own stylesheet
  (`[data-dock-box] { left: var(--pane-left); }`). Custom properties may carry
  any non-color value; a color in a custom property must be a theme variable.
- `<style>` elements move into the theme stylesheet or the package stylesheet.

### `no-unknown-classes`

- The class is defined in a stylesheet the theme does not import: bring that
  stylesheet into the theme's import graph (`@import "./dock.css";` from the
  app `globals.css`), or declare the class with `@utility` or
  `@custom-variant` in the theme.
- The class is dead: delete it.
- An unknown breakpoint (`xs:`) gets `--breakpoint-xs` in `@theme`.
- Never allow-list the class.

### `no-restyle`

1. Use an existing variant, size, or prop of the component.
2. Move demo or page chrome to a plain wrapper element:
   `<div className="rounded-md border p-4"><Component /></div>`. For
   triggers, put the styling on a child element.
3. Add a variant or prop to the component only when that design decision is
   recorded in [Design decisions](#design-decisions). The component owner
   changes the component; the consumer then passes the prop.

Layout classes (`mt-4`, `w-full`, `flex-1`, `hidden`, `absolute`) always pass.

### `require-static-classes`

Pass the component's variant props instead of a computed class
(`<Button variant="outline">`, not `className={buttonVariants({ variant: "outline" })}`),
or read the class from a constant declared in the same file.

## Add a UI workspace

Every workspace that renders Tailwind classes declares a `components.json` at
its root. The plugin reads it to find the theme stylesheet and the
design-system import alias. Copy [`apps/oip-web/components.json`](../../apps/oip-web/components.json)
and change two fields:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "<path to the stylesheet that imports Tailwind for this workspace>",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "phosphor",
  "aliases": {
    "components": "@/components",
    "hooks": "@/hooks",
    "lib": "@/lib",
    "utils": "@beep/ui/lib/utils",
    "ui": "@beep/ui/components"
  }
}
```

- `tailwind.css`: an app with its own `globals.css` (which
  `@import "@beep/ui/styles/globals.css"` and adds app tokens) names that file.
  A library package names the shared theme by relative path, for example
  `../../foundation/ui-system/ui/src/styles/globals.css` from
  `packages/<area>/<name>/`.
- `aliases`: point `components`, `hooks`, and `lib` at the workspace's own
  paths. Keep `ui` at `@beep/ui/components` so design-system components are
  recognized.

A missing or misdirected `tailwind.css` shows up as `no-unknown-classes` and
`no-raw-colors` findings on classes the theme does declare. Run the scoped
command over the new workspace before opening the PR.

## Add a theme token or variant

1. Record the decision in [Design decisions](#design-decisions): what is
   added, which screens need it, and why no existing token or variant fits.
2. Tokens: add `--color-<name>` (or `--radius-<name>`, `--font-<name>`,
   `--breakpoint-<name>`) under `@theme` in the shared theme, with light and
   dark values when it is a color. App-only tokens go in the app's
   `globals.css` after its `@import "@beep/ui/styles/globals.css"`.
3. Variants: add the variant to the component's `cva` definition in
   `packages/foundation/ui-system/ui/src/components/<name>.tsx`, then update
   consumers to pass the prop.
4. Run `bun run lint:shadcn` and the affected package's
   `bun run beep quality package-verify <@beep/name> --quick`.

Contracts, allow-lists, and disable comments are not accepted as a fix. Adding
one to `.oxlintrc.shadcn.json` requires a recorded design decision here that
names the component, the class category, and the source in the component that
anticipates the class (for example a `[.border-b]:pb-6` hook).

### Design decisions

| Date | Decision | Scope | Why |
| --- | --- | --- | --- |
| 2026-10-01 | Strict policy adopted: all six rules at `error`, `no-restyle` allows `layout` only, no contracts or allow-lists. | `apps/**`, `packages/**` | Initial adoption of `@shadcn/lint`. |

## CI

| Where | What runs | Gate |
| --- | --- | --- |
| Hosted `check.yml` verify matrix, context **Shadcn Lint** | `bun run beep ci lane shadcn-lint` -> `turbo run lint:shadcn --summarize` | Non-required. Skipped on goals-only PRs. Promotion to the branch ruleset is a later ruleset action once the context has a stable green history. |
| Yeet pre-push proof, lane `quality:shadcn-lint` | The same `beep ci lane shadcn-lint` argv, preflight wave | Blocks `yeet verify` / `yeet publish` locally. |
| `Heavy / Lint Policy` and `bun run lint` | `lint:shadcn` in the lint-policy state battery, beside `lint:oxlint` | Required through the Lint Policy context. |

The lane is CLI-runnable with exact replay: `bun run beep ci lane shadcn-lint`
reproduces the hosted job, and `bun run beep ci lane --list` shows it. The
lane body lives in `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`;
`check.yml` only dispatches it.
