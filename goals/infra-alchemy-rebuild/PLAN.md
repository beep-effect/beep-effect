# Rebuild beep-effect infrastructure on Alchemy and distilled, Pulumi retired Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | in-progress | Deep-research pass: the alchemy.run doc pages listed in `research/SOURCES.md`, the full `alchemy` and `distilled` sources, t3code `infra/relay` and `infra/task-cache`, all 47 alchemy.run blog posts (grok-4.7 xhigh lanes). Produce the "use this, never roll that" matrix. | Matrix reviewed by the operator; every planned package and resource maps to an Alchemy/distilled primitive or a recorded gap. |
| P1 Foundations | pending | Doctrine amendment (tooling kind `infra`); catalog pins for `alchemy`, `@alchemy.run/*`, `@distilled.cloud/*`; S3 state store bootstrapped under a new bucket; `BeepEffectWeb` re-adopted into it; CI deploy skeleton (per-stack concurrency, `op run`). | `alchemy plan` for `BeepEffectWeb` is a no-op on the shared store; one workflow deploys a stack from `main`. |
| P2 Providers | pending | `@beep/alchemy-vercel`, `@beep/alchemy-aws-extras`, `@beep/alchemy-github-runners`, each on the `@alchemy.run/test` harness. | `package-verify` green; provider tests cover create/update/delete/read/adopt. |
| P3 Low-risk stacks | pending | Storybook, turbo cache (move scratchpad module, delete scratchpad), cost controls, GitHub. Parallel build, flip, destroy Pulumi program. | Each stack live on Alchemy; CI enrolled on the Worker cache with hit evidence; four Pulumi programs destroyed with export archives recorded. |
| P4 OIP and hosts | pending | OIP web (Vercel project, env vars, domains, DNS, assets bucket), AI metrics and OpenClaw through `@beep/infra-hosts`. | oip.law prod and staging served from Alchemy-managed config; hosts deploy via Alchemy; two more Pulumi programs destroyed. |
| P5 Runner fleet | pending | `@beep/infra-ci-runners` deployed beside the live fleet, CI moved over, old fleet destroyed. | Hosted CI green on the new fleet for a full day; `beep-ci-runners` destroyed; export archived. |
| P6 Retire | pending | Delete `infra/`, Pulumi and TS6 pins, root `postinstall` hook, runbook rewrite. | Verification matrix rows "Pulumi gone" and "Infra gone" pass on `main`. |
| P7 Yeet: final PR to mergeable | pending | Publish through yeet and drive the final PR to mergeable. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P8 Close | pending | Closeout reflection, `proposedCloseout`, packet-state PR. | `closeout.status == initiative.status` on `origin/main`. |

Each phase ships as its own PR wave (at most three open at once per packet). Stacks inside P3
and P4 may ship as separate PRs.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

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

_No checkpoint files yet._

<!-- beep:decisions:end -->
