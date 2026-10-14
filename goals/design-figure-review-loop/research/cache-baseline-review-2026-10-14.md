# Cache baseline review — @beep/technical-drawing task configuration (2026-10-14)

Reviewer: Claude Fable 5.1 (design-figure-review-loop, lane feat/design-figure-review-1).

## What changed

`packages/foundation/capability/technical-drawing/package.json` on this branch:

- `beep:check` now also runs `beep:check:scripts` (`tsgo -p tsconfig.scripts.json --noEmit`), so the
  committed glyph generator under `scripts/` is type-checked with the package.
- New scripts `check:scripts`, `generate` (runs `scripts/generate-label-glyphs.ts` and formats
  `src/internal/LabelGlyphs.ts`) and `generate:check` (regenerates and requires a clean diff).
- New dependency `opentype.js` (catalog pin `1.3.4`, the version replicad already resolves), loaded
  through a non-literal dynamic import by the operator font-file route.

The scripts digest of the package changed, so every cached task of the package
(`build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`)
reports `configuration-drift` against the reviewed baseline.

## Review

No Turbo task command, cache flag, input, output or global configuration changed; only the
package's scripts block and dependency list did, which is what the drift reflects. The task
graph, profile `local-linux-x64-bun1.4.2`, epoch `qualification-v2`, scope and the qualification
ledger are unchanged. No cache qualification is granted by this review; it re-records the
legacy posture for `@beep/technical-drawing` only.

Reverse: revert the package.json script and dependency changes and re-record.
