---
title: "Layers are linked through the Stacks REST API, not gh stack"
date: 2026-11-13
lane: "feat/yeet-two-layer-stacks"
reversal: "Wrap gh stack link with remote.pushDefault injected through the environment, and drop createStack from GithubRest."
---

The P0 probes (research/stack-p0-probes-2026-11.md) created three two-layer stacks with `POST /repos/{owner}/{repo}/stacks` and a bottom-to-top list of PR numbers: 201 in under a second, drafts accepted, refusals as 422 with a sentence. Yeet already creates the PR through REST with its title, body, footer and label, so the link is one more call on the same client. `gh stack` v0.3.0 calls the same endpoints, but `submit` and `push` push every branch with `--force-with-lease`, `link` pushes branch arguments, `init` keeps per-clone tracking state, and `submit` refuses with three remotes unless `remote.pushDefault` is injected. A lane's only push stays the one Yeet proves. The CLI is not a dependency of any Yeet command.
