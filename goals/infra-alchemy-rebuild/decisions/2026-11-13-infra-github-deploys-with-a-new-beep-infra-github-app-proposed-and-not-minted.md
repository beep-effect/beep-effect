---
title: "infra-github deploys with a new beep-infra-github App, proposed and not minted"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-github"
reversal: "Use another credential with the same permissions in the workflow's token step; nothing is minted yet."
---

`@alchemy.run/github` authenticates with `GITHUB_TOKEN`; the workflow's own token cannot administer rulesets, environments or variables, and no installed App has those permissions (`beep-ci-fleet-controller` has `administration: write` but is the runner fleet's identity, and widening it couples two blast radii). Proposed, not minted: a new GitHub App `beep-infra-github` registered by `bun run beep github app mint` from a checked-in manifest (D10, same shape as `beep-knowledge-mint.manifest.json`: private, webhook inactive, no events), installed on `beep-effect/beep-effect` only, repository permissions `administration: write`, `environments: write`, `variables: write`, `issues: write` (labels), `metadata: read`, and `secrets: write` only once a secret is managed. Its id is the `infra-github-prod` environment variable `INFRA_GITHUB_APP_ID`; its private key is that environment's secret `INFRA_GITHUB_APP_PRIVATE_KEY` (also kept in 1Password by the mint). The deploy job mints a one-hour installation token with `actions/create-github-app-token` (already pinned in this repository); `GitHub.fromApp` in beta.86 is the in-process alternative. The read-only plan ran with the operator's `gh` token (`repo`, `admin:org`, `workflow` scopes).
