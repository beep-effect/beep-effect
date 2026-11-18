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
- `.github/workflows/catalog-regeneration.yml` (draft-only hosted shard regeneration job keyed on the `compute-profile-worker` label, relock push pattern; its own workflow so it fires on `labeled`).
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

- [x] The profile probe subcommand prints `worker` inside dankserver's worker slice and `workstation` on DankStation, and its `--is worker` form exits 0/1 in under a second.
- [x] On a worker host `yeet final-check` refuses hosted-only gates and prints the `yeet open` route; under `--force-local` each forced gate either completes with concurrency 1 and the receipt records `forceLocal: true`, or refuses with a reason naming its dankserver measurement (or no measured worker budget), writes an `admission-routed` refusal row and records no forced step. Refusing is correct on a 7 GiB slice (decision 2026-11-13).
- [x] A worker-profile lane completes edit → commit (hooks skipped by profile) → `yeet open` → hosted regeneration commit → hosted green → `yeet ready` with no local process above 1.5 GB RSS.
- [x] A workstation commit still runs both catalog hooks (no behavior change on `workstation`).
- [x] Attempt and admission facts carry `computeProfile` beside `ProofEnvProfile`; receipts name auto-skipped gates with reason `compute-profile=worker`.
- [x] AGENTS.md, agent-pools runbook (per-host table incl. measured dankserver row), remote-development-agents and yeet skills updated; `bun run beep skills update --check` passes.
- [x] No unrelated refactors or formatting churn.

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

Lane goals/compute-profile-gate-routing-p1

Reverse: Route yeetPublishCommand and yeetCommand back to runYeetMode publish and drop applyComputeProfileLabel; --force-local becomes a no-op.

### availableGib under a cgroup ceiling is min(MemAvailable, ceiling minus own RSS), 2026-11-08

Bun and Node expose no cgroup memory.current, and the packet forbids parsing /sys/fs/cgroup by hand. Under a ceiling tighter than MemTotal, MemoryStats.availableGib is min(MemAvailable, ceilingGib - process RSS). Other members of the slice are invisible, so the value is an upper bound; documented on MemoryStatsShape. Uncapped processes are unchanged.

Reverse: Drop the clamp so availableGib is MemAvailable again

### Catalog regeneration runs in its own workflow so it fires on the labeled event, 2026-11-08

yeet open pushes the head, creates the PR and then applies compute-profile-worker; check.yml listens to the default pull_request types (opened, synchronize, reopened), so the job would first run on the lane's next push. Adding `labeled` to Check's types would re-run every tier-1 lane on each label change, which ruling 51 (time-to-certainty B8) forbids. catalog-regeneration.yml listens to labeled, synchronize and reopened; the if guard keeps every other PR a skipped run. The label, not a receipt or a body marker, is the trigger because it is visible in the event payload with no extra API call.

Lane goals/compute-profile-gate-routing-p2

Reverse: Move the regenerate-catalogs job back into check.yml and accept that a single-push worker PR gets no regeneration

### computeProfile stays out of every proof digest and reuse key, 2026-11-08

ProofInputDigest, ProofLedgerShadowRow and ProofShadowAttemptFacts record computeProfile as evidence beside envProfile, but proofInputKey still hashes only laneId, commandDigest, envProfile, inputDigest and epochDigest, and ProofLedger key equivalence is unchanged. Existing digests and reuse decisions are untouched; documented on ProofInputKeyComponents.

Reverse: Add computeProfile to proofInputKey components and accept that every existing proof key changes

### final-check records computeProfile and forceLocal as optional receipt keys and fails on an unreadable override, 2026-11-08

The receipt keys are optionalKey so receipts written before P1 decode unchanged. An unreadable BEEP_COMPUTE_PROFILE override fails final-check with exit 2 instead of silently running the hosted-only gates. An operator --skip for a gate wins over the profile skip and keeps its own reason.

Lane goals/compute-profile-gate-routing-p1

Reverse: Remove the two optional keys from FinalCheckReceipt and the resolveFinalCheckProfileSkips call; old and new receipts both still decode.

### P0 records forceLocal on requests, tickets and leases; the receipt row lands in P1, 2026-11-08

AdmissionRequest gains gateRoute and forceLocal (defaults none and false). Tickets and leases carry forceLocal (decoding default false) and computeProfile. A worker run bypasses the ticket queue, so its forceLocal evidence in P0 is the scheduler log line 'compute-profile=worker force-local=true'; the yeet final-check receipt that names forced and auto-skipped gates is P1 work. No caller sets gateRoute yet, so P0 changes no live behavior beyond the logged worker bypass.

Reverse: Add a journal event for worker bypass runs that records forceLocal

