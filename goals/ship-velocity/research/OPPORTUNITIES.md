# ship-velocity — friction & opportunity ledger

Record friction at the moment it happens (what you were doing, evidence, what would have
prevented it). Public repo: redact secrets, replace absolute home paths with `~`, drop
session/machine ids.

## 2026-08-13 — packet bootstrap

- The 9-lane fan-out's C1 archaeology lane was stopped before writing its narrative report; the
  distilled per-lane failure counts were recovered from its raw log into
  `research/c1-raw-failures.txt`. Prevention: fan-out lanes should write incremental partial
  reports, not single end-of-run files.
- `beep goals` has no scaffold/bootstrap subcommand (doctor/index/set-status only); this packet
  was hand-mirrored from ci-lane-economics. The `beep goals bootstrap` gap is already routed to
  knowledge-surface-automation Workstream E — this is a second live receipt for it.

## 2026-08-13 — this packet's own publish hit the treadmill it documents

- First `yeet publish` was refused stale-base: main advanced 3 commits during packet authoring
  and #699 touched `goals/INDEX.md` (the overlap path). Then git auto-merged INDEX plausibly but
  wrong — `beep goals index --write` post-merge corrected 2 lines the textual merge got past.
  Third receipt for the E1/E2 backlog items (publish-time regeneration + INDEX end-state); also
  a live demo of why auto-heal must regenerate, never trust textual merges of projections.
- Biome's pre-commit lane strict-parses staged `.json` research artifacts and its auto-fix
  mangled one raw model-output file; evidence files now land as fenced markdown. Prevention
  candidate: research/ artifact extensions exempt from code-parser lanes.
- Verify on this branch failed build/check with TS2307 on `@beep/shared-use-cases/PromotionGate`:
  the main merge moved `bun.lock` + subpath exports and no `bun install` followed — the known
  stale-node_modules phantom class, now with a fresh receipt. A failure capsule (A-track) should
  classify "lockfile/exports moved since last install" before blaming source.
- The same verdict's repair hint said "Inspect the OSV finding" while the OSV lane logged
  `No issues found` exit 0 — a live misattributed-composite-hint receipt (see
  `research/c7-opportunities.md` finding 3; capsule work must derive hints from the failing
  sublane, not the composite).
- Verify attempt on the third catch-up merge failed with no-location TS2589 in three unrelated
  packages (@beep/ui, @beep/box, @beep/xai) in one run — the environmental native-compiler flake
  class, live receipt for the SPEC's TS2589 class-aware arbitration item; the verdict again
  surfaced the misattributed OSV hint alongside it.
