---
title: "OipWeb Pulumi cutover done, both stacks removed"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p4-oip-web-cutover"
reversal: "Run the archived script's rollback per stack from a checkout that still has infra/oip-web (6e393d55c29): stack init, stack import of the archive, targeted refresh of the bucket group; disarm OIP_WEB_INFRA_DEPLOY first"
---

The packet gate session ran the `opip-web` Pulumi cutover on 2026-11-14, staging first. It used the
attended script, with one `stack_ls_json` fix: bare stack names are normalized to full names. Every
step was announced to the orchestrator, and every time below is UTC from command output.

**Archives, taken 10:29Z.** Both are kept until P6 under
`~/.local/state/beep/infra-archives/pulumi-exports/`, off-repo.

| Stack | Resources | Bytes | sha256 |
| --- | --- | --- | --- |
| staging | 18 | 79,266 | `23c44a9f49d6c5d0804af5b3e794aacfe8958e2882624572d20150df2d1b4a93` |
| production | 22 | 101,138 | `465ab3f9bca3d89165819155e63ec341469ddea20ee7fa04fc1f3ed61a81c803` |

The same directory (`opip-web-<stack>-2026-11-14-*`) also holds every step snapshot, the compare
inputs, both destroy previews (JSON) and both destroy logs, plus the script (`oip-web-pulumi-cutover.sh`)
and its steps file. Those are what `rollback` needs.

**The armed deploy before it.** Run 43591525409 (main `6e393d55c29`):
- staging planned `Plan: 1 to create` (`[EnvHubSpotServiceKey] create`, eight `noop`);
- prod planned `Plan: 8 to create, 5 to adopted`;
- both deployed, and the smoke checks passed.

The probe had predicted `1 to adopted` for staging. Why `create` printed instead:
1. Alchemy commits a `creating` checkpoint with no attributes before it calls the provider
   (`Apply.ts`).
2. The failed first run (43585534113) left that checkpoint for `EnvHubSpotServiceKey`.
3. The planner prints such a row as `create` and decides adoption at apply time (`Plan.ts`).
4. The probe had deleted the row instead, a wrong model of a failed create. The stack test now
   models the checkpoint.

Before the cutover, the live state matched the pre-arming census: the six variable ids, one variable
per key, the same types and targets, and unchanged domains and DNS records.

**Staging.**
1. Detach 8 URNs, 11:54:24Z to 11:54:39Z: 18 to 10 resources, compare ok.
2. Old bucket `staging-assets.oip.law`: 0 versions, 0 delete markers.
3. Unprotect 5 resources at 11:55:09Z.
4. The destroy preview showed exactly five deletes; destroy ran 11:56:08Z to 11:56:21Z with the
   orchestrator's go: `5 deleted, 2 unchanged`, 10 to 5, compare ok.
5. Component state delete at 11:56:54Z: 4 left.
6. `stack rm --force --preserve-config` at 11:57:10Z.

**Production.**
1. Detach 12 URNs, 11:57:39Z to 11:58:01Z: 22 to 10, compare ok.
2. Old bucket `assets.oip.law`: 0 versions, 0 delete markers.
3. Unprotect 5 resources at 11:58:04Z.
4. The destroy preview showed exactly five deletes; destroy ran 11:58:51Z to 11:59:06Z with the
   orchestrator's go: `5 deleted, 2 unchanged`, 10 to 5, compare ok.
5. Component state delete at 11:59:26Z: 4 left.
6. `stack rm` at 11:59:33Z.

**After.**
- `pulumi stack ls -a` lists only `organization/beep-ci-runners/production`: 354 resources,
  lastUpdate 2026-11-14T05:22:19.684Z, unchanged throughout.
- Both old buckets return 404; both Alchemy buckets exist; all six hostnames serve.

**What this PR retires (#3341).** The Pulumi program goes: infra/oip-web (removed in #3341), infra/src/OipWeb.ts
(removed in #3341), its entry and test. The Storybook Pulumi program goes in the same PR, under the P6 retire inventory
R1 (its stack was removed on 2026-11-13): infra/storybook (removed in #3341) and infra/src/Storybook.ts (removed in #3341), with its
entry and test, and infra/src/Vercel.ts (removed in #3341), which only those two programs imported. So
`@pulumi/cloudflare` and `@pulumiverse/vercel` leave `infra/`, the root catalog and `bun.lock`. The
turbo-cache lab program and the runners program are unchanged.
