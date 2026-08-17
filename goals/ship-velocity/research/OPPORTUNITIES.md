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
