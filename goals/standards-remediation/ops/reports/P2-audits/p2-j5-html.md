# P2 audit — J5-html-generator (`@beep/html` generated-file JSDoc)

Cluster: `@beep/html` package block, `standards/jsdoc-documentation.inventory.jsonc`
(fresh generation `2026-07-08T02:24:53.010Z`, i.e. post-P1 re-export
exemption). Fence 14 applies (no fake docs); this package carries the largest
concentration of `missingExportExamples` findings from a single file in the
repo (`src/Html.model.ts`).

## 1. The generator

`src/Html.model.ts` and `src/Html.meta.ts` are both emitted by
`packages/foundation/modeling/html/scripts/generate.ts`. Regeneration command:

```
cd packages/foundation/modeling/html && bun run generate
```

(`"generate": "bun run scripts/generate.ts && biome check --write src/Html.model.ts src/Html.meta.ts"`
in `package.json`.) A determinism-check script already exists and should be
the proof gate for this lane: `bun run generate:check` (regenerates, then
`git diff --exit-code` on the two output files).

`buildModel()` (lines 213-618 of `generate.ts`) is the single template
authority: `elementBlock()` emits each `S.TaggedClass` element + companion
namespace, `containerNode()` emits `Fragment`/`Document`, `categoryUnion()`
emits the 9 advisory content-category unions, and the `meta` template (534-614)
emits `Html.meta.ts`. **None of these currently emit `@example`.** Hand-fixing
`Html.model.ts` directly would be wasted work — every fix belongs in one of
these four emitter functions, followed by `bun run generate`.

## 2. Fresh finding counts (post-P1, `@beep/html` package block)

Total package: 339 exports, 331 missing `@example`, 16 `schemaAnnotationGaps`,
0 everything else (category/since/summary/forbidden/malformed/exampleImport/
unsafe all clean). Split by file:

| File | Kind | Exports | Missing `@example` | `schemaAnnotationGaps` | Status |
|---|---|---|---|---|---|
| `src/Html.model.ts` | **GENERATED** | 301 | 301 (100%) | 1 (`HtmlChildren`) | all open |
| `src/Html.meta.ts` | **GENERATED** | 5 | 3 | 0 | 2 resolved (`HtmlCategory` value+type already have examples), 3 open (`HtmlElementMeta` schema, `HtmlElementMeta` type, `ELEMENT_META`) |
| `src/Html.attributes.ts` | hand-authored | 22 | 22 (100%) | 15 | all open |
| `src/Html.nodes.ts` | hand-authored | 6 | 5 | 0 | 1 resolved (`Text` class has an example; its companion namespace and `Comment`/`Doctype` do not) |
| `src/index.ts` | barrel | 5 | 0 | 0 | all resolved (P1 re-export exemption) |

Generated-file share: **304 of 331 missing-`@example` findings (92%)** plus 1
of 16 schema-annotation gaps sit in the two generated files. The remaining 27
missing-example + 15 schema-annotation findings are in the two hand-authored
files and are ordinary hand-fixes, not generator work — call these out
separately so they don't get bundled into the generator lane (D-D: one writer
per package at a time, but these are still two independently reviewable
diffs).

`Html.model.ts`'s 301 exports break down as 144 classes (142 elements +
`Fragment` + `Document`), 146 companion namespaces (144 class companions +
`HtmlChildren` + `HtmlNode`), and 11 consts (`HtmlChildren`, `HtmlNode`, 9
category-union schemas).

## 3. Template change spec

### 3a. Element classes (144: `elementBlock()`, `containerNode()`)

Every element supports a minimal `.make()` call because every field —
`GlobalAttributes`, every generator-emitted specific attribute
(`valueSchema()` always wraps in `S.OptionFromOptionalKey(...).pipe(SchemaUtils.withNoneDefault)`),
and the `children`/`content` structural field — is either `Option`-optional or
the one required structural field per element `kind`. The generator already
tracks `kind: "void" | "rawText" | "normal"`, so the example body is a pure
function of `kind`:

- `normal` → `ClassName.make({ children: [] })`
- `void` → `ClassName.make({})`
- `rawText` → `ClassName.make({ content: "" })`

Before (current `elementBlock()` output for `Div`, `src/Html.model.ts:1850`):

```ts
/**
 * The <div> element.
 *
 * @category elements
 * @since 0.0.0
 */
export class Div extends S.TaggedClass<Div>($I`Div`)(
  "div",
  { ...GlobalAttributes, align: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault), children: HtmlChildren },
  $I.annote("Div", { description: "The <div> element." })
) {}
```

After:

```ts
/**
 * The <div> element.
 *
 * @example
 * ```ts
 * import { Div } from "@beep/html/Html.model"
 *
 * const node = Div.make({ children: [] })
 * console.log(node._tag) // "div"
 * ```
 *
 * @category elements
 * @since 0.0.0
 */
export class Div extends S.TaggedClass<Div>($I`Div`)( ... ) {}
```

