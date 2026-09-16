# schema-inventory/v1 — research prototype

## Contract

| Field | Meaning |
| --- | --- |
| `sha` | Fixed upstream main prefix `51d4a2f08a`; generator verifies full HEAD and compares every input byte against `git show HEAD:<file>` before writing. |
| `module` | Effect import path; barrel `index.ts` maps to its directory import. |
| `file`, `line` | Upstream-relative path and one-based declaration/export-specifier line; resolve against `.repos/effect/`. Barrel member rows cite the defining module. |
| `symbol` | Exported name; direct members use `Parent.member`. Computed/quoted names preserve source spelling; anonymous calls/indexes/constructors use `<call>`, `<index>`, `<new>`. |
| `kind` | `function`, `const`, `class`, `interface`, `type`, `namespace`; member extensions `method`, `property`, `accessor`, `call`, `constructor`; unresolved external named exports use `re-export`. |
| `category`, `since` | Declaration-local `@category` / `@since`, or JSON `null`; no parent metadata inheritance. |
| `deprecated`, `internal` | Boolean presence of the respective JSDoc tag on that declaration; retained, never silently filtered. |
| `signature` | Whitespace-collapsed syntactic declaration preview, at most 300 UTF-16 code units including ellipsis. Function bodies and variable initializers omitted; inferred constants carry `<inferred; see source>`. Local aliases can retain their local name in this preview. |
| `summary` | First JSDoc paragraph before a blank line/tag, at most 400 UTF-16 code units including ellipsis; empty string when absent. Inline JSDoc markup retained. |
| `hasExample` | JSDoc contains `@example` or `**Example**`; no example execution or validity claim. |
| `overloads` | Number of syntactic bodyless function/method/call/construct signatures, or direct call signatures of a const's explicit type literal. Implementation bodies excluded; zero means no overload signature captured, not non-callability. |

Identity is `(module, symbol, kind)`, a declaration facet rather than a unique TypeScript semantic symbol. Same-kind overloads collapse; type/value/namespace facets remain separate. Rows sort by defining file, source line, symbol and kind; module files follow CAPTURE order. The draft version name is documented here rather than added as a per-row field. JSONL bytes exclude index, README and generator.

This is the single `schema-inventory/v1` identity contract for both tools. All listed fields are required; nullable metadata must be explicitly `null`, flags must be booleans, and `line`/`overloads` must be integers (positive/nonnegative respectively). The verifier rejects unknown fields, unknown kinds, duplicate identities and source paths outside the captured input list.

| Reconciliation finding | Resolution and upstream evidence (relative to `.repos/effect/`) |
| --- | --- |
| `Arbitrary.Constant` was reported malformed | Extracted row is correct: the declaration is `packages/effect/src/unstable/arbitrary/Arbitrary.ts:368`, reached through the namespace export at `packages/effect/src/unstable/arbitrary/index.ts:10`. Verifier now bounds `line` against the row's defining `file`, not the barrel. |
| Repeated `Arbitrary.TypeId` was reported as a duplicate symbol | Both facets are correct: `const` at `packages/effect/src/unstable/arbitrary/Arbitrary.ts:24` and `type` at `packages/effect/src/unstable/arbitrary/Arbitrary.ts:32`. Verifier now rejects only exact `(module, symbol, kind)` duplicates. |
| Extractor failed from `research/` | Resolve repo root from the script URL; add an optional output-directory argument restricted to inventory or a child of `research/tools/.tmp/`; require exact full upstream SHA equality. Extraction semantics are unchanged. |

The old compiler-symbol coverage check was removed because it enforced another merging/namespace contract. This verifier proves row shape, provenance, counts and reproducibility; semantic export completeness remains **UNVERIFIED**. It checks each input against the pinned commit and compares regeneration in a disposable directory, without overwriting the checked inventory.

## Extraction boundary and gaps

