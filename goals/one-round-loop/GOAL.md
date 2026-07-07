# Goal: One-Round Loop

Make the next crispening-scale effort need at most one CI round per PR.

`SPEC.md` is normative (tiers, fences, DoD, verification matrix, stop
conditions). `research/decisions-locked.md` holds the grilled rulings
D1–D7 and R1–R4 — locked; amendments need a superseding
`standards/architecture/DECISIONS.md` entry. Track resumable state in
`ops/progress.json`.

## Why

repo-crispening-orchestration burned ten ~30-minute CI rounds across its
final two PRs; every round surfaced exactly one failure class local gates
structurally could not see (full-graph tsc, coverage ratchet, cspell on
generated files, fallow base-diff, commitlint, seed-dependent property
laws). This packet removes each structural cause and proves the removal
on itself.

## Phases (in order; P0 gates the rest)

- **P0 CI-lane inversion** — classify every check.yml lane
  cli-runnable / workflow-gated / ci-native (D2); cli-runnable bodies
  become `bun run beep ci lane <id>` (beside the existing
  `append-turbo-summary`, reusing the Quality step runners); GitHub
  orchestration stays in YAML as flags; `beep ci local` replays the
  locally-runnable battery (--lanes, --fast, --affected). First
  deliverable: the lane-by-lane parity table (the naive "5-lane
  delta" understates it — pre-push differs in SHAPE too). FENCE: 17
  required-check context names frozen by ruleset 10240248. Parity per
  D9: shadow workflow on the SAME SHA, verdicts matching, before
  thinning merges.
- **P1 Property-law lane** — max()-aware `fcRuns()`-style helper in
  @beep/test-utils reading BEEP_FC_NUM_RUNS (inline numRuns overrides
  fc.configureGlobal, so a codemod migrates all inline sites INCLUDING
  it.prop/test.prop; values become floors, never lowered) +
  configureGlobal floor in vitest.setup.ts; per-PR affected lane at
  400 runs (own turbo task, env-declared, frozen context name,
  ratchets to required at P4 per D3); nightly sweep at 1000+ with
  workflow_dispatch + issues:write and one tracking issue.
- **P2 Medium tier** — coverage baseline v2 with raw counts (the counts
  are already decoded and discarded at CoverageRegression.ts:223;
  denominator deltas in failure output; auto-add missing packages);
  beep cwd-independence (chdir(findRepoRoot) at bin startup +
  BEEP_INVOCATION_CWD escape hatch + audit Worktree/Research + a bin
  shim); `beep quality regen-generated` + documented conflict recipe;
  `SchemaUtils.withNormalizedCheck(normalizer)` + migrate the venice-ai,
  phoenix, and m365 hand-rolls (wire unchanged, parity-proved).
- **P3 Stretch** (each closable won't-fix with a ledgered rationale) —
  fallow envelope findings carry file/line/symbol; yeet publish
  committed-branch mode (Handler.ts:1188 staged gate); worktree lane
  adoption (beep worktree new already bun-installs — measure, tune,
  document as THE agent-lane path); CI cancel-rerun + required-check
  quarantine (distinguish benign cancel-in-progress supersessions from
  infra cancellations first).
- **P4 Close** — DoD confirmation, dogfood retrospective (CI rounds per
  packet PR + root-cause notes), `/reflect` closeout,
  `bun run beep lint reflection-artifacts` green, statuses updated.

## Dogfood rule (no bootstrap exemption)

Every packet PR — including P0's own — passes `beep ci local` built
from that PR's branch before push (D4; docs-only PRs may use --fast
--affected per D8). A >1-CI-round packet PR is a FAILED proof: it
needs a root-cause note AND evidence the exposed class is now caught
locally before the packet may close.

## Non-negotiable fences

Inversion is behavior-preserving — never weaken or change what CI
checks. numRuns floors never go down. No product-slice changes beyond
the named combinator migrations. Full list in SPEC.md §Non-Goals.

## Verify

Wave gate: `bun run beep ci local` green, `bun run beep yeet verify`
green. Ship each phase as its own PR via yeet publish --pr + monitor.
