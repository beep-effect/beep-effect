# Canonical Effect Vitest execution plan

Status: `active`

## Phase gates

| Phase | Status | Work | Exit criterion |
| --- | --- | --- | --- |
| P0a | complete | Grounding | Four Grok reports, all sources ledgered, every census class emitted. |
| P0b | complete | Worktree and packet | Goal doctor and index pass; launcher under 4000 characters. |
| P0c | complete | Detector and census | repo-cli package verification green; full scan under 10 seconds; live scope reconciled. |
| P0d | complete | Pinned primitives graph | Every export/member/helper/README section covered; installed pin guard tested. |
| P0e | complete | Charters and instrumented it | Pinned charters and Node/Bun runner proofs green. |
| P0.5 | complete | MemoryFileSystem promotion | Node/Bun/Memory conformance and test-utils proof green; PR1047 merged by Benjamin after acceptance at 0fce23f. |
| P0f | in-progress | Adversarial review | Three Grok rounds; no open blockers; majors fixed or waived. |
| P0g | pending | Initial PR and ratification | Yeet merge-ready; Benjamin approves plan and merges before P1. |
| P1 | pending | Inventory | All four lenses cover every file; timing evidence; Benjamin acknowledges before P2. |
| P2 | pending | Remediation waves | Each topological wave passes package proof and shrinks baseline exactly. |
| P3 | pending | Close | Empty baseline; hosted proof; following-week p95; reflection and state flip in final PR. |

P0a research and P0b packet setup overlap as authorized by the first-actions
contract. Every subsequent phase waits for its predecessor's gate.

## Current integration, 2026-09-10

Main, including #1060 and #1082, is integrated through `8cb18e6` by merge `3630388`.
The current source contract is rc113 at d3b837aee836f35d625d55205f7d6e61305fc198.
The 100-entry graph preserves its API names, signatures and coordinates, with
conditional assertion and shared-clock guidance added during round two. The
remote checkpoint remains b86269212e; its Greptile 5/5 and closed threads are
historical evidence for that head.

Final local runner repairs pass all 52 registrations on Node 22, Node 24 and Bun
plus normal scoped Node 22 coverage. Detector repairs pass 207 focused cases,
compiler/lint/Fallow checks and full repo-cli audit/docgen in 423.690 seconds.
The accepted canonical inventory contains 7,775 open candidates across 1,000
tests and 110 support modules. Its complete correspondence, graph guidance and
all 29 generated declarations are verified without unexplained deltas or exception
transfer. Three normal lint commands pass in 9.943s, 9.503s and 9.588s with stable
source/artifacts and complete host context; earlier failed cohorts remain recorded.

Round one and round two are closed. Round three, final CLI coverage, full
aggregate proof and exact-head hosted/review checks still gate readiness. Main's
Vitest 4.1.11 remains outside the adapter's declared peer range; actual runtime
binding and exercised behavior are recorded separately. The publishing commit
must include the repo-configs release note. P0f/P0g remain open; P1/P2 are not
authorized. See history/2026-09-10-pr1067-rc113-integration.md.

## Historical evidence through rc.112

P0a through P0.5 completed at their recorded revisions. Their dated verification
receipts remain in history; the following rc.112 results do not establish the
current upgrade's compatibility or final package/hosted proof.

P0c delivered all 15 syntax-only detector rules, the live census, keyed ratchet
and package JSONL rows. Its full package verification passed under Bun 1.4.1.
P0d delivered the complete 85-entry pinned graph, schema boundary, version guard,
graph-backed hints and portable source/example/runtime tests. Semantic review
and the full-run cwd defect are closed. See history/2026-09-08-p0d-verification.md.

The final P0d full package command passed in 430.115 seconds, with audit and
docgen green and all 29 captured source/graph/fixture hashes stable. Exact
writer runs take 8.368 and 7.890 seconds; the default ratchet takes 7.607 seconds,
with no introduced/resolved findings and identical hashes for all 123 artifacts.

At P0d, the census was 1,073 paths: 968 tests and 105 support modules across
139 owners. All P0c paths remain, including the generated declarations matched
by literal D9. The primitives test is the sole new path and adds one EV010
judgment row. All 5,012 P0c canonical finding identities and semantic fields
remain; the baseline and 121 JSONL files agree on 5,013 rows. One import's
line/ID shifts without changing its canonical key. Every count/owner/kind matches.

