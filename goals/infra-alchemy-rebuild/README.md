# Rebuild beep-effect infrastructure on Alchemy and distilled, Pulumi retired

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Rebuild beep-effect infrastructure on Alchemy and distilled, Pulumi retired (graduated from explorations/pulumi-to-alchemy).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/infra-alchemy-rebuild/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P3 Low-risk stacks (started 2026-11-13), in parallel with P2: Storybook is live on Alchemy
(PR #3289; Pulumi stack `beep-storybook/production` removed); the turbo cache's stage 1 (the
`@beep/infra-turbo-cache` Worker and R2 stack, deployed beside the live caches) is in its PR; cost
controls and GitHub are in flight. Turbo-cache stage 2 (CI enrolment) and the P5 runner fleet wait for
the ci-lane-economics window-5 verdict (2026-11-20T20:10Z).

P2 Providers (started 2026-11-13), run as three parallel lanes with one PR each:
`@beep/alchemy-aws-extras` (cost-allocation tags, the Compute Optimizer and Cost Optimization Hub
enrollments, `RunnerLaunchTemplate`; `KmsGrant` dropped because the GitHub App key delegates to
IAM), `@beep/alchemy-vercel` and `@beep/alchemy-github-runners`. P2 exits when all three pass
`package-verify` with `@alchemy.run/test` coverage of create, update, delete, read and adopt.
P1 Foundations closed 2026-11-13: the first `prod` deploy on the shared S3 store showed no create
or replace.

## Latest Evidence

- 2026-11-13 P3 turbo cache stage 1: personal-stage live proof on the Worker (remote miss then hit, read-only upload refused), stage destroyed (`decisions/2026-11-13-personal-stage-deploy-proof-blocked-the-alchemy-cloudflare-token-has-no-r2-permission.md`).
- 2026-11-13 P3 Storybook live: `decisions/2026-11-13-storybook-is-live-on-alchemy-pulumi-stack-beep-storybook-production-removed.md`.
- 2026-11-13 P1 exit: PRs #3021 and #3133 merged; hosted run 43407236289 (`Deploy beep-effect-web`, `main`) logged `Plan: 1 to update`, `[Website] update` and `Done: 1 succeeded`, no create or replace (`decisions/2026-11-13-p1-complete-p2-providers-in-progress.md`).
- 2026-11-13 P2 aws-extras lane: `decisions/2026-11-13-*.md` (KmsGrant dropped, resource shape, fake-HTTP provider tests, launch template placement).
- 2026-11-09 P1 bootstrap receipts: `decisions/2026-11-09-*.md` (state bucket, OIDC role, state move, bun patch).
- 2026-11-06 grill session: decisions D1–D16 in [`explorations/pulumi-to-alchemy/DECISIONS.md`](../../explorations/pulumi-to-alchemy/DECISIONS.md); doctrine entry "Infrastructure Stacks Are A Tooling Kind" in `standards/architecture/DECISIONS.md`.
- [explorations/pulumi-to-alchemy/RESEARCH.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/explorations/pulumi-to-alchemy/RESEARCH.md) (2026-11-02): coverage matrix, gaps G1–G9.

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