Generator change: add an `exampleBody(kind)` helper next to `childField`/
`childTypeField` (~line 325) returning the one-line `.make(...)` call, and
splice it into `elementBlock()`'s template string and into `containerNode()`
(both `Fragment`/`Document` are `kind: "normal"`-shaped — always have
`children`).

### 3b. Companion namespaces (146: same two emitters)

Repo precedent for namespace-level examples already exists (not yet applied
in `@beep/html`): `packages/shared/domain/src/values/Rule/Rule.model.ts:69-84`
uses the class/const's own name to type-check an `Encoded` literal. Because
`class X` and `namespace X` declaration-merge under one identifier, no
separate type-only import is needed — the same `import { Div } from ...`
statement provides both the value and the `Div.Encoded` type position.
`GlobalAttributesEncoded` fields are all optional keys (readonly `attr?:
type`), so only the structural field needs to appear in the literal:

```ts
/**
 * Companion namespace for {@link Div}.
 *
 * @example
 * ```ts
 * import { Div } from "@beep/html/Html.model"
 *
 * const encoded: Div.Encoded = { _tag: "div", children: [] }
 * console.log(encoded._tag) // "div"
 * ```
 *
 * @category elements
 * @since 0.0.0
 */
export declare namespace Div { ... }
```

Same three-way kind split as 3a (`void` → `{ _tag }` only, `rawText` → add
`content: ""`, `normal` → add `children: []`). `HtmlChildren`/`HtmlNode`
companions need their own one-off examples (array literal / one union member
literal respectively) since they aren't per-element.

Optional style note, not a blocker: the repo's broader convention
(`Rule.model.ts` and similar) tags companion namespaces `@category type-level`
rather than reusing the value's category. `@beep/html`'s generator currently
gives namespaces the same category as their class (`elements`/`models`) and
the detector's `categoryViolations` check only flags casing, not taxonomy
choice, so this is a take-it-or-leave-it alignment, not required for zero.

### 3c. Category-union consts (9: `categoryUnion()`) and `HtmlChildren`/`HtmlNode`

Each needs one example built from a representative member (first element in
`els` whose `categories` includes the target category, using the same
`exampleBody`-style construction). E.g. for `Flow`:

```ts
/**
 * @example
 * ```ts
 * import { A, Flow } from "@beep/html/Html.model"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Flow)(A.make({ children: [] }))) // true
 * ```
 */
```

### 3d. `Html.meta.ts` (3 open: `HtmlElementMeta` schema, `HtmlElementMeta`
type, `ELEMENT_META`)

`HtmlCategory` (value + type) already has real compiling examples in the
current template (lines 552-557, 570-575) — copy that idiom:

```ts
/**
 * @example
 * ```ts
 * import { ELEMENT_META } from "@beep/html/Html.meta"
 *
 * console.log(ELEMENT_META.div.interface) // "HTMLDivElement"
 * ```
 */
```

### 3e. `schemaAnnotationGaps` (1 in `Html.model.ts`: `HtmlChildren`)

Rule `missing-schema-runtime-type-alias` wants `export type HtmlChildren =
typeof HtmlChildren.Type;` alongside the existing companion namespace. Tested
directly in the generated file (inserted, `tsc --noEmit -p tsconfig.json`,
reverted): **compiles clean**, no identifier collision with the
`declare namespace HtmlChildren { export type Type; export type Encoded }`
block — a `const`, a flat `type` alias, and a type-only `namespace` of the
same name can all coexist. Add this one-line emission to the `header`
template right after the `HtmlChildren` const block (~`generate.ts:475`).

## 4. Verification performed

- Wrote the proposed `Div`/`Img` (void)/`Script` (rawText) class examples and
  their namespace `Encoded`-literal counterparts into a scratch file
  (`src/__jsdoc_scratch_test.ts`), ran
  `npx tsc --noEmit -p tsconfig.json --skipLibCheck` inside
  `packages/foundation/modeling/html` — **zero errors**. Deleted the scratch
  file afterward (it was untracked, so no `git checkout` was needed;
  confirmed via `git status --porcelain`).
- Tested the `export type HtmlChildren = typeof HtmlChildren.Type;` insertion
  directly in `src/Html.model.ts`, ran the same `tsc --noEmit`, confirmed
  clean, then `git checkout -- src/Html.model.ts` to revert.
- **Determinism**: ran `bun run generate` (full pipeline: `generate.ts` +
  `biome check --write`) in the package, then `git diff --exit-code -- src/Html.model.ts src/Html.meta.ts`
  → **exit 0, zero diff**. The current generator's output is byte-identical
  to the checked-in files; no drift, deterministic same-input→same-output.
  `git status --porcelain` on the package confirmed no residual changes.
- Real proof for the eventual fix lands via `turbo run docgen --filter=@beep/html`
  (per RC-JSDOC) — docgen's own example compiler
  (`packages/foundation/modeling/html/docgen.json` `examplesCompilerOptions`:
  `strict`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
  `noUnusedLocals`, etc.) is stricter than the plain `tsc` check used here for
  the scratch proof, but the patterns above (no unused locals, no `any`, real
  imports, `Option`-shaped fields entirely omitted rather than passed as
  `undefined`) are written to satisfy it.