P0e is complete. Its dated receipt records the public runner, four lens charters,
Node/Bun runtime regressions, caller-overload compatibility and detector alias
integration. Both packages have full verification evidence; the final callable-
only correction has fresh test-utils proof and explicitly retains the unchanged
CLI proof. All eight charter examples compile. The dependency/lockfile diff only
moves the existing @effect/vitest catalog pin into runtime dependencies.

Final exact scan commands pass in 8.532, 8.121 and 8.072 seconds with stable
source and 123 identical artifacts. The census is now 1,075 files: 970 tests and
105 support modules across 139 owners. Only the two new runner tests were added.
Baseline and 121 JSONL files agree on 5,016 unique rows; all 5,013 previous rows
are unchanged and exactly three judgment candidates arise in the new tests.
See history/2026-09-08-p0e-verification.md. P0.5 source/conformance reconnaissance
is complete; the absent historical scratchpad/MemoryFileSystem path maps to the
actual memfs core. Conformance integration is verified in its own publication
worktree. The following section records the completed promotion; later human
and merge gates remain pending.

## P0.5 completed promotion

PR #1047 was published at 0fce23fbace5ef95a1bca9459c341a17d5bbd641 on the separate
filesystem branch. Main b4f7497 was merged before the remediation push.
Benjamin merged the PR at 2026-09-09 11:49:31 UTC, producing main commit
03faddd5387ea4e24aec0a75e23607549e179729. Root did not perform the merge.
The worktree is clean; Bun 1.4.2, Node 24.20.0, Effect/@effect/vitest rc.112 and
Vitest 4.1.11 remain pinned. Primary packet/D5 work stays in the goal worktree for
P0g. The scratchpad copies remain pending the separate deletion decision.

The promoted engine retains all 25 FileSystem primitives and the shared suite's
21 cases for actual Node, Bun and Memory. Initial full test-utils/repo-cli,
Fallow, public/export/built-consumer and bounded glob/directory preservation
receipts remain historical proof at their recorded revisions. Four JSDoc example
import repairs were comment-only and passed fresh package/docgen/inventory proof.
The first full Yeet attempt never completed; its successful earlier lanes and
introduced JSDoc failure remain recorded rather than being relabeled full-green.

The review update preserves infallible closed seek while retaining the cursor,
strengthens copy conformance with a real absent-destination copy, hoists exact
schema guards, preserves regular-file atime, hard-links the symlink inode,
rejects empty symlink targets and publishes the temporary directory Create event.
Pinned runtime evidence confirms watch preflight errors correctly retain stat.
Five additional characterization cases cover those claims; equivalent explicit
suite options replace the deprecated sequential shorthand without changing bodies.

All 101 filesystem/conformance cases plus 26 new public-API coverage cases pass
on actual Node and Bun. Final full package-verify passes audit/docgen; the only
remaining full lint-policy failure was deprecated-apis, now passing in its full
canonical rerun. The accepted cursor snapshot has an independent no-findings
review, qualified by exact later-delta checks. No source/test changes occurred
between final proof and the verified pushed tree.

The canonical scoped coverage writer adopts exactly the three new source
identities after independent provenance review and final gap review. Pre/post
checks preserve all 133 other package rows/global fields, all 11 existing file
identities, existing percentage floors and old-file gap budgets. The normal
ratchet pinned to origin/main passes. Package L/S/B/F is 96.19/95.51/93.16/91.04;
core is 98.87/97.66/94.57/97.85. Residual private invariant/resource-pressure paths
remain measured, without exclusions. Package branch gaps rise from 23 to 45 with the
new source; other gap totals improve. See history/lanes/p05-pr1047-coverage-adoption-root.md.

Benjamin repeatedly directed prompt pushing after local issue remediation,
instead of waiting on queue. Yeet fast committed the verified five-file update
but still entered full-proof admission. Root stopped that owned queued process,
verified the clean committed tree equals the reviewed staged tree, then pushed
with a command-scoped pre-push hook bypass. Hosted checks remain the required
full gate; no global hook setting changed. This supersedes the earlier local
full-proof wait for this update, not the review/hosted acceptance requirements.

