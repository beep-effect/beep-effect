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
- Seventh misattributed-hint receipt, and the clearest yet: a `full:pre-push` failure whose only
  red lanes were `quality:check` and `quality:check:tsgo-tests` — a single `strictEffectProvide`
  diagnostic in one test file — produced the verdict repair command *"Inspect the OSV finding and
  rerun `bun run beep quality github-checks security`"*. The security lane had passed. Six prior
  receipts in this ledger describe the same class from different lanes; at seven, the pattern is
  no longer anecdotal and the fix is A-track capsule work: the hint must be derived from the
  failing sublane, not from a fixed template.
- The same failure is also a receipt against my own process: the synthetic `test-tsgo` replica I
  ran to pre-check the test files was executed *before* the P1 regression test existed, and I did
  not re-run it after adding that test — so a gate result was carried forward onto a tree it never
  saw. `bun run beep quality test-tsgo` is in-process, takes no lock, and needs no turbo, so there
  was no reason to skip it except forgetting that a proof binds to a tree. Prevention: re-run the
  cheap in-process gates as the *last* step before publish, never as a step before the last edit.

## 2026-08-16 — C1 implementation

- Building the C1 resolver, I found the workstation's interactive shell already exports the
  full remote-read quad (`TURBO_API`/`TURBO_TOKEN`/`TURBO_TEAM`/`TURBO_CACHE=local:rw,remote:r`)
  with literal — not `op://` — credential values, while the checked-in `.env.example` listed
  only two of the four names and no checkout documents the contract. So the cache was
  *configured* and the CLI's forced `--cache=local:rw` was the only thing suppressing it; the
  C4 audit's "not enabled locally" verdict read as a config gap when it was a CLI gap. Proven
  live against the cache's status endpoint: authenticated `200`, unauthenticated `401`.
  Prevention: any env-driven capability needs its full name set in `.env.example` plus one
  operator doc at the moment it is deployed, so "is it configured?" is answerable without
  reading the consumer's source.
