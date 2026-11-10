# Vercel deploys

The Vercel apps (`todox`, `oip-web` and the Pulumi-managed `oip-web-staging`)
deploy from GitHub Actions, not from Vercel's Git integration. The workflow is
`.github/workflows/vercel-deploy.yml`.

## Why Git-triggered deploys are off

All three projects sit on the Hobby team `kriegclouds-projects`, which allows
100 deployments a day. Each project was connected to this repository, so every
push to every branch started three deployments. At about 77 merges a day plus
agent PR pushes, the team stayed out of quota: almost every PR head carried
`Vercel – <project>: Deployment rate limited — retry in 24 hours.` and real
deploys, production included, queued behind wasted ones.

Measured on 310 first-parent `main` commits (2026-11-05 to 2026-11-09):
`turbo ls --affected` flagged `todox` in 58 and `oip-web` in 57. The other
roughly 80% of builds rebuilt an unchanged app.

The mainstream fixes, and why each was or was not used here:

| Mechanism | Counts against the quota | Used |
| --- | --- | --- |
| Native "skip unaffected projects" (`enableAffectedProjectsDeployments`) | No, since 2026-10-21 | No. Any change outside a workspace package (`goals/`, `standards/`, `docs/`, `.github/`, root config) is a "global change" that deploys every project, and 86% of `main` commits touch one. |
| Ignored Build Step / `turbo-ignore` (`ignoreCommand`) | Yes: the cancelled build is a full deployment | No |
| `git.deploymentEnabled: false` + GitHub Actions deploys | Only for deploys the workflow creates | Yes |

The last row is the pattern in Vercel's own GitHub Actions guide
(`vercel pull`, `vercel build`, `vercel deploy --prebuilt`, and
`"git": { "deploymentEnabled": false }` in `vercel.json`). It is also what
Vercel staff recommend for monorepos whose non-workspace churn defeats native
skipping.

## What deploys when

| Event | Projects | Rule |
| --- | --- | --- |
| Push to `main` | `todox`, `oip-web` | Production deploy when `turbo query affected --tasks build --packages <pkg>` lists `<pkg>#build`, diffing the project's last READY production deployment against the pushed commit. No base, a base missing from history, or a Turbo error deploys (fail open). |
| Pull request | `todox`, `oip-web` | Preview deploy only when the PR changes `apps/<app>/`. A PR that changes only shared packages gets no preview. Dispatch the workflow if you want one. |
| `workflow_dispatch` | any, including `oip-web-staging` | Unconditional deploy of the selected ref; tick `production` for the production target. `oip-web-staging` production is `staging.oip.law`. |

Main pushes are never cancelled. A newer push replaces only the pending run,
and because every plan diffs against the last READY production deployment,
the replaced run's changes ship with the next deploy. A quota failure inside
the deploy step is a warning, not a red: the next affecting push deploys it.

The plan job summary records each project's decision and the reason.

## Credentials

- `secrets.VERCEL_TOKEN`: repository secret, sourced from
  `op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_VERCEL_TOKEN`. Rotate it in 1Password
  first, then
  `op read op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_VERCEL_TOKEN | gh secret set VERCEL_TOKEN -R beep-effect/beep-effect`.
- Team and project ids are in the workflow's `VERCEL_ORG_ID` and `VERCEL_APPS`
  env; they are not secret.

Fork pull requests have no token and plan no deploys.

## Adding an app

1. Add `"git": { "deploymentEnabled": false }` to the app's `vercel.json`.
2. Add a `VERCEL_APPS` row (`project`, `package`, `root`, `projectId`,
   `auto`) to the workflow, and the project to the `workflow_dispatch` choice.

## Reversal

Remove `git.deploymentEnabled` from the app's `vercel.json`. The Git
integration resumes deploying every push on its next commit. Delete or disable
the workflow at the same time so nothing deploys twice.

## Plan note

The Hobby plan is for non-commercial use only (Vercel fair-use guidelines).
`oip.law` is a commercial site, so it belongs on a Pro team. The `By Any Means`
team is already on Pro. Moving the project there is a billing decision for the
operator and does not change this workflow beyond `VERCEL_ORG_ID` and the
project ids.