### Palantiri carries its own HostComputeProfile literal and optional ceiling and profile keys, 2026-11-08

`@beep/palantiri` is a library that `@beep/repo-cli` depends on, so it cannot import repo-cli's `ComputeProfile`. A two-value `LiteralKit` in the library keeps the dependency direction; the repo-cli value is assignable to it. Both keys are optional with a `None` default so recorded parcel envelopes without them still decode.

Lane goals/compute-profile-gate-routing-p2

Reverse: Make the keys required, or move the literal domain into a shared package both import

### The probe service is a Context.Reference named ComputeProfileProbe, 2026-11-08

ComputeProfile is the LiteralKit; the service is ComputeProfileProbe, a Context.Reference whose default reads the live process (process.constrainedMemory, os.totalmem). A Reference keeps withQualityAdmission and every Yeet caller compiling with no new layer; tests provide makeComputeProfileProbe over an injected ComputeMemorySource instead of patching process. The shape is resolve (default 20 GiB envelope) plus resolveFor(envelopeGib) so a custom AdmissionConfig envelope is honored.

Reverse: Turn ComputeProfileProbe into a required Context.Service and provide its live layer at every command and scheduler entry

### The profile probe subcommand is beep compute profile, 2026-11-08

New command group compute with subcommand profile: prints the profile, --is <profile> exits 0 or 1 silently through the CliReportedExit path, --json prints the encoded ComputeProfileResolution (Options as null). An invalid BEEP_COMPUTE_PROFILE exits 2 with ComputeProfileError. No repo scan or git; measured about 0.5 s wall.

Reverse: Rename the compute command group and update the dispatch manifest and Root registration

### The regeneration push uses BEEP_SKILLS_TRAIN_TOKEN with the github.token fallback, 2026-11-08

A push with `github.token` does not start new workflow runs, so hosted CI would never prove the regenerated head. The skills train token already has contents write on this repo and is used on an explicit URL only, never in git config. `github.token` stays as the fallback so a missing secret degrades to an unproven push instead of a failed job.

Lane goals/compute-profile-gate-routing-p2

Reverse: Swap the PUSH_TOKEN expression in the regenerate-catalogs job

### The scheduler derives its compute profile from the MemoryStats ceiling, 2026-11-08

withQualityAdmission resolves the profile with resolveComputeProfileForCeiling(min(MemTotal, ceilingGib), envelope), the same override rule as the probe, instead of calling the live probe. The refusal and the capacity view therefore never disagree, and scheduler tests stay deterministic on 16 GiB hosted runners where the live probe would say worker. Requests whose envProfile is hosted are never refused (D5).

Reverse: Resolve the profile in withQualityAdmission through ComputeProfileProbe instead of resolveComputeProfileForCeiling

### Worker final-check runs only changeset status for repo-sanity, 2026-11-08

