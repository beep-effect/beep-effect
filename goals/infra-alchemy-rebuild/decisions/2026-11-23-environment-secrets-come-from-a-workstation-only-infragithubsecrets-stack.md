---
title: "Environment secrets come from a workstation-only InfraGithubSecrets stack"
date: 2026-11-23
lane: "feat/fleet-watch-app-and-env"
reversal: "Delete secrets.run.ts, secrets.env and productionSecretsConfig; the secret stays in GitHub, unmanaged, with its reason restored to awaiting a delivery route."
---

Ruling relayed by the orchestrator on 2026-11-23: the operator wants the fleet-watch App's secret managed as code, not set by hand. The packet-gate ruling of 2026-11-13 still holds, so no credential that can read 1Password enters CI.

`@beep/infra-github` gains a second Alchemy stack, `InfraGithubSecrets` (`secrets.run.ts`). It has its own state under the shared S3 store and owns only `GitHub.Secret` resources declared by `productionSecretsConfig`. Each value is read at deploy time from 1Password through the PATH `op` shim (`op run --env-file=secrets.env`), so the committed env file holds `op://` references only. Values stay `Redacted`, which keeps them out of logs and state, and the upload is sealed to the environment's public key. The stack refuses to start when `CI` is set, and on `prod` it requires `INFRA_GITHUB_SECRETS_PLANE=workstation`. No workflow references it, and a package test checks that. The CI stack lists each owned secret as unmanaged. The first entry is `fleet-watch/FLEET_WATCH_APP_PRIVATE_KEY`, from the `beep-fleet-watch GitHub App` item. The agent service account can read that item, so an agent can apply it. Each apply is an announced live step.

Rejected: a scoped 1Password service-account token as an `infra-github-prod` secret. It would put a long-lived credential into CI.