- `yeet status` on the metrics-baseline PR flagged `goals-doctor (baseline)` stale because
  `goals/ship-velocity/PLAN.md` had a newer mtime than `goals/goals-doctor.baseline.jsonc`;
  running the prescribed `beep goals doctor --write-baseline` produced zero content change —
  the gate compares timestamps, not content, so any packet-doc edit forces a no-op regen step.
  Prevention candidate: staleness gates on derived baselines should compare content hashes
  (or the doctor's finding-key set) before prescribing a regen.
- CORRECTED after an AWS-side audit (an earlier revision of this receipt called it a 2-day
  fleet wedge — wrong): there was NO fleet outage 2026-08-14→16. It was ~5h of job-level flake
  churn on 08-14 (Docgen silent-hang timeouts + genuine Coverage/TI reds → operator cancel
  waves), then ~48h of ZERO workflow_job demand over the weekend (every webhook delivered 201,
  every scale-up invocation succeeded, zero RunInstances because nothing was queued), with
  stale cancelled/red check runs on PR pages reading as "queued for 2 days". Recovery was
  plain operator re-runs on the unchanged old AMI. The real gap is observational: nothing
  distinguishes "healthy scale-to-zero idle" from "starved", and stale PR check rows
  masquerade as live state. Prevention: a queue-age probe (alarm only when a job is genuinely
  queued beyond a bound — not when idle), and monitor `--summary` labeling check rows with
  their run's age/attempt so a Friday red isn't read as a live Sunday hang. SPEC A1's watch
  stream carries both.
- Post-#718 baked-AMI activation broke every heavy lane in ~70s: the bake installs only the
  `bun` binary from the release zip (`bun-linux-x64.zip` has no `bunx`; the official installer
  creates that symlink, the bake never ran it), the setup action's baked fast path skips
  oven-sh/setup-bun (which would have created it), and the CI CLI spawns `bunx turbo ...` →
  ENOENT (main run 31968744160, all 5 heavy jobs; fleet-lane-probe 31969468654 caught it
  within 2 minutes — the canary worked). The gap: the bake proved the `bun` binary but never
  asserted the full spawn surface CI actually uses. Fixed by `ln -sfn bun .../bunx` +
  `bunx --version` proof in the bake script and a self-heal in the fast path for
  already-activated images. Pattern for A5/bake-style gates: verify the consumer's exact argv
  surface, not the artifact's existence.
- The TS2306 torn-read race recurred on PR #728 — the very PR deleting the stale tsconfig
  references — between @beep/observability and @beep/schema, a pair whose reference IS inside
  the declared dep closure (audit clean). Ordering-by-declared-deps is therefore proven
  INSUFFICIENT for this class; the writer must be something ordering cannot fence (nested
  tsc -b upstream rebuild, in-place `babel dist --out-dir dist` rewrite, or a concurrent cache
  restore into the read package's directory). Escalated to a mechanism pin-down; the permanent
  fix must remove cross-package writes, not just add ordering edges.
- Third misattributed-composite-hint receipt: PR #728's publish verdict said "inspect the Nix
  error" while the actual hosted red was Test Integration (TS2306 race). Same class as the two
  OSV receipts above — capsule hints must derive from the failing sublane.
- Stale local dist masked a hosted-only failure class during the check-lane swap: the local
  check sweep passed only because earlier builds had populated dist/, while CI's dist-less
  Check lane hit TS6305 everywhere (tsgo redirects composite-project source imports to their
  built outputs even with references cleared). Lesson for B-track parity: any lane validation
  claiming CI parity must run from the artifact state CI actually has — wipe derived outputs
  first (the cold-world script now does). Fix: check.dependsOn ^build, making the lane's
  input explicit instead of inherited from whatever a -b sub-build left behind.

## 2026-08-16 — E1 implementation

- Placing the derived-INDEX regeneration required reconstructing an undocumented invariant by
  hand: regeneration is only trustworthy after `stashUnstagedWorktree` runs, because
  `git stash push --keep-index` is what makes the worktree equal the staged tree. Anywhere
  earlier, `--staged-only` would render the index from unstaged manifest edits that are not in
  the commit — a silently wrong INDEX, the exact class E1 exists to prevent. Nothing in
  `Yeet/internal/` states that the post-stash / pre-commit window is the only point where the
  worktree provably equals the commit-to-be. Prevention: name that window in the publish
  pipeline (a comment landed with E1) and reuse it for every E3 derived-file auto-heal instead
  of each gate re-deriving it.
- The publish commit phase runs *outside* the stash-restore `Effect.ensuring` that wraps the
  post-commit phases, so any refusal between the stash and the commit strands the operator's
  unstaged residue in a stash they were never told about. Pre-existing for commit-hook failures;
  E1's new refusal had to add its own `Effect.tapError` restore rather than inherit a safe
  default. Prevention: make stash restoration a property of the whole staged-only publish scope,
  not of one sub-phase, so future pre-commit gates cannot reintroduce the leak.
- `packages/tooling/tool/cli/test/tsconfig.json` cannot compile at all: it extends the package
  config and therefore inherits `rootDir: "src"`, so every file it includes fails TS6059
  ("not under rootDir"). repo-cli test files consequently have zero typecheck coverage from any
  gate — a wrong test-kit import surfaces only as a runtime `undefined` deep inside an unrelated
  call (here, a `path.join` TypeError), not as a missing-export error. The blindspot baseline
  entry for `@beep/repo-cli` attributes the gap to `include` narrowing, which is not the actual
  blocker. Verified locally: an otherwise identical config with `rootDir: "."` typechecks the
  same file at exit 0. Prevention: fix `rootDir` in the test project before B6 counts repo-cli's
  test surface as covered; the baseline note should record the real cause.

## 2026-08-16 — E1 review wave

- The coverage ratchet is hosted-only, so a green full local proof still shipped a required-lane
  red: `yeet verify` runs `test`, never `coverage`, and PR #736's Coverage Regression lane failed
  on three `Yeet/internal/Handler.ts` floors (functions 9.8 < 10.1, lines 23.2 < 23.47, statements
  21.54 < 21.77) after 22 minutes of green local proof. The mechanism is structural, not a
  one-off: the file is ~1,460 lines at 23% coverage, so *any* uncovered orchestration line trips
  its per-file floor, and nothing local says so before the push. Direct evidence for SPEC B2
  (coverage in the local proof) — the affected-scoped lane is cheap enough to run pre-push, and
  the scoped `--affected --write-baseline` path already exists for the legitimate floor move.
- Fifth misattributed-repair-hint receipt, this time from the monitor rather than a proof capsule:
  with exactly one failing job (Coverage Regression, `95283426563`), the monitor's rerun decision
  printed "same-SHA red detected for **Check**". Check had passed. The hint names a lane the
  operator would have reran for nothing. Prevention (A7/A1 input): the rerun decision must derive
  its lane name from the failing job record it already fetched, not from a separate classifier
  pass over the check list.
- The coverage baseline writer is scoped by *package*, but a change is scoped by *file*: the
  legitimate `coverage --affected --write-baseline` run for one edited file rewrote every
  `@beep/repo-cli` entry from the local measurement, and three files nobody touched moved with it
  — `MonitorLoop.ts` lines 45.79 → 44.23 and branches 36.84 → 33.33, `CreatePackage.command.ts`
  down, `PackageShell.ts` up. Local and hosted measurement disagree by ~0.2–3 pp on those files
  (env-gated tests), so committing the whole write would have silently relaxed three unrelated
  monotonic floors to buy one intended floor move. Pruned the write by hand to the two files the
  diff actually touches. Prevention: let the writer take the touched-file set (it already takes
  `expectedPackageNames`) and leave untouched entries byte-identical, so a floor can only move
  where the diff moved code.
- Editing `standards/coverage.regression-baseline.jsonc` puts the affected-coverage planner into
  its full-repo fallback: verifying a 12-line baseline edit ran 231 coverage tasks (~10 min)
  instead of the 31 the write itself ran, and the identical check with an explicit
  `--filter=@beep/repo-cli` is ~3 min. The fallback is correct for source under `standards/`, but
  the baseline document is an input to the *gate*, not to the packages' coverage. Prevention:
  exempt the regression baseline from the full-fallback trigger, or map it to the packages whose
  entries changed — the same file-scoping fix as the receipt above.
- Review corroborated the stash-window receipt above as a live defect rather than a nit: Greptile
  flagged P1 "commit failure strands publish state" against the same window. Fixed properly rather
  than patched at the call site — `restorePublishStashOnFailure` now wraps the whole guard+commit
  window in `PublishScope.ts` (where `stashUnstagedWorktree`/`restoreStashedWorktree` already live
  and are covered), restoring on interruption as well as failure. Confirms the prevention note:
  restoration belongs to the staged-only publish scope, not to whichever sub-phase last needed it.

## 2026-08-16 — B1 implementation

- B1 (2026-08-16): two lanes took their *scope* from ambient env rather than argv, so "same
  command" would not have meant "same work". `beep lint policy` picks full-repo vs changed-file
  scope from `isCi()`, so a local replay of the required Lint Policy context would have scanned
  strictly less than hosted — in a lane with 11 recorded failures. Likewise the affected-scoped
  Check lane suppresses the two repo-wide tsgo extras that root `bun run check` carried, which
  are the only gate on Effect tsgo diagnostics in test files. Fixed by putting `--full` in the
  lane body and re-adding the extras as their own local lanes. Prevention law for the rest of
  B-track: a lane's scope must be stated in its argv, never inherited from the environment —
  otherwise argv parity is cosmetic and the audit that reads only the command lies.
- B1 (2026-08-16): `A.filterMap(xs, (x) => Option)` compiles and silently yields `[]` — effect
  v4's `filterMap` takes a `Filter` (Result-returning), not an Option-returning function. Cost a
  debug cycle on a test that reported "no lane carries the flake quarantine" when both lanes
  did. Already recorded as agent memory; worth a lint rule or a v3→v4 migration note, since the
  failure mode is a wrong answer rather than a type error.

## 2026-08-16 — A7 implementation

- Four new exported helpers were written, typechecked green by the package's own
  `bunx tsgo -p tsconfig.check.json`, and only then rejected by the same command once the
  effect language-service rules ran: `TS377101 missingPipeableSignature` on every 2+-parameter
  export (two renderers, one combinator, one Option-returning formatter). The rule is invisible
  while authoring — nothing in the editor loop, the law files, or the JSDoc pattern doc says
  "a new exported function with two or more parameters needs a data-last partner or it will not
  compile". Cost: a second authoring pass over four symbols plus their call sites and tests.
  Prevention: state the arity rule in the code laws next to the helper-form law, with its three
  standard remedies (make it module-private, curry it data-last, or `dual` it) — the remedy is
  cheap once known and expensive to rediscover.
- The test-file typecheck lane cannot be run for one package. `bunx tsgo -p test/tsconfig.json`
  from the package fails immediately with TS6059 (`rootDir` is `src`), because the real lane
  (`beep quality test-tsgo`) synthesises a per-package config with `rootDir: <repoRoot>` into
  `node_modules/.tmp/`. Reproducing that by hand was the only way to typecheck three new test
  files without running the repo-wide lane; a first attempt with the synthetic config outside
  the repo failed differently (TS2688, `bun`/`node` type roots unresolvable). It found two real
  classes immediately — `strictEffectProvide` (TS377032) on mid-effect `Effect.provide(layer)`
  and a `Ref<string[]>` vs `Ref<readonly string[]>` mismatch — so the lane is worth reaching,
  which is the argument for `beep quality test-tsgo --filter <package>` (or a documented
  scoped recipe) rather than all-or-nothing.
- `it.effect` runs under a TestClock, so every timed assertion silently hangs to the 30s vitest
  timeout instead of failing: four monitor tests wedged with no diagnostic beyond "Test timed
  out", including one whose only sleep was 30 real milliseconds. `it.live` is the fix and it is
  in the repo already (`worktree-fleet-scan.test.ts`), but nothing connects the symptom to the
  cause. Prevention: a testing-patterns line — "a test that sleeps, races, or polls needs
  `it.live`; `it.effect` gives it a clock that never advances".
- A monitor comment poll reported `Failed to poll pull request comments during yeet monitor.`
  and dropped gh's own words on the floor, so the degraded-stream line an operator sees could
  not distinguish a rate limit from a revoked token. Found only because a test asserted on the
  surfaced text. Same class as the misattributed-composite-hint receipts above: a failure that
  is *reported* to a human must carry the underlying tool's message, not just the wrapper's.
- SPEC A7's optional fifth item (Lint Policy lane success-exit hang) was already closed on main:
  `.github/workflows/check.yml` runs every lane through a `run_lane` wrapper (`setsid` + `wait`
  + process-group TERM/KILL) that landed in #718, and `bin-main.ts` already exits explicitly on
  success for all three entry paths. Re-deriving that cost a full investigation pass. Prevention:
  when a SPEC item is closed incidentally by another PR, strike it in the SPEC in that PR — the
  workflow comment cites "ship-velocity SPEC A7" but the SPEC bullet never learned about it.
  Residual gap worth its own receipt: the post-lane `Append Turbo summary` steps still invoke
  `bun run beep` directly, outside the reaping wrapper.
- Ran `bun run beep lint schema-catalog` as a pre-flight, saw it red, and regenerated
  `standards/schema-catalog.generated.jsonc` into a feature branch — a +170/-458 whole-file
  diff of which three entries were mine. Wrong call, reverted: `standards/generated-artifacts.
  policy.md` says whole-repo snapshots are refreshed only in dedicated chore PRs, that these
  gates are delta/ratchet-based, and that staleness at HEAD is not gating; the same mistake is
  already recorded there against PR #452. Confirmed the mechanics too — `schema-catalog`
  appears in no `package.json` script and nowhere in `.github/workflows/check.yml`, and the
  gating composite in `Quality/Tasks.ts:1699` carries `lint:schema-first` only. The trap is
  that `beep lint` exposes gating and non-gating scans through one uniform surface with one
  uniform exit code, so a manual pre-flight sweep of "the cheap lint gates" cannot tell which
  reds a proof actually enforces. Two preventions: have `beep lint <subcommand>` state whether
  the scan is gating (and point at the policy when it is not), and separately, the underlying
  staleness — a package deletion left `packages/drivers/box/src/experimental` entries behind —
  wants the standing `chore: refresh generated standards artifacts` PR from clean main, not a
  feature branch.
- The coverage ratchet cost two ~6.5-minute cycles for the same defect class, and neither hit
  was where the risk was expected. Both were `Option.getOrElse` fallback thunks that no test
  reaches: `replyOutcomeTarget`'s "neither handle" arm (unreachable through a decoded outcome,
  because `ReplyTargetPresenceCheck` rejects an empty target) and `yeetCheckRegistration`'s
  absent-`output` arm. Two rules made this expensive to predict: a **new** file is held to zero
  uncovered units ("no baseline file identity"), not to the package floor, so `MonitorChecks.ts`
  failed at 91.66% functions while the package's own floor is 63%; and a per-file floor at 100%
  means a single new defensive thunk is a regression. Both fixes were real tests, not floor
  moves — the first required changing `replyOutcomeTarget` to take the two handles instead of
  the whole outcome, since the schema check makes the empty case impossible to construct and
  therefore impossible to test. Prevention: say in the coverage lane's output that new files
  are held to 100%, and treat "a `getOrElse`/`orElse` thunk over a field the tests always
  populate" as the house signature of a ratchet failure — grep the diff for it before paying a
  cycle.
- **B5 has a costed case now.** Publishing A7 paid for two full ~17-minute proofs on byte-identical
  content. The second was not triggered by any source change but by `git add`: `ProofState.ts`'s
  `collectDiffFingerprint` hashes
  `sha256(git status --short ‖ git diff HEAD ‖ git diff --cached)`, so staging invalidates the
  proof three ways at once — status letters flip (`??`→`A `, `MM`→`M `), bytes leave the unstaged
  diff, and the same bytes enter the cached diff — while the resulting tree is unchanged. The
  fingerprint keys on the *staging arrangement*, not on the tree. Keying it on a tree SHA
  (`git write-tree` over the index) would have reused the proof. That is SPEC B5, and the price
  here was ~17 minutes of serialized slot time for a no-op, with three queued items waiting.
  Ordering half of the same defect: `yeet publish` refuses untracked files only *after* running
  the fallow-advisory preflight, and under `--start-pr-early` that waste sits on the critical
  path — the intent check belongs before the preflight, and the fingerprint could be taken after
  intent staging rather than before.
- Never pipe a long proof through `tail`: `bun run beep yeet verify 2>&1 | tail -50` buffers
  everything until exit, so 16 minutes of a healthy run were indistinguishable from a hang and
  the monitor armed on the log file could not fire until completion. Confirming liveness needed
  `ps`. Redirect to a file and tail the file. Same family as the existing piped-exit-code receipt.
- `yeet publish`'s operator status summary quoted a *stale* verdict: after the second publish
  attempt pushed and created PR #738, the summary printed
  `verdict: publish failure: yeet publish refuses untracked files` — the previous attempt's
  artifact — beside `checks: 28 total, 0 failing, 0 pending` from the current one. Two runs' state
  in one block, with the failure line the most eye-catching part. Sixth receipt in the
  misattributed-hint family: a summary must read the verdict written by the run it is summarizing,
  or state which run it came from.
