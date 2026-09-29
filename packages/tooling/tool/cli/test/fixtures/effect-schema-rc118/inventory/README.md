# schema-inventory/v1

The pinned Effect schema inventory: `schema-inventory/v1` rows for 24 upstream
modules, owned by `bun run beep lint effect-schema-inventory` in `@beep/repo-cli`
(`src/commands/Lint/EffectSchemaInventory.ts`). Pinned to `inventoryPin`
`df77fff9396fe31de72d1947ecb5b74f8cee89e1` (`effect@4.0.0-rc.118-9-gdf77fff939`).
The rows began as the effect-schema-parity research prototype; the
2026-09-28 refresh deltas are in
`explorations/effect-schema-parity/research/2026-09-28-inventory-refresh.md`,
and the History section below records every regeneration since.

| Command | What it does |
| --- | --- |
| `bun run beep lint effect-schema-inventory --write` | Regenerates every `*.jsonl` file and `INDEX.md` from `.repos/effect` at the pin. It builds the new directory in a sibling temporary directory and renames it into place, so a failed write leaves the committed fixture untouched. A stale `*.jsonl` is dropped only when every line decodes as a row; this README and foreign files are carried over. |
| `bun run beep lint effect-schema-inventory --check` | The default mode. Regenerates in memory and fails with a per-file drift report unless every owned fixture file is byte-identical and every generated lane prompt under `goals/effect-schema-parity/ops/prompts/` re-renders to its committed bytes outside its graft section. Writes nothing. |
| `bun run beep lint effect-schema-inventory --prompt <module>` | Writes a lane prompt for one module: each row resolved at the pin to its full declaration and JSDoc block, plus local graft context. Fails when graft cannot be read. Defaults to `goals/effect-schema-parity/ops/prompts/<slug>.md`; `--out <path>` overrides it. |

