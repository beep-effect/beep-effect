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