| Surface | Implemented behavior / limitation | Evidence |
| --- | --- | --- |
| Role A scope | Derives the TypeScript file list from CAPTURE; skips Markdown and all Role B modules. | `explorations/effect-schema-parity/CAPTURE.md:91` (module list section). |
| Namespace barrels | Emits namespace plus direct exported declarations of the target when that target is in the input list; no second member expansion. These rows intentionally repeat the defining module's API under another import path. | Upstream `packages/effect/src/unstable/schema/index.ts:10`, `packages/effect/src/unstable/arbitrary/index.ts:10`. |
| Local named aliases | Resolves local declarations, including destructured bindings; export-specifier JSDoc wins when present. | Upstream `packages/effect/src/Schema.ts:4453`, `packages/effect/src/SchemaAST.ts:857`, `packages/effect/src/unstable/schema/Model.ts:26`, `packages/effect/src/unstable/schema/Model.ts:72`. |
| Bare `export * from` | Not expanded. A future source introducing this needs explicit resolver support; no inference of exported names. | Scan command below establishes current absence; namespace-star exports above are supported. |
| Declaration merging | Keeps distinct kinds; combines same-kind declarations but does not run the TypeScript binder/checker to merge symbols, resolve inherited fields or disambiguate static/instance collisions. Namespaces with another same-named facet are expected. | Upstream `packages/effect/src/StandardSchema.ts:38`, `packages/effect/src/StandardSchema.ts:43`. |
| Public members | Includes explicit members of exported interfaces/classes and directly written type literals, one level only; skips private/protected/#private class members. No inherited members, generated properties, class-expression implementation members, or mapped/conditional-type expansion. | Upstream `packages/effect/src/StandardSchema.ts:38`, `packages/effect/src/StandardSchema.ts:47`; the latter's nested properties are beyond the namespace depth budget. |
| `@internal` leakage | Retains source exports tagged internal, including interface members. Not a declaration-emit/public-package availability proof. Parent internal status does not propagate; consumers must also exclude descendants of internal parents. | Upstream `packages/effect/src/SchemaAST.ts:830`, `packages/effect/src/Schema.ts:5420`; JSONL flags are queryable. |
| Documentation | Short previews and presence flags only; omits full JSDoc sections, example bodies, module-level docs, tags other than those listed, links resolved to targets, and deprecation reasons. | This is the requested bounded draft, not the full prompt context described by DECISIONS' Knowledge layer. |
| Semantic claims | No equivalence judgment, runtime behavior, type-check cost, declaration-emit compatibility, or examples tested. | UNVERIFIED by this extractor; requires the other research lanes and later gate design. |

Count commands (run from repo root):

```sh
rg -c '^A  .*\.ts$' explorations/effect-schema-parity/CAPTURE.md
rg -n '^export \* from' .repos/effect/packages/effect/src/{Schema,SchemaAST,SchemaGetter,SchemaParser,SchemaIssue,SchemaRepresentation,SchemaTransformation,StandardSchema,JsonSchema}.ts .repos/effect/packages/effect/src/unstable/{schema,arbitrary}/*.ts
rg --no-ignore -c '"internal":true' explorations/effect-schema-parity/research/inventory/*.jsonl
rg --no-ignore -c '"deprecated":true' explorations/effect-schema-parity/research/inventory/*.jsonl
```

Verified: 14 Role A TypeScript inputs; zero bare star declarations (rg exit 1); 162 internal rows across import surfaces; zero deprecated rows (rg exit 1). These are row counts, not unique semantic API counts. Module/kind/category counts and exact regeneration command are in [INDEX.md](INDEX.md); the generator independently checks every reported group using ripgrep. Bytes use `Buffer.byteLength`, since ripgrep counts matching lines rather than bytes.

## Portable fixture recommendation and existing mechanics

**Keep this snapshot in the packet during research; promote the reviewed generator and inventory into repo-cli test fixtures in the goal.** This follows the locked Knowledge layer and Gate home decisions. Hosted consumers must read committed rows without `.repos/effect`, graft or network access. Keep future rule findings/ratchet state separate from the upstream knowledge fixture.

