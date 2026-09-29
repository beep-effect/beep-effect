# Effect Schema Parity Spec

## Objective

Every `@beep/schema` concept whose consumed surface upstream Effect covers at
`inventoryPin`, the main snapshot `df77fff939` (rc.118 line,
`effect@4.0.0-rc.118-9-gdf77fff939`, read from the root `package.json`
catalog; goal-time rulings 2026-09-28 and 2026-09-29), is deleted, with every consumer
migrated in the same PR and no alias left behind. Concepts whose dominant
facet upstream does not cover are trimmed to that facet. A schema-first gate
(`SFV4-*` rules on a membership ratchet) and an rc-pinned inventory fixture
exist, and the gate's backlog is zero. Type-check cost on the three baseline
packages does not regress.

Shaped by `explorations/effect-schema-parity/BRIEF.md`; decomposed in
`explorations/effect-schema-parity/MAP.md`; ruled in
`explorations/effect-schema-parity/DECISIONS.md` (back-linked below, not
copied).

## Non-Goals

- No deprecation shims, thin re-export aliases, or "compat" modules for any
  retired concept or retired facet.
- No rewrite of the 77 KEEP concepts, and no new `@beep/schema` abstractions
  introduced while retiring old ones. SchemaUtils is one ADAPT concept outside these totals; its 39 exports census to 32 DELETE, 4 ADAPT, 3 KEEP
  (`explorations/effect-schema-parity/research/2026-09-28-schemautils-census.md`);
  its KEEP exports are untouched too.
- No changes to persisted or externally served encodings; a boundary whose
  upstream default differs is a migration goal outside this one.
- No detectors for idiom families under confidence 0.70 or reach 100 files
  (F05, F06, F04, ranks 10 through 21); skill prose at most. No F01 detector.
- No editing of the user's global rule files by an agent.
- No new workspace package for the inventory; it is a repo-cli fixture plus a
  generator command.
- No graft, `.repos/effect`, or LLM dependency in hosted CI.
- No retirement of LiteralKit's keyed value API (`Enum`, `is`, `$match`,
  `toTaggedUnion`, `LiteralToKey`) or of MappedLiteralKit's directional kits.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (schema-first-development,
   effect-first-development, yeet).