Canonical Yeet reply posted and resolved all seven code-review threads. Fresh
GraphQL confirms eight total threads, zero unresolved, on the pushed head.
Greptile's new-head review is 5/5. Canonical closeout passes its explicit 5/5,
zero-issues and zero-review-comments gates, with the reviewed SHA matching the
pushed head. Hosted coverage now passes across all 134 package baselines, as do
type checking and property laws. The repo-cli unit job ended in a hosted
runner communication failure. Read-only diagnosis and three bounded Bun
probes passed without reproducing the silence. One job-specific retry passed
on the same head as attempt 2, job 102447192692. The optional Vercel
deployment rate limit is separately attributed. See
history/2026-09-09-p05-hosted-verification.md for the exact-head receipt.
P0.5's gate is now complete. The single unit-job retry passed all 168 files and
3275 tests; all 18 required checks pass. Final canonical monitor reports
merge-ready: yes, and explicit closeout passes at the same head with Greptile 5/5
and zero unresolved threads. Monitor's process still exits 1 on the separately
attributed optional Vercel rate limit; every other optional check is green or
skipped. The first runner-loss failure is retained in the receipt.

P0f is now in progress. Benjamin authorizes merges; P0g/P1/P2 remain pending.
All runtime/verification limitations are in the hosted receipt and lane reports.

## P0f current work


Latest continuation (2026-09-10): full repo-cli package audit/docgen passes on
the final merged inputs in 406.858s, with no source drift. The scanner suite
passes 113 focused cases. Runner suites pass on Node 22.22.3, Node 24.20.0 and
Bun 1.4.2; full test-utils package verification and hosted-mode scoped coverage
pass with the original assertions and floors. Earlier CLI coverage adoption
added only nine measured missing identities and preserved all old floors;
fresh coverage remains required for the final policy changes.

The canonical census retains 1,106 paths (996 tests, 110 support). Its 8,026
candidate rows preserve every previous candidate with no unexplained loss or
exception transfer. Three new candidates are attributed to two upstream tests
and one scanner regression. After the membership-index repair, three consecutive
normal commands against the adopted baseline pass in 9.405s, 9.606s and 9.547s.
Raw receipts include workstation load, pressure, memory and swap activity.

Root closed all thirteen round-one findings and their integration gate. Round
two is reviewing an immutable corpus with twenty new sample files. Round three,
final local/hosted proof and PR review closure remain required. P0g ratification
and all P1/P2 gates remain. Current proof and limitations are recorded in the
September 10 integration and final timing reports; prior observations below are
historical, including the earlier 10.319s adopted-baseline failure.

### Historical pre-resumption integration

Current integration update (2026-09-09): the final runner handoff is terminal,
joined and accepted. Complete Node/Bun suites, source/test/fixture compilers,
isolated export consumers, deadline controls and full test-utils package proof
are green. Full repo-cli package proof also passes in 450.673s. The complete
post-package census contains 1,101 files (991 tests and 110 support); private
preview emits 7,580 findings. The 9.221s full command and the predeclared three
follow-ups (9.963s, 9.557s, 9.395s) preserve identical payloads and source hashes.
Root accepts this bounded current-input timing sample, retaining all older
slower observations and resource context. There is little margin under ten
seconds, and these measurements do not establish a bound under arbitrary load.
The existing detector task is reconciling every census and row delta against
exact historical/current source snapshots. Canonical artifacts remain unchanged;
reviewed regeneration, final validation and round-one dispositions still follow.
Rounds 2/3, initial PR ratification/merge and all P1-P3 gates remain pending.

The following paragraphs retain the earlier round-one evidence and failures;
the update above describes the current integration state.

Round 1 input assembly is complete: 282 immutable copied inputs and 132
hash-qualified references, plus five recovered upstream helpers at the exact
rc.112 commit. Root independently verified all copies, references, generated
metadata, and supplement hashes. Exactly 20 sampled tests span 17 owners and
all 14 detector rules with baseline findings; EV015 has no baseline findings
and retains its dedicated contract tests. Finding closure remains pending.
The assembly report is history/lanes/p0f-round1-corpus.md. The initial sealed
packet snapshot retains older progress prose; a separate status addendum
captures these current docs without changing the reviewed source snapshot.