| Concern | Existing Effect Vitest evidence (repo-relative) | Schema parity recommendation |
| --- | --- | --- |
| Portable upstream evidence | `packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts:35` selects `fixtures/effect-vitest-rc115`; `:111` reads source text fixtures and `:247` reads charter fragments. `packages/tooling/tool/cli/test/fixtures/effect-vitest-rc115/LICENSE:1` carries MIT licensing. | Commit compact generated JSONL and provenance/licensing metadata; do not bulk-copy upstream modules into this packet. |
| Pin ownership | `standards/effect-vitest.primitives.jsonc:6` through `:8` pins version, tag and full SHA; `packages/tooling/tool/cli/src/commands/Lint/Lint.schemas.ts:1221` names the graph path. | Add manifest with full SHA, effect version/tag, generator/parser version, input file hashes and output hashes. This draft has fixed SHA plus verified live source, not a complete release manifest. |
| Schema-decoded graph load | `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestPrimitives.ts:30` reads the graph through `readArtifact` and its schema. | Schema-decode rows and manifest at the hosted boundary; reject malformed/stale inventory. |
| Installed version gate | `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestScan.ts:73` reads package metadata; `:88` rejects version mismatch; `:92` instructs source-anchor regeneration, semantic diff review, then graph repin. | Compare installed `effect` version with fixture manifest before running UpstreamParity detectors. This checks package version; it does not itself verify a Git checkout SHA. |
| Source-anchor proof | `packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts:101` derives anchors from portable source; `:282` checks derived entries against the graph. | Add focused extraction contract tests for aliases, overloads, merging, internal tags and namespace depth, plus deterministic refresh proof. Hash equality alone cannot prove extraction completeness. |
| Baseline storage | `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestStore.ts:65` schema-decodes the optional baseline; `:105` encodes it; `:118` identifies `effect-vitest --write` as the generator. | Reuse typed storage conventions for findings. Avoid treating upstream declarations themselves as ratcheted findings. |
| Baseline refresh gate | `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestScan.ts:450` rejects a mismatched baseline version unless writing; `:453` requests reviewed-source refresh; `:472` performs write. | Repin knowledge, review semantic diff, run detectors, then explicitly refresh the independent findings baseline. `--write` is not automatic upstream-fixture regeneration. |
| Owned JSONL output | `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestStore.ts:24` recognizes owned rows through decoding; `:153` documents guarded stale-file removal. | Adopt ownership-aware cleanup on promotion. This prototype overwrites only its named outputs and does not delete stale or unrelated files. |

A fully automated Vitest fixture-refresh command was **UNVERIFIED** in the inspected Store/Scan/Primitives/test files; the observed contract is regeneration plus review instructions, portable anchor tests, and separate baseline `--write`. Do not describe the existing scanner as automatically repinning fixtures on dependency bumps.

## Verification

Exact commands from repo root (offline; `bun run`):

```sh
bun run explorations/effect-schema-parity/research/tools/schema-inventory.ts
bun run explorations/effect-schema-parity/research/tools/verify-schema-inventory.ts
```

Verifier output:

```text
PASS: upstream HEAD and source bytes pinned to 51d4a2f08a5c7691dc876415bc9fc0ecf467e153
PASS: 14 modules; 2105 rows; Schema.ts 1026 rows; JSONL 853360 bytes; INDEX and ripgrep counts agree
PASS: (module, symbol, kind) identities unique; all fields/types, preview bounds and defining-file line bounds valid
PASS: regenerated JSONL and INDEX.md byte-identical from research cwd; temporary directory deleted
```

Count proof: `rg --no-ignore --no-heading -F -c '"sha":' explorations/effect-schema-parity/research/inventory/*.jsonl` (sum the file counts; Schema.ts is `effect-Schema.jsonl`). Bytes are summed Buffer lengths, not ripgrep counts. The generator also checks the INDEX kind/category census using its documented ripgrep commands.

The verifier invokes `bun run <absolute-script-path> <absolute-temporary-directory>` with cwd set to `research/`; `mkdtempSync` allocates that directory beneath `research/tools/.tmp/`, and `finally` deletes it even on comparison failure. It compares the JSONL filename set and every JSONL byte, plus INDEX.md bytes. No full build, full test suite, network request or Git mutation was used.

## History

- Concurrent inventory writers replaced an earlier unique-symbol extractor after its verifier passed; the former verifier and receipt did not validate the surviving declaration-facet implementation.
- Earlier receipt (historical, **UNVERIFIED** against retained artifacts): 1,830 rows, Schema 922, 703,959 JSONL bytes; digest `0dc88f93bd39ed2eb7da5102d7e1963f13195ca38754e9060da679e4f7ff9cdc`.
- The earlier implementation combined kinds, handled implicit ambient namespace exports and left namespace aliases unexpanded; the survivor keeps kinds separate and expands barrel aliases. Reconciliation retains the survivor's extraction boundary.
- The concurrent-write receipt reported 2,105 rows, Schema 1,026 and 857,722 bytes; that byte figure is stale (**UNVERIFIED** historical snapshot). Current regeneration and verification above establish 853,360 bytes.
- This single-writer reconciliation aligns tools, contract and INDEX, and folds in the deleted `research/INVENTORY-CONCURRENT-WRITE.md` receipt; future refreshes need one owner and an agreed identity contract before generation.
