# ship-velocity — friction & opportunity ledger

Record friction at the moment it happens (what you were doing, evidence, what would have
prevented it). Public repo: redact secrets, replace absolute home paths with `~`, drop
session/machine ids.

## 2026-09-02 — replacement accepted an incomplete secret reference

- **Doing:** closing the automated review of the remote-cache reference replacement mode.
- **Evidence:** review showed that the helper accepted any value with an `op://` prefix, so an
  incomplete path could replace a working configured token and fail only during later resolution.
- **Would have prevented it:** validate the documented `op://vault/item/field` structure before
  any `.env` creation or replacement and cover the no-modification failure path directly.

## 2026-09-02 — two provisioning passes preserved the wrong cache reference

- **Doing:** proving the final cache credential against its infrastructure source before repeating
  the fleet sample.
- **Evidence:** digest-only comparison showed that the infra-vault read-only item still matched the
  SSM source, while the main checkout and the alternate reference in another live root resolved to
  a different February item that predates the AWS cache. The sanctioned helper had intentionally
  left every nonblank `TURBO_TOKEN` untouched, so two provisioning passes preserved the stale
  reference. No value was rendered.
- **Would have prevented it:** make reference correction an explicit helper mode that compares a
  nonblank token reference with the intended source and reports only sanitized prior state.

## 2026-09-02 — a legacy root stored the resolved cache token

- **Doing:** classifying non-reference `TURBO_TOKEN` state before applying the fleet repair.
- **Evidence:** one dormant legacy root held a resolved value in its ignored `.env`. A value-
  suppressed digest matched the February developer item, not the SSM-backed read-only item. The
  replacement helper reported only `raw value (not shown)` and wrote the canonical reference.
- **Would have prevented it:** validate that every checkout token starts with `op://` during
  provisioning and offer a safe replacement path instead of relying on manual `.env` edits.

## 2026-09-02 — an unrelated reference blocked the all-file cache preflight

- **Doing:** running the exact output-suppressed `op run --env-file=.env -- true` preflight in
  every root from the frozen cache sample.
- **Evidence:** one live root exited 1 because a non-cache reference in the same `.env` names a
  field absent from its item. The all-file wrapper failed before the artifact GET or Turbo spawn,
  while a TURBO-only subset returned 200 and restored all eight first-touch tasks remotely. The
  run's scope allowed only `TURBO_*` edits in sibling roots, so the unrelated line was preserved.
- **Would have prevented it:** hand `op run` only the four references the remote-read lane needs,
  or preflight each reference and name the offending variable without values. Retain the whole-
  file wrapper as a separate environment-health check.

## 2026-09-02 — another zsh special parameter broke a read-only inventory

- **Doing:** checking whether frozen live roots had `node_modules` before their sequential cache
  probes.
- **Evidence:** the loop used `modules` as a scalar name; zsh rejected it as read-only before any
  install or probe ran. The packet already recorded the same class for `path` and `status`, but the
  known-danger list did not include this name.
- **Would have prevented it:** run portable inventory snippets under Bash and consistently use
  task-specific names such as `modules_present`, rather than maintaining an incomplete list of zsh
  special parameters.

## 2026-08-31 — 1Password MCP IPC failed while the exact CLI wrapper worked

- **Doing:** authorizing the final remote-cache canary after the 1Password MCP server appeared in
  a fresh Codex task.
- **Evidence:** the MCP server was registered and its tools loaded. Authentication first reported
  that the desktop app was not running, then returned `IPC request failed` after the desktop
  process appeared. The output-suppressed `op run --env-file=.env -- true` wrapper succeeded in
  the same checkout, and `beep cache probe` reached Turbo with remote caching enabled.
- **Would have prevented it:** make the MCP relay report whether the failure is client approval,
  desktop readiness, or relay transport, and add a bounded reconnect after the desktop process
  starts. Keep the exact output-suppressed wrapper as the runtime proof because MCP and CLI
  authorization are separate paths.

## 2026-08-31 — Turbo rendered forbidden remote reads as cache misses

- **Doing:** checking the repaired CLI session against the final isolated remote-cache sample.
- **Evidence:** `beep cache probe` reported eight misses and a broader targeted lint canary
  reported 35 more while both said `Remote caching enabled` and emitted no authentication
  warning. An authorization-only GET for a known hosted artifact and a current lint artifact
  returned HTTP 403 under the same injected read token. No token or reference was rendered.
- **Would have prevented it:** make the cache probe distinguish 401/403 authorization failures
  from 404 cache misses, and require one authenticated artifact GET before treating an all-miss
  run as evidence that the remote namespace is merely cold.

## 2026-08-31 — the first cache-recovery dispatch had no heavy runner

- **Doing:** populating the current-generation Turbo hashes after Turbo reported 43 first-touch
  misses and no remote hits.
- **Evidence:** the repository's `Cache Warm` recovery workflow had no prior runs. Manual run
  `33437433334` queued on exact `main` with the `beep-ec2-heavy` label, but GitHub still reported
  no assigned runner, no pending environment approval, and zero registered runners with that
  label after 18 minutes. It was cancelled before consuming a runner after the direct HTTP 403
  proved that warming could not repair the rejected reader.
- **Would have prevented it:** continuously test the scale-from-zero path with the shipped lane
  probe, and alarm on genuine queued age when no matching runner registers. The recovery workflow
  should expose whether its webhook was accepted, a scale-up was requested, or provisioning
  failed before registration.

## 2026-08-31 — post-merge review forced a successor final-evidence PR

- **Doing:** cleaning up PR #937 after its merge and preserving the initiative completion gate.
- **Evidence:** PR #937 merged at `2026-08-31T11:11:45Z` without the cache receipt, lifecycle and
  P5 status flip, or updated reflection. Two actionable Codex review threads posted eight minutes
  later. One identified that the merged PR could no longer receive its declared closeout artifacts;
  the other corrected this ledger's description of goals-doctor staleness.
- **Would have prevented it:** keep an evidence PR unmerged while it names future same-PR
  artifacts, and wait for every enabled review channel to reach a terminal state before the merge.

## 2026-08-31 — a zero-finding goals baseline clears only local mtime staleness

- **Doing:** clearing Yeet's stale goals-doctor gate after updating the observation receipt.
- **Evidence:** `yeet status --remote` reported that `goals/goals-doctor.baseline.jsonc` was older
  than the observation file and instructed `bun run beep goals doctor --write-baseline`. The
  command rewrote the zero-finding baseline without a content diff, advancing its filesystem mtime.
  The next Yeet closeout reported no staleness. This clears the current checkout, but Git does not
  record the refreshed witness, so a later checkout can reconstruct unrelated mtimes and repeat the
  verdict.
- **Would have prevented it:** store a source fingerprint or tracked witness in the baseline. If
  the local mtime check remains, its repair message should say that an identical rewrite refreshes
  only the current checkout and may not survive a checkout.

