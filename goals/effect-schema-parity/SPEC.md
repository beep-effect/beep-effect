# Effect Schema Parity Spec

## Objective

Every `@beep/schema` concept whose consumed surface upstream Effect
`4.0.0-rc.115` (main `51d4a2f08a`) covers is deleted, with every consumer
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
  introduced while retiring old ones.
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
  `packages/tooling/tool/cli/test/fixtures/effect-schema-rc115/**` (P1, P4).
- `packages/foundation/modeling/schema/src/**`: the 50 RETIRE and 6 Role B
  concepts, the LiteralKit and MappedLiteralKit trims, SchemaUtils statics
  (P2, P3, P5).
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
  `--extendedDiagnostics` on the three baseline packages (`@beep/schema`,
  repo-cli, law-practice-domain), measured with the same compiler and a fresh
  build-info file. An instantiation increase on any of them bounces the PR;
  check time is reported against a 5% tolerance band and a breach is a review
  flag, not a bounce (decisions "Performance", "Performance acceptance",
  refined 2026-09-16 in the goal-time log). No readability regression
  without a number.
- Appetite: six phases, roughly six weeks of part-time attention plus Codex
  lane volume, landing before the next effect RC bump forces a re-audit. A
  bump mid-train regenerates the inventory directory in the bump PR and the
  train continues on the new sha (decision "Appetite and shape sign-off").
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
- Token-heavy lanes run on Codex `gpt-6-astra` at `medium` (AGENTS.md); Fable
  orchestrates and judges. Lane prompts state the phase done-signal and
  bounce condition as acceptance criteria.
- Any audit row whose consumed surface was not censused is suspect until it
  is (see Facet Census Gate).

## Phase Contract

Sequence P0 → P1 → P2 → P3 → P4 → P5. P5 also waits for
`goals/schema-utils-selective-codec-statics` to merge its Yeet PR.

| Phase | Ships | Done when | Bounces when |
| --- | --- | --- | --- |
| P0 Doctrine PR | A dated "Upstream-First Foundation/Modeling" entry in `standards/architecture/DECISIONS.md` (decision "Doctrine surface"; draft in `research/gate-and-knowledge-plumbing.md` §(g)) and the operational rule text in `standards/architecture/11-evolution-and-deprecation.md` (decision "Doctrine lands ahead"): intent judged per facet, uncovered dominant facet ⇒ ADAPT, same-PR consumer adaptation, no alias, facet census before any RETIRE over 100 consumers. AGENTS.md LiteralKit line narrowed (kit for named literal domains; `S.Literals` for anonymous inline unions; `as const` note kept). `@beep/schema` README rule. Same clause in the standards and skill prose listed under Target Surfaces. | Merged; every later PR cites the entry by heading. | Wording contradicts an audit disposition, or drops "same PR, no alias". |
| P1 Knowledge layer | `research/tools/schema-inventory.ts` and its verifier moved into repo-cli as `bun run beep lint effect-schema-inventory --write` / `--check` (sibling of `lint effect-vitest`, goal-time ruling 2026-09-16); `research/inventory/` moved (not copied) to `test/fixtures/effect-schema-rc115/inventory/*.jsonl` (14 modules, `schema-inventory/v1`, identity `(module, symbol, kind)`, `@internal` rows kept and flagged) with a pin manifest carrying the upstream sha and a row digest, the exploration ledger left pointing at the fixture (decision "Evidence retention"). A prompt generator that resolves each row's `file:line` against `.repos/effect` at the pinned sha and inlines the full declaration and JSDoc block (signature, sections, examples) plus graft context for the module, because a row carries only a truncated signature, a summary and an example flag (decision "Knowledge layer"). | `--check` reproduces the fixture byte-for-byte from `.repos/effect` at the pinned sha; hosted CI verifies row shape, duplicate identities and the pinned sha with no effect checkout; tests green on Node and Bun; a lane prompt for one Role A module is generated with inlined docs and committed under `ops/prompts/` as the first-slice proof. | The command passes when `.repos/effect` is missing or at another sha; a prompt ships with only the row's truncated fields. |
| P2 LiteralKit trim | Delete `Options`, `pickOptions`, `omitOptions`, `HashSet`, `thunk`, `enumMapping` and the `M` type parameter with its validators; override upstream's public `rebuild(ast)` so statics survive `check`, `annotate` and `pipe`; codemod consumers (`Options` → `.literals`, `pickOptions` → `.pick(...).literals`, `omitOptions` → explicit complement pick, `HashSet` → `HashSet.fromIterable(X.literals)`, `thunk.k` → `F.constant(X.Enum.k)`); MappedLiteralKit's `From`/`To` kits alike; the two `enumMapping` consumers rewritten. Keep `Enum`, `is`, `$match`, `toTaggedUnion`, `LiteralToKey`. `literal-kit-const-assertion` stays. | Type check green; zero `rg` hits for the retired names; before/after `--extendedDiagnostics` attached with no instantiation increase; MappedLiteralKit and every `.check(...)` derivation verified to keep statics. | A kept facet is touched; any kit loses a static on a derivation; instantiations increase on a baseline package. |
| P3 Retirement train | Groups A–G by upstream target (PLAN.md), each PR one concept family plus every consumer, citing the P0 entry; the boundary table rows for D and E filled before those PRs open; the facet census run before Number, Int, Unknown, Opaque open. | Per PR: closure-sized; persisted and served encodings byte-identical; generated baselines regenerated; `package-verify` green on touched packages; before/after `--extendedDiagnostics` attached with no instantiation increase on the three baseline packages and check time within the 5% band or flagged; merge-ready. | A persisted encoding changes; instantiations increase on any baseline package; a census flips a row to ADAPT without a decision-log entry; a KEEP concept is edited. |
| P4 Gate cut | `SFV4-*` rules for F03 (custom key/default combinator wrappers), F13 (schema-derived guards versus duplicated predicates), F24 (opaque defect/equivalence wrappers) in `SchemaFirstDetectors.ts` with occurrence-anchored identity and membership ratchet baselines in `standards/schema-first.inventory.jsonc`; delete `SFV4-tagged-error-equivalence` and its remediation string; rewrite the SchemaUtils remediation strings, narrow the LiteralKit one to surviving facets. | Baselines committed; the floor is membership; no new lint lane; render and Yeet routing show the new groups. | A rule for a family under 0.70 confidence; a line-keyed identity; a separate lane. |
| P5 Statics and performance close | F15 detector; `withCodecStatics` retired with its consumers, `collectAnnotationsAt` kept; `quality check-census` extended with instantiations and check time plus a committed rc.115 baseline for `@beep/schema`, repo-cli and law-practice-domain; one or two upstream typeperf suites mirrored; closeout reflection; lifecycle flip in the same PR. | The selective-statics goal has merged; the gate exists and its backlog is zero; no instantiation increase on the three baseline packages and the check-time band reported. | Opened before the statics merge; a non-zero backlog relabelled as exceptions. |