Round 1 review coverage is accepted after the original pass and a same-round
continuation. Root independently verified all twenty sample bodies and the
44 complete-file code/test/charter/KG obligations. The final report contains
thirteen findings: one blocker, seven majors and five minors. The continuation
added R1-012 and R1-013; the initial eleven rows remain unchanged. See
history/2026-09-09-adversarial-round-1-acceptance.md for proof and limits.
The detector follow-up is terminal with all 93 focused tests, compiler and lint
checks passing. Root verified its fourteen input hashes and the runner's five
input hashes, with no unexpected source drift since P0e. R1-012/R1-013 and the
additional R1-006 legacy exception identity case are implemented. All 5,016
existing baseline rows are open; no legacy exception requires automatic
carry-forward. The runner lane and Root's pinned Bun 1.4.1 focused proof are
terminal and passing. A private full-scan preview precedes package validation
and reviewed canonical artifact regeneration. The preview took 34.197s,
exceeding D4. Performance repairs removed structural compiler access and repeated
lexical work; the first expanded focused run passed 96 tests. Root checked fifteen
retained scan outputs and attributed the sole intermediate extra finding to a new
test assertion, subsequently corrected with assertSome. A later direct-parser
experiment violated D4's required Project engine; Root interrupted that owned lane
and resumed it with an explicit engine-restoration instruction. The corrected
lane is terminal and Root accepts its 96-test/compiler/lint focused handoff,
restored Project engine and exact preservation of all 7,417 finding payloads.
Its scan takes 8.4606s / 10.452936s total; the independent Root run takes 8.947s /
10.885s total. Root accepted the completed read-only residual-cost profile.
The public kind-query candidate regressed to 13.368339s and was restored; the
second candidate adds only per-scope/name resolution memoization and records
9.459970s complete-command / 7.6438s scanner time with 98 focused tests passing.
The final handoff has two import-only location shifts among 7,417 findings; all
other payload fields are identical. Root accepted the focused handoff; independent timing then took 11.130s
complete command / 8.9749s scanner with exact accepted payload equality. A fixed
three-run unchanged-source sample took 13.842003s, 16.885761s and 13.914645s,
with observed host swapping/reclaim and retained resource context. The timing
gate remains open. The full test-utils package audit then failed one introduced
property-deadline runtime test (missing seed diagnostics); docgen passed and
sources stayed fixed. The sequential driver stopped before repo-cli. The completed read-only attribution identified a reporter information-loss
path and a sample/arming gap. Root accepted its evidence and dispatched a bounded
arming-time correction, raw-error diagnostics and source-only controlled-clock
test seam. Production clock/TestEnv, timeout values, floors and assertions remain
fixed; the lane must complete focused and full package proof before handoff. Canonical writes remain gated by timing/package proof. Resource context and the distinction between scanner and process time
are retained in history/2026-09-09-p0f-round1-integration.md.
R1-011 is fixed and validated: current goals doctor and index both pass across
177 packets with zero blocking findings and four unrelated advisories.
Every disposition is tracked in history/2026-09-09-adversarial-round-1-closure.md;
R1-010 has a narrow dated reference-identity waiver backed by pinned collection
probes and Node/Bun regressions. Full package validation and the remaining
findings are still pending. Round 2 waits for completed repair dispositions.

## Detailed phase contract

## 3. Phase plan

Phases are sequential; every phase has a gate. Do not start the next phase until the gate is met.
Record friction receipts in `research/OPPORTUNITIES.md` the moment they happen.

### P0a — Grounding (Grok research + Codex reconnaissance)

- Grok lanes (parallel, report-first, `--max-turns 60`): (1) `@effect/vitest` rc.112 idioms and
  the exact tag-pinned API surface, (2) upstream `packages/sql/*/test` and `platform*/test` layer
  sharing patterns (`it.layer`, container services, per-test inner resources, `TestClock.withLive`
  waits), (3) vitest 4.1 reporter / hook-timeout / JSON output facts needed for timings and the
  watchdog, (4) known TestClock and `it.layer` pitfalls (shared clock, hook timeout, nested memo
  maps). Outputs: `research/2026-09-04-grounding-<n>.md` + entries in `research/SOURCES.md`.
- Codex lanes (parallel, disjoint globs): regenerate the §1.4 census as JSON with file lists per
  class into `research/census/<class>.json`; dump every `withXyz` wrapper definition with its body
  into `research/census/wrappers.json` (name, file, line, resources acquired, layers built).
- You read only the reports and the census summaries.