## 2026-08-31 — a zsh loop variable erased command lookup

- **Doing:** checking whether concurrent packet edits still had an open writer before preserving
  them on the PR branch.
- **Evidence:** a zsh loop used `path` as its iterator. In zsh, the special `path` array is tied to
  `PATH`, so the assignment replaced command lookup and the same shell reported `stat` and `git`
  as not found. A later workflow-cancellation poll reused the read-only special parameter
  `status`; it printed the successful cancellation result, then exited on assignment. Neither
  command made a repository change.
- **Would have prevented it:** reserve zsh's special parameter names in agent shell snippets, use a
  task-specific name such as `target_file` or `run_state`, or run portable snippets under Bash
  explicitly.

## 2026-08-31 — reference resolution did not prove cache authentication

- **Doing:** running the final authenticated remote-read sample across a freshly frozen set of
  live checkouts.
- **Evidence:** the output-suppressed `op run --env-file=.env -- true` preflight resolved the
  existing references, and the configured endpoint and team matched the live repository
  variables. The canary `beep cache probe` nevertheless reported `Remote caching unavailable
  (Authentication failed)`. Sanitized control-plane metadata showed that the authoritative AWS
  read-token parameter was updated on 2026-08-12, while the referenced 1Password item was last
  updated in February. No secret value or reference path was printed, copied, or stored.
- **Would have prevented it:** add a rotation-time mirror verification and read-only service
  canary to the operator workflow. The timestamp difference suggests mirror drift, but does not
  prove a value mismatch or its cause. Reference resolvability should be reported separately from
  successful remote-cache authentication.

## 2026-08-30 — scoped goal doctor invocation no longer matches the CLI

- **Doing:** validating the packet after merging current `origin/main` into PR #929.
- **Evidence:** `bun run beep goals doctor goals/ship-velocity` exited with `Unexpected positional
  argument: "goals/ship-velocity"`; the supported repo-wide `bun run beep goals doctor` then
  checked 168 packets with zero blocking or advisory findings.
- **Would have prevented it:** document the repo-wide-only command contract, or accept an optional
  packet path when operators need scoped validation.

## 2026-08-30 — same-checkout proofs could race shared verdict artifacts

- **Doing:** closing PR #929 after current-version same-origin proofs became weighted-capacity
  peers.
- **Evidence:** hosted review found that two tickets for the same checkout could both admit when
  tokens fit. Those commands share branch-scoped `state.json` and `verdict.json` artifacts, so a
  later success could overwrite a concurrent failure even though sibling checkouts are safe to
  overlap.
- **Would have prevented it:** include checkout identity in the admission exclusion tests while
  preserving same-origin concurrency across distinct roots.

## 2026-08-30 — duplicate dotenv assignments made blank repair destructive

- **Doing:** reviewing the reference-only helper used to prepare the final remote-cache sample.
- **Evidence:** the helper inspected the first assignment but rewrote every matching line when
  that first value was blank. If a later assignment was configured and effective for a consumer,
  blank repair silently replaced it.
- **Would have prevented it:** reject duplicate cache names before any `.env` mutation and test
  that the original file remains byte-for-byte unchanged.

## 2026-08-30 — the packet's scheduler probe no longer matches the CLI

- **Doing:** following the goal packet's required lane-contention probe before package
  verification.
- **Evidence:** `bun run beep quality scheduler status` exited before the chained verification
  because the current command requires `--json`. The packet still names the flagless form.
- **Would have prevented it:** keep the packet instruction synchronized with the CLI usage
  contract, or retain a compact human-readable default for `scheduler status`.

## 2026-08-30 — fallback coverage omitted cross-origin contenders

- **Doing:** closing the final PR after the proof-lock retirement and same-origin concurrency
  changes reached hosted review.
- **Evidence:** Greptile's P1 review on PR #929 found that the below-envelope fallback path was
  derived from each repository origin. Two heavyweight proofs for different origins could
  therefore bypass machine-wide serialization. The existing fallback test used one origin twice.
- **Would have prevented it:** assert that distinct origin lock paths contend for one fixed
  machine-wide fallback lock whenever weighted admission is unavailable.

## 2026-08-30 — the first repair attempt left no terminal command receipt

- **Doing:** running the canonical `beep yeet repair` before publishing the replacement closeout
  branch.
- **Evidence:** the observation handle disappeared while the first attempt was running the 952-file
  test-source typecheck. A process-table audit found no surviving process rooted in this checkout;
  the two live typechecks belonged to other checkouts. Yeet had no verdict or closeout artifact,
  and the worktree remained unchanged, so that attempt ended without a durable exit record. A
  fresh retry later recorded terminal success; it does not supply the missing first-attempt receipt.
- **Would have prevented it:** persist a phase-level terminal attempt row independently of the
  calling transport, or attach repair to a run scope whose finalizer records interruption after
  the client handle disappears.

## 2026-08-30 — post-merge closeout work outlived its published branch

- **Doing:** resuming the final ship-velocity closeout and checking whether its accumulated local
  implementation was already durable on a remote branch or `main`.
- **Evidence:** the checkout still tracked the branch used by merged PR #895, while its current
  head was 13 commits ahead of `origin/main`; no remote ref contained that head. The work was
  locally committed and recoverable, but was not protected by an open PR or remote branch.
- **Would have prevented it:** after a PR merges, require continued packet work to move to a fresh
  closeout branch before accepting another commit, and make Yeet warn when a local head advances
  on the branch of an already-merged PR.

## 2026-08-30 — a same-checkout proof started while the closeout was still being edited

- **Doing:** recording the missing-remote-branch receipt while another agent process prepared the
  same checkout for full verification.
- **Evidence:** the full proof started 54 seconds before the ledger edit. The proof later reported
  a dirty worktree while running its affected lanes, even though it had captured the earlier tree
  at admission. The scheduler coordinated machine capacity but did not reserve the checkout for
  edits.
- **Would have prevented it:** add a per-checkout edit/proof ownership check before admission, or
  require the proof runner to verify the worktree fingerprint before each affected planning wave
  and stop as soon as it changes.

## 2026-08-30 — the fixed cache sample drifted from the live fleet

- **Doing:** resolving the exact checkout set for the final authenticated remote-read sample.
- **Evidence:** the packet's post-repair sample contains 11 fully provisioned roots. An earlier
  fleet scan classified seven roots as live, only two of which appeared in that sample. The final
  preparation scan at `2026-08-31T02:45:59Z` classified 16 roots as live; four appeared in the
  historical sample, 12 did not, and nine needed one or more missing cache-reference fields
  provisioned before authentication. The packet still called the historical 11 roots active.
- **Would have prevented it:** store the sampled root identities with the observation receipt and
  recompute a named live-fleet delta before closeout, instead of carrying an unlabeled root count
  forward as current state.