## 5. Other generator-marked files repo-wide

Searched for generation banners (`GENERATED FILE`, `@generated`, `do not
edit`, `automatically generated`, `codegen output`, etc.) across every
`packages/**/src/**/*.ts`, `apps/**/src/**/*.ts`, `infra/**/src/**/*.ts`, then
cross-checked each hit against `standards/jsdoc-documentation.inventory.jsonc`:

- The literal banner `GENERATED FILE — do not edit by hand` appears **only**
  in `Html.model.ts`/`Html.meta.ts` — no other file uses this exact marker.
- Other real generated-output files exist (`packages/drivers/acp/src/_generated/*.gen.ts`,
  `packages/drivers/box/src/_generated/Box.*.gen.ts`,
  `packages/foundation/primitive/data/src/generated/{cldr-territories,iana-media-types,iana-timezones,iso4217}.ts`,
  `packages/tooling/library/ai-sync/src/_generated/*.gen.ts`) but **none of
  them appear anywhere in the jsdoc inventory** — zero findings, zero
  mentions.
- Root cause, worth flagging to the driver as a separate item (not part of
  this lane): those files are barrel-exported with a **namespaced** re-export
  (`export * as CurrencyCodes from "./generated/iso4217.ts"` in
  `packages/foundation/primitive/data/src/index.ts`), whereas `@beep/html`'s
  `src/index.ts` uses a **flat** re-export (`export * from "./Html.model.ts"`).
  The inventory's `analyzeExportDeclaration` only exempts the `export * from`
  line itself; it separately walks `Html.model.ts` as a module and scans its
  301 direct declarations individually because they're flat-reachable as
  `@beep/html`'s own top-level named exports. `CurrencyCodeDataValues` and
  friends (which also have **no** `@example`) never get scanned as
  standalone declarations because they're only reachable as
  `CurrencyCodes.CurrencyCodeDataValues` through the namespace barrel.
  **This is plausibly a detector blind spot** (flat vs. namespaced re-export
  changes whether inner declarations get scanned at all, which looks like an
  accidental scope gap rather than a deliberate design choice) — flagging for
  driver verdict-challenge (D-C) rather than acting on it: restructuring
  `@beep/html`'s public API shape (`import { Div } from "@beep/html"` →
  `import { HtmlModel } from "@beep/html"; HtmlModel.Div`) purely to dodge the
  doc requirement would be a breaking API change and arguably gaming detector
  intent even without touching the detector's code, so it is **not**
  recommended as this lane's fix — the generator-template fix in §3 is.

## Disposition

| Item | Disposition | Evidence |
|---|---|---|
| 301 `Html.model.ts` missing-`@example` | fixed via generator template (§3a-3c) | scratch-compiled patterns, §4 |
| 3 `Html.meta.ts` missing-`@example` | fixed via generator template (§3d) | existing `HtmlCategory` precedent in same file |
| 1 `Html.model.ts` schemaAnnotationGap (`HtmlChildren`) | fixed via generator template (§3e) | tested in-place, reverted |
| 22 `Html.attributes.ts` missing-`@example` + 15 schemaAnnotationGaps | hand-fix, separate lane (not generated) | file has no generation banner |
| 5 `Html.nodes.ts` missing-`@example` | hand-fix, same lane as attributes.ts (small, same package) | file has no generation banner |
| Namespaced-barrel detector blind spot | flag only, no action | §5, D-C verdict-challenge queued |

## Summary

301 of `@beep/html`'s 331 missing-`@example` findings sit in one generated
file (`Html.model.ts`, 100% open) plus 3 more in its sibling `Html.meta.ts`
(both emitted by `packages/foundation/modeling/html/scripts/generate.ts` via
`bun run generate`). Fix belongs in the generator's four template functions,
not the checked-in output: a `kind`-driven (`void`/`rawText`/`normal`)
`.make()` example per class, an `Encoded`-literal type-level example per
companion namespace (repo precedent: `Rule.model.ts`), a representative-member
example per category union, and reuse of the existing `HtmlCategory` example
idiom for `Html.meta.ts`. Regeneration is deterministic — `bun run generate`
reproduces the checked-in files byte-for-byte (verified, zero diff). One
schemaAnnotationGap (`HtmlChildren` needs a flat `export type` alias) is also
generator-owned and was verified to compile alongside the existing companion
namespace. The 27 remaining findings (22+15 in `Html.attributes.ts`, 5 in
`Html.nodes.ts`) are ordinary hand-authored fixes, not generator work. No
other generator-marked file in the repo carries jsdoc findings; a related
namespaced-vs-flat-barrel detector blind spot was found and flagged for driver
review, not acted on. Estimated lane count: 2 (generator-template lane;
hand-authored-files lane).
