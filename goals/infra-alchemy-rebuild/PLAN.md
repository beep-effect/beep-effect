# Rebuild beep-effect infrastructure on Alchemy and distilled, Pulumi retired Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Deep-research pass: the alchemy.run doc pages listed in `research/SOURCES.md`, the full `alchemy` and `distilled` sources, t3code t3code's relay and task-cache stacks, all 47 alchemy.run blog posts (grok-4.7 xhigh lanes). Produce the "use this, never roll that" matrix. | Matrix reviewed by the operator; every planned package and resource maps to an Alchemy/distilled primitive or a recorded gap. |
| P1 Foundations | in-progress | Doctrine amendment (tooling kind `infra`); catalog pins for `alchemy`, `@alchemy.run/*`, `@distilled.cloud/*`; S3 state store bootstrapped under a new bucket; `BeepEffectWeb` re-adopted into it; CI deploy skeleton (per-stack concurrency, `op run`). | `alchemy plan` for `BeepEffectWeb` is a no-op on the shared store; one workflow deploys a stack from `main`. |
| P2 Providers | pending | `@beep/alchemy-vercel`, `@beep/alchemy-aws-extras`, `@beep/alchemy-github-runners`, each on the `@alchemy.run/test` harness. | `package-verify` green; provider tests cover create/update/delete/read/adopt. |
| P3 Low-risk stacks | pending | Storybook, turbo cache (move scratchpad module, delete scratchpad), cost controls, GitHub. Parallel build, flip, destroy Pulumi program. | Each stack live on Alchemy; CI enrolled on the Worker cache with hit evidence; four Pulumi programs destroyed with export archives recorded. |
| P4 OIP and hosts | pending | OIP web (Vercel project, env vars, domains, DNS, assets bucket), AI metrics and OpenClaw through `@beep/infra-hosts`. | oip.law prod and staging served from Alchemy-managed config; hosts deploy via Alchemy; two more Pulumi programs destroyed. |
| P5 Runner fleet | pending | `@beep/infra-ci-runners` deployed beside the live fleet, CI moved over, old fleet destroyed. | Hosted CI green on the new fleet for a full day; `beep-ci-runners` destroyed; export archived. |
| P6 Retire | pending | Delete `infra/`, Pulumi and TS6 pins, root `postinstall` hook, runbook rewrite. | Verification matrix rows "Pulumi gone" and "Infra gone" pass on `main`. |
| P7 Yeet: final PR to mergeable | pending | Publish through yeet and drive the final PR to mergeable. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P8 Close | pending | Closeout reflection and the `closeout` record in the final PR; completion refresh verifies it after the merge. | `closeout.status == initiative.status` on `origin/main`. |

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

### Storybook is live on Alchemy; Pulumi stack beep-storybook/production removed, 2026-11-13

PR #3289 merged 2026-11-13T22:12:56Z as 457e3ae3e8b6. Hosted run 43517423865 (Deploy Storybook, main) planned `2 to create` (Storybook/Build, Storybook), deployed `Done: 2 succeeded` with one Worker route reconciled; its smoke step failed on `iframe=404` one second after the route was created (propagation race, fixed in the turbo-cache PR, which makes both deploy workflows poll their smoke probes for up to 120 seconds). Probed by hand at 22:25Z: the index, the iframe (after its redirect), index.json and the bare slug with a query all return 200 under the public origin's storybook route, an unknown asset returns 404, and the apex still returns 200. `pulumi stack rm production --yes` then removed the empty Pulumi stack (0 resources at removal; the archive's sha256 matched the decision file); `pulumi stack ls` in that project lists no stacks.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: n/a (status note)

<!-- beep:decisions:end -->