## 2026-08-30 — local publish proof changed base after the PR preview was fixed

- **Doing:** running the exact-commit full proof after Yeet created PR #892 early to avoid more
  queue-driven base churn.
- **Evidence:** the hosted merge preview, based on `main@f1383148c6`, passed Coverage Regression.
  The still-running local proof refreshed `origin/main` after another PR merged, then reported
  coverage drops only in three untouched Yeet internals. All 2,583 CLI tests passed, and the
  hosted coverage context on the published head was green.
- **Would have prevented it:** pin every publish-proof comparison to the PR base OID captured at
  publish start; refresh remote refs for visibility without changing the semantic base mid-run.

## 2026-08-30 — base fast-forward left the ignored goal projection stale

- **Doing:** repeating the CLI package audit after merging the latest `origin/main`.
- **Evidence:** 2,582 tests passed and one goal-bootstrap determinism test failed because the
  ignored local `goals/INDEX.md` still rendered the pre-merge packet distribution while the merged
  manifests rendered a different active, paused, and retained distribution.
- **Would have prevented it:** refresh ignored generated projections from the new base in the
  post-merge hook, or make hermetic package tests isolate themselves from an optional checkout-local
  projection.

## 2026-08-30 — publish discovered base overlap after local acceptance proof

- **Doing:** publishing the main-push parity repair after package verification, cheap gates, and
  the authoritative affected lane passed.
- **Evidence:** Yeet refused before committing because `origin/main` advanced by two commits after
  the branch was cut. One upstream commit replaced the same brittle command-count assertion in
  `quality-tasks.test.ts`, so the branch required an explicit merge and another proof cycle. A
  subsequent refresh immediately after that repeat package proof found a third queued PR already
  merged, requiring another base refresh before publish.
- **Would have prevented it:** refresh and overlap-check the base immediately before starting the
  last expensive local acceptance lane, while retaining the publish-time stale-base refusal as the
  final safety gate.

## 2026-08-30 — scheduler probe command drifted from the live CLI

- **Doing:** probing the machine-wide Yeet admission lane before starting the post-merge
  observation work.
- **Evidence:** the goal's operator instruction says to run
  `bun run beep quality scheduler status`, but the live command exited 1 with
  `Missing required flag: --json`.
- **Would have prevented it:** keep the operator instruction in sync with the command schema, or
  let `scheduler status` default to its human-readable view when `--json` is absent.

## 2026-08-30 — fleet snapshot is too large for observation sampling

- **Doing:** selecting active sibling checkouts for the representative-week cache sample.
- **Evidence:** `bun run beep worktree fleet --json` originally emitted 32,786 characters for 78
  checkouts, including full policy-movement path lists. At closeout it exceeded the command
  transport's 131,072-byte capture limit for 91 checkouts, and the JSON was cut mid-string. The
  bounded text renderer plus an `awk` liveness filter was required to recover the 16 live roots.
- **Would have prevented it:** add a compact mode or liveness filter that returns checkout path,
  branch, liveness, and dirty count without the policy path inventory.

## 2026-08-30 — cache dashboard cannot sample a symlinked time window

- **Doing:** building a post-merge-only cache dashboard from existing Turbo summaries without
  copying raw receipts into the goal packet.
- **Evidence:** eight checkouts had summaries whose `execution.startTime` fell inside the window,
  including one with 55 files. `beep cache dashboard --runs-dir <filtered-directory>` reported
  `runFiles: 0` when that directory contained symlinks to the selected summaries.
- **Would have prevented it:** add `--from` and `--to` filters to `cache dashboard`, or document
  that the runs directory must contain regular files and that symlinks are ignored.

## 2026-08-30 — attempt journal lacks a terminal row

- **Doing:** counting post-merge publish retries and classifying contention-family causes.
- **Evidence:** the branch-scoped attempt journals contained five publish starts after the window
  opened but only four publish terminal rows. The scheduler snapshot had no active lease, so the
  unmatched attempt could not be classified as success, failure, interruption, or contention.
- **Would have prevented it:** write an explicit interrupted or abandoned terminal record from the
  attempt finalizer, and expose unmatched starts in `yeet status` or a bounded metrics command.

## 2026-08-30 — active worktrees missed remote-cache provisioning

- **Doing:** classifying the four active checkouts whose post-merge cache sample was local-only.
- **Evidence:** 30 ordinary, enabled, non-forced `check` summaries were local-only. Three active
  worktrees had no per-checkout remote-read configuration; one sibling clone had an incomplete
  four-name configuration with a blank team field. Every sampled revision contained the shipped
  implementation and used the current repo CLI, so neither stale code nor a script bypass caused
  the result. No secret values or raw 1Password data were inspected.
- **Would have prevented it:** make worktree bootstrap provision the read-only reference posture,
  reject present-but-blank fields, and run the sanitized dry plan before the first cacheable task.

## 2026-08-30 — package-scoped coverage used the slow default worker profile

- **Doing:** repairing the one introduced per-file coverage regression found by the baseline audit,
  using the documented package-scoped ratchet instead of rerunning coverage for all 135 packages.
- **Evidence:** `bun run coverage -- --filter=@beep/repo-cli --summarize` passed the ratchet but
  took 10m53s to run 143 files and 2,702 tests. The full coverage fallback had completed the same
  repo-cli suite in 5m49s with an explicit two-worker cap.
- **Would have prevented it:** make scoped coverage reuse the weighted full lane's worker policy,
  or print the selected Vitest worker profile so package-only verification does not become slower
  than its full-shard counterpart.

## 2026-08-27 — C2 workflow posture outran credential provisioning

- **Doing:** proving that the same-repository pull-request remote-read decision was live before
  closing the cache workstream.
- **Evidence:** `gh secret list --repo beep-effect/beep-effect` reported `TURBO_TOKEN` but no
  `TURBO_READ_TOKEN`, while the pull-request workflow expressions select only
  `secrets.TURBO_READ_TOKEN`. The current expressions therefore degrade safely to local-only, but
  do not enact the recorded C2 decision.
- **Would have prevented it:** make the decision-note checklist include a sanitized live metadata
  probe for every referenced variable/secret name, and keep the funded post-lane Actions-cache
  fallback active until that probe is green. No secret values were requested or printed.
- **Follow-on:** the encrypted SSM-to-GitHub pipe encountered `Your session has expired`; the
  downstream CLI accepted the empty pipe and briefly created an empty secret. The command checked
  secret-name metadata immediately and removed that new secret, restoring the prior absent/fail-
  closed state. Prevention: resolve and validate the upstream authentication command separately,
  then guard the pipe with a non-empty byte-count check without ever rendering its contents.
  The normal AWS browser authorization restored the session; a length-only probe then guarded the
  encrypted SSM-to-GitHub pipe, and secret-name metadata confirmed `TURBO_READ_TOKEN` exists. The
  raw value was never printed or written to the checkout.

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
  toward merging an unrelated branch. The handoff relied on `git log -1` in a checkout that another
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