Gate: `research/SOURCES.md` lists every source; the census JSON exists for every class in §7.

### P0b — Worktree and packet

```bash
bun run beep worktree new effect-vitest-canon -b feat/effect-vitest-canon
```

Branches from the current `@slop/09-02-26` HEAD (includes the MemoryFileSystem commit). Work in
the sibling worktree; never `git add -A`; never touch this checkout's tree afterwards.

Hand-author `goals/effect-vitest-canon/` from `goals/_template`: `README.md`, `SPEC.md`
(scope, non-goals, D1–D14 as normative decisions, acceptance, stop conditions), `PLAN.md` (this
phase plan), `GOAL.md` (launcher ≤ 4,000 chars), `ops/manifest.json`, `DECISIONS.md` (D1–D14
dated 2026-09-04 with rejected options), `research/SOURCES.md`, `ops/prompts/`,
`ops/inventory/.gitkeep`, `history/reflections/`. Gate: `bun run beep goals doctor` and
`bun run beep goals index` are clean.

### P0c — Detector command and the file census (single source of truth for scope)

Implement `beep lint effect-vitest` in `packages/tooling/tool/cli/src/commands/Lint/` mirroring
the SchemaFirst split: `EffectVitest.ts` (command), `internal/EffectVitest{Detectors,Policy,Scan,Store}.ts`,
schemas in `Lint.schemas.ts`. Flags:

- `--census` writes `goals/effect-vitest-canon/ops/inventory/test-files.json` (every in-scope
  file with package owner, kind `test|support`, and byte/line counts). The scope globs live in
  `Lint.schemas.ts` and are the only definition of "every test file".
- `--write` refreshes `standards/effect-vitest.inventory.jsonc` (baseline).
- `--rows <dir>` emits the detector findings as JSONL rows (schema §5.1) per package into
  `ops/inventory/detector/<package>.jsonl`.
- default (no flags) = ratchet check against the baseline, exit non-zero on any new instance.

Engine constraints (D4): ts-morph `Project` with `skipAddingFilesFromTsConfig: true` and
`addSourceFilesAtPaths(testGlobs)` only; syntax navigation (`getDescendantsOfKind`), never
`getType()`; full scan ≤ 10 s on the repo; register in the cheap-gates lane
(`GithubChecks.ts`) exactly like `cheap-gates:schema-first`; add it to the `yeet verify` cheap
gates. Implement the rules in §7 with `ruleId`s `EV001`…; every rule carries the KG id of its
replacement primitive. Tests for the command follow `08-testing.md` and this packet's own laws
(they are in scope too).

Gate: `bun run beep quality package-verify @beep/repo-cli` green; the census
exactly matches the live scope declared in Lint.schemas.ts; lint runs in under
10 seconds. The 955-file figure in SPEC §1.4 is the historical starting census.
The latest accepted P0e census has 970 test/spec files and 105 support modules;
later changes must reconcile their exact additions or removals against it.

### P0d — Knowledge graph (`standards/effect-vitest.primitives.jsonc`)

One entry per: every `index.ts` export and `Vitest` namespace member (including tester methods
`skip`, `skipIf`, `runIf`, `only`, `each`, `fails`, `prop`; `layer` options; `MethodsNonLive` vs
`Methods`), every `utils.ts` helper, and every README section at the tag (README is 311 lines
there: feature table 27-34, "Testing Successes and Failures as `Exit`" 76, "Logging" 226,
"Resource Safety and Scope" 257, "Writing Tests with `it.flakyTest`" 280). Entry schema §5.3.
APIs the charters lean on, all verified present at the tag: `Effect.timeoutOrElse`,
`Effect.raceFirst`, `Effect.scopedWith`, `Effect.fnUntraced`, `Effect.annotateLogs`,
`Logger.layer`, `Logger.consolePretty`, `TestClock.adjust`, `TestClock.withLive`, `Layer.mock`.
Line numbers are read at the tag with `git show`, never from HEAD or dist. Header pin:

```jsonc
{ "package": "@effect/vitest", "version": "4.0.0-rc.112",
  "tag": "@effect/vitest@4.0.0-rc.112", "sha": "2600f62f4532026928454dcea8d1c48557b3f942" }
```

