# Rebuild beep-effect infrastructure on Alchemy and distilled, Pulumi retired Plan

## Status

Status: `completed-retained`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Deep-research pass: the alchemy.run doc pages listed in `research/SOURCES.md`, the full `alchemy` and `distilled` sources, t3code t3code's relay and task-cache stacks, all 47 alchemy.run blog posts (grok-4.7 xhigh lanes). Produce the "use this, never roll that" matrix. | Matrix reviewed by the operator; every planned package and resource maps to an Alchemy/distilled primitive or a recorded gap. |
| P1 Foundations | complete | Doctrine amendment (tooling kind `infra`); catalog pins for `alchemy`, `@alchemy.run/*`, `@distilled.cloud/*`; S3 state store bootstrapped under a new bucket; `BeepEffectWeb` re-adopted into it; CI deploy skeleton (per-stack concurrency, `op run`). | `alchemy plan` for `BeepEffectWeb` is a no-op on the shared store; one workflow deploys a stack from `main`. |
| P2 Providers | complete | `@beep/alchemy-vercel`, `@beep/alchemy-aws-extras`, `@beep/alchemy-github-runners`, each on the `@alchemy.run/test` harness. | `package-verify` green; provider tests cover create/update/delete/read/adopt. |
| P3 Low-risk stacks | complete | Storybook, turbo cache (move scratchpad module, delete scratchpad), cost controls, GitHub. Parallel build, flip, destroy Pulumi program. | Each stack live on Alchemy; CI enrolled on the Worker cache with hit evidence; four Pulumi programs destroyed with export archives recorded. |
| P4 OIP and hosts | complete | OIP web (Vercel project, env vars, domains, DNS, assets bucket), AI metrics through `@beep/infra-hosts`; OpenClaw declared and tested there, not installed (operator ruling, 2026-11-22). | oip.law prod and staging served from Alchemy-managed config; AI metrics deploys via Alchemy and the OpenClaw stack passes its tests undeployed; both opip-web Pulumi stacks destroyed (done 2026-11-14); the host programs have no Pulumi state (decision 2026-11-13) and their files are deleted in P6. |
| P5 Runner fleet | complete | `@beep/infra-ci-runners` deployed beside the live fleet, CI moved over, old fleet destroyed. | Hosted CI green on the new fleet for a full day; `beep-ci-runners` destroyed; export archived. |
| P6 Retire | complete | Delete `infra/`, Pulumi and TS6 pins, root `postinstall` hook, runbook rewrite. | Verification matrix rows "Pulumi gone" and "Infra gone" pass on `main`. |
| P7 Yeet: final PR to mergeable | complete | Publish through yeet and drive the final PR to mergeable. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P8 Close | complete | Closeout reflection and the `closeout` record in the final PR; completion refresh verifies it after the merge. | `closeout.status == initiative.status` on `origin/main`. |

