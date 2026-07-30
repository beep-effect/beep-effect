# How Effect docs ship in v4

Dated 2026-07-30. All paths relative to `.repos/effect/` (git subtree pinned in
this repo). Every claim cites a path; line numbers re-verified by the packet's
claim-verification pass (see `SOURCES.md` §1).

## Headline

Effect v4's documentation quality is not a style guide — it is a
**machine-enforced grammar**. A private tool, `@effect/jsdocs`
(`packages/tools/jsdocs/src/Jsdocs.ts`, ~3,360 lines), parses every public
JSDoc block and emits ~30 diagnostic codes. The conventions we admired in the
screenshots are the *output* of that validator plus editorial effort on
flagship modules. Two consequences for us:

1. The style is fully portable: it is a spec, not taste.
2. In moving to this grammar, Effect **forbade the `@example` tag** — and in
   the same move **lost example typechecking entirely** (nothing compiles
   their fenced example code anymore). Our `@beep/docgen` still has that
   capability. We should port the grammar, not the regression.

## The four lanes

### Lane 1 — JSDoc grammar validation (`@effect/jsdocs`, new in v4)

- Tool: `packages/tools/jsdocs/` (private package, bin `effect-jsdocs`).
- Config: root `jsdocs.config.json` — `tsconfig.packages.json`, includes
  `packages/**/src/**/*.ts`, excludes `packages/tools/**`, `src/index.ts`
  barrels, `*Generated.ts`, all `internal/`; caches a parsed JSDoc model to
  `.data/jsdocs.json` keyed by input hash.
- Wiring: script `"jsdocs": "effect-jsdocs"` runs inside
  `"lint": "pnpm jsdocs && oxlint -f unix && dprint check"` → CI Lint lane
  (`.github/workflows/check.yml`).
- **Trap — currently toothless:** in `packages/tools/jsdocs/src/bin.ts`,
  *diagnostics* set a failing exit code only when `--check` is passed
  (`bin.ts:13`; a crash still fails unconditionally, `bin.ts:32-34`), and
  neither the `lint` script nor CI passes `--check`. Grammar violations
  print; builds do not fail. Do not copy this wiring.

The grammar it enforces (the portable asset — key constants in
`packages/tools/jsdocs/src/Jsdocs.ts`):

1. **One-paragraph description**, required. Multiple paragraphs, leading or
   trailing blanks, and markdown `#` headings are all diagnostics.
2. **Optional sections in exact order:** `**When to use**` → `**Details**` →
   `**Gotchas**` (`standardHeadings`). Out-of-order, duplicated, or empty
   sections are diagnostics. The `**When to use**` body must begin with one
   of `Use to` / `Use when` / `Use as` / `Use with` (`whenToUsePrefixes`).