## 2026-08-17 — A1 PR-2: the registration gap the sibling surface had already solved

- Pre-publish adversarial review of the capsule/dispatch PR confirmed a P1 inherited from the
  merged watch-stream PR (#751): a zero-check OPEN snapshot ends the watch as a green
  `all-terminal` with exit 0. `gh pr checks` answers "no checks reported" for seconds after any
  push, so a watch started (or a push landing mid-watch) inside that window reported a green
  settle while the wave's checks were about to run — and PR-2's dispatch would additionally
  retire the superseded wave record on that same tick. The classic monitor had this exact law
  already (A7: "zero-checks-yet ≠ terminal-empty", `YEET_CHECK_REGISTRATION_BACKOFF`, ~95s of
  patience), and the stream PR's own docstring *claimed* an upstream registration backoff that
  did not exist on its path. Fixed in PR-2 with a bounded in-loop patience (10 consecutive
  zero-check polls at the 10s interval) mirroring the monitor's budget.
- Prevention, two shapes: (1) when a new surface replaces an old one, its guard inventory must be
  diffed against the old surface's laws — the registration backoff was a named constant one file
  away; (2) a docstring that assigns a responsibility "upstream" is a claim about a mechanism and
  needs the same mechanism check as an exoneration — name the call site that implements it or
  implement it where the claim lives.

## 2026-08-17 — A2 PR-1: the per-file coverage ratchet is only probeable by the full lane

- What was happening: landing the `yeet inbox` CLI (PR #759). The new-file coverage ratchet
  (`no baseline file identity` → every new file needs near-total coverage) failed four times,
  and each attempt cost a full `beep ci lane coverage` run (~11 min local, ~14 min hosted)
  because nothing cheaper evaluates the ratchet's per-file verdict.
- Evidence: hosted job 95500703836 (first red), then local lane runs coverage-lane2/3/4/5 in
  this session's scratchpad; the passing run compared 127 packages to adjudicate 4 files.
  A fifth round-trip came from proving a fix on a tree that then changed (the `CommandStdinSource`
  rework landed after the green lane run — proof binds to the exact tree, and the hosted rerun
  caught the drift).
- What would have prevented it: a `beep quality coverage-probe --filter=@beep/repo-cli
  --files <changed>` that runs the package's vitest coverage once and evaluates ONLY the
  ratchet's per-file rules against the changed set (the ratchet compare is already pure —
  `CoverageRegression.ts` — it just has no entry point below the full lane). Sub-minute
  feedback instead of four ~11-minute loops; also makes "re-verify after any source edit"
  cheap enough that stale-tree proofs stop being tempting.

## 2026-08-24 — B9: the coverage lane's dominant failure class was self-inflicted

- What was happening: a sweep of 150 PR runs of `check.yml` (08-17 → 08-24) to explain why
  Coverage Regression tops churn. It fails 25.7 % (35/136), median 542 s, p90 811 s, 53 % of all
  lane failures and the sole red lane in 28/35; the next-worst lane fails 5.2 %. Zero infra
  failures — every red is ratchet content, and 34/35 were full-fallback runs.
- Evidence: of 15 failed jobs read, 7 were env-divergent per-file floors, five of them on
  `internal/cli/EnvConfig.ts` with three different floor sets (77.77 / 85.18 / 85.71 functions)
  minted on three branches. Mechanism, reproduced locally: `.env` carries
  `TURBO_TOKEN="op://…"`, `isUnresolvedSecretReference` classifies `op://` as unresolved, and
  the `turboCacheValueSource` lambda runs only when a `TURBO_*` value is non-empty — so a
  workstation (op:// or a resolved literal) and a main push (literal token) measure 88.05 lines /
  85.71 functions while PR jobs (blank quad, `check.yml:130-133`) measure 86.56 / 82.14. The
  ratchet's own remediation string (`coverageRegressionRegenerationCommand` → repo-wide
  `bun run coverage:baseline:write`) tells agents to regenerate locally, which mints the
  unattainable row; 39 baseline commits in 90 days, each a `COVERAGE_FULL_INPUT_FILES` hit
  costing the 9–15 min full shape. Controlled runs (`bun run coverage -- --filter=@beep/repo-cli`
  with the quad blanked) reproduce the hosted PR row to the decimal (86.76 / 92.85 / 82.14 /
  86.56, uncovered 151, 434, 496-509), and 266 of 269 comparable repo-cli files match hosted
  exactly — the other two (`Qa/Judge*.ts`) changed on main after the base commit. A "node 24 vs
  26 changes V8 branch denominators" hypothesis (memory note on `BunResolver.ts` 53.57 vs
  41.79) was refuted by the same run: local node 26 reports 41.79, identical to hosted node 24.
  Proof on the shipped tree: three consecutive `bun run coverage -- --filter=@beep/repo-cli`
  runs with a literal token, an `op://` reference, and a blank quad in the ambient environment
  produced identical per-file rows for all 482 measured files; `EnvConfig.ts` reads
  100 / 97.61 / 100 / 100 in every posture (one untested arm at `turboEnvOverrides`, the
  team-only-unresolved spread), and the ratchet passed each time.
- What would have prevented it: (1) B9 — pin the PR posture into the coverage env and make the
  reader pure, shipped with this receipt; still open, in order of payoff: (2) PR scope includes
  dependents (`CoverageScope.ts` selects direct owners only — #780's `@beep/md` change turned
  main red on `@beep/pandoc-ast` for 7 pushes); (3) the baseline writer holding every row it
  did not measure for a changed owner — landed the same afternoon as #795 (DECISIONS.md
  2026-08-24, complementary: #795 contains the writer, B9 removes the divergence it was
  containing); what remains is pointing `coverageRegressionRegenerationCommand` at the scoped
  invocation instead of the repo-wide one; (4) a comparator policy decision
  (new files held to the package tier, package regression requiring `uncovered` to rise, 4-dp
  floors) recorded in `standards/architecture/DECISIONS.md`; (5) B4 publish-time coverage only
  after (1)–(3), or it produces false greens on exactly this class.

## 2026-08-24 — B10: the pull-request coverage scope could not see the row it broke

- What was happening: executing step 2 of the coverage-lane plan (dependents in PR scope)
  after B9 removed the self-inflicted floor class. The remaining inherited-red class came from
  the planner's direct-owners-only selection (`CoverageScope.ts`): #780 changed `@beep/md`,
  measured `@beep/md` alone in 110 s, went green, and `main`'s full run then failed on the
  dependent `@beep/pandoc-ast` — 7 red `main` pushes and 3 inherited PR reds until #783 hand-
  fixed the row.
