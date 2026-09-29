# schema-inventory/v1 — research prototype

Pinned to `inventoryPin` `df77fff9396fe31de72d1947ecb5b74f8cee89e1`
(`effect@4.0.0-rc.118-9-gdf77fff939`), regenerated 2026-09-29 after the
snapshot bump in PR #1330; refreshed 2026-09-28 from the `51d4a2f08a`
snapshot. Deltas: [../2026-09-28-inventory-refresh.md](../2026-09-28-inventory-refresh.md)
and the History entry for 2026-09-29 below.

## Inputs

| Input | Rule | Owner |
| --- | --- | --- |
| Pin | The 40-character sha after `effect@` in the root `package.json` catalog entry for `effect` (a pkg.pr.new snapshot URL). The tools fail loud when the value is not such a URL, or when `git -C .repos/effect cat-file -e <pin>^{commit}` fails (the nightly pull has not reached the pin yet). The reference clone's HEAD (`referenceHead`) is never read. | `research/tools/modules.ts` `readInventoryPin` |
| Source bytes | `git -C .repos/effect show <pin>:<file>` only. The reference working tree and `node_modules/effect/src` are never read (the published tarball's `src/Schema.ts` differs from the git bytes). `.repos/effect` resolves relative to the repo root from the script URL. | `research/tools/modules.ts` `showPinned` |
| Module list | 24 files in fixed order: 12 package-root modules, the 9 files under `packages/effect/src/schema/`, and 3 provenance-only internals. Both tools import the list; `CAPTURE.md` is append-only stage-0 history and is no longer read. | `research/tools/modules.ts` `inventoryModules` |
| Parser | `typescript` resolved from the root `package.json` (no fallback into the reference clone). The version is stamped into `INDEX.md`, so a parser bump alone changes bytes. This refresh used `6.0.3`. | `research/tools/schema-inventory.ts` |

The planned `effect-schema-inventory` lint can take the same two rules: pin from
the catalog, bytes from `git show`. Neither tool depends on the reference
working tree, so a nightly `pull --ff-only` that moves `referenceHead` past the
pin leaves regeneration and verification byte-identical.

## Contract

| Field | Meaning |
| --- | --- |
| `sha` | The full 40-character `inventoryPin` (`df77fff9396fe31de72d1947ecb5b74f8cee89e1`), identical on every row and on the `INDEX.md` pin line (D4). The `51d4a2f08a` snapshot used a 10-character prefix. |
| `module` | Effect import path: `effect/` plus the source path without `packages/effect/src/`, `.ts` and a trailing `/index` (`schema/index.ts` is `effect/schema`). For provenance-only rows this is a path, not an importable specifier. |
| `file`, `line` | Upstream-relative path and one-based declaration/export-specifier line at the pin; read with `git -C .repos/effect show <pin>:<file>`, never the working tree. |
| `symbol` | Exported name; direct members use `Parent.member`. Computed/quoted names preserve source spelling; anonymous calls/indexes/constructors use `<call>`, `<index>`, `<new>`. |
| `kind` | `function`, `const`, `class`, `interface`, `type`, `namespace`; member extensions `method`, `property`, `accessor`, `call`, `constructor`; unresolved external named exports use `re-export`. |
| `category`, `since` | Declaration-local `@category` / `@since`, or JSON `null`; no parent metadata inheritance. |
| `deprecated`, `internal` | Boolean presence of the respective JSDoc tag on that declaration; retained, never silently filtered. |
| `signature` | Whitespace-collapsed syntactic declaration preview, at most 300 UTF-16 code units including ellipsis. Function bodies and variable initializers omitted; inferred constants carry `<inferred; see source>`. Local aliases can retain their local name in this preview. |
| `summary` | First JSDoc paragraph before a blank line/tag, at most 400 UTF-16 code units including ellipsis; empty string when absent. Inline JSDoc markup retained. |
| `hasExample` | JSDoc contains `@example` or `**Example**`; no example execution or validity claim. |
| `overloads` | Number of syntactic bodyless function/method/call/construct signatures, or direct call signatures of a const's explicit type literal. Implementation bodies excluded; zero means no overload signature captured, not non-callability. |
| `importable` | New in this refresh. `false` for rows of provenance-only modules: effect's `package.json` exports map sets `./internal/*` to `null`, so `effect/internal/schema/{codegen,compilerRegistry,interpreter}` cannot be imported by any consumer. `true` everywhere else. The flag is per module (declared in `modules.ts`) and repeated on each row so JSONL consumers can filter without the index. |

Identity is `(module, symbol, kind)`, a declaration facet rather than a unique TypeScript semantic symbol. Same-kind overloads collapse; type/value/namespace facets remain separate. Rows sort by defining file, source line, symbol and kind; module files follow `modules.ts` order. The draft version name is documented here rather than added as a per-row field. JSONL bytes exclude index, README and generator.

This is the single `schema-inventory/v1` identity contract for both tools. All listed fields are required; nullable metadata must be explicitly `null`, flags must be booleans, and `line`/`overloads` must be integers (positive/nonnegative respectively). The verifier rejects unknown fields, unknown kinds, duplicate identities, `importable` values that disagree with `modules.ts`, and source paths outside the module list. A module with no exports is an empty JSONL file (0 rows, 0 bytes); `effect/schema/SchemaJITCompiler/enable` is one, because it is a side-effect-only subpath listed in effect's `sideEffects`.

Changes from the `51d4a2f08a` snapshot: one new boolean field (`importable`), the barrel rule below, and the module list source. The one non-additive change is that row `sha` widened from a 10-character prefix to the full 40-character pin (D4). The widening alone adds 30 bytes per row: 66,960 bytes across 2,232 rows.

## Barrel rule (dedupe)

`packages/effect/src/schema/index.ts` (`effect/schema`) is an auto-generated barrel of five `export * as` lines (`:12`, `:18`, `:24`, `:30`, `:36` at the pin: `Model`, `SchemaAOTCompiler`, `SchemaCompiler`, `SchemaJITCompiler`, `VariantSchema`). Every target is itself in the module list, so its members are inventoried once, under the target's own import path. The barrel contributes one `namespace` row per `export * as` line and nothing else. The generator throws when a barrel names a target that is not in `modules.ts`, so a new upstream barrel member forces a module-list decision instead of silently dropping or duplicating rows.

This replaces the `51d4a2f08a` behaviour, which expanded each namespace one level and repeated the target's API under the barrel path (74 rows under `effect/unstable/schema`, 28 under `effect/unstable/arbitrary`). The old `unstable/arbitrary/{index,Arbitrary}.ts` pair collapses into the single root `Arbitrary.ts` (`effect/Arbitrary`): upstream deleted the barrel in `061b9611d4` (#8382).

## Extraction boundary and gaps

Evidence lines are at the pin, relative to `.repos/effect/`, read with `git show df77fff939:<path>`.

| Surface | Implemented behavior / limitation | Evidence |
| --- | --- | --- |
| Scope | The 24 files in `modules.ts`. Role B schema-bearing modules (`ai/`, `http/`, `encoding/`, `http-api/`, ...) are out of scope, as before. | `explorations/effect-schema-parity/research/tools/modules.ts` |
| Namespace barrels | One `namespace` row per `export * as`; no member expansion (see Barrel rule). | `packages/effect/src/schema/index.ts:12` |
| Local named aliases | Resolves local declarations, including destructured bindings; export-specifier JSDoc wins when present. | `packages/effect/src/Schema.ts:4505`, `packages/effect/src/SchemaAST.ts:862`, `packages/effect/src/schema/Model.ts:26` (destructure), `packages/effect/src/schema/Model.ts:79` (export list). |
| Bare `export * from` | Not expanded; none exist in the 24 inputs at the pin (generator reports `bareStarDeclarationsOmitted: 0`). | Count command below. |
| Declaration merging | Keeps distinct kinds; combines same-kind declarations but does not run the TypeScript binder/checker to merge symbols, resolve inherited fields or disambiguate static/instance collisions. Namespaces with another same-named facet are expected. | `packages/effect/src/StandardSchema.ts:78`, `packages/effect/src/StandardSchema.ts:83`. |
| Public members | Includes explicit members of exported interfaces/classes and directly written type literals, one level only; skips private/protected/#private class members. No inherited members, generated properties, class-expression implementation members, or mapped/conditional-type expansion. | `packages/effect/src/StandardSchema.ts:78`. |
| `@internal` leakage | Retains source exports tagged internal, including interface members. Not a declaration-emit/public-package availability proof. Parent internal status does not propagate; consumers must also exclude descendants of internal parents. `@internal` (a JSDoc tag) and `importable:false` (an exports-map fact) are independent. | `packages/effect/src/SchemaAST.ts:573`; JSONL flags are queryable. |
| Documentation | Short previews and presence flags only; omits full JSDoc sections, example bodies, module-level docs, tags other than those listed (including the new `@stability` tag from #8406), links resolved to targets, and deprecation reasons. | This is the requested bounded draft, not the full prompt context described by DECISIONS' Knowledge layer. |
| Semantic claims | No equivalence judgment, runtime behavior, type-check cost, declaration-emit compatibility, or examples tested. | UNVERIFIED by this extractor; requires the other research lanes and later gate design. |

Count commands (run from repo root; the grep reads the pinned bytes, not the working tree):

```sh
P=$(jq -r '.catalog.effect' package.json | sed 's/.*effect@//')
for f in $(bun -e 'import { inventoryModules } from "./explorations/effect-schema-parity/research/tools/modules.ts"; console.log(inventoryModules.map((m) => m.file).join(" "))'); do
  git -C .repos/effect show "$P:$f" | grep -c '^export \* from'
done
rg --no-ignore -c '"internal":true' explorations/effect-schema-parity/research/inventory/*.jsonl
rg --no-ignore -c '"deprecated":true' explorations/effect-schema-parity/research/inventory/*.jsonl
rg --no-ignore -c '"importable":false' explorations/effect-schema-parity/research/inventory/*.jsonl
```

Verified 2026-09-28: 24 inputs; zero bare star declarations; 195 internal rows; zero deprecated rows (rg exit 1); 39 `importable:false` rows (the three internal modules). These are row counts, not unique semantic API counts. Module/kind/category counts and the exact regeneration command are in [INDEX.md](INDEX.md); the generator independently checks every reported group using ripgrep. Bytes use `Buffer.byteLength`, since ripgrep counts matching lines rather than bytes.

## Portable fixture recommendation and existing mechanics

**Keep this snapshot in the packet during research; promote the reviewed generator and inventory into repo-cli test fixtures in the goal.** This follows the locked Knowledge layer and Gate home decisions. Hosted consumers must read committed rows without `.repos/effect`, graft or network access. Keep future rule findings/ratchet state separate from the upstream knowledge fixture.

| Concern | Existing Effect Vitest evidence (repo-relative) | Schema parity recommendation |
| --- | --- | --- |
| Portable upstream evidence | `packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts:35` selects `fixtures/effect-vitest-rc115`; `:111` reads source text fixtures and `:247` reads charter fragments. `packages/tooling/tool/cli/test/fixtures/effect-vitest-rc115/LICENSE:1` carries MIT licensing. | Commit compact generated JSONL and provenance/licensing metadata; do not bulk-copy upstream modules into this packet. |
| Pin ownership | `standards/effect-vitest.primitives.jsonc:6` through `:8` pins version, tag and full SHA; `packages/tooling/tool/cli/src/commands/Lint/Lint.schemas.ts:1221` names the graph path. | Add manifest with full SHA, effect version/tag, generator/parser version, input file hashes and output hashes. This draft reads the full SHA from the catalog and bytes from `git show`; it is not a complete release manifest. |
| Schema-decoded graph load | `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestPrimitives.ts:30` reads the graph through `readArtifact` and its schema. | Schema-decode rows and manifest at the hosted boundary; reject malformed/stale inventory. |
| Installed version gate | `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestScan.ts:73` reads package metadata; `:88` rejects version mismatch; `:92` instructs source-anchor regeneration, semantic diff review, then graph repin. | Compare installed `effect` version with fixture manifest before running UpstreamParity detectors. This checks package version; it does not itself verify a Git checkout SHA. |
| Source-anchor proof | `packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts:101` derives anchors from portable source; `:282` checks derived entries against the graph. | Add focused extraction contract tests for aliases, overloads, merging, internal tags and namespace depth, plus deterministic refresh proof. Hash equality alone cannot prove extraction completeness. |
| Baseline storage | `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestStore.ts:65` schema-decodes the optional baseline; `:105` encodes it; `:118` identifies `effect-vitest --write` as the generator. | Reuse typed storage conventions for findings. Avoid treating upstream declarations themselves as ratcheted findings. |
| Baseline refresh gate | `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestScan.ts:450` rejects a mismatched baseline version unless writing; `:453` requests reviewed-source refresh; `:472` performs write. | Repin knowledge, review semantic diff, run detectors, then explicitly refresh the independent findings baseline. `--write` is not automatic upstream-fixture regeneration. |
| Owned JSONL output | `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestStore.ts:24` recognizes owned rows through decoding; `:153` documents guarded stale-file removal. | Adopt ownership-aware cleanup on promotion. This prototype overwrites only its named outputs and does not delete stale or unrelated files; the 2026-09-28 refresh removed the renamed `effect-unstable-*.jsonl` files by hand. |

A fully automated Vitest fixture-refresh command was **UNVERIFIED** in the inspected Store/Scan/Primitives/test files; the observed contract is regeneration plus review instructions, portable anchor tests, and separate baseline `--write`. Do not describe the existing scanner as automatically repinning fixtures on dependency bumps.

## Verification

Exact commands from repo root (offline; `bun run`):

```sh
bun run explorations/effect-schema-parity/research/tools/schema-inventory.ts
bun run explorations/effect-schema-parity/research/tools/verify-schema-inventory.ts
```

Verifier output (2026-09-29):

```text
PASS: inventoryPin df77fff9396fe31de72d1947ecb5b74f8cee89e1 read from root package.json catalog; sources read via git show <pin>:<file>
PASS: 24 modules; 2232 rows; Schema.ts 1109 rows; JSONL 998102 bytes; INDEX and ripgrep counts agree
PASS: (module, symbol, kind) identities unique; all fields/types, preview bounds and defining-file line bounds valid
PASS: regenerated JSONL and INDEX.md byte-identical from research cwd; temporary directory deleted
```

Count proof: `rg --no-ignore --no-heading -F -c '"sha":' explorations/effect-schema-parity/research/inventory/*.jsonl` (sum the file counts; Schema.ts is `effect-Schema.jsonl`; the empty `enable` file prints nothing). Bytes are summed Buffer lengths, not ripgrep counts. The generator also checks the INDEX kind/category census using its documented ripgrep commands.

The verifier re-reads the pin from the catalog, bounds every row's `line` by the pinned file's line count from `git show`, checks the INDEX pin line, the JSONL file set against `modules.ts`, and every row's `importable` against `modules.ts`. It then invokes `bun run <absolute-script-path> <absolute-temporary-directory>` with cwd set to `research/`; `mkdtempSync` allocates that directory beneath `research/tools/.tmp/`, and `finally` deletes it even on comparison failure. It compares the JSONL filename set and every JSONL byte, plus INDEX.md bytes. No full build, full test suite, network request or Git mutation was used.

## History

- 2026-09-29 regeneration (`e5f7d12af9` → `df77fff939`, PR #1330's snapshot bump, which did not regenerate the inventory itself): of the 24 modules only `packages/effect/src/Schema.ts` changed upstream (effect #8580, single brand key typing). Rows stay at 2,232 with no identity added or removed; six `effect/Schema` rows changed signature (`brand` function and interface, `brand."Type"`, `brand."Iso"`, `brand."~type.make"`, `fromBrand`), line numbers after the change shifted, and every row's `sha` moved to the new pin. JSONL bytes 998,009 → 998,102.
- 2026-09-28 refresh (`51d4a2f08a` → `e5f7d12af9`): the pin moved from a hard-coded constant to the catalog; both tools dropped their `.repos/effect` HEAD-equals-pin and working-tree-bytes asserts (they passed only while `referenceHead` happened to equal the pin); the module list moved from `CAPTURE.md` Role A rows (14 `.ts` files) to `modules.ts` (24 files); `effect-unstable-*.jsonl` were deleted and replaced by paths that follow effect's move of unstable modules to top-level paths (#8354, #8382); barrels stopped expanding; `importable` joined the row contract. 2,105 rows became 2,232.
- The `51d4a2f08a` snapshot's verifier output read: 14 modules; 2105 rows; Schema.ts 1026 rows; JSONL 853360 bytes.
- Concurrent inventory writers replaced an earlier unique-symbol extractor after its verifier passed; the former verifier and receipt did not validate the surviving declaration-facet implementation.
- Earlier receipt (historical, **UNVERIFIED** against retained artifacts): 1,830 rows, Schema 922, 703,959 JSONL bytes; digest `0dc88f93bd39ed2eb7da5102d7e1963f13195ca38754e9060da679e4f7ff9cdc`.
- The earlier implementation combined kinds, handled implicit ambient namespace exports and left namespace aliases unexpanded; the `51d4a2f08a` survivor kept kinds separate and expanded barrel aliases. The 2026-09-28 refresh returns to unexpanded barrels because every barrel target is now inventoried under its own path.
- The `51d4a2f08a` single-writer reconciliation folded in the deleted `research/INVENTORY-CONCURRENT-WRITE.md` receipt; future refreshes need one owner and an agreed identity contract before generation.