3. **`**Example** (Title)` sections** come last in the prose. Each contains
   exactly one non-empty ` ```ts ` fence; titles are unique per block
   (case-insensitive); a ts fence outside an Example section is a diagnostic
   (`loose-ts-fence`). Examples must use **named imports**
   (`import { Option } from "effect"`).
4. **Tags last**, separated by one blank line, whitelisted and ordered:
   `@deprecated` → `@default` → `@see` → `@category` → `@since` (`tagOrder`).
   Nothing else is permitted — `@example` produces `forbidden-tag`:
   *"@example is not allowed; use a canonical **Example** (Title) section"*.
5. `@category` is required on public symbols; `@since` is required on module
   blocks and must be **stable semver** (`\d+\.\d+\.\d+`, no prereleases).
6. `{@link X}` must resolve to a real TS symbol that itself has public JSDoc
   (`unresolved-link`, `undocumented-see-target`); URLs inside `{@link}` are
   banned. Resolution runs against a real `ts.createProgram` — the compiler
   is used for *link resolution and signature extraction*, **not** for
   compiling example code.

### Lane 2 — Markdown API docs + website (classic `@effect/docgen`, demoted, alive)

- `"docgen": "pnpm --recursive --filter \"./packages/**/*\" exec docgen && node scripts/docs.mjs"`
  still runs classic `@effect/docgen` (v4.0.0-beta.102,
  `packages/tools/docgen/`, published) over 21 per-package `docgen.json`
  files, emitting `packages/<pkg>/docs/modules/*.md`; `scripts/docs.mjs`
  copies into the Jekyll `docs/` shell; `pages.yml` publishes.
- Its parser still reads `@example` tags (`packages/tools/docgen/src/Parser.ts`)
  and `packages/effect/docgen.json` still carries a full
  `examplesCompilerOptions` block — but since the grammar bans `@example`,
  **the example-compilation machinery runs over an empty set**. This is the
  dead role: v4 has no example typechecking, only example *shape* checks from
  Lane 1.

### Lane 3 — LLM-facing docs (`ai-docs/` → `LLMS.md`)

- `ai-docs/src/` is **hand-authored**: ~48 `.ts` + ~22 `.md` files in numbered
  chapters (basics → streams → http → ai → cluster).
- `ai-docs/` is a real TS project referenced from `tsconfig.packages.json`, so
  `pnpm check` typechecks every example destined for `LLMS.md` as ordinary
  source — this is where v4's "examples must compile" energy went.
- `"ai-docgen": "effect-ai-docgen ai-docs/src -o LLMS.md"` (a private Effect
  CLI app, `packages/tools/ai-docgen/`) concatenates the tree into the
  committed `LLMS.md`; the CI AI-docs lane regenerates it and **fails on a
  dirty git tree** — a committed-generated-artifact gate worth remembering.

### Lane 4 — Linters: no JSDoc involvement

`.oxlintrc.json` (+ `packages/tools/oxc/`) has **no jsdoc/tsdoc plugin**; no
typedoc, no eslint-plugin-jsdoc, no api-extractor anywhere in
devDependencies. All JSDoc shape enforcement is Lane 1.

## What replaced pre-v4 `@effect/docgen`, role by role

| Pre-v4 `@effect/docgen` role | v4 status | Where |
| --- | --- | --- |
| `@example` extraction + `tsc` compile | **DEAD — no replacement** | Machinery idles in `packages/tools/docgen`; grammar bans the tag |
| Markdown API doc generation | Unchanged | `packages/tools/docgen` + 21 `docgen.json` |
| Website publishing | Unchanged | `scripts/docs.mjs` → Jekyll `docs/` → `pages.yml` |
| Tag/`@since` validation | Superseded and expanded | `@effect/jsdocs` grammar (Lane 1) |
| — (no v3 equivalent) | New: full section/link grammar | `@effect/jsdocs` |
| — (no v3 equivalent) | New: LLM corpus | `ai-docs/` → `effect-ai-docgen` → `LLMS.md` |

## Adoption reality (stratified sample, `packages/effect/src`)

Denominator = `@since` count per module (proxy for documented symbols).

| Module | `@since` | **When to use** | **Details** | **Gotchas** | **Example** | `@category` | `@see {@link}` | `// Output:` | ASCII `┌───` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Option.ts | 67 | 99% | 85% | 0 | 87% | 97% | 104 | 109 | 6 |
| Effect.ts | 240 | 51% | 64% | 14 | 97% | 97% | 146 | 101 | 35 |
| Schema.ts | 531 | 31% | 39% | 40 | **14%** | 98% | 220 | 2 | 0 |
| Layer.ts | 55 | 58% | 65% | 1 | 67% | 98% | 43 | 0 | 0 |
| Stream.ts | 243 | 19% | 35% | 7 | 93% | 100% | 33 | 145 | 0 |
| Cause.ts | 76 | 57% | 30% | 6 | 79% | 95% | 66 | 0 | 0 |

Honest read: `@category`/`@since` are universal (mechanically enforced);
sections are the **target** state, not the current state — Option.ts is the
freshly-rewritten showcase (99% When-to-use) while Stream.ts sits at 19%.
Schema.ts proves hover quality does not require an example on every export.
`@example` tags: **zero** across `packages/effect/src` (raw string hits are
`alice@example.com` inside example code). `@experimental`: zero — not a v4
convention. `@since` values are real history (`2.0.0` carried-over, `4.0.0`
new v4 surface, long tail of 3.x).

`@category` values are free-form per-module lowercase (Option.ts has 22
distinct values, including capitalized outliers `Reducer`/`Combiner` that
prove no vocabulary check) — unlike our 80-slug `LiteralKit` vocabulary.

## Implications for beep (pointers, argued in `diff-effect-vs-beep.md` / `options.md`)

- Port the grammar semantics into our existing `jsdoc-inventory` rules; do
  not depend on `@effect/jsdocs` (private) or copy its toothless CI wiring.
- Keep `@beep/docgen` example compilation — it is our advantage over v4.
  The `@example`-tag-vs-`**Example**`-section carrier question is a grill
  decision; both variants can preserve compilation.
- Their uneven adoption argues for ratchet-on-touch (new/edited code), not a
  retroactive sweep of ~18k exports.