## Boundary Table

Fill before any group D or E PR opens. Persisted and served rows must read
`yes`; a `no` on such a row is a migration goal and leaves this packet.

| Boundary | Concept | Upstream codec | Byte-identical | Evidence |
| --- | --- | --- | --- | --- |
| persisted column | Timestamp | `S.DateTimeUtcFromString` or `S.DateTimeUtcFromMillis` | TO FILL | |
| HTTP payload | Timestamp | same as above per consumer | TO FILL | |
| in-memory | Timestamp | `DateTime.Utc` | n/a | |
| persisted / HTTP | DateTimeUtcFromValid | a consumer-local composition over `S.DateTimeUtcFromString` that preserves the existing tagged ISO transport byte-for-byte; if no such composition exists for a stored boundary, that boundary is excluded migration work | TO FILL (must be yes) | today's encoder emits the tagged ISO form (`DateTimeUtcFromValid.schema.ts:451`); the research recipe "tagged form becomes plain ISO or millis" is forbidden on these rows |
| in-memory | DateTimeUtcFromValid | `DateTime.make` + `DateTime.toUtc`; picker adapters via `DateTime.setZone` | n/a | |
| persisted / HTTP | Duration | `S.DurationFromString`, `S.DurationFromMillis`, `S.DurationFromNanos` | TO FILL | |
| persisted / HTTP | Timezone | `S.TimeZoneNamed` or `S.TimeZoneFromString` (IANA name as a bare string) | TO FILL | today a LiteralKit over IANA names encoded as the bare string (`Timezone.ts:30`) |
| persisted / HTTP | ArrayBuffer, Bytes | `S.Uint8Array`, `S.Uint8ArrayFromBase64` | TO FILL | |
| persisted / HTTP | ArrayOf presets | `S.Array` / `S.NonEmptyArray` over the same element schemas | TO FILL (expected yes) | presets are direct compositions (`ArrayOf.ts:29-229`); confirm no annotation-driven encoding |
| persisted / HTTP | HashSet, MutableHashMap, MutableHashSet | array wire fields via `S.HashSet`, `S.Array` | TO FILL | |
| persisted / HTTP | Graph | `S.Graph` + `S.toCodecJson` | TO FILL | |
| persisted / HTTP | RegExp | `S.RegExp` (object wire shape: source and flags) | TO FILL | |
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
A facet with no public upstream equivalent that carries the dominant share of
usage flips the row to ADAPT (trim the covered facets, keep the rest) and the
flip is logged below before the PR opens. Precedent: DECISIONS
"LiteralKit reopened at decompose: ADAPT, not RETIRE" (2026-09-15).

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
| Codex exec lanes, Fable judges | Orchestration lane, 2026-09-12 | binds all |
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
| Six phases, about six weeks, before the next RC bump; mid-train bump regenerates the inventory | Appetite and shape sign-off, 2026-09-14 | binds all |
| LiteralKit and MappedLiteralKit are ADAPT; facets ruled one by one; intent per facet; facet census gate; AGENTS line narrowed; F01 dropped | LiteralKit reopened at decompose: ADAPT, not RETIRE, 2026-09-15 | binds P0, P2, P3, P4 |

