# P0c Detector Lane Report

- Status: reviewable implementation handoff; orchestrator package verification pending
- Ownership: P0c detector command, schemas, registration, cheap-gate wiring, focused tests, and command-produced inventory artifacts within the user-specified path allowlist
- Model/effort: gpt-daybreak-blue-latest, xhigh (runtime provenance; escalation authorized for this lane)

## Activity log

- 2026-09-08: Lane initialized before code or document review, per lane contract.
- 2026-09-08: Continued in the same lane after deliberate review steering. Runtime provenance remains `gpt-daybreak-blue-latest`; effort is escalated from medium to xhigh with orchestrator authorization. Read `p0c-working-review.md`, `p0c-acceptance-checklist.md`, refreshed `DECISIONS.md`, and this steering section before further code.
- 2026-09-08: Correction closure is being tracked item-by-item (15 source defects and 4 fixture-oracle defects); the initial focused pass is supporting evidence only, not acceptance.

## Orchestrator steering, 2026-09-08

The initial turn was gracefully interrupted before handoff to deliver concrete
working-code and fixture-oracle corrections. Its exit 1 is an intentional
interruption, not a package-verification result.

Effort escalation: xhigh for the same lane because import provenance, callback
nesting, and incorrect negative fixtures expose correctness gaps across the
entire migration scope; medium implementation has not established the gate.

Read history/p0c-working-review.md and history/p0c-acceptance-checklist.md before
continuing. Revalidate every note against current files; some compile fixes may
already have superseded individual observations.

## Additional acceptance feedback, 2026-09-08

The orchestrator ran 15 read-only acceptance probes against unchanged detector
source hashes. Eleven passed and four failed; see history/p0c-additional-probes.md.
The lane was gracefully interrupted to receive these concrete failures and is
resuming in the same session at xhigh. The interruption exit is not a verifier
result. These four defects keep the P0c gate open.