- Evidence: a closure census over the live workspace graph (132 packages, 128 coverage owners;
  edges = every workspace name in the four `package.json` buckets, root excluded) shows the
  shape the planner must handle: 25 owners have no dependents, 48 have 1–2, 26 have 3–5,
  9 have 6–10, 9 have 11–25, 4 have 26–50, and the seven foundation packages (`types`,
  `identity`, `fc-runs`, `utils`, `data`, `schema`, `test-utils`) close over ≥111 of 128.
  `@beep/md` alone closes over 17 dependents (1,472 s of planner weight, including
  `@beep/repo-cli` at 720 s and `@beep/professional-desktop` at 279 s), so "just add the
  dependents to the `--filter` list" would have handed one Turbo invocation at
  `--concurrency=4` and uncapped Vitest workers a set the hosted memory ceiling was never
  proven against. The width guard therefore routes selections above 300 s of planner weight
  (every one of the 45 hosted scoped jobs in the B9 sweep finished under 300 s wall-clock on
  the single-invocation path) through the full lane's prebuild-plus-capped-shard executor.
- Proof (local, `CI=true`, `TURBO_SCM_BASE=HEAD`, one dirty source file each): a `@beep/nlp`
  touch selected 8 owners (7 dependents, 311 s) → `coverage:selected` prebuild once (39 tasks,
  0.33 s, fully cached) then 8 concurrent shards of 6–42 s, ratchet `ok: compared 8
  package(s)`, about one minute wall-clock; a `@beep/openai-compat` touch selected 3 owners
  (`venice-ai`, `xai` as dependents, 37 s) and stayed one `turbo run coverage --concurrency=4`
  invocation, ratchet `ok: compared 3 package(s)`. The live planner probe also confirmed the
  target: a `@beep/md` source path now selects 18 owners including `@beep/pandoc-ast`; a
  `@beep/schema` test path selects only `@beep/schema`.
- Friction, three receipts: (1) the first live proof silently planned `full` because the
  dirty tree also held the planner's own source files (all `COVERAGE_FULL_INPUT_*`) and an
  untracked probe script inside `packages/tooling/tool/cli/` — a dirty checkout is part of the
  changed-file set, so every proof of this planner must run from a committed tree with exactly
  one dirty path; (2) the second attempt planned `full` on
  `standards/architecture/DECISIONS.md: no current workspace owner` — a decision-log edit is
  documentation and belongs in `COVERAGE_NOOP_PREFIXES` alongside `docs/` (step 7 of the plan,
  now with a concrete path); (3) the repository root (`@beep/root`, path `.`) sat in the shared
  owner inventory with a `coverage` script and a workspace dependency, which would have made it
  a dependent of nearly everything and recursed into the aggregate task — caught by reading
  `discoverWorkspacePackages` before trusting the inventory, not by a test.
- Would have prevented it: a planner probe subcommand (`beep quality coverage plan --files …`)
  that prints the scope for hypothetical paths without a run, and a `COVERAGE_NOOP_PREFIXES`
  entry for `standards/` non-baseline documentation.
- Still open after B10: adoption on a scoped `--write-baseline` stays the direct owners, so a
  dependent's legitimate drop is fixed by hand-pinning the row (decision deferred to the
  comparator-policy step); the seven foundation packages still cost a near-full run on any
  source change, which is correct but makes step 7's no-op widening and step 4's comparator
  rules the next wins.

## 2026-08-25 — B11: the ratchet pointed every drop at the repo-wide writer

- What was happening: step 3 of the coverage-lane plan. After B9 (deterministic runtime) and
  B10 (dependents in scope), the remaining self-inflicted cost was the regeneration loop
  itself: the ratchet's failure output named no fix at all, and the only command an agent could
  find was the baseline header's `bun run coverage:baseline:write` — a 128-package run to change
  one row — whose resulting baseline commit was then a global input that forced the 9–15 minute
  full fallback on the PR. 39 baseline commits in 90 days, each paying twice.
- Evidence: the scoped write path already existed and was never advertised — a `--filter`/
  `--affected` run with `--write-baseline` merges exactly the rows it measured
  (`CoverageRegression.ts` scoped branch of `writeCoverageRegressionBaseline`). B10's own PR
  demonstrated the loop: adding covered branches to `CoverageScope.ts` dropped its branch
  percentage 92.85→92.1 with the same three uncovered arms, and the fix was two tests, not a
  regen; nothing in the output said which of the two to do or how.
- Proof (local, `CI=true`, `TURBO_SCM_BASE=HEAD`, committed tree, one dirty file): editing
  only `@beep/pandoc-ast`'s baseline row (lines floor 85.21→100, uncovered 127→0) planned
  `coverage:affected: standards/coverage.regression-baseline.jsonc changed only the row(s) for
  @beep/pandoc-ast; measuring those instead of the full workspace`, ran one package in 24.5 s
  of turbo time, and failed the ratchet with the new block:
  `remediation: … bun run coverage -- --filter=@beep/pandoc-ast --write-baseline`. A
  `standards/architecture/DECISIONS.md`-only edit planned `no coverage-bearing inputs changed`.
- Friction, two receipts: (1) `compareCoverageRegressionSnapshotsForTesting` is `dual(3)` — a
  two-argument call silently returns the data-last function, and a fixture with unchanged
  `uncovered` counts is a "deletion", not a regression, so the first remediation test asserted
  on a function and then on an empty result before the fixture carried an uncovered rise;
  (2) `standards/` mixes 25 executable policy inputs (`*.jsonc` baselines and inventories that
  tests read) with 28 Markdown files, so the no-op rule had to be a suffix rule, not a prefix.
- Would have prevented it: a remediation line on day one of the ratchet — every other gate in
  the lane prints its repair command; and a planner probe subcommand (still the top ask from
  B10) to see the scope a hypothetical change set gets without running it.
- Still open: step 4 (comparator policy — the percentage treadmill that bit B10, and whether
  new files are held to the package tier), step 5 (B4 publish-time coverage), 6 (laws text),
  7 (remaining no-op prefixes: `.claude/`, `scripts/`, root config files).

## 2026-08-27 — A2 continuation: structural discovery missed the live Yeet path

- What was happening: the required CodeGraph-first queries for the inbox hooks and merge-ready
  policy returned unrelated thread/domain symbols, and the first targeted source search used a
  lowercase `commands/yeet` path even though the live directory is `commands/Yeet`.
- Evidence: `codegraph explore` did not surface `Inbox.ts`, `Remediation.ts`, or `Status.ts` for
  the named Yeet questions; the targeted `rg` then failed with `No such file or directory` for
  the lowercase path before an `rg --files` inventory found the capitalized directory.
- What would have prevented it: CodeGraph routing that prioritizes exact named files and symbols,
  plus a generated command-area inventory (or case-insensitive path suggestion) for repo-cli.

## 2026-08-27 — B4: package check script is not a root script

