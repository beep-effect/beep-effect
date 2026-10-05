# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-10-05

Operator ask (verbatim intent): make beep-effect more cloud-environment
friendly. Many cloud credits across the ChatGPT and Claude subscriptions expire
in the coming weeks. Environments cannot be shared across subscriptions, so
cloud environments must be set up across 4 Claude, 4 ChatGPT, and 1 Cursor
subscription. Believed a goal packet already existed — it did not; this packet
is the first.

Credit state observed the same day:

- Each Claude account: Settings → Usage shows **Cloud session credits,
  Included credit $250 of $250 left, expires 1:59 AM CST, November 5**.
  "Applies automatically to cloud sessions. After it's used or expires, your
  plan's regular usage applies." Four accounts → $1,000 on a four-week clock.
- Codex Pro accounts: $200 cloud credits valid until 2026-11-20 (per OpenAI
  help/community sources in RESEARCH.md).
- Cursor: one subscription, environment already repo-committed.

What is already in the repo: `.cursor/environment.json` + `.cursor/install.sh`
(PRs #885, #887, Aug 2026) — a working Cursor Cloud Agent bootstrap (pinned
Bun, Node 24 via nvm, portless, GPG-verified `op`, `bun install
--ignore-scripts`, `bun run prepare`). Nothing for Claude cloud or Codex cloud.

Structural fact driving the plan: eight of the nine environments can only be
created by hand in a vendor UI (Claude and Codex environments are per account
with no API). The repo's job is to make each UI entry a one-line paste that
stays correct as the repo evolves.

First-session work (this packet's opening lane): `scripts/cloud/bootstrap.sh`
as the single vendor-neutral bootstrap; `.cursor/install.sh` becomes a thin
caller; a `CLAUDE_CODE_REMOTE`-guarded SessionStart hook; runbook
`docs/runbooks/cloud-environments.md` with the per-vendor paste text.