- Progress, 2026-09-08: the unchanged independent probe now passes root-namespace Effect provenance and hoisted-function shadowing. The orchestrator receipt is 13/15; EV008 still misclassifies `it.live` sleep and EV002 still treats a locally constructed `Context.make` value as an unresolved Layer. No handoff or complete-suite claim is made at this checkpoint.
- Probe closure, 2026-09-08: added source-first recognition for local `Context.make` provisions and restricted EV008 to `it.effect` TestClock mode; retained EV009 as a separate live-justification judgment. The unchanged `p0c-independent-probes.mjs` exited 0 with `total=15, failed=0`, including root namespace, hoisting, live sleep, and Context provision cases.
- Focused-suite receipt, 2026-09-08: the first quoted-glob attempt was a selection error (`No test files found`, exit 1), so it is not acceptance evidence. The corrected single shell-expanded command `bunx --bun vitest run packages/tooling/tool/cli/test/effect-vitest*.test.ts --pool=threads --maxWorkers=1 --reporter=verbose` selected both owned files and exited 0: 2 files passed, 44 tests passed, duration 7.66s.
- Command-boundary review acknowledged, 2026-09-08: the 1,045-row pre-fix artifacts are stale; exact CLI routing, current-generation JSONL cleanup, P0a line-count parity, <=10s complete-command timing, keyed membership performance, and full exported JSDoc remain open. The earlier 59,685.2ms scan and interrupted diagnostics are failures/diagnostics, not handoff receipts.
- Persistence closure, 2026-09-08: row export now sorts owners/findings, overwrites current owners, and removes only stale `.jsonl` files after successful writes. The unchanged private refresh probe exited 0: prior owner file removed, `staleFiles=[]`, and unrelated `keep.txt` preserved. A package fixture also covers disappearance and byte-identical repeated export.
- Focused-suite refresh, 2026-09-08: after the callback-index, membership, line-count, routing, and persistence changes, the single shell-expanded command selecting every `effect-vitest*.test.ts` file exited 0 with 3 files and 46 tests passed (Vitest duration 7.65s). The direct fallback `tsc -p packages/tooling/tool/cli/tsconfig.json` is not a lane acceptance receipt: it exited 2 in 9.31s with an inherited project-reference cascade beginning in untouched packages (`TS6305` missing dependency outputs plus downstream `unknown`/implicit-any errors); no broad repair was attempted.
- Discovery correction in progress, 2026-09-08: accepted the independently reproduced `62,152`-path cause. The scanner now derives positive includes and stripped `GlobOptions.ignore` entries from the single schema-owned glob array; the shared `Glob`/`FsUtils` implementation is unchanged. A first canonical `--census` after that split reached 1,048 paths, proving routing and scope cardinality, but still took 21.54s (`scanMs=17228.4`) and is not acceptance. Profiling then found Effect structural equality over ts-morph nodes; explicit node-identity checks reduced the worst isolated file from multi-second behavior to about 178ms. Final path-set integration proof and <=10s command receipts remain open.
- Boundary refresh, 2026-09-08: the green dependency build closure (32 tasks, exit 0) supersedes the earlier missing-output environment. The direct package check must now be rerun. D9 reconciliation must retain all 1,048 live paths: 1,043 P0a rows, three authored `effect-vitest` tests, and two generated schema declaration tests. Same-extension JSONL preservation remains open because extension-only cleanup is not positive command ownership.
- Discovery and persistence fixture closure, 2026-09-08: extracted schema-driven discovery now sends only positive patterns to real `FsUtils.globFiles` and derives its `ignore` entries from the same `!` patterns. The package integration fixture builds a syntax-only `Project` from the returned paths and proves the exact included set while rejecting unrelated source, packet/stale-lab roots, and `node_modules`; the 3-file suite passed 47/47. The unchanged discovery split probe exited 0 with `count=1048`, `owners=139`, and exact worktree root. Cleanup now requires every non-empty JSONL line to decode as an `EffectVitestFinding` whose safe owner filename matches before deletion. Both unchanged persistence probes exited 0: stale generated owner rows disappeared, `keep.txt` survived, and same-extension `unrelated.jsonl` survived byte-for-byte.
- Rule-probe refresh, 2026-09-08: after member/provenance performance gating, the unchanged independent probe exited 0 with all 15/15 cases passing, including direct named aliases, root namespace imports, both lexical-shadow cases, live sleep, known Context provision, and judgment residue.
- Canonical performance checkpoint, 2026-09-08: exact routed `--census --write --rows` completed with exit 0, 1,048 files, 5,009 findings, `scanMs=5568.4`, and process wall 7.47s; the exact default ratchet then completed with exit 0, `introduced=0`, `resolved=0`, `scanMs=5929.3`, and wall 7.89s. These clear the ten-second gate at this source checkpoint; final receipts will be rerun after documentation/test closure.
- Direct-check attribution, 2026-09-08: after the orchestrator's 32-task dependency build succeeded, `bun run --cwd packages/tooling/tool/cli check` was run as required. It exits 1 before compilation because the managed sandbox denies the repo `tsgo-shim` spawning mise's Node binary (`spawnSync .../mise/installs/node/24.19.0/bin/node EPERM`) and mise cannot write its tracked-config symlink outside the allowed roots. This is an environment-only launch failure, not a TypeScript diagnostic; no source suppression or fallback success claim replaces it.
- Compiler-law closure, 2026-09-08: running the package's Effect tsgo compiler through Bun (the same compiler path without the sandbox-blocked external Node launcher) exposed and then cleared introduced diagnostics. Corrections use `EffectVitestLintError.mapError` as an Effect transformer, decode the already encoded pin JSON with `S.decodeEffect`, restore lazy `orElseSucceed`, and give exported multi-argument helpers explicit data-first/data-last signatures. The final compiler invocation exited 0 in 8.68s with no diagnostics. This is supporting semantic evidence; it does not relabel the required direct-check launcher failure as green.
- Latest boundary steering acknowledged, 2026-09-08: the restored 1,048-file discovery and row-ownership fixes remain preserved. The independently reproduced Drizzle EV007 regression, canonical `it.layer` fixture shape, and forbidden internal JSDoc example imports are now tracked as open corrections before final artifact regeneration; no stale 5,009-row baseline is claimed as final.
- EV007 optimization-regression closure, 2026-09-08: canonical imported-name normalization now applies only to bare identifier callees; a property access such as `fc.assert` retains `assert` even when an unrelated namespace import uses that local name. The package fixture covers the collision, and the unchanged Drizzle probe exited 0 with all three real plain-`it` property assertions restored (`expected=3`, `actual=3`).
- Test/doc boundary closure, 2026-09-08: the filesystem fixtures now use timeout-bounded `it.layer` suites and keep scoped temporary directories inside each `it.effect`. Supporting Policy, Store, and Syntax exports are routed through the supported `@beep/repo-cli/commands/Lint` surface, so their titled examples no longer import the package's explicitly forbidden internal subpaths. The post-change Effect tsgo compiler again exited 0 with no diagnostics.
- Complete focused-suite receipt, 2026-09-08: one Vitest command selected every `effect-vitest*.test.ts` file, the complete lint-subcommand allowlist suite, and the two changed quality-routing tests by line. It exited 0: 5 files passed, 53 tests passed, 186 intentionally unselected tests skipped, duration 19.70s. This supersedes every earlier subset/selection receipt; the discovery path-set fixture, all EV positive/negative fixtures, row persistence, cheap-gate composition, and dependency-free routing checks are included.
- Independent-probe refresh, 2026-09-08: all unchanged private scripts exited 0 against the final detector snapshot. The rule probe reports 15/15; row refresh removes the vanished package; row ownership preserves both `keep.txt` and unrelated JSONL byte content; discovery reports the matching worktree root, 1,048 paths, 139 owners, and 34.9ms glob time; the Drizzle collision probe reports all 3/3 EV007 findings.
- Lint/JSDoc receipt, 2026-09-08: Biome checked the explicit 17-file owned source/test set with exit 0 (`Checked 17 files ... No fixes applied`). The package-scoped docgen gate initially exposed malformed one-line metadata, an invalid `filesystem` category, and an incorrect LiteralKit example; each was repaired at the owning declaration. `bun run docgen:local -- --package @beep/repo-cli` then exited 0, parsed all 229 modules, found 1,530 examples, typechecked them, and reported `Docs generation succeeded`. The remote-cache warning and read-only cache-write warning did not change the successful task exit.
- Final command-artifact receipt, 2026-09-08: after the canonical `assertNone` correction, two consecutive exact routed commands `bun run beep lint effect-vitest --census --write --rows goals/effect-vitest-canon/ops/inventory/detector` exited 0 and command-produced the same census, baseline, and package rows from 1,048 files / 5,012 findings. Scanner/process measurements were 6,705.6ms/8.61s and 6,504.3ms/8.43s. The exact default command then exited 0 with `introduced=0`, `resolved=0`, `scanMs=6346.9`, and wall 8.34s.
- Ratchet-growth receipt, 2026-09-08: an owned temporary test added one plain-`it` `Effect.runSync` instance. Against the then-current 5,013-row pre-idiom baseline, the exact default command discovered 1,049 files / 5,014 findings and exited 1 with exactly `1 new finding(s)` in 7.21s wall. The temporary file was removed through the patch boundary; the next exact default returned to clean membership and exit 0. The later routing-assertion canon fix removed one unrelated EV006 baseline row, leaving the final 5,012-row baseline; no temporary source or temporary artifact remains.
- Final fixture-proof refresh, 2026-09-08: added the explicit rc.112 mismatch failure and flaky-wrap reason boundary. The Effect tsgo compiler exited 0; the single focused Vitest command exited 0 with 5 files / 54 passed / 186 intentionally skipped; package docgen again exited 0 after typechecking 1,530 examples; all five unchanged private probes exited 0 (15/15 rule cases, both row cases, 1,048-path discovery, and 3/3 Drizzle assertions); final Biome checked all 17 explicit files with no fixes.
- Deterministic final artifacts, 2026-09-08: after the last test edit, two consecutive exact `--census --write --rows` commands both exited 0 and produced the same SHA-256 across the baseline, census, and 121 row files (`88c5902fc580a69a8a819a8bbef3b0996d572fbcd0f486fadcae9dda925edcf1`, 123 artifacts). The second run measured `scanMs=6504.3` and process wall 8.43s. The final exact default ratchet exited 0 with `introduced=0`, `resolved=0`, `scanMs=6346.9`, and process wall 8.34s.
- Final-source verification closure, 2026-09-08: the complete focused command exited 0 with 55 passed / 186 intentionally skipped; all unchanged private probes exited 0 (15/15 rules, both row-persistence contracts, 1,048 paths / 139 owners, and Drizzle 3/3); the Effect tsgo compiler exited 0 with no diagnostics; and Biome checked all 17 affected files with no fixes. The final baseline contains zero EV006 evidence rows for the new `effect-vitest` routing assertion.