3. Governing standards: `standards/architecture/11-evolution-and-deprecation.md`
   (with the P0 entry once merged), `standards/architecture/07-non-slice-families.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, then the source
   exploration packet.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `standards/architecture/11-evolution-and-deprecation.md`, `AGENTS.md` Code
  Laws line, `packages/foundation/modeling/schema/README.md`, rule prose in
  `standards/effect-laws-v1.md`, `standards/ARCHITECTURE.md`,
  `standards/effect-first-development.md`,
  `standards/architecture/04-rich-domain-model.md`, `.claude/skills/*`,
  `.claude/agents/*`, `.codex/agents/*.toml` (P0).
- `packages/tooling/tool/cli/src/commands/Lint/**` (inventory command, `SFV4-*`
  rules, store, scan, policy, render), `Lint.schemas.ts`,
  `packages/tooling/tool/cli/test/fixtures/effect-schema-rc118/**` (P1, P4).
- `packages/foundation/modeling/schema/src/**`: the 50 RETIRE and 6 Role B
  concepts, the LiteralKit and MappedLiteralKit trims, SchemaUtils statics
  (P2, P3, P5). SchemaUtils is one ADAPT concept outside these totals; its 39 exports census to 32 DELETE, 4 ADAPT, 3 KEEP: 20 zero-consumer DELETEs in P3 C and F,
  the four default helpers in P3 PR 3b, eight statics-family exports in P5;
  ADAPT `BoolKeyDefault*` (P3 C), `withLiteralKitStatics` (P2),
  `withStatics` (P5).
- Every consumer of a retired concept or retired facet under `packages/**`
  and `apps/**` (P2, P3, P5).
- `packages/tooling/tool/cli/src/commands/Quality/CheckCensus.ts` and a
  committed instantiation baseline (P5).
- Tracked generated baselines: `standards/schema-first.inventory.jsonc`,
  `standards/schema-catalog.generated.jsonc`,
  `standards/coverage.regression-baseline.jsonc`,
  `standards/jsdoc-documentation.inventory.md` (every PR that deletes files).

## Constraints

- Retirement is same-PR: the concept's implementation, exports, tests and
  every consumer change together. A PR that leaves the old module in place is
  a deprecation window and is rejected.
- Intent is judged on the consumed surface, facet by facet. Same-intent for a
  facet means a public upstream symbol (checked in installed `dist/*.d.ts`,
  never an `@internal` row) covers what consumers use it for.
- Consumer counts from the audit are direct imports only. Every PR sizes
  itself with a compiler-backed closure (`graft callers <symbol> --depth all`
  plus a type check), not the census number.
- Wire shape: persisted columns and served payloads keep byte-identical
  encodings, chosen from upstream variants; only in-memory shapes may change.
  The boundary table below is the control.
- Finding identity for the new rules is occurrence-anchored, not line-keyed;
  the ratchet floor is membership, not a count. No parallel lint lane.
- Every retirement PR (P2, each P3 PR, P5) attaches before/after
  single-checker `--extendedDiagnostics` on the three baseline packages
  (`@beep/schema`, repo-cli, law-practice-domain):
  `bun run tsc -p <pkg> --noEmit --extendedDiagnostics --singleThreaded --tsBuildInfoFile <fresh>`,
  same compiler, fresh build-info file per run. An increase in that
  instantiation count on any of them bounces the PR. The default run (four
  checkers) is advisory and reported beside check time; check time is
  reported against a 5% tolerance band and a breach is a review flag, not a
  bounce (decisions "Performance", "Performance acceptance", refined
  2026-09-16 and 2026-09-29 in the goal-time log). No readability regression
  without a number.
- Appetite: six phases, roughly six weeks of part-time attention plus Opus
  5.5 lane volume, landing before the next effect RC bump forces a re-audit.
  Any pin change, including one before P1, regenerates the inventory
  directory in the bump PR itself, and the train continues on the new sha
  (decision "Appetite and shape sign-off", extended by the 2026-09-28
  goal-time row; snapshot bumps now land several times a week).
- Codemods, not hand edits, above 100 files (`Number` 361, LiteralKit facet
  renames 212, `Int` 143, `Unknown` 128, `Opaque` 103). Yeet caps capture at
  512 KiB or about 4k paths; larger PRs take the manual `gh pr` path; merge
  main often; never push after the squash.
- Hosted CI sees only committed JSONL, policy and baselines. Local refresh
  inputs (`.repos/effect`, graft, LLMs) must fail loud when absent, never
  pass empty.
- repo-cli is itself the largest LiteralKit consumer and its lint rule domain
  is a kit (`Lint.schemas.ts:104`): P2 codemods `packages/tooling` first and
  boots the CLI before rewriting the rest.
- Token-heavy lanes run on Opus 5.5 children pinned `claude-opus-5-5`
  (AGENTS.md, D5 2026-09-28); Fable orchestrates and judges. Lane prompts
  state the phase done-signal and bounce condition as acceptance criteria.
- Any audit row whose consumed surface was not censused is suspect until it
  is (see Facet Census Gate).

## Phase Contract

Sequence P0 → P1 → P2 → P3 → P4 → P5. P5 also waits for
`goals/schema-utils-selective-codec-statics` to merge its Yeet PR; that
precondition is met: PR #927 merged 2026-08-31 as `2731847346` (D7).

| Phase | Ships | Done when | Bounces when |
| --- | --- | --- | --- |
| P0 Doctrine PR | A dated "Upstream-First Foundation/Modeling" entry in `standards/architecture/DECISIONS.md` (decision "Doctrine surface"; draft in `research/gate-and-knowledge-plumbing.md` §(g)) and the operational rule text in `standards/architecture/11-evolution-and-deprecation.md` (decision "Doctrine lands ahead"): intent judged per facet, uncovered dominant facet ⇒ ADAPT, same-PR consumer adaptation, no alias, facet census before any RETIRE over 100 consumers. AGENTS.md LiteralKit line narrowed (kit for named literal domains; `S.Literals` for anonymous inline unions; `as const` note kept). `@beep/schema` README rule. Same clause in the standards and skill prose listed under Target Surfaces. | Merged; every later PR cites the entry by heading. | Wording contradicts an audit disposition, or drops "same PR, no alias". |
| P1 Knowledge layer | `research/tools/schema-inventory.ts` and its verifier moved into repo-cli as `beep lint effect-schema-inventory --write` / `--check` (a new `lint` subcommand P1 adds, sibling of `lint effect-vitest`; goal-time ruling 2026-09-16). The repaired prototype (`research/tools/schema-inventory.ts`, `verify-schema-inventory.ts` and the shared `modules.ts`, reading the pin from the root `package.json` catalog and every source byte through `git -C .repos/effect show <inventoryPin>:<path>`, 2026-09-28) is what the command productizes; `research/inventory/` moved (not copied) to `test/fixtures/effect-schema-rc118/inventory/*.jsonl` (the tool-owned module list, `schema-inventory/v1`, identity `(module, symbol, kind)`, `@internal` rows kept and flagged) recording the full `inventoryPin` sha in the `INDEX.md` pin line and every row's `sha` (D4) plus a row digest, the exploration ledger left pointing at the fixture (decision "Evidence retention"). A prompt generator that resolves each row's `file:line` against `.repos/effect` at the pinned sha and inlines the full declaration and JSDoc block (signature, sections, examples) plus graft context for the module, because a row carries only a truncated signature, a summary and an example flag (decision "Knowledge layer"). | `--check` reproduces the fixture byte-for-byte from `.repos/effect` at the pinned sha; hosted CI verifies row shape, duplicate identities and the pinned sha with no effect checkout; tests green on Node and Bun; a lane prompt for one Role A module is generated with inlined docs and committed under `ops/prompts/` as the first-slice proof. | The command passes when `.repos/effect` is missing or lacks the pinned commit, or reads the reference working tree instead of `git show` at the pin; a prompt ships with only the row's truncated fields. |
| P2 LiteralKit trim | Delete `Options`, `pickOptions`, `omitOptions`, `HashSet`, `thunk`, `enumMapping` and the `M` type parameter with its validators; override upstream's public `rebuild(ast)` so statics survive `check`, `annotate` and `pipe`; codemod consumers (`Options` → `.literals`, `pickOptions` → `.pick(...).literals`, `omitOptions` → explicit complement pick, `HashSet` → `HashSet.fromIterable(X.literals)`, `thunk.k` → `F.constant(X.Enum.k)`); MappedLiteralKit's `From`/`To` kits alike; the two `enumMapping` consumers rewritten. Keep `Enum`, `is`, `$match`, `toTaggedUnion`, `LiteralToKey`. `literal-kit-const-assertion` stays. | Type check green; zero `rg` hits for the retired names; before/after `--extendedDiagnostics` attached with no instantiation increase; MappedLiteralKit and every `.check(...)` derivation verified to keep statics. | A kept facet is touched; any kit loses a static on a derivation; instantiations increase on a baseline package. |
| P3 Retirement train | Groups A–G by upstream target (PLAN.md), each PR one concept family plus every consumer, citing the P0 entry; the boundary table rows for D and E filled before those PRs open; the facet census run before Number, Int, Unknown, Opaque open. | Per PR: closure-sized; persisted and served encodings byte-identical; generated baselines regenerated; `package-verify` green on touched packages; before/after `--extendedDiagnostics` attached with no instantiation increase on the three baseline packages and check time within the 5% band or flagged; merge-ready. | A persisted encoding changes; instantiations increase on any baseline package; a census flips a row to ADAPT without a decision-log entry; a KEEP concept is edited. |
| P4 Gate cut | `SFV4-*` rules for F03 (custom key/default combinator wrappers), F13 (schema-derived guards versus duplicated predicates), F24 (opaque defect/equivalence wrappers) in `SchemaFirstDetectors.ts` with occurrence-anchored identity and membership ratchet baselines in `standards/schema-first.inventory.jsonc`; delete `SFV4-tagged-error-equivalence` and its remediation string; rewrite the SchemaUtils remediation strings, narrow the LiteralKit one to surviving facets. | Baselines committed; the floor is membership; no new lint lane; render and Yeet routing show the new groups. | A rule for a family under 0.70 confidence; a line-keyed identity; a separate lane. |
| P5 Statics and performance close | F15 detector; `withCodecStatics` retired with its consumers, `collectAnnotationsAt` kept (evidence 2026-09-28, D10: Effect v4 has cached parsers per AST since before the compilers, `memoize` at `SchemaParser.ts:1007` on `7e1f455fab`, 2026-06-20; the per-AST registry at `inventoryPin`, `WeakMap<SchemaAST.AST, Entry>` in `internal/schema/compilerRegistry.ts:33`, extends that cache to compiled entries, so hoisting into statics was never needed in v4 to avoid recompilation; the gate below is unchanged); the same PR retires codegen-kit's `schemaCodecStatics` config and emitter; `quality check-census` extended with instantiations and check time plus a committed baseline measured single-threaded (goal-time row 2026-09-29; the 2026-09-12 default-mode sample at `51d4a2f08a` stays historical) for `@beep/schema`, repo-cli and law-practice-domain; one or two upstream typeperf suites mirrored; closeout reflection; lifecycle flip in the same PR. | The selective-statics goal has merged (PR #927, 2026-08-31); the gate exists and its backlog is zero; no instantiation increase on the three baseline packages and the check-time band reported. | Opened before the statics merge; a non-zero backlog relabelled as exceptions. |

## Boundary Table

Fill before any group D or E PR opens. Persisted and served rows must read
`yes`; a `no` on such a row is a migration goal and leaves this packet.

Filled 2026-09-29 from `goals/effect-schema-parity/research/2026-09-29-p3-gates.md`
(full consumer paths) and `goals/effect-schema-parity/research/tools/boundary-probe.ts`
(bytes compared with `JSON.stringify` after decode and re-encode; "n/m" is
identical cases over cases). `yes, no boundary` means no persisted or served
schema in the repo uses the concept, so there are no bytes to keep. The codec
named is the upstream replacement; where the probe shows different bytes
(Graph), a boundary added before the PR becomes a migration goal.

| Boundary | Concept | Upstream codec | Byte-identical | Evidence |
| --- | --- | --- | --- | --- |
| persisted file and serialized record | Timestamp | `S.Trim.check(S.isNonEmpty({ message: "String must not be empty" }), S.makeFilter((s) => Option.isSome(DateTime.make(s)), { arbitraryConstraint: { patterns: [<the ISOStr pattern>] } }))`: the ISO string stays a string and the `ISOStr` brand drops. It must keep both annotations `ISOStr` carries today, the `NonEmptyTrimmedStr` message (`String.ts:64`) and the arbitrary pattern (`Timestamp.schema.ts:58-64`), because `ISOStr` is `NonEmptyTrimmedStr.check(...)` (`Timestamp.schema.ts:50-66`). Not `S.DateTimeUtcFromString` | yes | `ISOStr` is the only member at a boundary: `Worktree.schemas.ts:317` (written at `Worktree.service.ts:968-978`), `Recovery.ts:170`, `:175`, `Gate.ts:421`, `EvidenceReceipt.ts:309`, `JudgeContract.ts:663`, `VerifiedSpan.model.ts:570`, `:847`. Probe over 12 inputs (canonical, no millis, one fractional digit, microseconds, `+00:00`, `+02:00`, date-only, padded, `""`, `"   "`, a non-date): the composition 12/12, comparing bytes on success and the full issue message on rejection; without the message 10/12 (`""` and `"   "` report "Expected a value with a length of at least 1"); seeded arbitrary samples 3/3 seeds identical; `S.DateTimeUtcFromString` 2/12 (`...56Z` re-encodes as `...56.000Z`; offsets and date-only input become UTC), identical only on `formatIso` writer output (4/4) |
| HTTP payload | Timestamp | same | yes, no boundary | no HttpApi, RPC or MCP schema imports `@beep/schema/Timestamp`. `Timestamp` class and `EpochMillis` have no consumer; their `{"epochMillis":n}` wire differs from `S.DateTimeUtcFromMillis` (0/2) |
| in-memory | Timestamp | `DateTime.Utc` | n/a | `Ontology.ts:103` guard, `Worktree.service.ts:85`, `CitedArtifactExistsGate.ts:263` |
| persisted | DateTimeUtcFromValid | consumer-local composition: `S.TaggedStruct("string", { value: S.DateTimeUtcFromString })` decoded to `S.DateTimeUtc` with `SchemaTransformation.transform` (code in the report) | yes, no boundary | only consumer is the picker adapter (`effect-date-time-picker.tsx:16`). Probe: the composition encodes 4/4 identical to the tagged ISO form written at `DateTimeUtcFromValid.schema.ts:451` and decodes today's bytes 4/4. The plain ISO or millis recipe stays forbidden on this row |
| HTTP payload | DateTimeUtcFromValid | same composition | yes, no boundary | no served schema uses it |
| in-memory | DateTimeUtcFromValid | `DateTime.make` + `DateTime.toUtc`; picker adapters via `DateTime.setZone` | n/a | |
| persisted | Duration | `S.TemplateLiteral([S.Finite, " ", S.Literals(units)])` with the `Duration.Unit` names (string wire); not `S.DurationFromString` | yes, no boundary | only consumer `Graft.schemas.ts:667` (`GraftDeepRunnerStep.timeout`, built in code at `GraftDeep.service.ts:94-166`). Probe: composition 6/6; `S.DurationFromString` 1/6 (`"2 minutes"` re-encodes as `"120000 millis"`). Upstream `Duration.Unit` is a type only (`Duration.d.ts:87`) |
| HTTP payload | Duration | same | yes, no boundary | no served schema uses it |
| persisted | Timezone | `S.TimeZoneNamedFromString` | yes, no boundary | no consumer outside the schema package tests. Probe: 597/598 dataset names round-trip identically; `"Factory"` fails upstream decode (dataset at `Timezone.ts:30`) |
| HTTP payload | Timezone | same | yes, no boundary | no served schema uses it |
| persisted | ArrayBuffer | `S.Uint8ArrayFromBase64` (value becomes `Uint8Array`) | yes, no boundary | only consumer `FileTypeChecker.schema.ts:188` (`FileContent`, in-memory). Probe: base64 JSON 3/3, also 3/3 against `S.toCodecJson(S.Uint8Array)` |
| HTTP payload | ArrayBuffer | same | yes, no boundary | no served schema uses it |
| persisted | Bytes | `S.Uint8Array`, JSON through `S.toCodecJson` | yes, no boundary | no consumer. Probe: 3/3 |
| HTTP payload | Bytes | same | yes, no boundary | no consumer |
| persisted | ArrayOf presets | `S.Array` / `S.NonEmptyArray` over `S.String`, `S.NonEmptyString`, `S.Finite`, `S.Int` | yes, no boundary | 11 fields in 6 repo-utils and workspace files, none stored or served (for example `PackageJsonTools.ts:266`, `EmailArtifact.model.ts:56`; no workspace table holds `EmailArtifact`). Probe: all eight presets 16/16; the presets add annotations only (`ArrayOf.ts:29-229`) |
| HTTP payload | ArrayOf presets | same | yes, no boundary | no served schema uses them |
| persisted column (jsonb) | HashSet | `S.toCodecJson(S.HashSet(Item))` as the field schema, with each field's existing `.check(...)` kept on the composition; not bare `S.HashSet(Item)` | yes | `toPgTable` at `ActFrame.table.ts:39`, `LegalPositionRelator.table.ts:42`, `LegalOppositionCandidate.table.ts:43`. Three stored fields are `StoredHashSet(Item).check(nonEmpty)` (`ActFrame.values.ts:191`, `LegalRole.model.ts:19`, `LegalOppositionCandidateInput.model.ts:21`); the five `LegalScopeContext` axes (`LegalScopeContext.model.ts:102-114`) have no check, so `[]` is valid there. Probe: encode 4/4 including `[]`, decode of stored arrays 4/4, the checked composition 4/4 (`[]` rejected by both with the same message); bare `S.HashSet` 0/4 (`{"_id":"HashSet","values":[...]}`, as `ActFrame.converters.ts:97-100` warns). Columns stay `pg.jsonb()`: the encoded AST is `Arrays` on both sides (probe 1/1), and `effect-drizzle` maps `Arrays` and `Objects` to the same `object` carrier (`derive.ts:352-353`) |
| HTTP payload | HashSet | same | yes, no boundary | the law-practice MCP tools (`Tools.ts`, `PracticeKg.tools.ts`) do not carry these values |
| persisted | MutableHashMap | `S.Array(S.Tuple([K, V]))`, then `MutableHashMap.fromIterable` at the boundary | yes, no boundary | only consumer `NLPMonoid.ts:40` uses `MutableHashMapFromSelf` (in-memory, never encoded). Probe: entry arrays 2/2 |
| HTTP payload | MutableHashMap | same | yes, no boundary | no served schema uses it |
| persisted | MutableHashSet | `S.Array(Item)`, then `MutableHashSet.fromIterable` | yes, no boundary | no consumer. Probe: 2/2 |
| HTTP payload | MutableHashSet | same | yes, no boundary | no consumer |
| persisted | Graph | `S.toCodecJson(S.Graph(kind, N, E))` | yes, no boundary | no consumer. The upstream JSON differs (0/1: `{"_tag":"Graph",...,"nodes":[[0,"a"]]}` against `{"type":...,"nodes":[{"index":0,"data":"a"}]}`), so a stored Graph added before the PR would be a migration goal |
| HTTP payload | Graph | same | yes, no boundary | no consumer; same caveat |
| persisted | RegExp | consumer-local `S.String` decoded to `S.RegExp` with `S.decodeTo` (string wire); not `S.toCodecJson(S.RegExp)` | yes, no boundary | only consumer `ParserOptions.schema.ts:40`, `:109` decodes a pattern built from the delimiter (in-memory). Today's encoder is forbidden (`RegExp.ts:84`), so no encoded bytes exist. Probe: decode 4/4; `S.toCodecJson(S.RegExp)` writes `{"source":...,"flags":...}` for a string pattern (0/4) |
| HTTP payload | RegExp | same | yes, no boundary | no served schema uses it |
| log line | any of the above | in-memory shape rendered by the logger | n/a | |

Coverage rule: before a group D or E PR opens, this table must have a row
for every concept in that group as listed in `PLAN.md`; a missing row is a
bounce.

## Facet Census Gate

Before a RETIRE concept with more than 100 audited consumers opens its PR
(`Number`, `Int`, `Unknown`, `Opaque`), the lane counts kit-only usage per
exported facet outside the concept's own sources:

```sh
# one pattern per exported member; exclude the concept's own directory
rg -c -e '\.<member>\b' packages apps --glob '!node_modules' --glob '!**/<Concept>/**' --glob '*.ts' --glob '*.tsx'
```

Record lines and files per facet next to the upstream symbol that covers it.
The import-anchored count in `goals/effect-schema-parity/research/tools/facet-census.ts`
is the count of record; the `rg` shape above misses bare named imports and
collides with same-named `S.*` symbols, so it is a cross-check only. Then sum
two totals per concept: (a) lines that read the concept's uncovered members,
and (b) lines that use its covered facets, construction and schema-value use
sites included. Record both sums in the decision-log row. A larger uncovered
sum flips the row to ADAPT (trim the covered facets, keep the rest) and the
flip is logged below before the PR opens; otherwise RETIRE holds and the
consumers of minor uncovered facets adapt in the retirement PR. Precedent:
DECISIONS "LiteralKit reopened at decompose: ADAPT, not RETIRE" (2026-09-15),
2,054 uncovered lines against 2,048 covered.

## Decision Log

Normative rulings live in `explorations/effect-schema-parity/DECISIONS.md`;
this log points at every entry by heading with a disposition (binds,
historical, or superseded) and records goal-time additions below.

| Ruling | Entry (heading, date) | Disposition |
| --- | --- | --- |
| Compare against effect main; rc.112..main is a hint list only | Comparison baseline, 2026-09-12 | binds P1, P3 |
| One exploration, one goal, phased internally | Packet shape, 2026-09-12 | binds all |
| Rows are a sha-pinned index; lane prompts carry signatures, JSDoc sections, examples and graft-led upstream context | Knowledge layer, 2026-09-12 | binds P1 (prompt generator inlines docs from `file:line`) |
| Same intent retires; adapt consumers; no alias | Equivalence test for retirement, 2026-09-12 | binds P2, P3 |
| Goal closes when the gate exists and its backlog is zero | Goal closing condition, 2026-09-12 | binds P4, P5 |
| Type-check cost first; every change carries a number | Performance, 2026-09-12 | binds P2, P3, P5 |
| Role A adoption surfaces, Role B exemplars; Role B may still retire a local concept | Module list roles, 2026-09-12; Role B modules may be retirement targets, 2026-09-14 | binds P3 group G |
| Codex exec lanes, Fable judges | Orchestration lane, 2026-09-12 | superseded 2026-09-28 by D5: Opus 5.5 children pinned `claude-opus-5-5`, Fable judges |
| One PR for everything | PR batching, 2026-09-12 | superseded by PR batching revised |
| Gate lives inside `schema-first` lint | Gate home, 2026-09-12 | binds P4 |
| Architecture decision entry plus `@beep/schema` README rule | Doctrine surface, 2026-09-12 | binds P0 (with Doctrine lands ahead: both the DECISIONS entry and the §11 rule text ship in the P0 PR) |
| Packet seeded at capture, nothing committed | Deliverable of this session, 2026-09-12 | historical |
| LiteralKit retires; helpers are ergonomics | LiteralKit retires; its helpers are ergonomics, 2026-09-14 | superseded by LiteralKit reopened at decompose |
| Selective-statics goal ships first; then F15 and the statics retirement | SchemaUtils: ship the selective-statics goal, then retire statics, 2026-09-14 | binds P5 |
| Upstream default per boundary, recorded in a table; persisted and external bytes identical | Wire shape, 2026-09-14 | binds P3 groups D, E |
| Case brands retire; rejection is an inline check | Case-string brands retire, 2026-09-14 | binds P3 group F |
| Reports, scripts, inventory and small proofs committed; three regenerable receipts deleted | Evidence retention, 2026-09-14 | binds packet publication (three receipts deleted with the packet) and P1 (inventory moved, not copied) |
| Three-package instantiation baseline; no regression per retirement PR | Performance acceptance, 2026-09-14 | binds P2, P3, P5 (refined 2026-09-16: instantiations hard, check time advisory) |
| Doctrine lands ahead as its own PR | Doctrine lands ahead of the goal PRs, 2026-09-14 | binds P0 |
| Detectors at confidence ≥ 0.70 and reach ≥ 100 files; F26 correction | First gate cut, 2026-09-14 (F01 removed 2026-09-15) | binds P4 |
| Inventory is a repo-cli fixture per RC with a generator and `--check` | Inventory home, 2026-09-14 | binds P1 |
| Six-phase train | PR batching revised, 2026-09-14 | binds all |
| Six phases, about six weeks, before the next RC bump; mid-train bump regenerates the inventory | Appetite and shape sign-off, 2026-09-14 | binds all (extended 2026-09-28: any pin change, including pre-P1; the bump PR regenerates) |
| LiteralKit and MappedLiteralKit are ADAPT; facets ruled one by one; intent per facet; facet census gate; AGENTS line narrowed; F01 dropped | LiteralKit reopened at decompose: ADAPT, not RETIRE, 2026-09-15 | binds P0, P2, P3, P4 |

Goal-time additions (append dated rows):

| Date | Ruling | Rationale |
| --- | --- | --- |
| 2026-09-15 | HttpStatus retires in group G; its named codes become `effect/http/HttpStatus` value-module lookups (path updated 2026-09-28; `unstable/` is gone at `inventoryPin`); its MappedLiteralKit use is transient between the P2 trim and the group G PR. | The MAP §P3 note had read as if HttpStatus kept its kit after P2; the Role B ruling (2026-09-14) governs and the MAP note was corrected the same day. |
| 2026-09-15 | Persisted and served boundaries for retired transports keep the existing encoded bytes; the research migration recipes that change a wire form (tagged ISO to plain ISO or millis) apply to in-memory boundaries only. | Codex review of the graduated packet caught a boundary-table row that copied a research recipe over the Wire shape ruling. |
| 2026-09-16 | Instantiations are the hard per-PR performance gate; check time is advisory within a 5% tolerance band (same compiler, fresh build-info). Refines "Performance acceptance" (2026-09-14). | Instantiation counts are deterministic; wall-clock check time moves a few percent run to run, so a literal check-time bounce would fire on noise. The deterministic count carries the ruling's intent. |
| 2026-09-16 | The P1 command is `beep lint effect-schema-inventory --write` / `--check` (P1 adds the subcommand), registered in the existing Lint command beside `lint effect-vitest`. | Same store, pin-check and fixture shape as the effect-vitest lane; the name says what it checks; the schema-first gate later reads the same fixture. Rejected: flags on `lint schema-first` (mixes fixture refresh with the lint's own `--write`); a `knowledge` subcommand (separates the fixture from the lane that consumes it). |
| 2026-09-28 | Reopen amendment (Dn cites the ten decisions in the exploration `DECISIONS.md` 2026-09-28 entry). (1) The pin moves to `inventoryPin` `e5f7d12af9abef188f7dc39b0207af1801b03ffd` (`effect@4.0.0-rc.118-1-ge5f7d12af9`), the repo's own `package.json` catalog commit, never the moving reference HEAD (D4). (2) The fixture is renamed `effect-schema-rc118`, mirroring `effect-vitest-rc118`; since that sibling has no pin file, the schema fixture records the full sha in the `inventory/INDEX.md` pin line and every row's `sha` (D4). (3) The bump rule widens from "mid-train" to any pin change, including pre-P1, and the bump PR regenerates the inventory. (4) Lanes are Opus 5.5 children pinned `claude-opus-5-5` (D5). (5) The P5 precondition is met by PR #927, merged 2026-08-31 as `2731847346` (D7). (6) Effect's per-AST parser cache, present since at least `7e1f455fab` (2026-06-20) and extended by the compiler registry at the pin, moots the hoisting rationale for `withCodecStatics`; the P5 gate wording stays (D10). (7) SchemaUtils census rows flow into P3 (zero-consumer DELETEs into the retirement groups) and P5 (`withCodecStatics`): rows landed by the 2026-09-28 census report (D7, D9). | Effect main shipped schema compilers in #7908 and the repo now runs main snapshots that bump several times a week (#1234, #1310), so an rc-named pin and a mid-train-only bump rule no longer describe reality. Pinning to the catalog keeps the fixture reproducible while the reference clone moves nightly. Rejected: pinning to `referenceHead` (moves nightly); keeping `rc115` names over rc.118 bytes; leaving the bump rule to future bump authors; moving compiler adoption into this goal (D2 keeps it separate). |
| 2026-09-28 | `isCodecDataFirst` is KEEP. It survives the P5 statics retirement beside `collectAnnotationsAt`; this supersedes the 2026-09-14 "SchemaUtils: ship the selective-statics goal, then retire statics" entry for this symbol only (exploration `DECISIONS.md` "isCodecDataFirst: keep", operator ruling in the align grill). The SchemaUtils 32 / 4 / 3 split and the 50 / 6 / 77 totals are unchanged. | Effect has no equivalent at `inventoryPin`: `Function.dual` takes an `isDataFirst` predicate and this export is that predicate specialised to `ParseOptions`. The census counts 42 production files and 123 uses, all the repo's `dual(SchemaUtils.isCodecDataFirst, <bound decoder>)` convention. Rejected: retire with the statics (no upstream target for 123 uses); inline the predicate at each call site (42 copies of one function). |
| 2026-09-29 | The pin moves to `inventoryPin` `df77fff9396fe31de72d1947ecb5b74f8cee89e1` (`effect@4.0.0-rc.118-9-gdf77fff939`), the catalog commit PR #1330 bumped to. PR #1330 did not regenerate the inventory, so a catch-up PR regenerates it before P0 opens and every phase continues on the new sha. Of the 24 inventoried modules only `Schema.ts` changed (effect #8580, single brand key typing): 2,232 rows, no identity added or removed, six `effect/Schema` signatures changed (the `brand` function and interface, `brand."Type"`, `brand."Iso"`, `brand."~type.make"` and `fromBrand`). No audit disposition changes: the six changed signatures restrict brand keys to one per call and add or remove no upstream coverage. | The 2026-09-28 bump rule binds any pin change, and the SPEC stop condition holds every later phase PR until the inventory matches the catalog. Until P1 ships `lint effect-schema-inventory --check`, nothing enforces the rule on a bump PR; the friction ledger records the miss. Rejected: leaving the rows at `e5f7d12af9` until P1 (every phase before P1 would read stale rows); folding the regeneration into P0 (the doctrine PR is its own PR per "Doctrine lands ahead"). |
| 2026-09-29 | The facet census gate compares sums. The definition in force is this SPEC's §Facet Census Gate; its source is P0 PR #1333 (§11 rule 2, pending merge), which adds the "Upstream-First Foundation/Modeling" entry: lines that read a concept's uncovered members against lines that use its covered facets, construction and schema-value use sites included. A larger uncovered sum flips the row to ADAPT; otherwise RETIRE holds and consumers of minor uncovered facets adapt. Both sums go in the row. Precedent: LiteralKit read 2,054 uncovered lines (`.Enum` 1,172, `.is` 603, `.$match` 243, `.toTaggedUnion` 36) against 2,048 covered (construction 1,521, `.Options` 395, `.thunk` 65, `.pickOptions` / `.omitOptions` 52, `.HashSet` 15). | "Dominant share" named no denominator: one facet's share reads differently against the concept total, against the uncovered facets, or against the largest covered facet, and covered usage spread across many facets could hide behind any of them. Two sums over the same line census give one comparison a reviewer can recompute. The import-anchored tool is the count of record because the `rg` shape reads 0 for bare named imports (`NonNegativeInt`, `UnknownFromJsonString`) and hundreds for `S.Int` and `S.Unknown` collisions. Rejected: the single dominant-facet test (ambiguous denominator); a fixed percentage threshold (a number nobody derived); counting construction and schema-value sites as neither side (they are the schema facet upstream covers, and LiteralKit's 1,521 construction lines decided its row). |
| 2026-09-29 | Facet census: `Number` RETIRE holds. Sums: uncovered 112 lines (the branded `NonNegativeInt` in type position) against covered 2,079 (`.make` 1,199, schema value 663, `.pipe` 107, `.annotateKey` 100, other 23). `NonNegativeInt` is 2,129 of the concept's 2,183 lines. Every member maps to public upstream API: `S.Natural` with its `make` and `S.is`, `S.Finite.check(S.isGreaterThanOrEqualTo(0))`, the `S.isGreaterThan` family, `S.FiniteFromString`. Counts: `goals/effect-schema-parity/research/2026-09-29-p3-gates.md`. | Ruled: `.make` on a branded member is covered. The case-brand ruling (`explorations/effect-schema-parity/DECISIONS.md:297`) holds that a brand carrying an invariant in the type is not a kept facet; a check carries it in the schema, where the repo's laws put invariants. `S.Natural.make` validates and throws as `NonNegativeInt.make` does, so only the brand on the return type is lost, and the census counts that separately as the uncovered facet. Rejected: counting `.make` as a brand read (1,305 against 895; it would re-litigate the case-brand ruling for numeric brands); a nominal alias over `S.Natural` (the thin re-export the doctrine forbids). |
| 2026-09-29 | Facet census: `Int` RETIRE holds. Sums: uncovered 67 lines (`PosInt` and `Int` in type position) against covered 478 (`.make` 326, schema value 114, `.annotateKey` 29, `.pipe` 16, other 3). `PosInt` is 543 of 544 lines; `PostgresSerialInt`, `NegInt` and `NonPositiveInt` have no consumer. `Int64` is outside this gate: it is its own group B concept, and the `Int.ts:250` re-export stays until its PR. Coverage is the composition `S.Int.check(S.isGreaterThan(0))`, whose `make` validates and throws as `PosInt.make` does. | Same `.make` ruling and case-brand grounds as `Number`. Group B PR note: upstream has no named positive-integer schema, so the PR decides where the composition lives (consumer-local named schemas per package, never a new `@beep/schema` abstraction) and shows the readability cost with a number. Rejected: counting `.make` as a brand read (392 against 162; it would re-litigate the case-brand ruling for numeric brands); keeping `PosInt` by name (a doctrine exception, not a census flip); `S.Natural` (admits 0). |
| 2026-09-29 | Facet census: `Unknown` RETIRE holds, target corrected. Doctrine sums: uncovered 0 against covered 175 (codec statics 160, schema value 15). `UnknownFromJsonString` carries 170 of 175 lines (135 files; 68 lines in 62 production files); 160 of its 171 references are bound codec statics (`encodeUnknownEffect` 43, `encodeUnknownSync` 39, `decodeUnknownEffect` 22, and eight more). The audit's target `S.UnknownFromJsonString` is `/** @internal */` at every sha the packet has used (declared at `Schema.ts:9209` at `51d4a2f08a`, the line the audit cited; `:9470` at `e5f7d12af9`; `:9493` at `df77fff939`; each under an `@internal` comment line) and absent from `Schema.d.ts`; the target is `S.fromJsonString(S.Unknown)` (`Schema.d.ts:6873`) with `S.encodeUnknownEffect(schema)` and its siblings for the statics. | Every facet maps to a public symbol, and the statics are the `withCodecStatics` surface P5 retires anyway. Upstream caches parsers per AST, so the codemod builds the composition once per file. Rejected: `S.UnknownFromJsonString` (an internal row; the Constraints forbid it); ADAPT keeping `UnknownFromJsonString` by name (a one-call composition over two public symbols). |
| 2026-09-29 | Facet census: `Opaque` RETIRE holds; the recipe carries the equivalence override. Doctrine sums: uncovered 0 against covered 154 (schema value 153, `.annotateKey` 1). `Defect` carries 152 of 154 lines (110 files; 145 lines in 105 production files), all `Defect(...)` calls; `OpaqueUnknown` has 2. `goals/effect-schema-parity/research/tools/facet-probe.ts` shows today's `Defect()` and `S.Defect().pipe(S.overrideToEquivalence(() => () => true))` (`Schema.d.ts:6605`, `:10592`) agree on all four observations; bare `S.Defect()` turns `S.toEquivalence` on a struct or tagged error from true to false; `Equal.equals` on tagged errors ignores the annotation in every variant. | The opaque facet is schema-derived equivalence, and `S.overrideToEquivalence` is public, so it is covered; dropping the override would silently change equivalence for 105 production files. Rejected: bare `S.Defect()` and `S.Unknown` (the F24 "accept changed equivalence" branch, a semantic change with no number behind it); ADAPT keeping `Defect` (a one-line composition of two public symbols). |
| 2026-09-29 | PR 3b one-facet census: upstream covers every use shape of the four default helpers. Doctrine sums: uncovered 0 against covered 2,513 lines (`withNoneDefault` 1,933, `withKeyDefaults` 446, `withConstantDefault` 88, `withEmptyArrayDefaults` 46); RETIRE holds. `withConstructorDefault`, `withDecodingDefaultTypeKey` and `withDecodingDefaultType` exist at `df77fff939` (`Schema.ts:5726`, `:5844`, `:5952`; `Schema.d.ts:4632`, `:4722`, `:4807`), data-last only. `withNoneDefault`: 1,933 code occurrences in 305 files (1,894 production), all point-free `.pipe(SchemaUtils.withNoneDefault)`, on optional-key Option codecs 1,791 times, required-key 136, other 6. `withKeyDefaults`: 446 in 117 files (426 production), data-last 433 and data-first 13; defaults literal 213, reference 91, constructed 142. `withEmptyArrayDefaults`: 46 in 24 files, 39 with a type argument, one data-first. `withConstantDefault`: 88 in 27 files, all curried. `facet-probe.ts` shows identical construction, missing-key decode, undefined-key decode and encode for six representative shapes, and the upstream forms type-check. | No shape is uncovered. Two codemod rules follow: data-first calls (13 `withKeyDefaults`, one `withEmptyArrayDefaults`) become `schema.pipe(...)`; the 142 constructed `withKeyDefaults` defaults bind once to a const, because the helper evaluates a default once and shares it between the constructor and decoding defaults, and two `Effect.succeed(expr)` calls would build two instances. Rejected: keeping `withKeyDefaults` as a named ADAPT helper (the SchemaUtils census pushback; still a two-call composition with no uncovered shape). |
| 2026-09-29 | Boundary table filled for groups D and E: 24 persisted and HTTP rows, all yes, none no, three n/a rows. Only two concepts cross a persisted boundary. `Timestamp` does so through `ISOStr` fields, which keep a string wire (`S.Trim` with `S.isNonEmpty` and a `DateTime.make` check, 6/6 byte-identical). `HashSet` does so through three law-practice jsonb tables and moves to `S.toCodecJson(S.HashSet(Item))` (3/3). `DateTimeUtcFromValid` has no persisted or served consumer; the tagged-ISO composition over `S.DateTimeUtcFromString` is byte-identical (4/4) and recorded for the PR. No group D or E concept appears in an HTTP, RPC or MCP schema. | Evidence: `goals/effect-schema-parity/research/tools/boundary-probe.ts` and the report. Rejected, because each changes bytes and would be a migration goal: `S.DateTimeUtcFromString` for `ISOStr` fields (2/6: it normalizes accepted non-canonical ISO to `formatIso`), `S.DurationFromString` for the Graft timeout string (`"2 minutes"` becomes `"120000 millis"`), `S.toCodecJson(S.RegExp)` for a string pattern (`{source, flags}`), and bare `S.HashSet` for jsonb fields (a tagged wrapper). |
| 2026-09-29 | The per-PR instantiation gate is the single-checker count: `bun run tsc -p <pkg> --noEmit --extendedDiagnostics --singleThreaded --tsBuildInfoFile <fresh>`, which reports the same count as `--checkers 1`. The default run (tsgo 7.0.2 uses four checkers) is advisory and reported beside check time. The P5 check-census baseline is re-measured single-threaded; the 2026-09-12 sample (default mode, `51d4a2f08a`) stays historical. Refines the 2026-09-16 row. | tsgo partitions files across checkers and each checker keeps its own type cache, so the instantiation total depends on the partition. Evidence from P3 group A (PR #1336): the same diff measured `@beep/schema` at −4,936 with one checker, +41,833 with two, −5,039 with three, +42,404 with four and +77,290 with eight; restoring one deleted file moved the four-checker count 11k below the baseline; repeat runs on one tree are stable. The 2026-09-16 row chose instantiations as the hard gate because they are deterministic, and only the single-checker count is also independent of the partition. Rejected: gating on the default run (it bounces on partition noise); averaging several checker counts (still partition-bound). |
| 2026-09-29 | The instantiation gate compares a PR to its base. An increase is admitted only when it is the first-use cost of an upstream combinator the retirement requires (`S.overrideToEquivalence` in `@beep/repo-cli`, +139 single-checker in P3 PR 3-ii: 4,152,422 → 4,152,561 against the 3-i head `579c05d32d`), the sole alternative changes runtime behaviour, the count against the train's origin `7cc0aa9b33` still decreases (4,152,690 → 4,152,561), and the changeset states the number and the reason. | The retired `Defect()` hid the override behind a declared `S.Defect` return type, so the repo-cli program never instantiated it; its first use costs about 150 instantiations (one shared `S.Defect({ includeStack: true })` measures 4,152,409 without the override and 4,152,561 with it; the override inline at all 44 cause fields measures 4,152,904). repo-cli therefore shares one consumer-local `OpaqueDefect` const, annotated with plain `.annotate({ identifier, description })`: `$I.annoteSchema` on the same const costs +323 instantiations, evidence for the P5 per-combinator cost table. Rejected: dropping the equivalence override (it changes `S.toEquivalence` on 44 error fields; a behaviour change is never the remedy for a type-cost number); the override inline at every field (+482). |

## Acceptance Criteria

- [ ] P0 merged: dated entry in `standards/architecture/DECISIONS.md`, rule
      text in `standards/architecture/11-evolution-and-deprecation.md`,
      AGENTS.md line narrowed, `@beep/schema` README carries the rule.
- [ ] Every retirement PR (P2, each P3 PR, P5) carries before/after
      single-checker `--extendedDiagnostics` (`--singleThreaded`) on the
      three baseline packages with no instantiation increase; the default
      run and check time reported beside it against the 5% band.
- [ ] `test/fixtures/effect-schema-rc118/inventory/` committed with the full
      `inventoryPin` sha in its pin line and rows; `--check` byte-identical locally; hosted verification green.
- [ ] LiteralKit and MappedLiteralKit trimmed per the P2 row; no retired facet
      name remains; statics survive every derivation; a before/after number
      is attached.
- [ ] The 50 RETIRE concepts and 6 Role B concepts are deleted with consumers
      migrated, or flipped to ADAPT through the facet census with a logged
      ruling; the 77 KEEP concepts are untouched.
- [ ] SchemaUtils (ADAPT concept, 39 exports per
      `explorations/effect-schema-parity/research/2026-09-28-schemautils-census.md`):
      32 DELETE (20 zero-consumer in P3 C/F; 4 defaults via PR 3b; 8 with the
      P5 statics retirement), 4 ADAPT (`BoolKeyDefaultFalse`/`True` in P3 C,
      `withLiteralKitStatics` in P2, `withStatics` in P5), 3 KEEP
      (`collectAnnotationsAt`, `isCodecDataFirst`, internal
      `staticDescriptorInstaller` until its last user goes).
- [ ] Boundary table rows for every group D and E concept are filled with
      evidence; no persisted or served encoding changed.
- [ ] `SFV4-*` rules for F03, F13, F24 exist with committed baselines;
      `SFV4-tagged-error-equivalence` is gone; `bun run beep lint
      schema-first` reports zero actionable parity findings.
- [ ] `withCodecStatics` retired after the selective-statics merge (#927);
      `collectAnnotationsAt` kept; F15 rule exists.
- [ ] `quality check-census` records single-checker instantiations and check
      time against a committed baseline measured `--singleThreaded`; no
      instantiation increase on the three packages and check time reported
      against the 5% band.
- [ ] Closeout reflection written; lifecycle flipped in the same PR.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/effect-schema-parity/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/effect-schema-parity/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/effect-schema-parity` | Passes |
| Schema-first gate | `bun run beep lint schema-first` | Green; parity backlog zero at P5 |
| Inventory fixture | `beep lint effect-schema-inventory --check` (subcommand added in P1) | Byte-identical locally; fails loud without `.repos/effect` |
| Package handoff | `bun run beep quality package-verify @beep/schema`, `... @beep/repo-cli`, and each touched package | Green |
| Type-check cost | `bun run beep quality check-census` against the committed baseline | No instantiation increase on the three packages; check time within 5% or flagged |
| Reflection | `bun run beep lint reflection-artifacts` | Passes at P5 |
| PR state | `bun run beep yeet monitor` | `merge-ready: yes` per PR |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.
- A retirement PR would change a persisted or externally served encoding.
- A facet census flips a RETIRE row to ADAPT and no decision-log row records
  the flip.
- P5 would open before `goals/schema-utils-selective-codec-statics` has merged
  its Yeet PR (satisfied: PR #927 merged 2026-08-31; kept as the standing
  gate).
- The effect pin changes at any point, including before P1: regenerate the
  inventory directory for the new sha in the bump PR itself before any
  further phase PR opens (goal-time row 2026-09-28).

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