- **Vacuous-test receipt (15 assertions).** The same shell export made 15 existing
  `quality-tasks.test.ts` cases fail the moment the resolver went live (`expected
  --cache=local:rw, received --cache=local:rw,remote:r`). The cause is the vacuous-assertion
  class, not a behavior change: the helper *restated the production formula* in the test
  (`Bun.env.CI === "true" || A.some(args, isTurboCacheControlArg) ? [] : ["--cache=local:rw"]`,
  plus a verbatim copy of `isTurboCacheControlArg`), so each assertion compared the
  implementation against a second copy of itself. That proves nothing about the policy: it
  passes for any implementation the copy also describes, and it fails whenever the copy drifts
  — which is exactly what happened, on a machine difference rather than on a code defect. The
  suite's apparent green had been conditional on this workstation being *unconfigured*, and a
  verify launched from a configured shell would have failed for a reason unrelated to the
  change under test.
  Fix, stated honestly: the tautology was not removed from those 15 cases, it was *relocated*.
  They now derive the cache segment from the same resolver, which makes them structural
  assertions (the plan's args reach turbo, in the right position, for every lane) and
  environment-independent by construction; the policy itself is proven separately in
  `turbo-cache.test.ts`, where concrete literals are asserted against explicitly constructed
  environments with no ambient reads. Prevention, general form: a test may restate a value or
  derive it, never both-ways-at-once — derive the environment-dependent segment and assert the
  decision function against literals somewhere else. A restated formula is a second
  implementation that silently inherits every bug of the first and adds drift of its own.
  Detection idea for A5/B-track: flag test helpers whose body is a textual near-duplicate of a
  production expression (the copied `isTurboCacheControlArg` here was byte-identical).
- `withLocalEnv` in `Quality/Tasks.ts` rebuilt the op-run step from four fields and silently
  dropped `env` and `flakeQuarantine`. It was harmless only because the single `useLocalEnv`
  step today (root build) carries no `env`, and the quarantine policy is read from the
  pre-resolution step. Making more steps op-wrappable would have turned it into a real
  regression (a coverage step losing `CI=true`, or an integration step losing its
  testcontainer URI). Prevention: step transformers should copy-with-override
  (`optionalProp` over every optional field) rather than re-enumerate a subset — or the step
  model should expose a total `withCommand` helper so no call site can forget a field.
- `op run --env-file=.env` overlays the checkout's dotenv onto the child, so wrapping a step
  that carries its own `env` can silently clobber lane-critical values. There is no way to
  express "step env wins" with `op run`, so the wrapper is now restricted to steps with no
  step-specific env. Worth recording because the obvious reading of "wire op-run env for all
  Turbo steps" is unsafe as stated.
- Self-review before the proof slot caught a real defect the tests would not have: my
  `turboEnvOverrides` scrubbed `op://` credential references for *every* turbo spawn, including
  the `op run`-wrapped one. An ambient-env probe settles what the docs left implicit — `op run`
  resolves `op://` references out of the environment it is handed, not only out of
  `--env-file` (a bogus ambient reference made it fail on the vault name). So the scrub deleted
  the exact reference the wrapper exists to resolve: a checkout holding the quad as shell
  exports would have handed the wrapped turbo *no credential at all* while argv demanded
  `remote:r`. Fixed by scoping the scrub to direct `bunx turbo` spawns. Prevention: when a
  wrapper's whole job is to transform a value, the transform stage must be excluded from every
  sanitizer aimed at the untransformed form — state the pipeline stage a guard belongs to, not
  just its condition.
- The regression guard for the above was itself vacuous on the first attempt: vitest's
  `toEqual` **ignores keys whose value is `undefined`**, and this codebase uses
  `{ VAR: undefined }` as the spawner's *delete* signal. Every assertion about a scrub was
  therefore passing for both the scrubbing and the non-scrubbing implementation. Only
  `toStrictEqual` compares undefined-valued keys. Verified by mutation: with the fix reverted
  the strict assertion fails (`TURBO_TOKEN: undefined`, `TURBO_CACHE: "local:rw"` leaking into
  the wrapped spawn), where the `toEqual` form had passed. Prevention, repo-wide: any
  assertion over an env-override record that encodes deletion as `undefined` must use
  `toStrictEqual` — a lint or review checklist item, since the weaker matcher silently proves
  nothing and reads identically. Second instance of the vacuous-assertion class in one packet.
- The new-file zero-uncovered rule turned out to be satisfiable only because it was *measured*
  rather than assumed. A targeted `bunx vitest run <files> --coverage --coverage.include=<file>`
  (no turbo, no ratchet env, ~7s) reported `TurboCache.ts` at 100% on all four metrics — but the
  same probe surfaced the real exposure one file over: `EnvConfig.ts`'s new
  `isUnresolvedSecretReference(value) ? "secret-reference" : "literal"` arm is **unexecutable on
  any checkout whose credentials are literal**, and this workstation's are. It would have been a
  permanently uncovered branch added to a baselined file, invisible to every local run. Fixed by
  moving the ternary into the pure module as `turboCacheValueSourceFor(boolean)` where a test
  reaches both arms with no environment at all. Prevention, and the generalizable half: an
  environment-classifying branch belongs in a pure function that takes the verdict, never at the
  reading edge that produces it — otherwise its coverage is a property of the machine.
  Corollary worth adopting packet-wide: scoped `--coverage.include` on a single file is cheap
  enough (seconds, no lock) to run before every proof that adds a file, instead of discovering
  the floor from a hosted lane.
- Same probe, second finding: `Tasks.ts`'s run-time degradation arm was unreachable in tests for
  the same reason (its guard calls an env reader). Rather than mutate the ambient environment in
  a shared test file — fragile, because the default ConfigProvider snapshots the environment at
  the first config read — the session verdict became a *parameter* and the function got a
  `...ForTesting` export, the convention already used dozens of times in that file. That closed a
  real gap, not just a number: nothing had proven that an unwrapped step's remote posture is
  actually rewritten, or that the rewrite carries `env` and `flakeQuarantine` through. Four cases
  now do. Prevention: when a guard mixes a pure decision with an ambient read, take the read as
  an argument — testability and the coverage floor both follow for free.
- Third instance of the same species in one PR, and the one that proves it is systemic rather
  than careless: after fixing the pattern twice, `turboStepLocalEnv`'s opt-in arm still shipped
  uncovered because its guard called an env reader, and the ratchet caught it —
  `Tasks.ts` branches 63.63 vs baseline 64.48, a real regression, on the pre-verify coverage run
  the lead insisted on. Fixed identically (session verdict becomes a parameter, plus a
  `...ForTesting` export and three cases pinning both arms), which cleared it. The lesson is not
  "be careful": **any guard that reads the ambient environment inline is a coverage landmine on a
  machine whose environment happens to take one branch.** A lint rule could find these — an
  `if`/ternary whose condition transitively calls a `*Sync` config reader — and would have caught
  all three at authoring time instead of one per proof cycle.
- Reading the ratchet's failure line as a percentage comparison sends you chasing a phantom. The
  rule is a **conjunction**: "surviving files fail when a percentage drop is accompanied by more
  uncovered units" (`CoverageRegression.ts` §Gotchas). Both of this PR's runs showed a percentage
  drop on the same file — upstream's B1 and labs additions grew its denominator — and only the
  first also added uncovered units. Reported as `branches: 63.63 < 64.48`, the message names only
  the percentage half, so the obvious reading is that the percentage must be restored, which is
  neither necessary nor achievable when someone else's merge moved the denominator. Prevention:
  the failure line should print both halves — the percentage drop and the uncovered-count delta
  that made it a failure — so the remedy (cover your own new units) is unambiguous.
- A green proof log contains realistic failure text as **fixture output**, and the only reliable
  discriminator is the lane verdict line. This proof printed
  `yeet publish --push-only --reuse-verified refuses staged changes`,
  `warning: staged-only residue was NOT restored: stash pop failed`, and a bare
  `yeet monitor failed.` — every one of them E1's or A7's own tests asserting their refusal and
  degrade paths, in a run whose lanes were all `ok`. An agent or operator scanning stdout for
  trouble finds three convincing failures in a clean run; scanning for `quality:<lane>: ok`
  finds the truth. Prevention: capsule and verdict rendering should quote the lane verdict, never
  matched stdout, and lanes that deliberately emit failure prose in fixtures are the reason
  A1's watch stream must key on transitions rather than log-line matching.

## 2026-08-17 — P1 closeout

Attribution note (added after the #747 review flagged the batching): the three receipts below
were surfaced in chat during earlier P1 work — the first by the A7 worktree agent while #738's
proof held its tree, the second across the E1/#736 and C1/#743 review waves, the third by the
C1 agent refusing a bad instruction during #743 — and could not land contemporaneously because
each originating worktree was frozen under a live proof fingerprint at the time. That constraint
is itself the fourth receipt below; the batching is the symptom, not the practice.

- The ledger itself is the packet's hottest contention surface, and it is contention in *prose*,
  not code (A7's framing, carried here at closeout): every packet PR that appends to this file
  invalidates the next packet PR's base, so a queue of N packet items serializes into N base
  refreshes **regardless of code overlap**. Evidence from P1 alone: four items, each appending its
  own dated section, producing a two-way and then a three-way conflict on the same tail hunk, with
  one agent contributing three appends by itself. Two of the four PRs paid a re-merge for a
  conflict that touched none of their code. That makes it an E5 contention-family problem — the
  fix shape is per-item append targets, or a ledger generated from parts — rather than a
  merge-order problem to be scheduled around.
- Non-canonical `@category` values are a repo-wide drift class, not a per-PR slip. Three sightings
  in one session: `execution` on a new E1 export (fixed in #736, then found 5 more pre-existing
  uses in `EnvConfig.ts` / `Tasks.ts`), `resolution` ×4 on new C1 exports (fixed in #743), and
  `tasks` ×1 in `Tasks.ts`. Every instance was caught by review rather than by a gate, and each
  cost a review round trip on an otherwise-green PR. The canonical domain is already machine-
  readable (`repo-utils/src/schemas/JSDocCategories.ts`, 80 literals) and the JSDoc law already
  says to use it, so nothing prevents a check. Prevention: a codemod for the existing drift plus a
  lint rule that rejects a non-canonical `@category` on a touched export, which turns three review
  round trips into a local failure in seconds.
- The ledger's record-it-when-it-happens law collides with the proof fingerprint: a receipt
  discovered *after* a tree is staged and proven has nowhere to go, because editing this tracked
  file mid-proof mutates `git status` and both diffs — invalidating the very proof in flight (the
  B5 defect, deliberately re-run). Every batched receipt above existed in chat within minutes of
  its incident and still had to wait for a safe tree. Prevention is the same E5 fix shape: give
  receipts an untracked or per-item landing zone that a live fingerprint does not cover, then fold
  into the ledger at the next natural commit.
- A base-freshness claim sourced from a clone's `HEAD` rather than from `origin/main` sent an agent
  toward merging an unrelated branch. The orchestrator read `git log -1` in a checkout that another
  session had switched to a feature branch, reported "main moved" with that branch's tip, and
  instructed a re-merge; the receiving agent verified from the merge base, found the claim false,
  and did not act on it. No damage, purely because the instruction was checked rather than obeyed.
  Prevention, and it generalizes to every agent-to-agent hand-off in this repo: a base claim must
  cite `origin/main` explicitly (`git rev-parse origin/main`), never a working checkout's `HEAD`,
  and overlap must be computed from the merge base (`git diff --name-only <mb>..origin/main`)
  because the bidirectional `HEAD..origin/main` form lists your own commits as incoming and makes
  every branch with a commit look like a total collision.

## 2026-08-17 — success-exit hang correction (the #718 exoneration did not hold)

- The P1 record carried "the lane success-exit hang was already closed on main by the `run_lane`
  process-group reap in #718." That claim did not hold: the hang recurred on 2026-08-17 in Lint
  Policy job 95354812245 (PR #744) with #718's `run_lane` active, matching the original job
  94646234791 signature — every policy step logged green, then 29-40 minutes of silence, six
  orphaned bun processes reaped only by job cleanup. This packet's own later precision, carried
  here verbatim: the #718 facts were "true but NOT preventive — presented as exoneration when the
  stragglers sit outside run_lane's setsid pgid (spawns default detached) and the v4 spawner only
  group-reaps on interrupt/nonzero exit; the #673 success-exit is, ironically, what orphans the
  grandchildren holding the pipe write-ends." The runner-side reap also fires only after `wait`
  returns — the very call the wedged pipe blocks — so it could never fire in time.
- Root cause is a capture-lifetime seam, not a CI-wrapper gap: `runCaptured`/`runCapturedStreams`
  gate completion on pipe EOF, and EOF needs every inherited write-end closed, so a step child's
  successful exit while a straggler grandchild still holds the write end (suspected `bunx`
  resident wrapper — suspected, not proven) wedges the lane silently. Fixed at the seam in #748:
  after the child exits, a short drain grace, then a process-group reap that closes surviving
  write-ends with the captured text kept, and a loud `CapturePipeWedgedError` defect naming the
  command when a descendant escaped even the group.
- Prevention lesson for the ledger: an exoneration ("already fixed by X") is a claim about a
  mechanism and needs the mechanism check — who is in the process group, and when the reap can
  actually run — not just the plausible fact that X exists. Both confident misattributions this
  week burned exactly this way.