## Orchestrator boundary update: JSONL ownership

The new cache-only `p0c-row-ownership-probe.mjs` preserves the earlier refresh
expectations and adds an unrelated JSONL record from another producer. It exits 1:
`unrelatedJsonlPreserved=false`. The cleanup deletes that file during the first
export. Read the appended output-ownership section in p0c-boundary-review.md and
run this unchanged probe before handoff. Fix cleanup to use positive ownership
evidence, preserve other JSONL, and add the regression to the owned package tests.
The earlier text-sentinel pass did not establish same-extension file safety.

## Orchestrator dependency-build preparation

The orchestrator is running the package-verifier's upstream build closure,
`bun x turbo run build --filter=@beep/repo-cli^... --concurrency=3`, to address
missing referenced build outputs before authoritative package verification.
It builds dependencies, not repo-cli. Status and raw output are in the private
cache as `p0c-build-closure-status.json` and `p0c-build-closure.log`. Defer final
performance acceptance until that build is terminal; interim scans share load.
This preparatory build does not replace the exact full package-verify command.

The upstream build closure is now terminal and green: 32 tasks succeeded, exit 0,
16.806 seconds. Its status receipt is in the named cache file. The independent
post-build path probe now finds 1,048 D9 matches: the previous 1,045 plus your
new store test and two generated schema `dist/internal/test/*.d.ts` files. The
exact delta is in `p0c-post-build-scope-probe.json`. Reconcile this actual build
state rather than narrowing D9 globs to force the pre-build count. Keep generated
declaration additions distinct from newly authored tests in the report.

## Orchestrator performance review candidate

`importedBindingMatches` currently invokes `isShadowed` before comparing the
requested member. Consequently an imported `Effect.succeed(...)` can walk its
lexical scopes repeatedly for unrelated EV rule predicates such as `runSync`,
`provide`, and `sleep`. Check cheap module/local/member identity first, then do
the lexical-shadow query only for an otherwise matching candidate; preserve all
alias and hoisting semantics. A per-file binding/node cache is another option.
This is a source-level profiling candidate, not a claimed measured speedup.

## Orchestrator artifact-cost isolation

