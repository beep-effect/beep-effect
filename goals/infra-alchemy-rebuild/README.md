# Rebuild beep-effect infrastructure on Alchemy and distilled, Pulumi retired

## Status

Lifecycle: `completed-retained`

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

Closed by the final PR #3567 (P6 Retire, P7, P8): `infra/` and Pulumi are deleted, and every stack runs on Alchemy.
P5 closed 2026-11-26: the new fleet serves CI, the Pulumi controllers' webhooks were deleted (step 6b), and
the whole `beep-ci-runners` stack was destroyed (step 6 (d), 353 resources, export archived;
`decisions/2026-11-26-ci-runners-6d-whole-stack-destroy.md`). P4 closed with AI metrics deployed through
`@beep/infra-hosts` (#3560). Two operator steps follow the merge and change no repository file:
`pulumi stack rm production` and the step 6 (f) choices
(`decisions/2026-11-26-closeout-rides-the-p6-retire-pr.md`).

P3 Low-risk stacks closed 2026-11-23: Storybook, the turbo cache, cost controls and GitHub are live on
Alchemy. CI reads the Worker cache, and no live Pulumi program remains for any of them
(`decisions/2026-11-23-p3-low-risk-stacks-complete.md`).

P2 Providers closed 2026-11-14: `@beep/alchemy-aws-extras` (#3292), `@beep/alchemy-vercel` (#3290) and
`@beep/alchemy-github-runners` (#3291 for the Lambdas, #3314 for the composite) each pass `package-verify`, with
`@alchemy.run/test` or fake-HTTP coverage of create, update, delete, read and adopt. Nothing was deployed.
P1 Foundations closed 2026-11-13: the first `prod` deploy on the shared S3 store showed no create
or replace.

## Latest Evidence

- 2026-11-26 P6-P8: final PR #3567 deletes `infra/`, the Pulumi catalog entries and postinstall, and the destroyed AWS cache's credential census; the closeout reflection is `history/reflections/2026-11-26-claude.md`.
- 2026-11-26 P5 exit: step 6b (hooks 663255260 and 711445970 deleted; proof on hook 714397446), step 6 (c) export (354 resources), step 6 (d) destroy (353 deleted across two runs, 0 left; `decisions/2026-11-26-ci-runners-6d-whole-stack-destroy.md`).
- 2026-11-26 P4 exit: Phoenix on `@beep/infra-hosts` (#3560, `decisions/2026-11-26-ai-metrics-health-gate-without-docker-healthcheck.md`).
- 2026-11-23 P3 exit: Storybook (#3289), turbo cache (stage 2 plus #3380/#3385/#3389/#3390; main run 45225209782 Docgen `Cached: 197 cached, 200 total` on the Worker), cost controls (#3320) and GitHub (run 45253869434); `decisions/2026-11-23-p3-low-risk-stacks-complete.md`.
- 2026-11-14 P2 exit: #3292 (aws-extras), #3290 (vercel), #3291 (runner Lambdas) and #3314 (`RunnerFleet`, `RunnerSweep`, runner user data, composing `RunnerLaunchTemplate`); `decisions/2026-11-14-p2-providers-complete.md`.
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
