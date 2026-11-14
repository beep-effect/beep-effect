---
title: "First armed OipWeb deploy failed on a sensitive variable edit"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p4-oip-web-envvar-fix"
reversal: "Revert the EnvVar edit-field change; the rehearsal stack is test-only and can be deleted"
---

**What happened.** Before arming, the packet gate archived both Pulumi stacks of `opip-web`:
- `staging`: 79,266 bytes, sha256 `23c44a9f…1b4a93`, 18 resources, 0 pending operations.
- `production`: 101,138 bytes, sha256 `465ab3f9…81c803`, 22 resources, 0 pending operations.

The archives are kept off-repo under the operator's infra archive directory. The gate then armed the
deploy job: `OIP_WEB_INFRA_DEPLOY=enabled` at 2026-11-14T10:29:44Z, and `workflow_dispatch` run
43585534113 on `main` `b7d3c9d99a4`.

Staging went as follows:
- The plan was `Plan: 6 to create, 3 to adopted`, as predicted, and the guard passed.
- 8 of 9 resources applied: the project and both DNS records adopted, the two domains created with
  no change, the new `oip-law-web-assets-staging` bucket created, and `NEXT_DISABLE_PWA` and
  `CRM_HUBSPOT_ACCOUNT_ID` rewritten in place.
- `EnvHubSpotServiceKey` failed with `BadRequest: You cannot change the key of a Sensitive
  Environment Variable.`
- The job stopped before prod.

The gate disarmed at 10:31:44Z (variable deleted). Afterwards all six hostnames served normally,
Alchemy rows existed only under `OipWeb/staging/`, the prod bucket was absent, and Pulumi was
untouched.

**Cause.** `Vercel.EnvVar`'s in-place edit (`PATCH /v9/projects/{id}/env/{envId}`) sent the
variable's `key`. The real API refuses any `key` on a sensitive variable, even the identical one.
The evidence test that cleared arming ("one `PATCH Env`, no delete, no duplicate") ran the real
provider against an in-memory Vercel API that accepted the body. The fake was more permissive than
the service it models, so a green test proved nothing about this write.

**Fix (this lane).**
- The in-place edit now sends only what Vercel lets an edit change:
  - the value, always, because it cannot be read back and an edit is how adoption and rotation
    reach Vercel;
  - the targets and git branch, only when they differ from what is stored;
  - a declared comment.
- It never sends `key` or `type`. A key change is now a create-first replacement (review round 1
  on #3339): the new variable is created before the old one is deleted, so a failed create leaves
  the old one in place. Only a type change on the same project and key deletes first.
- The fake refuses what the real API refuses: any `key` on a sensitive variable, a non-sensitive
  `type` on a sensitive variable, and a `gitBranch` without the `preview` target. It also records
  each PATCH body's fields so tests assert them.

**Rehearsal on the real API.** Personal stage `dev_elpresidank`, scratch objects only, all
destroyed afterwards:
- The test-only stack `apps/oip-web/test/live/rehearsal.alchemy.run.ts` ran:
  1. A seed create.
  2. A state delete, then a re-deploy with every object adopted. This is the live stages' create
     path over existing variables, for encrypted, sensitive `valueFrom` and plain alike.
  3. A target change on the plain variable.
  4. A rotation of the sensitive value.
  5. A target change on the sensitive variable.
- The staging re-run shape ran separately: the variable's row was dropped while the project's row
  stayed, so the plan was `1 to adopted`, and the plan after it had no changes. A failed create does
  not delete its row, though: it leaves a `creating` checkpoint, which plans as `create` (below).
- The real `OipWeb` personal stage was deployed and destroyed, covering its project, two variables
  and bucket.
- Every write succeeded in place: same ids, no duplicates, stored types unchanged.

**The re-run.** After #3339 merged (`6e393d55c29`, 11:44:22Z) the gate re-armed at 11:45:21Z, and run
43591525409 succeeded on both stages:
- staging: `Plan: 1 to create` (`[EnvHubSpotServiceKey] create`, the eight others `noop`), then `Done: 1 succeeded`;
- prod: `Plan: 8 to create, 5 to adopted`, then `Done: 13 succeeded`.

Staging printed `create` rather than the probe's `adopted`. Alchemy commits a `creating` checkpoint
without attributes before it calls the provider (`Apply.ts`), the failed call left it in state, and the
planner prints such a row as `create`, deferring adoption to apply time (`Plan.ts`). The probe had
deleted the row instead, a wrong model of a failed create.

After the run, read-only:
- All six live variables kept their pre-arming ids, types and targets, with one variable per key.
- The six domains, six DNS records and both `*.vercel.app` domains were unchanged.
- No log line carried a value or a `__redacted__` envelope.
- Every `OipWeb` state row is `created` or `updated`.

**Rule from now on.** A provider write path is exercised against the real API on a scratch stage
before any live stage is armed. Fake-only evidence is not enough for a first arm. A fake encodes
only the API rules someone has observed or confirmed in the docs, and each such rule is pinned by
a test.