A direct run of the real Store helpers against the existing 5,025-row baseline
and a fresh cache-only output root took about 99 ms to read/decode, 120 ms to
encode/format/write the baseline, and 104 ms to write all package JSONL: 322 ms
total, exit 0. Private script: `p0c-artifact-cost.mjs`. This makes storage alone
an unlikely explanation for the canonical command's long run. Keep measuring
root resolution, workspace owner discovery, glob discovery and scan separately.

## New-test canon reminder

The current store regression test supplies NodeServices through per-test
`provideScopedLayer`. The P0c acceptance checklist requires newly authored tests
to satisfy the packet's idioms too. Use `it.layer` for the fixture services and
keep the temporary directory scoped to the individual `it.effect` test. Apply
that review to the new discovery fixture as well. The conformance-subject D14
exception is specifically for P0.5, not a general exemption for these tests.

## Baseline-delta regression: namespace import collides with member name

The orchestrator compared the old 5,025-row baseline to the new 5,009-row output.
EV008's 16 removed live-sleep rows agree with the corrected rule, but three EV007
rows disappeared from `packages/drivers/drizzle/test/Drizzle.errors.test.ts`.
They are real `fc.assert(fc.property(...))` calls inside a plain `it` callback.
The unchanged private `p0c-drizzle-regression-probe.mjs` exits 1: expected 3,
actual 0. Its per-call checks show `inTest=Some`, `assertMatch=true`, and
`propertyMatch=true` for all three.

Cause: the cheap `canonicalMember` prefilter looks up the property name `assert`
as though it were a bare imported identifier. This file also has
`import * as assert from "@effect/vitest/utils"`, so `fc.assert` becomes `*`
and is skipped. Only normalize imported aliases for a bare identifier callee;
property-access members must retain their actual member name. Add a minimal
fixture with both imports, retain direct named-function alias coverage, rerun
the unchanged Drizzle probe, and regenerate the baseline. More findings are
expected after restoring these missed instances.

Also check new JSDoc imports such as
`@beep/repo-cli/commands/Lint/internal/EffectVitestSyntax`: package.json explicitly
sets `./commands/Lint/internal/*` to null. Use a valid supported import in examples
and prove them with package docgen; do not open a forbidden package export just
to make an example resolve.

## Handoff outcome

P0c is implemented and reviewable. The canonical `beep lint effect-vitest`
command now routes through the dependency-free lint fast path and supports all
four requested modes: default membership ratchet, `--census`, `--write`, and
`--rows <dir>`. The final command-produced state contains 1,048 source files,
5,012 schema-valid findings, and 121 per-owner JSONL files. The command verifies
the installed `@effect/vitest` version is exactly `4.0.0-rc.112`; the focused
fixture proves a mismatched version fails with `EffectVitestLintError` and no
fallback.

This is a syntax-only ts-morph implementation. It constructs
`Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true })`,
adds only the discovered D9 paths, and never calls a type checker, `getType`, or
symbol-resolution API. The single scope definition remains
`EffectVitestSourceFileGlobs` in `Lint.schemas.ts`; scanner discovery separates
its positive entries from `!` exclusions and passes the stripped exclusions to
`GlobOptions.ignore` without changing shared `Glob` or `FsUtils`.

P0c intentionally supplies built-in rule hints plus the annotated
`EffectVitestPrimitive` shape only. It does not create a partial
`standards/effect-vitest.primitives.jsonc`. The complete graph document, graph
decoder/lookup integration, and enriched hints remain P0d.

## Census reconciliation

| Measure | Corrected P0a | Final command census | Exact delta |
| --- | ---: | ---: | ---: |
| Tests | 964 | 967 | +3 authored detector tests |
| Support | 79 | 81 | +2 generated schema declarations |
| Total paths | 1,043 | 1,048 | +5 |
| Containing workspace owners | 139 | 139 | 0 |

All 1,043 P0a paths remain present. There are no removed paths, no owner
mismatches, and no kind mismatches. Nested fixture/SDK manifests are not treated
as workspaces. The five additions are exactly:

