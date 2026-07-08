# FINAL-D — module-level `@since` batch

Lane: FINAL-D (module-level doc-comment `@since` findings from the jsdoc
inventory's `modules[]` array, distinct from export-level findings owned by
another lane). Branch `standards-remediation`. Touched only file-top module
doc comments; never edited `standards/*.jsonc` by hand (only regenerated via
the tracked CLI generator) and made no commits.

## Scope and file list

Queried `standards/jsdoc-documentation.inventory.jsonc` (read-only) for every
`modules[]` entry with `remediationStatus: "open"` and
`missingRequiredTags` containing `"@since"`. That query returned **116**
files across three packages: `@beep/ui` (113), `@beep/oip-web` (1,
`MattersCarousel.tsx`), `@beep/professional-desktop` (2, `runtime/Pglite.ts`
and `transport/TauriIpcSocket.ts`).

## Placement pattern validated

Read `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts`'s
`topFileoverview` detector directly: it matches
`/^(?:#![^\n]*\n)?\s*(\/\*\*[\s\S]*?\*\/)/` against the **full file text** —
the module doc comment must be the literal first thing in the file (only an
optional shebang may precede it). This means the doc block goes **above**
`"use client";`, above any leading `//`/`/* */` comments, and above any
`/// <reference>` directive — none of those are whitespace, so anything
placed before the comment defeats the match.

Before touching anything, confirmed this placement is already the
established, passing convention elsewhere in `@beep/ui`:
`src/components/country-select.tsx` already has
`/** ...\n * @packageDocumentation\n * @since 0.0.0\n */` immediately above
its `"use client";` line, and its inventory entry is `"resolved"` with zero
missing tags. Applied the identical pattern to the pilot file
(`components/button.tsx`), then validated it against a small standalone
script (`probe-module-doc.mjs`) that ports the detector's exact
`topFileoverview`/`tagsFromComment`/`summaryFromComment` logic line-for-line
— confirmed `CLEAR` for both the pilot and the reference file before batch-
applying to the other 114.

Two files (`Pglite.ts`, `TauriIpcSocket.ts`) were a different shape: each
already had a complete, correct `@packageDocumentation`/`@since 0.0.0` block,
just preceded by a stray `// cspell:words ...` (and, for `Pglite.ts`, an
`/// <reference>` directive too), which blocked the same-anchor regex. Fixed
by moving the existing block to the true top and folding the cspell
directive into it as a plain prose line — the convention already used
elsewhere in the repo (`packages/foundation/modeling/utils/src/Function.ts`,
`packages/drivers/runpod/src/_generated/Runpod.generated.ts`), rather than
leaving a redundant second comment. No content was invented for these two;
only reordered plus the reference directive kept immediately below the doc
block (comments/triple-slash directives may be preceded by other comments
per TS's directive-prologue rules, so this doesn't break the reference).

The remaining 114 files had `docKind: "none"` (no leading comment at all, or
one always beaten out by an ignored preceding line) — for those, prepended a
new one-line, real (non-boilerplate) description plus `@packageDocumentation`
/ `@since 0.0.0`, written from each file's actual exported symbol(s) and a
few lines of surrounding code (component name, variant list, primary hook
signature), not template text. Existing export-level doc comments elsewhere
in these files (e.g. `button.tsx`'s `buttonVariants` block) were left
untouched.

## Before / after

| | before | after |
|---|---|---|
| repo-wide `openModules` | 120 | 4 |
| `@beep/ui` `openModules` | 114 | 1 (pre-existing, out of scope — see below) |
| `@beep/oip-web` `openModules` | 1 | 0 |
| `@beep/professional-desktop` `openModules` | 2 | 0 |

All 116 originally-flagged missing-`@since` module findings are resolved —
verified via the full `bun run beep quality jsdoc-inventory` regenerator
(ran once for the baseline, once after the batch; ~3 min each) and via the
local probe script across all 116 target files (116/116 `CLEAR`, exit 0).

The one remaining open `@beep/ui` module (`src/lib/index.ts`) was **never
part of this scope** — its `missingRequiredTags` is empty (it already has
`@since`); it's open only for `missingSummary: true`, an unrelated finding
this lane did not touch (confirmed zero diff on that file). The other 3
repo-wide open modules are in `@beep/observability` (also not this lane's
package).

## Verification

- `bunx biome check packages/foundation/ui-system/ui/src apps/oip-web/src/components/MattersCarousel.tsx apps/professional-desktop/src/{runtime/Pglite.ts,transport/TauriIpcSocket.ts}` — clean, no fixes.
- `bun run turbo run check --filter=@beep/ui --filter=@beep/oip-web --filter=@beep/professional-desktop` — 34/34 tasks green (tsgo build + `@beep/ui`'s stories check + `professional-desktop`'s codegen/migration-bundle checks all included).
- `bun run beep quality jsdoc-inventory` — full repo regeneration, run twice (before/after), numbers above.
- `git diff --stat`: 116 files changed, 689 insertions(+), 4 deletions(−) (the 4 deletions are the two special-case cspell-comment relocations).

No commits made; `standards/jsdoc-documentation.inventory.jsonc`/`.md` are
left in their regenerated (post-fix) state on disk per the driver's
instruction to run the generator for verification.