The lint command decodes the file with `EffectVitestPrimitive` (`S.Class`), uses `replaces` to
render remediation hints, and fails with a clear message when
`node_modules/@effect/vitest/package.json` version ≠ pin (the bump procedure is: regenerate
anchors at the new tag, review semantic diffs, update the pin).

Gate: every export in `index.ts` and `utils.ts` at the tag has an entry (assert by diffing the
export list against the KG in a lint test); each entry's `whenToUse` names at least one repo
class from §7 it replaces, or states `replaces: []` with a reason.

### P0e — Lens charters (`ops/prompts/`)

Write `lane-contract.md` (shared rules from §0), `resource-authoritarian.md`,
`flake-detective.md`, `property-tester.md`, `all-seeing-eye.md` from §6, each with: mission,
rules (D-numbers), detection heuristics beyond the mechanical rules, evidence sources, the finding
row schema, and worked before/after examples validated against the tag. These are lane prompts,
not agent definitions.

Also design (not yet adopt) the instrumented `it` (§6.4) as `packages/tooling/test-kit/test-utils/src/Vitest.ts`
with its own tests; it ships in the P0g PR but is adopted only in P2's observability step.

Gate: each charter cites only tag-pinned APIs; the instrumented `it` passes its tests under both
`bun run test` (bun-native) and node vitest (coverage runner).

### P0.5 — MemoryFileSystem promotion (its own PR, D8)

1. Port [upstream FileSystem.test-utils.ts](https://github.com/Effect-TS/effect/blob/d3b837aee836f35d625d55205f7d6e61305fc198/packages/effect/test/FileSystem.test-utils.ts) (`testLayer`, `TestLayerOptions`) into
   `@beep/test-utils` as `FileSystemConformance.ts`, parametrized exactly like upstream, replacing
   upstream's `runPromise`-in-plain-`it` with `it.effect` + `Effect.provide(layer)` per test (the
   layer under test is the subject, so per-test provide is correct here — record this as a D14
   exception with reason).
2. Run it against `NodeFileSystem.layer`, `BunFileSystem.layer` and `MemoryFileSystem.layer`.
3. Promote `scratchpad/MemoryFileSystem/**` to `packages/tooling/test-kit/test-utils/src/MemoryFileSystem/`
   (`$TestUtilsId` instead of `$ScratchpadId`, JSDoc per `.patterns/jsdoc-documentation.md`), move
   its test, keep the fresh-volume-per-`it.layer` gotcha in the docs.