All three modes fail loud when the catalog entry is not a snapshot URL, when
`.repos/effect` is missing or is not a git checkout, or when it lacks the pinned
commit, and `--write` and `--check` fail when extraction yields zero rows in
total (one empty module, `enable`, is expected). A fixture directory that exists
but cannot be listed fails too. Nothing passes on empty input. This `README.md`
and `../LICENSE` (Effect's MIT license) are maintained by hand; the command never
writes them.

## Inputs

| Input | Rule | Owner |
| --- | --- | --- |
| Pin | The 40-character sha after `effect@` in the root `package.json` catalog entry for `effect` (a pkg.pr.new snapshot URL). The command fails with `EffectSchemaInventoryCatalogPinError` when the value is not such a URL, with `EffectSchemaInventoryReferenceMissingError` when `.repos/effect` is absent or not a git checkout, and with `EffectSchemaInventoryPinAbsentError` when `git -C .repos/effect cat-file -e <pin>^{commit}` fails (the nightly pull has not reached the pin yet). The reference clone's HEAD (`referenceHead`) is never compared with the pin. | `internal/EffectSchemaInventoryModules.ts` `parseEffectSchemaInventoryPin`; `internal/EffectSchemaInventorySource.ts` `verifyPin` |
| Source bytes | `git -C .repos/effect show <pin>:<file>` only. The reference working tree and `node_modules/effect/src` are never read (the published tarball's `src/Schema.ts` differs from the git bytes). `.repos/effect` resolves against the repository root. | `internal/EffectSchemaInventorySource.ts` `readPinned` |
| Module list | 24 files in fixed order: 12 package-root modules, the 9 files under `packages/effect/src/schema/`, and 3 provenance-only internals. `CAPTURE.md` is append-only stage-0 history and is not read. | `internal/EffectSchemaInventoryModules.ts` `EffectSchemaInventoryModules` |
| Parser | The TypeScript compiler bundled with `ts-morph` (a repo-cli dependency; no fallback into the reference clone). The version is stamped into `INDEX.md`, so a parser bump alone changes bytes. The P1 regeneration used `6.0.2`; the research prototype used the root `typescript` `6.0.3`, and every JSONL byte came out identical. | `internal/EffectSchemaInventoryExtract.ts` |

Paths in the Owner column are under `packages/tooling/tool/cli/src/commands/Lint/`.
Nothing reads the reference working tree, so a nightly `pull --ff-only` that
moves `referenceHead` past the pin leaves regeneration and verification
byte-identical.

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
| `importable` | Added in the 2026-09-28 refresh. `false` for rows of provenance-only modules: effect's `package.json` exports map sets `./internal/*` to `null`, so `effect/internal/schema/{codegen,compilerRegistry,interpreter}` cannot be imported by any consumer. `true` everywhere else. The flag is per module (declared in the module list) and repeated on each row so JSONL consumers can filter without the index. |

Identity is `(module, symbol, kind)`, a declaration facet rather than a unique TypeScript semantic symbol. Same-kind overloads collapse; type/value/namespace facets remain separate. Rows sort by defining file, source line, symbol and kind (strings compared with `localeCompare(…, "en")`, lines numerically); module files follow the module-list order. The version name `schema-inventory/v1` is documented here rather than added as a per-row field. JSONL bytes exclude `INDEX.md`, this README and the LICENSE.

This is the single `schema-inventory/v1` identity contract, modelled by the `EffectSchemaInventoryRow` schema (`src/commands/Lint/EffectSchemaInventory.schemas.ts`). Keys appear in the order `sha`, `module`, `file`, `line`, `symbol`, `kind`, `category`, `since`, `deprecated`, `internal`, `summary`, `hasExample`, `signature`, `overloads`, `importable`. All listed fields are required; nullable metadata must be explicitly `null`, flags must be booleans, and `line`/`overloads` must be integers (positive/nonnegative respectively). The hosted fixture test decodes every row, re-encodes it and requires the original line back, so unknown fields, reordered keys, unknown kinds, duplicate identities, `importable` values that disagree with the module list, and source paths outside it all fail.

**Row digest.** The `INDEX.md` `Row digest` line is the lowercase hex SHA-256 of the 24 JSONL files concatenated byte for byte in Module totals order (the module-list order); an empty file contributes no bytes. Reproduce it from this directory with the table's file names in order piped through `cat` and `sha256sum`. A module with no exports is an empty JSONL file (0 rows, 0 bytes); `effect/schema/SchemaJITCompiler/enable` is one, because it is a side-effect-only subpath listed in effect's `sideEffects`.

Changes from the `51d4a2f08a` snapshot: one new boolean field (`importable`), the barrel rule below, and the module list source. The one non-additive change is that row `sha` widened from a 10-character prefix to the full 40-character pin (D4). The widening alone adds 30 bytes per row: 66,960 bytes across 2,232 rows.

## Barrel rule (dedupe)

`packages/effect/src/schema/index.ts` (`effect/schema`) is an auto-generated barrel of five `export * as` lines (`:12`, `:18`, `:24`, `:30`, `:36` at the pin: `Model`, `SchemaAOTCompiler`, `SchemaCompiler`, `SchemaJITCompiler`, `VariantSchema`). Every target is itself in the module list, so its members are inventoried once, under the target's own import path. The barrel contributes one `namespace` row per `export * as` line and nothing else. Extraction fails when a barrel names a target that is not in the module list, so a new upstream barrel member forces a module-list decision instead of silently dropping or duplicating rows.

This replaces the `51d4a2f08a` behaviour, which expanded each namespace one level and repeated the target's API under the barrel path (74 rows under `effect/unstable/schema`, 28 under `effect/unstable/arbitrary`). The old `unstable/arbitrary/{index,Arbitrary}.ts` pair collapses into the single root `Arbitrary.ts` (`effect/Arbitrary`): upstream deleted the barrel in `061b9611d4` (#8382).

## Extraction boundary and gaps

Evidence lines are at the pin, relative to `.repos/effect/`, read with `git show df77fff939:<path>`.

| Surface | Implemented behavior / limitation | Evidence |
| --- | --- | --- |
| Scope | The 24 files in the module list. Role B schema-bearing modules (`ai/`, `http/`, `encoding/`, `http-api/`, ...) are out of scope, as before. | `packages/tooling/tool/cli/src/commands/Lint/internal/EffectSchemaInventoryModules.ts` |
| Namespace barrels | One `namespace` row per `export * as`; no member expansion (see Barrel rule). | `packages/effect/src/schema/index.ts:12` |
| Local named aliases | Resolves local declarations, including destructured bindings; export-specifier JSDoc wins when present. | `packages/effect/src/Schema.ts:4505`, `packages/effect/src/SchemaAST.ts:862`, `packages/effect/src/schema/Model.ts:26` (destructure), `packages/effect/src/schema/Model.ts:79` (export list). |
| Bare `export * from` | Not expanded; none exist in the 24 inputs at the pin (generator reports `bareStarDeclarationsOmitted: 0`). | Count command below. |
| Declaration merging | Keeps distinct kinds; combines same-kind declarations but does not run the TypeScript binder/checker to merge symbols, resolve inherited fields or disambiguate static/instance collisions. Namespaces with another same-named facet are expected. | `packages/effect/src/StandardSchema.ts:78`, `packages/effect/src/StandardSchema.ts:83`. |
| Public members | Includes explicit members of exported interfaces/classes and directly written type literals, one level only; skips private/protected/#private class members. No inherited members, generated properties, class-expression implementation members, or mapped/conditional-type expansion. | `packages/effect/src/StandardSchema.ts:78`. |
| `@internal` leakage | Retains source exports tagged internal, including interface members. Not a declaration-emit/public-package availability proof. Parent internal status does not propagate; consumers must also exclude descendants of internal parents. `@internal` (a JSDoc tag) and `importable:false` (an exports-map fact) are independent. | `packages/effect/src/SchemaAST.ts:573`; JSONL flags are queryable. |
| Documentation | Short previews and presence flags only; omits full JSDoc sections, example bodies, module-level docs, tags other than those listed (including the new `@stability` tag from #8406), links resolved to targets, and deprecation reasons. | The rows are an index. `--prompt <module>` supplies the full context the DECISIONS Knowledge layer describes by resolving each row's `file:line` at the pin. |
| Semantic claims | No equivalence judgment, runtime behavior, type-check cost, declaration-emit compatibility, or examples tested. | UNVERIFIED by this extractor; requires the other research lanes and later gate design. |

Count commands (run from repo root; the grep reads the pinned bytes, not the working tree):

```sh
P=$(jq -r '.catalog.effect' package.json | sed 's/.*effect@//')
I=packages/tooling/tool/cli/test/fixtures/effect-schema-rc118/inventory
for f in $(jq -r .file "$I"/*.jsonl | sort -u); do
  git -C .repos/effect show "$P:$f" | grep -c '^export \* from'
done
rg --no-ignore -c '"internal":true' "$I"/*.jsonl
rg --no-ignore -c '"deprecated":true' "$I"/*.jsonl
rg --no-ignore -c '"importable":false' "$I"/*.jsonl
```

The first loop covers the 23 modules that have rows; the empty `enable` module has no `export` line at all. Verified 2026-09-29: zero bare star declarations (the command also reports `bareStarDeclarationsOmitted=0`); 195 internal rows; zero deprecated rows (rg exit 1); 39 `importable:false` rows (the three internal modules). These are row counts, not unique semantic API counts. Module/kind/category counts and the exact regeneration command are in [INDEX.md](INDEX.md). Bytes are UTF-8 byte lengths, since ripgrep counts matching lines rather than bytes.

## Hosted verification

Hosted CI never reads `.repos/effect`, graft, or a model. `packages/tooling/tool/cli/test/effect-schema-inventory-fixture.test.ts` runs in the repo-cli unit lane on Bun and on Node and checks the committed files alone:

- the JSONL file set equals the module list, and every row decodes with `EffectSchemaInventoryRow` and re-encodes to its exact line;
- `(module, symbol, kind)` identities are unique, and each row's `module`, `file`, and `importable` match its module-list entry;
- every row's `sha` equals the `INDEX.md` pin line and the root `package.json` catalog pin, so an Effect bump PR fails until it regenerates this fixture with `--write`;
- the `INDEX.md` row digest matches the JSONL bytes, and re-rendering `INDEX.md` from the committed rows reproduces it byte for byte.

Hosted CI cannot verify the lane prompts: re-rendering a prompt needs the pinned sources, so prompt verification runs only in local `--check`, which splices each committed prompt's graft section (local graft output) into the re-render and compares every other byte. `--check` is the local byte-for-byte proof against the pinned sources; the effect-vitest fixture beside this one (`../../effect-vitest-rc118/`) follows the same local-regenerate, hosted-verify split.

## Verification

Exact commands from repo root (offline):

```sh
bun run beep lint effect-schema-inventory --write
bun run beep lint effect-schema-inventory --check
```

`--check` output (2026-09-29):

```text
[effect-schema-inventory] fixture and prompts are byte-identical; pin=df77fff9396fe31de72d1947ecb5b74f8cee89e1 parser=6.0.2 modules=24 rows=2232 bytes=998102 internal=195 deprecated=0 bareStarDeclarationsOmitted=0 digest=519a2ee22549217f9afcd6d1e015d50f97b045cdbf59449fe3d866821ecd90b4
```

`--check` regenerates in memory, so a failed or interrupted check leaves nothing behind. Drift output names each missing, stale, or unexpected file; a stale file reports its first differing line and column with both sides of that line.

## History

- 2026-09-29 P1 productization: the research generator, verifier and module list moved into `beep lint effect-schema-inventory`, and this directory moved here with `git mv` from `explorations/effect-schema-parity/research/inventory/`. Regeneration kept all 24 JSONL files byte-identical (2,232 rows, 998,102 bytes). `INDEX.md` changed only in its header: the parser line (`6.0.3` to `6.0.2`, the TypeScript bundled with `ts-morph`), the module-list path, the regenerate command, the fixture paths in the count commands, the new `Row digest` line, and the verification sentence that now names the hosted test instead of the generator's ripgrep census.
- 2026-09-29 regeneration (`e5f7d12af9` → `df77fff939`, PR #1330's snapshot bump, which did not regenerate the inventory itself): of the 24 modules only `packages/effect/src/Schema.ts` changed upstream (effect #8580, single brand key typing). Rows stay at 2,232 with no identity added or removed; six `effect/Schema` rows changed signature (`brand` function and interface, `brand."Type"`, `brand."Iso"`, `brand."~type.make"`, `fromBrand`), line numbers after the change shifted, and every row's `sha` moved to the new pin. JSONL bytes 998,009 → 998,102.
- 2026-09-28 refresh (`51d4a2f08a` → `e5f7d12af9`): the pin moved from a hard-coded constant to the catalog; both tools dropped their `.repos/effect` HEAD-equals-pin and working-tree-bytes asserts (they passed only while `referenceHead` happened to equal the pin); the module list moved from `CAPTURE.md` Role A rows (14 `.ts` files) to `modules.ts` (24 files); `effect-unstable-*.jsonl` were deleted and replaced by paths that follow effect's move of unstable modules to top-level paths (#8354, #8382); barrels stopped expanding; `importable` joined the row contract. 2,105 rows became 2,232.
- The `51d4a2f08a` snapshot's verifier output read: 14 modules; 2105 rows; Schema.ts 1026 rows; JSONL 853360 bytes.
- Concurrent inventory writers replaced an earlier unique-symbol extractor after its verifier passed; the former verifier and receipt did not validate the surviving declaration-facet implementation.
- Earlier receipt (historical, **UNVERIFIED** against retained artifacts): 1,830 rows, Schema 922, 703,959 JSONL bytes; digest `0dc88f93bd39ed2eb7da5102d7e1963f13195ca38754e9060da679e4f7ff9cdc`.
- The earlier implementation combined kinds, handled implicit ambient namespace exports and left namespace aliases unexpanded; the `51d4a2f08a` survivor kept kinds separate and expanded barrel aliases. The 2026-09-28 refresh returns to unexpanded barrels because every barrel target is now inventoried under its own path.
- The `51d4a2f08a` single-writer reconciliation folded in the deleted `research/INVENTORY-CONCURRENT-WRITE.md` receipt; future refreshes need one owner and an agreed identity contract before generation.
