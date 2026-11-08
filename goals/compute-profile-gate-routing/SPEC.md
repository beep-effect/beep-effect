# Compute-Profile Gate Routing Spec

## Objective

Give every `beep` process a typed compute profile (`workstation | worker`) derived from the host's
memory ceiling, and route gates, pre-commit hooks and publish verbs by it, so agents on
worker-class hosts (dankserver 15 GiB / 7 GiB slice, beep-worker, tom-pc-1-wsl) defer
compute-heavy proof to hosted CI by construction instead of by a 10-minute timer and judgment.
Brief, decisions D1–D9 and map: `explorations/compute-profile-gate-routing/` (BRIEF.md,
DECISIONS.md, MAP.md). Trigger: 2026-11-07 dankserver T3 Offline incident (CAPTURE.md).

## Non-Goals

- Raw `process.env` reads: the profile override is an `effect/Config` contract.
- A new memory service or external state; the profile is computed per process.
- Hosted heavy admission (`ready-for-heavy`, ruling 51) stays unchanged.
- dankserver provisioning (`t3 serve` own slice, D8) lives in the dankserver repo.
- Weakening commit hooks on workstation profile.
- Making the catalog writer cheaper (goal `catalog-writer-incremental`).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/internal/repo-run/` (ComputeProfile service, MemoryStats ceiling, GateRoute table, QualityScheduler refusal, facts carrying the profile).
- `packages/tooling/tool/cli/src/commands/Yeet/**` (publish→open posture, final-check auto-skips, ready accepting hosted green), and a NET-NEW profile probe subcommand of the repo CLI (name fixed in P0).
- `lefthook.yml` (`skip: - run:` on `schema-catalog` and `instrumentation-catalog`).
- `.github/workflows/check.yml` (draft-only hosted shard regeneration job, relock push pattern).
- `AGENTS.md` Quality Operator, `docs/runbooks/agent-pools.md`, `.claude/skills/remote-development-agents/SKILL.md`, `.claude/skills/yeet/references/gates-and-proof.md`, Palantiri host-pressure parcel.

## Constraints

- Profile resolution: `process.constrainedMemory()` vs the admission envelope (`hardFloorGib + slotSizeGib`); Bun reports `memory.high`, Node `memory.max`, both are "the ceiling"; unavailable probe ⇒ `workstation`. The Config override may only tighten to `worker` (D1).
- `ComputeProfile` is a separate axis from `ProofEnvProfile`; hosted runners are posture `hosted`, never a compute profile (D5).
- Default routing table is D6; it ships, the first slice records per-gate RSS on dankserver as evidence, it does not gate the design.
- Scheduler refusal replaces the `bypassAdmission` branch on worker; `--force-local` is recorded in the receipt (D4).
- The hosted regeneration job runs only on draft PRs that declare `compute-profile=worker` skips and never after `yeet ready` (bot pushes move the verdict head and review window); push via the `skills-update-train.yml` relock pattern with `persist-credentials: false` (D3, D9).
- Do not parse `/sys/fs/cgroup` by hand while `constrainedMemory()` is available.
- At most three concurrent PR lanes: P0 profile+scheduler, P1 yeet+lefthook, P2 CI+docs (MAP.md).

## Acceptance Criteria

- [ ] The profile probe subcommand prints `worker` inside dankserver's worker slice and `workstation` on DankStation, and its `--is worker` form exits 0/1 in under a second.
- [ ] On a worker host `yeet final-check` refuses hosted-only gates and prints the `yeet open` route; `--force-local` runs them and the receipt records it.
- [ ] A worker-profile lane completes edit → commit (hooks skipped by profile) → `yeet open` → hosted regeneration commit → hosted green → `yeet ready` with no local process above 1.5 GB RSS.
- [ ] A workstation commit still runs both catalog hooks (no behavior change on `workstation`).
- [ ] Attempt and admission facts carry `computeProfile` beside `ProofEnvProfile`; receipts name auto-skipped gates with reason `compute-profile=worker`.
- [ ] AGENTS.md, agent-pools runbook (per-host table incl. measured dankserver row), remote-development-agents and yeet skills updated; `bun run beep skills update --check` passes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/compute-profile-gate-routing/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/compute-profile-gate-routing/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/compute-profile-gate-routing` | Passes |
| Profile on a capped scope | the profile probe subcommand under `systemd-run --user --scope -q -p MemoryHigh=2G` | prints `worker` |
| Profile on the workstation | the profile probe subcommand on DankStation | prints `workstation` |
| Package verify | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Hook skip | `LEFTHOOK_VERBOSE=1 git commit` on a worker host | both catalog commands reported skipped |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add compute-profile-gate-routing --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug compute-profile-gate-routing`; add a `kind: decision` file there, never edit this block._

### ComputeProfile is a separate two-valued axis from ProofEnvProfile, 2026-11-07

ComputeProfile = LiteralKit([workstation, worker]) describes the memory ceiling; ProofEnvProfile keeps describing posture; hosted runners are posture hosted. Facts carry both. Exploration D5.

Reverse: Fold worker into ProofEnvProfile and delete ComputeProfile

### Default gate routing table (D6), 2026-11-07

worker local-allowed: package-scoped lint, expectation-rewrite, repo-sanity changeset status. worker hosted-only: cheap-gates (schema catalog), lint-policy, check, docgen, fallow, coverage, both catalog hooks. One typed table in repo-run read by the scheduler, yeet final-check/ready and the lefthook skip test. First slice records per-gate RSS on dankserver as evidence. Exploration D6.

Reverse: Delete the GateRoute table; every gate runs on every profile

### Profile source of truth is the live cgroup probe; Config override only tightens, 2026-11-07

process.constrainedMemory() (Bun: memory.high, Node: memory.max) vs the admission envelope decides; an effect/Config override may force worker, never workstation. Rejected: env-only (drift), probe-only. Exploration D1.

Reverse: Delete the ComputeProfile probe and read BEEP_COMPUTE_PROFILE alone

### Scheduler refuses hosted-only gates on worker hosts instead of bypassing admission, 2026-11-07

The bypass branch becomes a refusal naming the yeet open route; --force-local runs the gate and the receipt records it. Exploration D4.

Reverse: Restore the bypassAdmission branch for sub-envelope hosts

### Worker lanes skip the catalog hooks; a draft-only hosted job regenerates shards, 2026-11-07

lefthook skip: - run: on both catalog commands (LEFTHOOK_EXCLUDE interim in the worker env). A check.yml job, draft PRs declaring compute-profile=worker only, regenerates scoped shards and pushes with the skills-update-train relock pattern (persist-credentials false, contents write, head.repo guard); never after yeet ready. Exploration D2, D3, D9.

Reverse: Remove the lefthook skip conditions and the check.yml regeneration job

### a plain yeet publish on worker takes the yeet open posture and labels the PR compute-profile-worker, 2026-11-08

yeetPublishPostureFor decides: mode publish on the worker profile without --force-local takes open. Publishes that reuse or amend a commit (--prove-first, --push-only, --reuse-verified, --amend, --no-edit, --staged-only) or run detached keep the publish route, because yeet open rejects those flags. Like yeet open, the redirect pushes the committed HEAD and refuses staged changes: commit first. With --message and no --body-file the body is synthesized from the message plus the deferral sentence, in a scoped temp file. On worker, yeet open adds the compute-profile-worker label through the REST issues endpoint, which creates a missing label. A failed add is one warning. The attempt fact gains an optional forceLocal, set only when --force-local was passed.

Lane `goals/compute-profile-gate-routing-p1`

Reverse: Route yeetPublishCommand and yeetCommand back to runYeetMode publish and drop applyComputeProfileLabel; --force-local becomes a no-op.

### availableGib under a cgroup ceiling is min(MemAvailable, ceiling minus own RSS), 2026-11-08

Bun and Node expose no cgroup memory.current, and the packet forbids parsing /sys/fs/cgroup by hand. Under a ceiling tighter than MemTotal, MemoryStats.availableGib is min(MemAvailable, ceilingGib - process RSS). Other members of the slice are invisible, so the value is an upper bound; documented on MemoryStatsShape. Uncapped processes are unchanged.

Reverse: Drop the clamp so availableGib is MemAvailable again

### computeProfile stays out of every proof digest and reuse key, 2026-11-08

ProofInputDigest, ProofLedgerShadowRow and ProofShadowAttemptFacts record computeProfile as evidence beside envProfile, but proofInputKey still hashes only laneId, commandDigest, envProfile, inputDigest and epochDigest, and ProofLedger key equivalence is unchanged. Existing digests and reuse decisions are untouched; documented on ProofInputKeyComponents.

Reverse: Add computeProfile to proofInputKey components and accept that every existing proof key changes

### final-check records computeProfile and forceLocal as optional receipt keys and fails on an unreadable override, 2026-11-08

The receipt keys are optionalKey so receipts written before P1 decode unchanged. An unreadable BEEP_COMPUTE_PROFILE override fails final-check with exit 2 instead of silently running the hosted-only gates. An operator --skip for a gate wins over the profile skip and keeps its own reason.

Lane `goals/compute-profile-gate-routing-p1`

Reverse: Remove the two optional keys from FinalCheckReceipt and the resolveFinalCheckProfileSkips call; old and new receipts both still decode.

### P0 records forceLocal on requests, tickets and leases; the receipt row lands in P1, 2026-11-08

AdmissionRequest gains gateRoute and forceLocal (defaults none and false). Tickets and leases carry forceLocal (decoding default false) and computeProfile. A worker run bypasses the ticket queue, so its forceLocal evidence in P0 is the scheduler log line 'compute-profile=worker force-local=true'; the yeet final-check receipt that names forced and auto-skipped gates is P1 work. No caller sets gateRoute yet, so P0 changes no live behavior beyond the logged worker bypass.

Reverse: Add a journal event for worker bypass runs that records forceLocal

### The probe service is a Context.Reference named ComputeProfileProbe, 2026-11-08

ComputeProfile is the LiteralKit; the service is ComputeProfileProbe, a Context.Reference whose default reads the live process (process.constrainedMemory, os.totalmem). A Reference keeps withQualityAdmission and every Yeet caller compiling with no new layer; tests provide makeComputeProfileProbe over an injected ComputeMemorySource instead of patching process. The shape is resolve (default 20 GiB envelope) plus resolveFor(envelopeGib) so a custom AdmissionConfig envelope is honored.

Reverse: Turn ComputeProfileProbe into a required Context.Service and provide its live layer at every command and scheduler entry

### The profile probe subcommand is beep compute profile, 2026-11-08

New command group compute with subcommand profile: prints the profile, --is <profile> exits 0 or 1 silently through the CliReportedExit path, --json prints the encoded ComputeProfileResolution (Options as null). An invalid BEEP_COMPUTE_PROFILE exits 2 with ComputeProfileError. No repo scan or git; measured about 0.5 s wall.

Reverse: Rename the compute command group and update the dispatch manifest and Root registration

### The scheduler derives its compute profile from the MemoryStats ceiling, 2026-11-08

withQualityAdmission resolves the profile with resolveComputeProfileForCeiling(min(MemTotal, ceilingGib), envelope), the same override rule as the probe, instead of calling the live probe. The refusal and the capacity view therefore never disagree, and scheduler tests stay deterministic on 16 GiB hosted runners where the live probe would say worker. Requests whose envProfile is hosted are never refused (D5).

Reverse: Resolve the profile in withQualityAdmission through ComputeProfileProbe instead of resolveComputeProfileForCeiling

### yeet ready maps worker-deferred gates to real hosted check-run names and refuses on pending or red, 2026-11-08

The GateRouteId to hosted-context table sits next to GateRoute in GateRoute.schemas.ts. Names were verified with gh api against origin/main 0c1b780e564 and merged PR heads: cheap-gates and both catalog hooks map to Repo Sanity; lint-policy, check, docgen and coverage map to Heavy / Lint Policy, Heavy / Check, Heavy / Docgen and Heavy / Coverage Regression (the gates-and-proof table omits the Heavy prefix); fallow maps to Fallow Advisory Envelopes. The newest run per name decides, reusing mergeGateLatestRunPerName. A conclusion the merge gate counts green (success, skipped, neutral) accepts the gate. A missing or pending run refuses with wait for hosted <context>, and any other conclusion refuses naming the red. A failed check-run read refuses too, because an unread run is unknown, never green. Operator skips with any other reason keep today's behaviour.

Lane `goals/compute-profile-gate-routing-p1`

Reverse: Drop gateHostedContextTable and the hostedChecks read in ReadyGate.ts; profile skips then behave like operator skips (named, never checked).

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