- What was happening: after adding the CI-parity planner and merge-preview runner, the first
  compile probe used `bun run beep:check` from the repository root.
- Evidence: Bun exited immediately with `Script not found "beep:check"`; the script exists only
  in `packages/tooling/tool/cli/package.json`, while the root exposes the broader `check` command.
- What would have prevented it: package handoff documentation that prints the exact package-scoped
  command next to each workspace path, or a root dispatcher for package-owned `beep:*` scripts.

## 2026-08-27 — Full docgen paid the whole graph before reporting local export annotations

- What was happening: closeout ran `bun run docgen:local`, but the changed root `turbo.json`
  correctly escalated the predicate to full. The resulting 136-package cold pass ran for 3m29s
  before repo-cli reported that the new Cache and Atlas exports lacked `@since 0.0.0`.
- Evidence: the full run completed 122 of 127 scheduled tasks and failed only
  `@beep/repo-cli#docgen`; the focused package rerun reported the missing annotations and passed
  in 18 seconds after they were added.
- What would have prevented it: a cheap changed-export annotation preflight before the global
  Turbo docgen graph, or docgen's existing module checker exposed as a no-render package command
  that `docgen:local` runs before deciding affected versus full.

## 2026-08-27 — A missing optional plugin script blocked every agent tool call

- What was happening: while the reviewer panel was finishing, every shell and coordination call
  across the active sessions began failing before the requested command ran because an enabled
  Cognee hook referenced a vanished cached script.
- Evidence: even `pwd` failed with `python3: can't open file
  '~/.codex/plugins/cache/cognee/cognee/1.5.0/scripts/store-to-session.py'`; the plugin cache
  directory contained no remaining implementation to invoke. A temporary no-op compatibility
  shim at that exact stale path restored the terminal so the initiative proof could continue.
- What would have prevented it: atomically replace plugin cache versions only after hook targets
  are present, and make optional asynchronous memory-capture hooks fail open without cancelling
  the primary tool call. The plugin manager should also detect a hook whose target disappeared
  and disable or repair that hook as one transaction.

## 2026-08-27 — A lint subcheck looked like an aggregate positional argument

- What was happening: the closeout attempted `bun run beep lint roadmap`, intending the dedicated
  roadmap validator. The CLI instead ran the full lint group and forwarded `roadmap` to Turbo,
  which failed with `Could not find task roadmap` even though the separately scheduled
  `lint:roadmap-refs` step reported zero blockers and zero advisories.
- Evidence: the aggregate launched 26 lint steps, then failed its generic `lint` child on the
  nonexistent Turbo task; the same run's named roadmap validator was green.
- What would have prevented it: expose named lint subchecks as real nested commands (or reject
  unknown positional arguments before starting the aggregate) and print the exact invocation in
  validation output and packet handoffs.

## 2026-08-27 — Scheduler status unexpectedly required JSON output

- What was happening: the documented pre-proof inspection command
  `bun run beep quality scheduler status` was used to check machine-wide admission before
  starting validation.
- Evidence: the command printed its help and exited nonzero with `Missing required flag: --json`;
  rerunning `bun run beep quality scheduler status --json` succeeded and reported the live
  capacity, leases, and queue.
- What would have prevented it: make `--json` optional as the help text implies and render the
  existing human-readable status by default, or document the JSON flag as required everywhere
  the scheduler status command is prescribed.

## 2026-08-27 — Focused test arguments were sent to Turbo instead of Vitest

- What was happening: a focused repo-cli regression run used
  `bun run test --run <test-files>`, matching Vitest's argument shape.
- Evidence: the root test dispatcher appended `--run` and every file path before Turbo's
  pass-through separator. Turbo rejected `--run` four times before any test started.
- What would have prevented it: reject Vitest-only flags in the root dispatcher with the exact
  package-scoped command, or place focused arguments after Turbo's `--` separator automatically.

## 2026-08-27 — Scheduler admission blocked the early PR push

- What was happening: `yeet publish --start-pr-early` committed the change, then requested the
  five-token merged-preview lease before running its early push or creating the PR.
- Evidence: the next output after `start-pr-early: pushing before local proof` was
  `admission: waiting`, with the push still absent while unrelated proofs held four tokens.
- What would have prevented it: keep the clean-HEAD preflight, push, and PR creation outside the
  proof coordinator. Acquire scheduler admission immediately before the heavyweight proof phase.

## 2026-08-28 — Thread steering terminated an admitted proof

- What was happening: a Yeet proof had completed the cheap gates, build, and lint and was still
  running in the foreground when a new thread instruction arrived.
- Evidence: the foreground command was terminated during `lint-policy`; the scheduler lease was
  released, but the completed output could not be resumed or accepted as a terminal proof.
- What would have prevented it: run admitted proofs behind a resumable process handle whose
  receipt survives thread steering, so a later turn can reattach without repeating passed work.

## 2026-08-28 — Yeet verify cannot isolate a staged repair

- What was happening: the review repair was staged beside an unrelated unstaged operator edit,
  and the pre-publication check attempted to use Yeet's staged-only isolation.
- Evidence: `bun run beep yeet verify --staged-only` exited before proof with
  `Unrecognized flag: --staged-only`; only the publish command exposes that isolation mode.
- What would have prevented it: support the same staged-only worktree protection on `yeet verify`,
  or have it delegate to the publish isolation boundary without committing or pushing.

## 2026-08-30 — The installed PR watcher observed only one checkout

- What was happening: validating the automatic dead-owner takeover gate found the user service
  disabled and its generated unit pinned to the checkout that happened to install it.
- Evidence: the unit carried one `BEEP_YEET_WATCH_ROOTS` value, so leases created in sibling
  checkouts and nested worktrees were outside the 30-second scan even after enabling the service.
  A generic recursive repair peaked at 548.6 MiB; layout-bounded discovery still took 7.01 seconds
  while waiting on fresh-lease mutexes. The final freshness prefilter reduced a full scan to 0.21
  seconds and 3.7 MiB while retaining the locked stale-candidate recheck.
- What would have prevented it: install the shared projects root and enumerate live leases only in
  the sanctioned sibling-checkout and `*-worktrees/*` layouts. A generic recursive `find`, even
  depth-bounded, traverses enough task scratch state to waste CPU and emit disappearance races.

## 2026-08-30 — Remote-cache provisioning could not repair incomplete checkouts

- What was happening: applying the sanctioned read-only cache template to active roots left six
  older `.env` files local-only because `TURBO_TEAM` existed but was blank.
- Evidence: the helper reported every existing name as unchanged; a metadata-only validation then
  found five newly created complete quads and six incomplete existing quads with blank team fields.
  Its documented dry-run command also targeted a nonexistent `quality check` subcommand.
- What would have prevented it: distinguish valid existing values from blank placeholders, offer a
  reference-preserving repair mode, and keep the verification example covered by a CLI smoke test.

