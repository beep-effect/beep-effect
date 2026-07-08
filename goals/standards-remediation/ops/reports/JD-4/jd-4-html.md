# JD-4 — `@beep/html` JSDoc generator lane

Lane: `JD-4`, package: `packages/foundation/modeling/html` (`@beep/html`).
Single writer for the package for the duration of this lane. No commits made;
`standards/*.jsonc` never opened for writing.

Spec followed: R8 (LOCKED, `goals/standards-remediation/research/decisions.md`)
and its full plan in `ops/reports/P2-audits/p2-j5-html.md`. Fresh baseline
before this lane: 339 exports, 331 missing `@example`, 16
`schemaAnnotationFindings`, 0 everything else.

## Work Set 1 — generator template (`scripts/generate.ts`)

Added a kind-driven `exampleArgs(kind)` / `exampleEncoded(tag, kind)` helper
pair (`void` → `{}` / `{ _tag }`, `rawText` → `{ content: "" }`, `normal` →
`{ children: [] }`) and spliced `@example` blocks into all four template
emitters:

- `elementBlock()` — `.make()` example per element class + `Encoded`-literal
  example per companion namespace (144 classes + 144 companions).
- `containerNode()` — same treatment for `Fragment`/`Document` (both
  `normal`-shaped).
- `categoryUnion()` — representative-member `S.is` example per of the 9
  category unions (first matching element in `els`, e.g. `A`/`Flow` — matches
  the audit's own worked example verbatim).
- `header` — `HtmlChildren` const/namespace examples, plus the new
  `export type HtmlChildren = typeof HtmlChildren.Type;` alias (schema
  annotation gap fix) with its own `@example`, mirroring the pre-existing
  `HtmlCategory` const+type idiom in `Html.meta.ts`.
- `unionBlock` — `HtmlNode` const/namespace examples (`A` as the one
  representative union member).
- `meta` template — `HtmlElementMeta` schema + type examples, `ELEMENT_META`
  example (`ELEMENT_META.div.interface // "HTMLDivElement"`, matching the
  audit's suggested idiom exactly).

`bun run generate` regenerates `Html.model.ts` (8-9k lines) and `Html.meta.ts`
cleanly. **Determinism**: two consecutive `bun run generate` runs produce
byte-identical output (`sha256sum` compared before/after a second run — no
diff). Note: `bun run generate:check`'s `git diff --exit-code` step reports
non-zero here only because the regenerated files differ from the *last
commit* (expected — these changes are intentionally uncommitted per lane
instructions), not because of non-determinism; the sha256 comparison is the
correct determinism proof in a dirty tree.

## Work Set 2 — hand-authored fixes

Pulled exact ground truth from `standards/jsdoc-documentation.inventory.jsonc`
(read-only) instead of guessing: 22 missing `@example` + 15
`schemaAnnotationGaps` in `Html.attributes.ts`, 5 missing `@example` in
`Html.nodes.ts`.

- `Html.attributes.ts`: added `@example` to all 22 open exports (13
  `LiteralKit` enums via `.is.<value>(...)`, `BooleanAttribute` via
  `S.is(...)`, `StandardGlobalAttributes`/`DatasetAttribute`/`AriaAttributes`/
  `EventHandlerAttributes`/`GlobalAttributes` via `S.is(<field>)(O.none())` on
  one representative field, `GlobalAttributesStruct` via `S.is(...)({})`,
  `GlobalAttributesType`/`GlobalAttributesEncoded` via a typed helper
  function). Added the 15 missing `export type X = typeof X.Type` aliases
  (14 schemas + `GlobalAttributesStruct`), each with its own `@example`.
  Caught and fixed one effect-LSP `unnecessaryTypeofType` finding this
  introduced (`GlobalAttributesType` re-derived `typeof GlobalAttributesStruct.Type`
  redundantly once the sibling `GlobalAttributesStruct` type alias existed —
  changed to `export type GlobalAttributesType = GlobalAttributesStruct`).
- `Html.nodes.ts`: added `@example` to `Text` namespace, `Comment`
  class+namespace, `Doctype` class+namespace (`Doctype.html()`'s existing
  static helper used directly for the class example).

## Work Set 3 — effect-laws allowlist (2 entries, `AL-1b.json`)

Both `packages/foundation/modeling/html/scripts/generate.ts` entries
**converted, not left unconvertible**:

- `HTML-GENERATOR-NATIVE-MAP-SET` (`new-map-set`) — every `new Map`/`new Set`
  (12 call sites: `RESERVED`, `elementNameSet`, `elemAttrs`
  `Map<string,Set<string>>`, `enumValues` get-or-insert map, `interfaceByName`,
  `globalKeys`, `booleanAttrs`/`numericAttrs`/`voidEls`/`rawTextEls`, the
  `uniq`-dedup `Set`, and the category-values dedup `Set`) replaced with
  `MutableHashMap`/`MutableHashSet` (repo precedent: `Graph.ts`, `UniqueDeps.ts`,
  `Corpus.service.ts`, `DualArity.ts`) — `.get`/`.has`/`.add`/`.set` calls
  rewritten to the dual-form `MutableHashMap.get`/`MutableHashSet.has`/etc.
- `HTML-GENERATOR-OBJECT-METHOD` (`object-method`) — the one `Object.keys(GlobalAttributes)`
  call replaced with `R.keys(GlobalAttributes)` (`effect/Record`, aliased `R`
  per repo convention); required an explicit `MutableHashSet.fromIterable<string>(...)`
  type argument since `R.keys` returns the narrower `Array<K & string>` literal
  type rather than plain `string[]`.

Both entries in `standards/effect-laws.allowlist.jsonc` (lines ~131, ~139) are
now **stale** — the violations they describe no longer exist in source. Not
removed here (instructed not to edit `standards/*.jsonc`); flagging for the
driver to delete both entries in the P7 allowlist-challenge pass.

## Verify (all green, package-scoped)

- `bun run generate` then `bun run generate:check` internals — determinism
  confirmed via sha256 (see above); zero generator errors.
- `turbo run docgen --filter=@beep/html --force` (cache bypassed) — **354
  examples found, typechecked, zero errors**, `✓ Docs generation succeeded!`.
- `npx tsgo -b` — clean, no output (after fixing the one
  `unnecessaryTypeofType` self-inflicted finding above).
- `npx vitest run` — 12/12 passed.
- `bunx biome check .` — clean after one auto-fix (a long ternary in
  `generate.ts` needed line-wrapping; `bunx biome check . --write` applied it,
  re-ran `bun run generate` + full verify chain after, still green).
- Manual zero-missing-`@example` re-scan of all 5 `src/*.ts` files
  (declaration-adjacent doc-comment check) found 0 gaps.
- `git status --porcelain` scoped to the package shows exactly the 5 expected
  files touched: `scripts/generate.ts`, `src/Html.attributes.ts`,
  `src/Html.meta.ts`, `src/Html.model.ts`, `src/Html.nodes.ts`.

## Result

Package missing-`@example` total: **331 → 0**. `schemaAnnotationFindings`:
**16 → 0**. Effect-laws allowlist: 2/2 entries converted (driver to prune the
now-stale allowlist rows). No fake-docs shortcuts (fence 14): every example is
a real, compiling, observable call against the package's actual public API.
