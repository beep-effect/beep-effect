---
title: "infra-github is armed: beep-infra-github App 5808968, first deploy adopted ruleset 10240248 with no write"
date: 2026-11-18
lane: "goals/infra-alchemy-rebuild-mint-vault-writer"
reversal: "gh variable delete INFRA_GITHUB_DEPLOY_ARMED -R beep-effect/beep-effect"
---

**App.** `beep-infra-github`, app id 5808968, installation 183128206, installed on
`beep-effect/beep-effect` only. The 2026-11-15 mint registered App 5766296 but could not
store its key (the `op` on `PATH` was the service-account shim, which cannot create items);
that orphan App was deleted. The 2026-11-18 mint stored the credentials through `op-human`.
The launcher now picks a human-capable writer and preflights the vault before it listens
(this PR).

**Environment.** `infra-github-prod` has a `main`-only branch policy plus
`INFRA_GITHUB_APP_ID`, the secret `INFRA_GITHUB_APP_PRIVATE_KEY` and
`ALCHEMY_STATE_ROLE_ARN = arn:aws:iam::832907639880:role/beep-alchemy-infra-github-deploy`.
The role was created per decision `2026-11-14-infra-github-deploy-role`. IAM simulation:
`allowed` under `InfraGithub/`, `implicitDeny` under `CostControls/`, `implicitDeny` for
`PutBucketVersioning`.

**Armed.** `INFRA_GITHUB_DEPLOY_ARMED=true` at 2026-11-18T00:10:15Z. First deploy: run
44205593606 on `main` 0ebff74854, success at 00:11:58Z.

**Ruleset 10240248.** The normalized diff of `rules`, `conditions`, `bypass_actors` and
`enforcement` (ids and timestamps removed) is empty. `updated_at` is unchanged at
2026-10-27T04:49:40-05:00: the stack adopted the ruleset with no write. The CI goals driver
ruled no window-5 restart.

**Side effect.** The provider's create upserts existing objects. Eight labels that had no
description now return `""` instead of `null`. Everything else matches the census:
repository settings, the four environments, and the `KNOWLEDGE_MINT_*` variables are
untouched.

**Standing rule (CI goals driver).** Report a later infra-github deploy only if the ruleset
diff is non-empty, or the deploy changes repository settings or required contexts.