Goal-time additions (append dated rows):

| Date | Ruling | Rationale |
| --- | --- | --- |
| 2026-09-15 | HttpStatus retires in group G; its named codes become `effect/unstable/http/HttpStatus` value-module lookups; its MappedLiteralKit use is transient between the P2 trim and the group G PR. | The MAP §P3 note had read as if HttpStatus kept its kit after P2; the Role B ruling (2026-09-14) governs and the MAP note was corrected the same day. |
| 2026-09-15 | Persisted and served boundaries for retired transports keep the existing encoded bytes; the research migration recipes that change a wire form (tagged ISO to plain ISO or millis) apply to in-memory boundaries only. | Codex review of the graduated packet caught a boundary-table row that copied a research recipe over the Wire shape ruling. |
| 2026-09-16 | Instantiations are the hard per-PR performance gate; check time is advisory within a 5% tolerance band (same compiler, fresh build-info). Refines "Performance acceptance" (2026-09-14). | Instantiation counts are deterministic; wall-clock check time moves a few percent run to run, so a literal check-time bounce would fire on noise. The deterministic count carries the ruling's intent. |
| 2026-09-16 | The P1 command is `bun run beep lint effect-schema-inventory --write` / `--check`, registered in the existing Lint command beside `lint effect-vitest`. | Same store, pin-check and fixture shape as the effect-vitest lane; the name says what it checks; the schema-first gate later reads the same fixture. Rejected: flags on `lint schema-first` (mixes fixture refresh with the lint's own `--write`); a `knowledge` subcommand (separates the fixture from the lane that consumes it). |

## Acceptance Criteria

- [ ] P0 merged: dated entry in `standards/architecture/DECISIONS.md`, rule
      text in `standards/architecture/11-evolution-and-deprecation.md`,
      AGENTS.md line narrowed, `@beep/schema` README carries the rule.
- [ ] Every retirement PR (P2, each P3 PR, P5) carries before/after
      `--extendedDiagnostics` on the three baseline packages with no
      instantiation increase; check time reported against the 5% band.
- [ ] `test/fixtures/effect-schema-rc115/inventory/` committed with a pin
      manifest; `--check` byte-identical locally; hosted verification green.
- [ ] LiteralKit and MappedLiteralKit trimmed per the P2 row; no retired facet
      name remains; statics survive every derivation; a before/after number
      is attached.
- [ ] The 50 RETIRE concepts and 6 Role B concepts are deleted with consumers
      migrated, or flipped to ADAPT through the facet census with a logged
      ruling; the 77 KEEP concepts are untouched.
- [ ] Boundary table rows for every group D and E concept are filled with
      evidence; no persisted or served encoding changed.
- [ ] `SFV4-*` rules for F03, F13, F24 exist with committed baselines;
      `SFV4-tagged-error-equivalence` is gone; `bun run beep lint
      schema-first` reports zero actionable parity findings.
- [ ] `withCodecStatics` retired after the selective-statics merge;
      `collectAnnotationsAt` kept; F15 rule exists.
- [ ] `quality check-census` records instantiations and check time against a
      committed baseline; no instantiation increase on the three packages
      and check time reported against the 5% band.
- [ ] Closeout reflection written; lifecycle flipped in the same PR.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/effect-schema-parity/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/effect-schema-parity/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/effect-schema-parity` | Passes |
| Schema-first gate | `bun run beep lint schema-first` | Green; parity backlog zero at P5 |
| Inventory fixture | `bun run beep lint effect-schema-inventory --check` | Byte-identical locally; fails loud without `.repos/effect` |
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
  its Yeet PR.
- An effect RC bump lands mid-train: regenerate the inventory directory for
  the new sha in the bump PR before any further phase PR opens.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