- `packages/tooling/tool/cli/test/effect-vitest-contract.test.ts` — authored test,
  `@beep/repo-cli`, 7,529 bytes / 186 physical lines.
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts` — authored test,
  `@beep/repo-cli`, 8,648 bytes / 204 physical lines.
- `packages/tooling/tool/cli/test/effect-vitest-store.test.ts` — authored test,
  `@beep/repo-cli`, 2,550 bytes / 60 physical lines.
- `packages/foundation/modeling/schema/dist/internal/test/Markdown.test-kit.d.ts`
  — generated support, `@beep/schema`, 354 bytes / 14 physical lines.
- `packages/foundation/modeling/schema/dist/internal/test/Yaml.test-kit.d.ts`
  — generated support, `@beep/schema`, 306 bytes / 14 physical lines.

The only common-path byte delta is the owned routing assertion in
`quality-tasks.test.ts` (+272 bytes and +3 P0a-reported lines). The census
defines an actual physical-line convention: empty text is 0, a non-empty
unterminated final line counts once, and a terminal newline does not invent
another empty line. Tests
cover empty, one-line unterminated, multi-line unterminated, and terminal-newline
inputs. The consolidated P0a file has a known mixed capture convention: 936
newline-terminated `packages/**` rows include a phantom terminal line and are
therefore exactly one greater than the final physical count; P0a `apps/**` and
`infra/**` rows agree with the physical convention. The remaining line delta is
the intentional +3 P0a-reported lines in `quality-tasks.test.ts` (four physical
lines added after accounting for P0a's terminal-line phantom). This mismatch is
reported rather than hidden by narrowing scope or special-casing path families.

The real FsUtils integration fixture compares exact path sets, not cardinality
alone. It includes app/package tests and a package test-support module, and
excludes an unrelated source file, packet path, stale-lab root, and
`node_modules`. The unchanged discovery probe independently reports the exact
worktree root, 1,048 matches, 139 owners, and a final 24.0ms glob phase. Support
modules participate only in EV003 wrapper-definition detection; test-body rules
are filtered out after parsing.

## Finding and persistence contract

`EffectVitestFinding`, `EffectVitestPrimitive`, replacement, census, scan timing,
and the separate SPEC 5.4 package timing document are annotated `S.Class`
models. Internal closed domains use `LiteralKit`; optional boundary fields use
`OptionFromOptionalKey` and encode as omitted JSON keys. Finding validation
accepts EV001–EV015 and `L-RES`/`L-FLAKE`/`L-PROP`/`L-OBS` identifiers, requires
positive ordered lines, finite confidence in 0..1, evidence at most 200
characters, and a non-empty reason for exception and `flaky-test-wrap` rows.
Fixtures prove exception and flaky reason rejection/acceptance and preservation
of an existing reason after a line shift.

Finding display identities retain the documented readable prefix and add syntax
disambiguation:

```text
${ruleId}:${file}:${line}:${symbol}@${zeroBasedColumn}#${sameFingerprintOrdinal}
```

The column identifies a node for review; the ordinal prevents duplicate IDs
when equivalent same-rule nodes share a line. Membership deliberately excludes
line and column but retains rule, file, symbol, class, compact evidence, and the
occurrence ordinal. Consequently unrelated source shifts do not create growth,
while repeated same-line occurrences remain distinct. A substantive evidence or
context change is intentionally treated as changed membership. Keys are
precomputed before calling the shared `diffMembership({ current, baseline,
equivalence, order })`; exception lookup is a keyed `HashMap`, avoiding repeated
key construction while preserving the shared ratchet API.

The final baseline has 5,012 unique IDs and no duplicates: 4,574 detector rows
and 438 honest judgment rows. Current live counts are:

| Rule | Rows | Rule | Rows | Rule | Rows |
| --- | ---: | --- | ---: | --- | ---: |
| EV001 | 1,397 | EV006 | 2,394 | EV011 | 165 |
| EV002 | 102 | EV007 | 393 | EV012 | 3 |
| EV003 | 213 | EV008 | 1 | EV013 | 5 |
| EV004 | 59 | EV009 | 130 | EV014 | 1 |
| EV005 | 2 | EV010 | 147 | EV015 | 0 |

EV015 has no live candidate in the present tree, matching P0a reconnaissance;
its rule metadata, replacement ID, positive/negative fixtures, nested-layer
predicate, and independent positive probe are nevertheless present. The 121
JSONL files contain exactly the same 5,012 unique identities as the baseline.
Two consecutive final exports produced the identical SHA-256 across all 123
artifacts (baseline + census + rows):
`88c5902fc580a69a8a819a8bbef3b0996d572fbcd0f486fadcae9dda925edcf1`.
The sorted baseline-ID and JSONL-ID streams also share the same SHA-256,
`3fbc28b9fcce8c9cca4878e8200145c771daf24f1606537962c415c74ce4650d`.

Rows are sorted by owner and identity. Output owner names pass through the
existing safe artifact-name helper. Current-generation cleanup deletes a stale
JSONL only when every non-empty record schema-decodes as an Effect Vitest
finding and its encoded package owns that exact safe filename. The package test
and unchanged probes prove package disappearance, unrelated text and unrelated
JSONL preservation, and byte-identical repeated export.

## Exact rule predicates and known limits

| Rule | Predicate / mechanization | Built-in replacement and known limit |
| --- | --- | --- |
| EV001 | Mechanical imported `Effect.runPromise`, `runSync`, or `runFork` inside plain, effect, or live test callbacks. Named, renamed, module namespace, root `effect` namespace, `it`/`test`, `.each`, `.skip`, and layer callback testers use import provenance plus lexical shadow checks. | `it.effect`. Syntax-only hoisted function/var/parameter shadowing is respected; dynamically rebound or re-exported runners are not guessed. |
| EV002 | Mechanical `Effect.provide` in effect/live tests when the final argument is syntactically non-pure; an unresolved local/imported constructor becomes a Resource judgment. Local constructor bindings are chased. `Layer.succeed`/`Layer.mock` and pure merges are permitted, as are known `Context.make`/`empty`/`add`/`merge` values. | `it.layer`. Higher-order/imported constructors stay judgment residue rather than asserted layer semantics. |
| EV003 | Mechanical `withXyz` definitions/calls whose local named function, const arrow, or `Effect.fn`/`fnUntraced` callback contains resource construction; missing definitions at a registered root become Resource judgments. Pure data transforms such as `withStatus` are ignored. | `it.layer`. The wrapper-name convention is intentionally `with[A-Z]`; opaque imported wrappers are judgment rows only when used as test roots. |
| EV004 | Whole-body `Effect.scoped` in effect/live callbacks is mechanical; a shorter nested scope is retained as a lower-confidence Resource judgment with the precise scoped call as evidence. | `readme.resource-safety`. The detector never tells callers to delete shorter deliberate lifetimes. |
| EV005 | Mechanical `Effect.result` used by an enclosing `expect`, including a locally bound result later passed to `expect`. | `utils.assertExitSuccess`. Custom outcome consumers are not inferred from names. |
| EV006 | Mechanical `expect` whose subject or matcher arguments contain provenance-verified Option, Result, or Exit guards/constructors. | `utils.assertSome` (the hint directs callers to the matching utility). Alias-aware utility alternatives remain negative fixtures. |
| EV007 | Mechanical provenance-verified FastCheck `assert(property(...))` or `assert(asyncProperty(...))` in plain/effect/live tests. Bare import aliases are normalized, while property members such as `fc.assert` retain their identity even if another import is named `assert`. | `it.effect.prop`; the hint explicitly preserves configured `fcRuns` floors. Wrapper-composed properties outside this direct AST shape remain outside mechanical certainty. |
| EV008 | Mechanical `Effect.sleep` or `Schedule.spaced`/`fixed`/`exponential`/`recurs` inside an `it.effect` callback when that same callback has no `TestClock.adjust`/`setTime`. `it.live` sleep is excluded. | `readme.testclock`. Clock driving hidden behind another function is not semantically followed. |
| EV009 | Judgment on `it.live` when its callback has no proven live `Clock`, root `Console`, or `TestClock.withLive` call. `Effect.log` alone is intentionally a positive finding; a test name mentioning Console carries no weight. | `it.effect`. Live service necessity is semantic, so the row remains judgment. |
| EV010 | Judgment for raw Node fs/fs-promises, `node:os` with `tmpdir`, or platform Node/Bun module imports. | `it.layer` / MemoryFileSystem review. Generic `FileSystem` from `effect` is explicitly not a finding; each platform import is only a candidate. |
| EV011 | Mechanical plain `vitest` import in a file that also imports Effect. | `module.@effect/vitest`. Files without Effect provenance are not migrated by this rule. |
| EV012 | Judgment for provenance-verified `vi.mock`/`vi.spyOn` targeting Effect/@beep module strings or a local class extending `Context.Service`/`Effect.Service`. | `Layer.mock`. Whether a spy is the correct seam remains semantic. |
| EV013 | Judgment for classic `for`, `while`, or `do` loops inside a test when loop syntax carries attempt/retry state names or an imported `Effect.sleep`. | `it.flakyTest`, with the built-in hint requiring root-cause work and a reason. Arbitrary domain loops and string/comment mentions do not match. |
| EV014 | Judgment for `it.layer` whose layer expression is syntactically resource-bearing (`Layer.scoped`/`effect`/`unwrap`/`launch`, Effect acquisition, or nested resource arguments) and whose options omit `timeout`. | `it.layer.option.timeout`. The resource shape is known, but whether the hook needs a timeout is semantic, so this is not asserted as mechanical. |
| EV015 | Judgment for `TestClock.adjust` inside an enclosing `it.layer` when neither the same test nor a layer `beforeEach` calls `TestClock.setTime`. The harness index tracks the inner test and outer layer separately. | `it.layer.option.excludeTestServices`. Cross-helper clock resets are not inferred. |

No rule uses raw-text proximity as provenance. Strings, comments, unrelated
shadowed names, module fixture construction, and subject APIs that happen to
share a method name remain negative cases. The syntax-only boundary necessarily
leaves higher-order and imported semantic relationships for the Resource,
Property, Flake, and Observability lenses.

## Working-review closure: 15 source items

1. **Named/root/renamed imports and shadows:** closed by the binding collector,
   lexical cache, hoisting-aware scope lookup, package fixtures, and independent
   named/root/parameter/hoisted probes.
2. **Plain EV001/EV007 callbacks:** closed; the primary positive fixtures use
   plain `it`/`test`, and both independent cases pass.
3. **EV006 matcher arguments:** closed for Option, Result, and Exit; both subject
   and matcher arguments are traversed and dedicated fixtures pass.
4. **EV003 definitions:** closed for function declarations, const arrows, and
   Effect function wrappers; pure transforms stay negative.
5. **Nested EV015 containment:** closed by the per-file harness index, which
   independently resolves inner tests and outer layer callbacks.
6. **EV010 generic FileSystem false positive:** closed; only raw/platform imports
   enter the judgment predicate, and the unchanged generic service probe passes.
7. **EV013 loop syntax:** closed using `for`/`while`/`do` nodes plus retry state or
   sleep provenance; an ordinary `for..of` subject loop is negative.
8. **Shared finding boundary:** closed for EV and lens IDs, ordered lines,
   exception reasons, flaky-wrap reasons, bounded evidence/confidence, and
   encoded optional keys.
9. **Timing shapes:** closed with separate `EffectVitestScanTiming` and the exact
   SPEC 5.4 reporter-derived package/file/slowest shape.
10. **D9 scope:** closed with all extensions/test-support paths in one schema
    definition, 1,048 exact command paths, and no generic build/dist exclusion.
11. **Export documentation:** closed with useful titled examples and final
    package docgen proof over 229 modules / 1,530 examples.
12. **Code-law defects:** closed. Owned source has no `new Error`, native Object
    helpers, `any`, unsafe assertions, or type-checker API. Typed errors, schema
    codecs, Effect FS/Path services, and helper modules are used; compiler and
    Biome receipts are green.
13. **Shift-resistant identity:** closed by the documented membership key and
    fixtures for line shifts, preserved reasons, and same-line ordinals.
14. **Shared diff API:** closed using the real `diffMembership` order/
    introduced/resolved contract; growth and resolution fixtures exercise it.
15. **Repository-root storage:** closed through `findRepoRoot` and root-relative
    schema-owned artifact paths; the exact root CLI command is the artifact
    producer.

## Fixture-oracle closure: four items

1. **EV009 oracle:** `it.live` used only for `Effect.log` is a positive judgment;
   a provenance-verified root Console call is the negative. Names do not decide.
2. **Pinned APIs:** TestClock fixtures import `effect/testing/TestClock`, and the
   driven-clock example uses the rc.112 `Effect.forkChild` shape. The mismatch
   pin fixture also proves the version guard.
3. **Missing behavior matrix:** fixtures now cover plain runners/properties,
   aliases and lexical shadows, matcher arguments, arrow/Effect.fn wrappers,
   nested layer clock adjustment, real retry loops, Context provision, and the
   unrelated `assert` import collision.
4. **Short scope oracle:** whole-body EV004 is asserted mechanical and shorter
   lifetime EV004 is separately asserted as judgment; no required residue was
   hidden to make a negative green.

## Command-boundary review closure

- The dependency-free `LintRouting.ts` allowlist now includes `effect-vitest`.
  The exact canonical root command visibly routes to
  `packages/tooling/tool/cli/src/bin.ts -- lint effect-vitest ...`, and the full
  allowlist/help/dependency-free suite passes.
- `cheap-gates:effect-vitest` sits immediately after
  `cheap-gates:schema-first` in the existing GitHub/Yeet gate source with argv
  `bun run beep lint effect-vitest`; no parallel registry was introduced.
- The 62,152-path discovery defect is closed by include/ignore separation at the
  scanner boundary. Shared glob utilities remain untouched. Exact path-set
  integration and private discovery probes pass.
- Stale package rows and same-extension unrelated-file deletion are closed with
  positive producer ownership. Both private persistence probes and package
  fixtures pass.
- The FastCheck property-member optimization regression is closed. The unchanged
  Drizzle probe observes all 3 expected findings, and full output restores
  EV007=393. The same fix also retains the real EV008 DuckDB effect-test sleep
  while keeping all live sleeps excluded from EV008.
- Filesystem tests use timeout-bounded `it.layer` suites and keep temporary
  directories scoped to individual `it.effect` tests. No `provideScopedLayer`
  remains in the new suites.
- Every supporting example imports the supported
  `@beep/repo-cli/commands/Lint` surface; no forbidden internal package export
  was opened.

## Verification receipts

| Verification | Final outcome |
| --- | --- |
| Focused tests | `bunx --bun vitest run packages/tooling/tool/cli/test/effect-vitest*.test.ts packages/tooling/tool/cli/test/lint-subcommand-allowlist.test.ts packages/tooling/tool/cli/test/quality-tasks.test.ts:762 packages/tooling/tool/cli/test/quality-tasks.test.ts:5449 --pool threads --maxWorkers=1 --reporter=verbose` — exit 0; 5 files, 55 passed, 186 intentionally unselected/skipped, 13.00s Vitest duration. |
| Independent detector probes | Unchanged `p0c-independent-probes.mjs` — exit 0; 15/15. |
| Persistence probes | Unchanged row-refresh and row-ownership scripts — both exit 0; stale owner gone, text and unrelated JSONL preserved. |
| Discovery/Drizzle probes | Unchanged discovery split and Drizzle scripts — both exit 0; 1,048/139 and 3/3 respectively. |
| Effect tsgo compiler | `bun tools/tsgo-shim/tsgo.js -p packages/tooling/tool/cli/tsconfig.check.json` — final exit 0, no diagnostics, 10.81s process receipt. |
| Changed-file lint | Biome over the explicit 17 owned/affected source and test files — exit 0; `Checked 17 files in 1240ms. No fixes applied.` |
| Package JSDoc | `bun run docgen:local -- --package @beep/repo-cli` — exit 0; 229 modules, 1,530 examples, example typecheck and docs generation succeeded. Remote-cache/read-only cache warnings were non-fatal. |
| Final full writer | Two consecutive exact `bun run beep lint effect-vitest --census --write --rows goals/effect-vitest-canon/ops/inventory/detector` runs — both exit 0 at 1,048 files / 5,012 findings; scanner/process walls 6,705.6ms/8.61s and 6,504.3ms/8.43s. Both meet the ≤10s full-command gate and produce the identical 123-artifact digest. |
| Final default ratchet | Exact `bun run beep lint effect-vitest` — exit 0; introduced 0, resolved 0, scanner 6,346.9ms, process wall 8.34s. |
| New-instance rejection | Temporary owned plain-`it` `Effect.runSync` fixture — exact default exit 1 with exactly one new finding, 1,049 files / 5,014 findings, wall 7.21s against the pre-idiom 5,013-row baseline. After patch deletion the default returned clean; the later unrelated EV006 canon fix establishes the final 5,012-row baseline. The file does not remain. |
| Dependency build | Orchestrator-owned upstream build closure — 32 tasks, exit 0, 16.806s. |

The required direct package command was also run after that green dependency
closure: `bun run --cwd packages/tooling/tool/cli check`. It exits 1 before the
compiler starts because the managed sandbox denies the tsgo shim spawning the
mise Node binary (`spawnSync .../node EPERM`) and mise cannot update its external
tracked-config symlink. This is an environment-only launcher failure. It is not
reported as a green direct check and was not blindly rerun. The final direct Bun
invocation of the same Effect tsgo compiler is green as recorded above.

An earlier diagnostic that selected the entire existing
`quality-tasks.test.ts` suite observed 17 inherited environment failures from
its git-spawning fixtures returning exit 128 (221 passed / 17 failed). That run
was not used as acceptance evidence. The final single focused command selects
both changed quality assertions, the complete dependency-free routing suite,
and every effect-vitest suite; it is the quoted green test receipt.

Full `quality package-verify @beep/repo-cli` was not run in this lane, per the
contract. The orchestrator owns that authoritative handoff gate.

## Changed-path inventory

This list comes from the lane's edit log and command targets, not from git.

Implementation and registration:

- `packages/tooling/tool/cli/src/commands/Lint/EffectVitest.ts`
- `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestDetectors.ts`
- `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestPolicy.ts`
- `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestScan.ts`
- `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestStore.ts`
- `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestSyntax.ts`
- `packages/tooling/tool/cli/src/commands/Lint/Lint.schemas.ts`
- `packages/tooling/tool/cli/src/commands/Lint/Lint.errors.ts`
- `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts`
- `packages/tooling/tool/cli/src/commands/Lint/index.ts`
- `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts`
- `packages/tooling/tool/cli/src/internal/cli/LintRouting.ts`

Tests:

- `packages/tooling/tool/cli/test/effect-vitest-contract.test.ts`
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts`
- `packages/tooling/tool/cli/test/effect-vitest-store.test.ts`
- `packages/tooling/tool/cli/test/quality-tasks.test.ts`

`packages/tooling/tool/cli/test/lint-subcommand-allowlist.test.ts` was exercised
but did not require an edit: its existing exact registration/help and
dependency-free assertions automatically cover the new allowlist member.

Command-produced artifacts:

- `standards/effect-vitest.inventory.jsonc`
- `goals/effect-vitest-canon/ops/inventory/test-files.json`
- `goals/effect-vitest-canon/ops/inventory/detector/` — the complete current
  generation of 121 package JSONL files.
- `goals/effect-vitest-canon/history/lanes/p0c-detector.md`

No test-utils, primitive-graph file, global config, dependency, lockfile,
coverage artifact, unrelated test, or other packet document was edited. The
temporary ratchet probe was deleted and is not part of the changed set.

## Remaining phase boundary

The orchestrator must still run the authoritative full package verification and
record its receipt. After P0c, the full KG and graph-backed hint loader remain
P0d; the instrumented `it` implementation remains D7/later work; the repository
migration, per-package before/after timing collection, lens audits, Grok rounds,
PR slicing, hosted checks, and PR merge gates all remain pending. In short: the
full KG, instrumented `it`, migration, and PR gates remain pending; this lane
does not claim any of them.

## Final new-code idiom check

The newly added routing assertion in `quality-tasks.test.ts` uses
`expect(O.isNone(parseQualityTaskInvocation(["lint", "effect-vitest"]))).toBe(true)`.
It adds an EV006 finding in the freshly generated baseline. Apply D5 to this new
line with `assertNone` from `@effect/vitest/utils`; keep the unrelated pre-existing
assertions for P2. Regenerate the baseline after the focused routing check. The
three newly authored effect-vitest test files themselves have no mechanical
findings; their two EV010 rows are honest native-filesystem judgment candidates.

## Final idiom correction progress

The new routing assertion now uses rc.112's canonical `assertNone` helper from
`@effect/vitest/utils`; the neighboring pre-existing P2 assertions remain
unchanged. The complete focused selection is green on that source state: 5 test
files, 55 passed, 186 skipped, exit 0. Two exact writer runs regenerated the
baseline at 5,012 findings, removed the introduced EV006 row, and produced the
same artifact digest. The exact default ratchet then exited 0 with no membership
delta, so the preceding orchestrator note is closed.
