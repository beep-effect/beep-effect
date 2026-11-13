---
title: "Regeneration and relock pushes use the knowledge-mint App token, minted right before the push"
date: 2026-11-13
lane: "fix/compute-profile-acceptance-fixes"
reversal: "Point the two push steps at another App's client id and key, or restore a PUSH_TOKEN expression with a github.token fallback and a summary warning"
---

Supersedes the 2026-11-08 BEEP_SKILLS_TRAIN_TOKEN decision. That secret was never created (repository secrets on 2026-11-13: APP_ENV, APP_LOG_FORMAT, APP_LOG_LEVEL, APP_NAME, KNOWLEDGE_MINT_APP_PRIVATE_KEY, NEXT_PUBLIC_ENV, TURBO_*, VERCEL_TOKEN), so the dankserver acceptance push of 2026-11-13 went out as `github-actions[bot]` and every follow-up run on its head (43423589914, 43423589737, 43423589561) ended `action_required`.

Both workflows now mint an installation token of the `beep-knowledge-mint` App (app id 5321422) with `actions/create-github-app-token`, `client-id: vars.KNOWLEDGE_MINT_APP_CLIENT_ID`, `private-key: secrets.KNOWLEDGE_MINT_APP_PRIVATE_KEY` and `permission-contents: write` only, in the step right before the push. Reuse is acceptable: the installation grants contents, issues and pull requests write but no `workflows`; it is not a bypass actor on the `main` ruleset (its only Integration bypass is `beep-fleet-orchestrator`, 5309624); the token is scoped to this repository, lives one hour and is revoked at job end; and the Lint Policy seal guard keys on the mint App authoring a PR on `automation/knowledge-baseline-mint` and re-mints the baseline byte for byte, which a contents-only token on another branch cannot satisfy. A write collaborator who could read the token gains nothing beyond their own push access.

`catalog-regeneration.yml` splits into two jobs. `regenerate-catalogs` runs pull-request code with `contents: read` and no secret and uploads the shard diff as an artifact. `push-catalogs` runs on a fresh runner, executes nothing from the PR (no setup, no install, git hooks off), refuses a diff that touches anything but the two shard directories or adds a symlink, submodule or mode change, re-reads the PR to confirm it is still a labelled draft, and only then mints the token. In one job, a background process started by an earlier PR-code step could read a later step's token; a separate runner closes that. The relock job keeps one job because the code it runs is the branch check's proven Renovate/relock-only head.

No silent fallback: when `KNOWLEDGE_MINT_APP_CLIENT_ID` is unset the push fails closed and its summary says that a github.token push would leave the follow-up runs waiting for approval. `skills-update-train.yml` had the same latent defect; its history (260 pull-request runs) shows no Renovate skills PR and so no relock push yet.