4. Delete the scratchpad copies (pending Benjamin's answer); if `memfs`'s seed / fault / inspect
   facade is wanted later, it is re-ported on top of the promoted engine, not vendored again.

Gate: conformance green on all three layers; `package-verify @beep/test-utils` green; PR
published via yeet and merge-ready (Benjamin merges).

### P0f — Adversarial review, three Grok rounds

Inputs per round: packet docs, `DECISIONS.md`, KG file, detector rules and their tests, lens
charters, the instrumented `it` design. Output contract per round:
`history/2026-09-DD-adversarial-round-N.jsonl` with rows
`{ id, severity: blocker|major|minor, area, claim, evidence, proposedFix }` and a short prose
summary. You triage every row: fix, or waive with a dated reason in `DECISIONS.md`. Round N+1
receives round N's closure ledger and is told to look for what was missed, weaker Effect patterns,
KG gaps, and detector false positives / negatives (give it 20 sampled test files per round).

Gate: zero open blockers; majors fixed or waived with reasons.

### P0g — Initial goal PR and ratification

One PR via yeet carrying: the packet, the lint command + baseline (`--write` output is the P1
starting inventory), the KG, the instrumented `it` module, the D5 doc corrections
(`08-testing.md`, `.patterns/testing-patterns.md`, the testing lines of
`.claude/skills/effect-first-development/SKILL.md`). `--start-pr-early --monitor --pr`. Babysit to
`merge-ready: yes` (Greptile 5/5, zero unresolved threads, zero failing required checks).
**Ratification = Benjamin approves the plan and merges. Do not start P1 before that.**

### P1 — Inventory

1. Detector rows: `beep lint effect-vitest --rows ops/inventory/detector` (mechanical classes,
   `mechanization: "detector"`).
2. Baseline timings per package with the coverage-lane runner (plain node vitest, run from the
   package directory; the per-package `test` scripts are bun-native and time differently):

```bash
cd <package-dir> && bunx vitest run --reporter=json --outputFile=<abs-repo-root>/goals/effect-vitest-canon/ops/inventory/timings/baseline/<pkg>.json
```

   Summarize to §5.4 shape; capture the slowest 10 files per package. Never switch branches
   while a run is in flight (vitest reads the working tree mid-run).
   Record the exact runtime versions, command, source identity and test worker settings
   alongside each timing. Retain host CPU/memory/I/O pressure and process resource limits
   in a separate context receipt without changing the §5.4 summary shape. Before/after
   comparisons use the same runtime and concurrency settings; report elapsed time as
   measured, without numerical adjustment for workstation load. If contention or an
   outlier makes a comparison inconclusive, retain that result and collect additional
   unchanged-input evidence. Never select only the fastest run or infer hosted CI speed
   from workstation timings. Queue waiting is separate from test execution time.
3. Codex lens lanes on the residue, batched in `topo-sort` order with disjoint packages, one lane
   per (batch, lens) or one lane per batch applying all four charters when the batch is small.
   Each lane reads `test-files.json`, the detector rows for its packages, the KG, and its charter;
   emits `ops/inventory/<lens>/<package>.jsonl` (schema §5.1) and appends to
   `ops/inventory/digests/<package>.md` (§5.2). Every file gets at least one row per lens — a
   `class: "no-findings"` row counts, so completeness is checkable.
4. Completeness check (a lint test or a tiny script): every path in `test-files.json` has rows
   for all four lenses; row counts per package are summarized in `PLAN.md`.
5. One Grok round on inventory completeness and false-positive rate (sample 40 files).

Gate: completeness check passes; P1 summary table in `PLAN.md` (rows per lens per package,
severity histogram); Benjamin acknowledges before P2.

### P2 — Remediation in waves

- Waves from `bun run beep topo-sort` (dependencies first: foundation → drivers → slices →
  tooling → apps), capped near 150 changed files per PR; `foundation/modeling` and
  `tooling/tool` alone (D13).
- Per package, lens order (D12): **scope** (it.layer blocks, MemoryFileSystem, wrapper deletion,
  per-test provide removal, `Effect.scoped` removal) → **assertions** (`Effect.exit` +
  utils helpers, `expect` only for plain values) → **property** (`it.effect.prop`, schema
  arbitrary richness, `fcRuns` floors preserved) → **flake** (root causes on the stabilized
  structure) → **observability** (swap to the instrumented `it`).
- Codex lanes own disjoint packages; you run `bun run beep quality package-verify <pkg>` per
  package (`--quick` only when the touched surface justifies it) and the detector ratchet; rows
  flip to `status: fixed` with `fixSha`, or `exception` with `reason`.
- After-timings per package with the same command as P1; append the before/after pair to the PR
  body and to `ops/inventory/timings/after/<pkg>.json`.
- Publish each wave with yeet (`--start-pr-early --monitor --pr`), merge `origin/main` first, and
  hold to `merge-ready: yes`. Attribute every red check (introduced / inherited / unrelated /
  environment-only) before repairing. Hosted proves; locally run only `--filter` checks, never a
  full repo coverage run. Benjamin merges.

Gate per wave: baseline shrank by exactly the fixed rows; zero new findings; package-verify green
for every package in the wave.

### P3 — Close

- Baseline empty; lint zero-tolerance confirmed by a hosted cheap-gates run.
- `history/timings-report.md`: per-package before/after table, slowest-file deltas, and the
  Coverage Regression p95 over the following week from `bun run beep ci lane-timings --window`.
- Reflection via `/reflect effect-vitest-canon`; `ops/manifest.json` status flip in the final PR
  (same-PR packet-state rule); `research/OPPORTUNITIES.md` receipts folded.
- Stop: if a wave cannot close without deleting tests or weakening schemas, stop and ask.

## Resume contract

Read ops/manifest.json and the current reports before dispatching replacement lanes.
Raw lane streams and prompts are kept in the user cache under
`~/.cache/beep/effect-vitest-canon/`. A report or zero exit status alone never proves
a phase gate. Update this table and the manifest together after verification.

## Verification

```sh
bun run beep goals doctor
bun run beep goals index
wc -m goals/effect-vitest-canon/GOAL.md
git diff --check -- goals/effect-vitest-canon
```