## 2026-08-30 — The scheduler contract makes the dual-verify gate unreachable

- What was happening: two clean current-main `yeet verify` processes were submitted together to
  prove the packet's required overlapping full-proof acceptance case.
- Evidence: after a 58-minute upstream wait, `beep-effect7` acquired a three-token full-proof lease
  with seven tokens still free, but `beep-effect6` remained queued. `QualityScheduler.ts` marks a
  ticket skippable whenever any live lease has the same `originKey`, and `Handler.ts` also retains
  the exclusive per-origin proof lock. Every sibling checkout of this repository has the same
  origin key, so weighted capacity can never admit the required overlap. The admitted proof passed
  every lane and released normally with a 32,089,321,472-byte peak; the next same-origin waiter was
  admitted immediately after release, confirming serialization rather than capacity pressure.
- What would have prevented it: make the scheduler the single current-version authority and design
  an explicit shared/migrated legacy-lock protocol, or change the completion gate by an operator
  decision. Removing either guard alone would only move the serialization boundary or weaken
  mixed-version safety.
- Resolution: current tickets and leases now carry an origin-coordination protocol. Legacy entries
  decode distinctly, and same-origin legacy state drains first; the first current contender then
  atomically installs a persistent v4 retirement marker that old clients fail closed against.
  Current siblings share the weighted scheduler, while below-envelope hosts retain a separate
  exclusive fallback lock. After the first closeout review, the focused scheduler/coordinator
  suites pass 56 tests and the full Yeet unit file passes 132 tests; a live dual-full-proof receipt
  remains the final runtime acceptance check.

## 2026-08-30 — mixed-version review found a current-first ticket deadlock

- What was happening: the required closeout reviewer panel modeled both queue orders for the
  additive scheduler protocol instead of only the already-tested legacy-lease drain.
- Evidence: an older current ticket treated any younger same-origin legacy ticket as a migration
  owner, but the prior-version selector saw that older current ticket as unblocked. Each therefore
  waited for the other to leave the queue. The same review found that non-`NotFound` coordinator
  read failures were converted into apparent absence on the mandatory retirement path.
- What would have prevented it: pin both legacy-first and current-first ticket orders before the
  rollout implementation is accepted, and reuse the typed read boundary for every coordination
  file observation rather than collapsing platform failures into absence.

## 2026-08-30 — post-merge package verification repeated ignored projection drift

- What was happening: running the required repo-cli package verification immediately after merging
  current main.
- Evidence: 2,702 tests passed and the only test failure compared a freshly generated goals index
  with this checkout's ignored pre-merge `goals/INDEX.md`; the merge had changed three packet
  lifecycles. The earlier receipt in this ledger describes the same failure class.
- What would have prevented it: regenerate ignored packet projections in the post-merge hook, or
  isolate the determinism fixture from checkout-local generated state.

## 2026-08-30 — Package verification inherits a private temporary root

- What was happening: the required `@beep/repo-cli` package verification failed 2 of 2,701 tests
  after 442 seconds even though the touched scheduler and Yeet suites were green.
- Evidence: both failures were unchanged AgentEffectiveness command fixtures. The default temporary
  directory was below the private home path, so the production privacy guard correctly refused the
  generated annotation and Phoenix-sync artifacts. Running the exact eight-test file with
  `TMPDIR=/tmp` passed 8/8 without changing the guard or fixture assertions.
- What would have prevented it: make the package verifier provide a public, disposable temporary
  root to tests that intentionally exercise repository-path validation, or make those fixtures
  request that root explicitly instead of inheriting the launching shell's home-scoped default.

## 2026-08-30 — Yeet repair starts heavyweight feedback after a failed cheap gate

- What was happening: the closeout repair was run while other admitted full proofs were queued,
  with the expectation that its collected cheap-gate failure would stop before heavyweight work.
- Evidence: `fallow:audit` reported three introduced blockers, but the same repair continued into
  full repo docgen, affected build/check/lint, and the complete 2,701-test repo-cli suite. Those
  feedback lanes passed, but they ran outside a scheduler lease while another full proof was live.
- What would have prevented it: stop repair feedback before heavyweight lanes whenever the
  collected cheap-gate wave is red, or admit the feedback phase through the same weighted
  scheduler used by full verification.

## 2026-08-30 — Concurrent linked-worktree verifies raced during origin refresh

- What was happening: launching the repaired live dual-proof trial from two clean detached
  worktrees at the same commit.
- Evidence: both Yeet processes refreshed `origin/main` during startup. One completed the fetch and
  joined the scheduler queue; the other exited before admission because its quiet Git fetch could
  not update the shared linked-worktree ref concurrently. No quality lane ran in the failed
  process, and retrying after the first refresh completed avoided the collision.
- What would have prevented it: serialize origin refresh through the repository's shared Git
  common directory, or make a ref-lock collision retry with bounded backoff before Yeet treats the
  refresh as a terminal command failure.

The same linked-worktree setup later exposed a second isolation gap. A root `node_modules` symlink
did not supply the worktree-local `infra/node_modules/@pulumi/gharunners` output created by the
install hook, so the 951-file TypeScript test gate failed in `infra`. Disposable full checkouts
with independent Git metadata and their own frozen install avoid both defects. A reusable proof
worktree provisioner should install the complete workspace instead of linking only root packages.

## 2026-08-30 — Full aggregate exposed inherited coverage-baseline drift

- What was happening: the final `TMPDIR=/tmp bun run audit:github quality` acceptance proof passed
  all 20 build, lint, policy, type, unit, and integration lanes, but stopped at the coverage ratchet.
- Evidence: five rows were below their recorded floors in `PrLease.ts` and `TmpfsReap.ts`. Both
  implementation files are byte-identical to current `origin/main`; the gap was missing path
  coverage, not a source regression introduced by this branch.
- What would have prevented it: require the coverage ratchet on the exact merge head before main
  advances, and land any baseline-affecting test changes with the implementation whose paths they
  cover. This branch restores the floors with focused regression tests instead of lowering them.

## 2026-08-30 — Durable admission rows omit the protocol and terminal memory receipt

- What was happening: extracting the terminal evidence for two same-origin full proofs admitted
  under `scheduler-origin-concurrency/v1`.
- Evidence: live scheduler status identified both current-protocol leases and their overlap. The
  durable admission journal recorded admitted and released rows, but the rows do not carry
  `coordinationProtocol`, and the first successful release omitted `memoryPeakBytes` even though
  its Yeet verdict recorded peak RSS for both heavyweight steps. Establishing the receipt required
  correlating ephemeral status, journal timestamps, terminal exit, and the branch-local verdict.
- What would have prevented it: include the coordination protocol in both journal event variants
  and copy the verdict or scheduler peak into every terminal release row, then expose a bounded
  closeout query that joins the records by nonce.

## 2026-08-30 — A queued Yeet verify disappeared without a terminal attempt receipt