D6 keeps only the repo-sanity changeset status check local on worker, but P1 routed the whole gate
local, so `yeet final-check` still dispatched `ci lane repo-sanity` and its whole-repo schema catalog
scan. On 2026-11-08 that scan held 5.2 GB in dankserver's 7 GiB worker slice for 25 minutes and took
T3 offline until it was killed (PR #2968's final-check).

The narrowing lives in final-check, not in `beep ci lane`: hosted runners execute that same lane and
must keep the full scan. A passing repo-sanity step on a worker receipt therefore means changeset
status only; hosted Repo Sanity remains the proof. `--force-local` restores the full lane.

Reverse: Remove routeFinalCheckStepsForProfile from the final-check run so repo-sanity dispatches the full ci lane again

### yeet ready maps worker-deferred gates to real hosted check-run names and refuses on pending or red, 2026-11-08

The GateRouteId to hosted-context table sits next to GateRoute in GateRoute.schemas.ts. Names were verified with gh api against origin/main 0c1b780e564 and merged PR heads: cheap-gates and both catalog hooks map to Repo Sanity; lint-policy, check, docgen and coverage map to Heavy / Lint Policy, Heavy / Check, Heavy / Docgen and Heavy / Coverage Regression (the gates-and-proof table omits the Heavy prefix); fallow maps to Fallow Advisory Envelopes. The newest run per name decides, reusing mergeGateLatestRunPerName. A conclusion the merge gate counts green (success, skipped, neutral) accepts the gate. A missing or pending run refuses with wait for hosted <context>, and any other conclusion refuses naming the red. A failed check-run read refuses too, because an unread run is unknown, never green. Operator skips with any other reason keep today's behaviour.

Lane goals/compute-profile-gate-routing-p1

Reverse: Drop gateHostedContextTable and the hostedChecks read in ReadyGate.ts; profile skips then behave like operator skips (named, never checked).

### A forced gate on a worker completes serially inside its measured budget or refuses with the reason, 2026-11-13

The two dankserver acceptance runs (research/2026-11-13-worker-host-acceptance.md and its -repeat.md sibling; 15 GiB host, 7 GiB agent slice) measured every forced gate that ran: none completed. Forced fallow, serial, held a 2G-capped scope at its ceiling (2.15 GB aggregate) in its first sub-lane fallow:audit:check (204 packages) until slice pressure passed 15 at 523 s; unserialized it reached 3.06 GB and gave no result in 29.5 minutes. The @beep/repo-cli test type-check held 2.59 GB in one tsc process and gave no result in 30 minutes under a 3 GiB cap. The whole-repo schema catalog scan behind cheap-gates and the full repo-sanity lane held 5.2 GB for 25 minutes (decision 2026-11-08). Forced coverage was stopped at 565 s at 2.15 GB in a prebuild that ran turbo build at --concurrency=4.

The worker forced-route table now follows those figures. Only coverage is forceable: its prebuild, shard group and Turbo graph all follow --concurrency=1, and final-check runs it only when the affected plan selects the diff's own packages, which it names. A whole-workspace or unreadable plan refuses. fallow, check and lint-policy (2.59 GB), cheap-gates and the full repo-sanity lane (5.2 GB) refuse with their measured figure and note; docgen refuses with no measured worker budget. Every refusal tells the operator to push with yeet open and let hosted CI prove the gate. The receipt records forceLocal: true only when a gate was actually forced, so a refusal-only run no longer claims a forced run.

Amended reading of criterion 2b: on a worker, a forced gate either completes with concurrency 1 and its receipt records forceLocal: true, or refuses with a reason naming its measurement; a refused gate writes an admission-routed refusal row and no forced step. Refusing is correct behaviour on a 7 GiB slice. Still to show on dankserver: one forced coverage run over a small package completing with forceLocal: true on its receipt.

Lane fix/compute-profile-forced-gates

Reverse: Set fallow back to Serial in workerForcedRouteTable, drop the coverage scope refusal in FinalCheck.ts and record options.forceLocal on the receipt again

### Forced coverage completes on a worker and records forceLocal, 2026-11-13

On dankserver, final-check --force-local --gates coverage measured @beep/github-references through one turbo run coverage --concurrency=1 graph (8 tasks, builds included), passed in 34.9 s with a 588 MB largest process, a 1.39 GB scope peak under a 2G MemoryHigh and slice pressure at 0.00, wrote a receipt with a passed coverage step and forceLocal: true, and journalled admission-routed coverage bypass with forceLocal: true. A forced fallow refused at once with its measured reason, wrote a refusal row and left forceLocal: false. Criterion 2b passes. Evidence: research/2026-11-13-worker-host-acceptance-forced-gate.md.

Reverse: Delete the research note; it records measurements and changes no behaviour.

### P2 lane taken over and rebased onto main, 2026-11-13

The P2 lane's owner session has been gone since 2026-11-08: no process, no session file, and branch goals/compute-profile-gate-routing-p2 untouched with no PR while main moved 222 commits. The CI-goals-finish driver took the slice over: its single commit 574c4b77212 was cherry-picked onto origin/main 8de1571f088 in lane goals/compute-profile-p2-takeover, and the old branch and worktree were left as they were. Conflict resolutions: the Palantiri.service.ts import block keeps main's GithubLedger imports beside ComputeProfileProbe; skills-lock.json takes main's side and is regenerated by skills update; the PLAN.md and SPEC.md generated blocks take main's side and are rewritten by goals decisions write. AGENTS.md takes main's current paragraph with the worker-profile rule appended as one sentence instead of the reflowed paragraph. The rebase also drops the workflow's unused beep CI binary fetch, sets LEFTHOOK=0 on its commit step, exempts the job in the CI job-to-descriptor test, points the runbook's dankserver evidence at the archived exploration, and folds the superseded default-event-types decision into the own-workflow decision.

Lane goals/compute-profile-p2-takeover

Reverse: Close the takeover PR; the original commit 574c4b77212 stays on branch goals/compute-profile-gate-routing-p2

### Regeneration and relock pushes use the knowledge-mint App token, minted right before the push, 2026-11-13

Supersedes the 2026-11-08 BEEP_SKILLS_TRAIN_TOKEN decision. That secret was never created (repository secrets on 2026-11-13: APP_ENV, APP_LOG_FORMAT, APP_LOG_LEVEL, APP_NAME, KNOWLEDGE_MINT_APP_PRIVATE_KEY, NEXT_PUBLIC_ENV, TURBO_*, VERCEL_TOKEN), so the dankserver acceptance push of 2026-11-13 went out as `github-actions[bot]` and every follow-up run on its head (43423589914, 43423589737, 43423589561) ended `action_required`.

Both workflows now mint an installation token of the `beep-knowledge-mint` App (app id 5321422) with `actions/create-github-app-token`, `client-id: vars.KNOWLEDGE_MINT_APP_CLIENT_ID`, `private-key: secrets.KNOWLEDGE_MINT_APP_PRIVATE_KEY` and `permission-contents: write` only, in the step right before the push. Reuse is acceptable: the installation grants contents, issues and pull requests write but no `workflows`; it is not a bypass actor on the `main` ruleset (its only Integration bypass is `beep-fleet-orchestrator`, 5309624); the token is scoped to this repository, lives one hour and is revoked at job end; and the Lint Policy seal guard keys on the mint App authoring a PR on `automation/knowledge-baseline-mint` and re-mints the baseline byte for byte, which a contents-only token on another branch cannot satisfy. A write collaborator who could read the token gains nothing beyond their own push access.

`catalog-regeneration.yml` splits into two jobs. `regenerate-catalogs` runs pull-request code with `contents: read` and no secret and uploads the shard diff as an artifact. `push-catalogs` runs on a fresh runner, executes nothing from the PR (no setup, no install, git hooks off), refuses a diff that touches anything but the two shard directories or adds a symlink, submodule or mode change, re-reads the PR to confirm it is still a labelled draft, and only then mints the token. In one job, a background process started by an earlier PR-code step could read a later step's token; a separate runner closes that. The relock job keeps one job because the code it runs is the branch check's proven Renovate/relock-only head.

No silent fallback: when `KNOWLEDGE_MINT_APP_CLIENT_ID` is unset the push fails closed and its summary says that a github.token push would leave the follow-up runs waiting for approval. `skills-update-train.yml` had the same latent defect; its history (260 pull-request runs) shows no Renovate skills PR and so no relock push yet.

Lane fix/compute-profile-acceptance-fixes

Reverse: Point the two push steps at another App's client id and key, or restore a PUSH_TOKEN expression with a github.token fallback and a summary warning

### Worker acceptance fixes serialize forced gates and journal routing without tickets, 2026-11-13

Findings in goals/compute-profile-gate-routing/research/2026-11-13-worker-host-acceptance.md require serial forced Fallow and coverage execution, explicit refusal of gates beyond the worker budget, admission-routed facts through the existing archive, and scoped effect-vitest lint over changed test files. Local tests are implementation proof only; repeat acceptance on dankserver before the final PR.

Lane fix/compute-profile-acceptance-fixes

Reverse: Revert the acceptance fix lane and repeat worker-host acceptance before changing the route table

### Worker-host acceptance repeat on dankserver, 2026-11-13

The repeat run on dankserver (PR #3277) proves criteria 1, 2a and 5 and closes first-run findings 1, 2, 4 and 6. A spaced 1Password reference works, the catalog push uses the knowledge-mint App token and its follow-up runs start on their own and went green, admission-routed rows are written for every routed gate, and the scoped effect-vitest check runs locally and catches EV014. Criterion 3 passes except the lane's own ready flip, which is not proven: the draft was flipped by the kriegcloud account from outside this host's Yeet tooling 16 s after the lane's refused yeet ready. Criterion 2b is not proven: forced fallow (serial) and forced coverage were both stopped by the slice-pressure watchdog after about 9 minutes at the 2 GB scope limit, and the coverage prebuild still builds with --concurrency=4. Evidence: goals/compute-profile-gate-routing/research/2026-11-13-worker-host-acceptance-repeat.md.

Reverse: Delete the research note; it records measurements and changes no behaviour.

### Worker-host acceptance run on dankserver, 2026-11-13

On dankserver (worker, 7 GiB ceiling) the probe, the profile-driven catalog hook skip, the worker final-check posture (six hosted-only gates skipped with compute-profile=worker), yeet open with the compute-profile-worker label and the hosted Catalog Regeneration commit all worked, and no lane process exceeded 1.5 GB. Hosted Check and Lint Policy then went red on the lane's own test (TS377032 and an EV002 per-test Layer provide), which the worker could only learn from hosted CI about 36 minutes after the push; yeet ready refused on pending and on red gates, including after an operator flipped the PR ready. Not proven: hosted green after regeneration (the bot push leaves every workflow action_required pending maintainer approval), a forceLocal receipt (fallow under a 3 GiB cap did not finish in 29.5 minutes and was stopped to protect T3), and admission facts (no admission journal row is written for worker-lane runs). Evidence: research/2026-11-13-worker-host-acceptance.md.

Lane test/compute-profile-worker-acceptance · PR #3267

Reverse: Delete the research note; it records measurements and changes no behaviour.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