Each phase ships as its own PR wave (at most three open at once per packet). Stacks inside P3
and P4 may ship as separate PRs.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status infra-alchemy-rebuild completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug infra-alchemy-rebuild` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add infra-alchemy-rebuild --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.
- Every `pulumi destroy` gets a decision file first, naming the `pulumi stack export` archive
  path (outside the repo) and the `pulumi stack import` reversal.
- Research files under `research/` are projected by `bun run beep goals manifest --write`;
  never hand-edit `researchReports`.

## Verification Commands

```sh
test "$(wc -m < goals/infra-alchemy-rebuild/GOAL.md)" -le 4000
jq . goals/infra-alchemy-rebuild/ops/manifest.json
rg -n "infra-alchemy-rebuild|GOAL.md|agentLaunchers|packetAnchorDocument" goals/infra-alchemy-rebuild
git diff --check -- goals/infra-alchemy-rebuild
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug infra-alchemy-rebuild`; add a `kind: checkpoint` file there, never edit this block._

### P0 complete, P1 Foundations in progress, 2026-11-09

P0 closed 2026-11-09: the "use this, never roll that" matrix was reviewed in the P1 session and every open question resolves to a decision (Q1 D17, Q2 D18, Q3 D19, Q4 runner-group decision, Q5 D20, Q6 D20, Q7 D21, Q8 Storybook decision, Q9 and Q10 recorded in DECISIONS.md). P1 Foundations started the same day: tooling kind `infra`, `@alchemy.run/aws` catalog pin, the `Artifacts.cached` bun patch, the shared S3 state store bootstrapped, the GitHub OIDC state role, `BeepEffectWeb` on the shared store with a plan step in its deploy workflow, `docs/runbooks/alchemy-infra.md`. Owed before P1 exits: the first `prod` deploy against the shared store with a plan showing no create or replace (runs on merge).

Lane goals/infra-alchemy-rebuild-p1

Reverse: n/a (status note)

### P1 complete, P2 Providers in progress, 2026-11-13

P1 Foundations closed 2026-11-13. Its exit criterion held on the shared S3 store: PRs #3021 and #3133 merged, and hosted run 43407236289 (`Deploy beep-effect-web`, `main`, 2026-11-13) logged `Plan: 1 to update` and `[Website] update`, then `Done: 1 succeeded`, with no create or replace. P2 Providers started the same day as three parallel lanes, each its own PR: `@beep/alchemy-aws-extras` (this lane), `@beep/alchemy-vercel` and `@beep/alchemy-github-runners`. P2 exits when all three pass `package-verify` with `@alchemy.run/test` coverage of create, update, delete, read and adopt.

Lane goals/infra-alchemy-rebuild-p2-aws-extras

Reverse: n/a (status note)

### Storybook is live on Alchemy; Pulumi stack beep-storybook/production removed, 2026-11-13

PR #3289 merged 2026-11-13T22:12:56Z as 457e3ae3e8b6. Hosted run 43517423865 (Deploy Storybook, main) planned `2 to create` (Storybook/Build, Storybook), deployed `Done: 2 succeeded` with one Worker route reconciled; its smoke step failed on `iframe=404` one second after the route was created (propagation race, fixed in the turbo-cache PR, which makes both deploy workflows poll their smoke probes for up to 120 seconds). Probed by hand at 22:25Z: the index, the iframe (after its redirect), index.json and the bare slug with a query all return 200 under the public origin's storybook route, an unknown asset returns 404, and the apex still returns 200. `pulumi stack rm production --yes` then removed the empty Pulumi stack (0 resources at removal; the archive's sha256 matched the decision file); `pulumi stack ls` in that project lists no stacks.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: n/a (status note)

### P2 Providers complete, 2026-11-14

P2 Providers closed 2026-11-14 with all three provider packages on `main` or in their last PR: `@beep/alchemy-aws-extras` (#3292), `@beep/alchemy-vercel` (#3290) and `@beep/alchemy-github-runners` (#3291 for the Lambdas, plus #3314 for `RunnerFleet`, `RunnerSweep` and the runner user data, composing `RunnerLaunchTemplate` from aws-extras). Each passes `package-verify` with hermetic provider tests covering create, update, delete, read and adopt; nothing was deployed and no workflow changed. P3 status is left as `main` records it.

Lane goals/infra-alchemy-rebuild-p2-github-runners-composite

Reverse: Set P2 back to in-progress in ops/manifest.json, PLAN.md and README.md and delete this checkpoint.

### P4 OipWeb half done: oip.law served from Alchemy, opip-web Pulumi stacks removed, 2026-11-14

The OipWeb half of P4 is complete: #3323 and #3339 merged, run 43591525409 deployed staging and prod, and the gate removed both `opip-web` Pulumi stacks and the two empty old buckets on 2026-11-14. This PR deletes the Pulumi program. The hosts half (AI metrics, OpenClaw) runs in its own lane; the P4 phase row stays pending until both halves land.

Lane goals/infra-alchemy-rebuild-p4-oip-web-cutover

Reverse: Rollback per decision 2026-11-14-oipweb-pulumi-cutover-done-both-stacks-removed

### P5 fix A deployed: runner tarball mirrored, post-check passed, 2026-11-20

Fix (A) deployed to the CiRunners stack on 2026-11-20, and its post-check passed. The CI goals driver closed it.

- **What deployed:** #3443 (`eb68bf2edf3`). The runner-binaries syncer now mirrors the runner tarball by multipart
  upload, and the syncer role gains `s3:AbortMultipartUpload`. #3442's memory change (256 MB for the SSM housekeeper
  and the termination watcher) rode the same dispatch.
- **Boundary:** before the dispatch, the gate published fleet boundary version v2 (`+s3:AbortMultipartUpload` in
  `CeilingFleetBinaries`). It is byte-identical to the generated document. v1 is kept for rollback.
- **Plan:** plan_only run 44697391034 printed digest `14cd803c…42ab` over 73 rows: 11 function updates and 62 noop.
- **Dispatch:** run 44697771513, armed from 07:49:09Z to 07:49:22Z. The deploy step re-planned to the same digest and
  applied it, and the webhook still answered an unsigned event with 401.
- **Code and memory:** all 11 functions updated successfully, each with the code hash the bundle build predicted. The
  housekeeper and the watcher are at 256 MB, and the pool instance-type lists are unchanged.
- **CloudTrail:** two reads of the deploy role's management events (07:49 to 08:00Z), 411 events each, identical.
  - The webhook URL permission was read once with GetPolicy, with no RemovePermission or AddPermission.
  - No AccessDenied errors, and no writes to the old fleet.
  - 22 log-group writes and 22 IAM writes, all on the 11 functions' own roles. The syncer role's policy changed by
    exactly `+s3:AbortMultipartUpload`; the other 10 were byte-identical to the previous deploy.
- **Announced one-off invokes:**
  - The first syncer run took 8.3 s and 41% of its 1024 MB. It uploaded the 228,071,396-byte tarball, tagged with its
    release name, and left no multipart upload in progress.
  - A second syncer run skipped on the tag.
  - The housekeeper used 53% of its 256 MB.
- **Role simulation:** the live syncer role is allowed abort, put and put-tagging on the tarball key. It is still
  denied abort on any other key.

Lane docs/infra-alchemy-p5-fix-a-checkpoint

Reverse: none: a checkpoint; the code reverts with #3443 and #3442, the boundary with set-default-policy-version v1

### P3 Low-risk stacks complete, 2026-11-23

All four P3 stacks are live on Alchemy, and none has a live Pulumi program.

- **Storybook:** live since #3289 (2026-11-13); Pulumi stack `beep-storybook/production` removed (`decisions/2026-11-13-storybook-is-live-on-alchemy-pulumi-stack-beep-storybook-production-removed.md`).
- **Turbo cache:** `@beep/infra-turbo-cache` serves CI. Stage 2 moved every Turbo-backed workflow to the Worker cache (`decisions/2026-11-18-turbo-cache-stage-2-every-turbo-backed-ci-job-reads-the-worker-cache-under-new-names.md`), and the follow-on chain (#3380, #3385, #3389, #3390) brought the schedule and dispatch callers along. Hit evidence: main Check run 45225209782 at `3a5d25a64b7c`, job Heavy / Docgen 137885914937, `TURBO_API` the Worker, `Cached: 197 cached, 200 total`. The Pulumi lab stack `lab-c1023a` was destroyed on 2026-10-24 and never held live state (`decisions/2026-11-14-turbo-cache-lab-lab-c1023a-was-destroyed-on-2026-10-24-nothing-is-live.md`).
- **Cost controls:** live since #3320; the old pair was destroyed and 11 state entries removed, with the BEFORE export archived by sha256 (`decisions/2026-11-14-cost-controls-pulumi-cutover-executed.md`).
- **GitHub:** `@beep/infra-github` is armed and has deployed since 2026-11-18 (`decisions/2026-11-18-infra-github-is-armed-beep-infra-github-app-5808968-first-deploy-adopted-ruleset-10240248-with-no-write.md`). Its latest deploy, run 45253869434 after #3510, created exactly the `fleet-watch` environment and its variable. GitHub never had a Pulumi program.

The exit criterion's four Pulumi programs therefore resolve to two destroyed with export archives (Storybook, cost controls), one lab stack destroyed before this packet, and one that never existed (GitHub).

Lane docs/infra-alchemy-p3-close

Reverse: Set P3 back to in-progress in ops/manifest.json, PLAN.md and README.md and delete this checkpoint.

<!-- beep:decisions:end -->