- What was happening: the final closeout `beep yeet verify` waited behind a live same-origin
  legacy proof and reached position one, but its client process exited before admission after more
  than 22 minutes in the queue.
- Evidence: scheduler status showed the holder still heartbeating in an active run scope, with no
  dead or quarantined state. The closeout ticket then disappeared, no new verdict was written, and
  `attempts.ndjson` retained an `attempt-started` row without a matching `attempt-finished` row.
- What would have prevented it: make queued attempts reconnectable, or ensure every client exit
  writes a terminal cancellation receipt before its ticket is removed. A durable reason should
  distinguish operator interruption, signal exit, lost observer, and scheduler rejection.
## 2026-08-30 — The root test wrapper treated focused file paths as Turbo task names

- **Doing:** validating the Yeet merge resolution against four focused repo-cli test files.
- **Evidence:** `bun run test packages/tooling/tool/cli/test/yeet.test.ts ...` forwarded each file
  path after `turbo run test`; Turbo rejected them as missing tasks before Vitest ran.
- **Would have prevented it:** route file arguments to the owning package's Vitest command, or
  reject unsupported positional paths before constructing the Turbo invocation.

## 2026-08-30 — A detached pre-commit observer stranded Lefthook after its child exited

- **Doing:** committing the packet reconciliation after the focused merge tests and goal checks
  passed.
- **Evidence:** the command observer ended after gitleaks passed and Lefthook announced `typos`.
  Git, the pre-commit shell, and Lefthook then remained asleep for nearly six minutes with no
  `typos` child. After terminating only that orphaned process tree, the exact `typos` command
  completed in 0.25 seconds at exit 0.
- **Would have prevented it:** preserve and return the live command handle whenever capture
  yields, and make Lefthook finalize a parallel command when its child has already exited.

## 2026-08-30 — The machine-wide fallback inherited a PID-only liveness check

- **Doing:** closing the exact-head Greptile review after moving below-envelope proofs from
  per-origin fallback paths to one machine-wide lock.
- **Evidence:** the shared lock still used the legacy v3 owner schema and considered any live
  process with the recorded PID to be its owner. If the proof exited without cleanup and Linux
  recycled that PID, every repository origin could remain queued behind the unrelated process.
- **Would have prevented it:** require every newly written process-owned coordination record to
  carry `/proc/<pid>/stat` start time and reuse the scheduler's PID-plus-start-time liveness helper
  before broadening a lock from per-origin to machine-wide scope.

## 2026-08-31 — The PID-reuse repair assumed readable Linux procfs

- **Doing:** closing the next exact-head Greptile review after adding process-start fencing to the
  machine-wide fallback lock.
- **Evidence:** the lock refused every new owner when `/proc/<pid>/stat` was unavailable. That was
  safe against PID reuse but disabled below-envelope full proofs on macOS, Windows, and Linux
  environments without readable procfs.
- **Would have prevented it:** model process identity as a platform capability from the first
  repair—procfs on Linux, a stable `ps` start representation on Unix, and process start ticks on
  Windows—and test the non-procfs acquisition path before publishing the review fix.

## 2026-08-31 — Two CI lanes failed before they could test the branch

- **Doing:** monitoring the exact PR head after the portable process-identity repair.
- **Evidence:** Property Laws stopped during `bun install` when cached `keytar` fell back to a
  source build on a hosted runner without `libsecret-1`. The exact local property lane then passed
  2,743 tests. Coverage Regression stopped when its self-hosted runner lost communication with
  GitHub, before the lane produced a coverage result.
- **Would have prevented it:** provision native build prerequisites before restoring dependency
  caches, and retry a job automatically when GitHub reports that its runner lost communication.

## 2026-08-31 — Package verification omitted the coverage ratchet

- **Doing:** monitoring the exact PR head after the portable process-identity repair passed the
  repo-cli package audit, package docgen, and aggregate cheap gates.
- **Evidence:** the hosted Coverage Regression lane was the first completed proof to report that
  `ProofState.ts` had fallen below its recorded branch, function, line, and statement floors.
  Package verification had passed without exercising the package's coverage script.
- **Would have prevented it:** include affected coverage in the package verification profile for
  source changes, or require publishers to run the scoped coverage ratchet before entering the
  heavyweight publish queue.

## 2026-08-31 — Goal doctor has no packet-scoped form

- **Doing:** validating the ship-velocity packet after adding its coverage-gate friction receipt.
- **Evidence:** `bun run beep goals doctor ship-velocity` exited before validation with
  `Unexpected positional argument: "ship-velocity"`; the command accepts only a repository-wide
  scan.
- **Would have prevented it:** accept an optional packet slug, or print the repository-wide form
  in the error so a focused closeout does not need a failed discovery call.

## 2026-09-02 — Inbox acknowledgement shorthand did not match the live CLI contract

- **Doing:** acknowledging an environment-only package-audit receipt after rebuilding stale
  workspace outputs and obtaining a green audit.
- **Evidence:** `beep yeet inbox ack <id> --wontfix "<reason>"` rejected the explanation as an
  unexpected positional argument; the live help requires the separate `--wontfix --reason
  "<reason>"` flags.
- **Would have prevented it:** keep operator handoffs and error reminders aligned with the
  command's parsed flag contract, or accept the value-bearing shorthand as an alias.

## 2026-09-02 — Detached publish was terminated before Yeet produced a verdict

- **Doing:** starting the staged-only final-evidence publish under `nohup` so a shell timeout
  could not interrupt the full local proof.
- **Evidence:** the publish log retained only Bun's command echo, the branch verdict timestamp did
  not advance, no commit was created, and the background process disappeared with the exact
  staged index still intact.
- **Would have prevented it:** launch long-lived operators under a durable user scope with an exit
  receipt, or keep a supervised command handle that survives the calling shell's lifecycle.

## 2026-09-02 — A branch name in code formatting was classified as a tracked path

- **Doing:** running the final-evidence publish proof after the packet named its successor branch
  in the goal, plan, and README.
- **Evidence:** `knowledge semantic-delta` treated the code-formatted branch name as a repository
  path and reported three introduced `broken-tracked-path` findings; the branch is intentionally
  not a tracked directory.
- **Would have prevented it:** distinguish Git branch references from tracked filesystem paths in
  semantic-delta, or document that branch names must remain plain prose rather than inline code.

## 2026-09-02 — Staged-only publish could not carry an unpushed repair amend

- **Doing:** retrying the final-evidence publish after fixing its sole pre-push policy failure.
- **Evidence:** Yeet's failure guidance offered an amend for the unpushed commit, while
  `publish --staged-only --amend --no-edit` was rejected because staged-only cannot combine with
  amend mode.
- **Would have prevented it:** print the exact supported retry command in the failure guidance, or
  allow staged-only to scope the staged delta of an unpushed amend.
