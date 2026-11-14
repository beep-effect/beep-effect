---
title: "Packet gate ruling: the beep-infra-github App key is the one credential that enters CI for this stack"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p3-github"
reversal: "Delete the environment secret INFRA_GITHUB_APP_PRIVATE_KEY on infra-github-prod and uninstall the beep-infra-github App; the stack then cannot deploy from CI."
---

Ruling by the packet gate session, 2026-11-14, on review thread discussion_r4572751666. It amends
`2026-11-13-packet-gate-ruling-every-secret-stays-unmanaged-and-no-new-long-lived-credential-enters-ci.md`,
whose reversal line anticipated this ("a later decision names … the delivery route the gate approves").

What stands unchanged: the 2026-11-13 ruling was about delivering secret values. It kept a 1Password
service-account token, which can read every secret, out of CI. So every repository and environment secret stays
unmanaged by the stack.

What is amended, for one credential only: the deploy identity. The private key of the `beep-infra-github` App is
stored as an environment secret, `INFRA_GITHUB_APP_PRIVATE_KEY`, on `infra-github-prod`. It enters CI only in the
token-mint step of `deploy-infra-github.yml` (`actions/create-github-app-token`), which exchanges it for a one-hour
installation token.

Why: the stack writes repository settings, rulesets, environments, variables and labels, and the Actions
`GITHUB_TOKEN` can do none of that, so some administrative identity is unavoidable. The narrowest one available is
an App that:
- is installed on this one repository;
- has only the permissions the stack needs;
- has a key readable only by jobs on `main`, through a protected environment;
- exchanges that key for a one-hour token on every run.

The App and its environment:
- **App permissions** (checked-in manifest
  `packages/tooling/policy-pack/repo-configs/data/github-apps/beep-infra-github.manifest.json`): repository
  `administration` write (settings and rulesets), `environments` write, `actions_variables` write, `issues` write
  (labels), `metadata` read. No secrets permission, no events, webhook inactive.
- **Installation:** `beep-effect/beep-effect` only.
- **Mint step:** no `permission-*` inputs, so the token carries exactly the App's permissions.
- **Environment `infra-github-prod`:** deployment branch policy `protected_branches: false`,
  `custom_branch_policies: true`, with one branch policy, `main` (type `branch`). Only a job running on `main` can
  read the secret.

Alternative considered and not taken: keeping the key in AWS (SSM Parameter Store or Secrets Manager) and fetching
it through the OIDC role. That keeps the key out of GitHub's secret store but not out of the job's reach, and it
adds a second system to rotate.

Controls:
- The key is never a repository-level secret.
- It reaches no step but the mint step. This is already true in the workflow (blob
  `9b4af8a47264f24357b22016096c59689fca8fc3`), and the job-level `env` holds no secret.
- Rotation (runbook, InfraGithub section): mint a new key in the App settings, replace the environment secret, then
  delete the old key in the App settings.
- The operator mints the App and stores the key, so the credential exists only by their act.
