---
title: "Codex is exhausted until about 2026-11-13; the remaining T2 reads run on Opus 5.5 through the local proxy"
date: 2026-11-07
lane: "feat/research-intake-2026-11"
reversal: "Re-run any partition with --profile codex-sol after the Codex reset; per-artifact records keep completed reads"
---

After 463 T2 readings, the signed-in Codex account and then every proxy credential for gpt-6.1-sol reported usage_limit_reached (proxy reset in about 142 hours). Remaining pools: Cursor's API pool shows 0% and refuses private artifacts anyway, and Grok has no mine profile. claude-opus-5-5 is the Claude chain's step 1 and its rate limit had cleared, so the remaining ~724 reads (public and private) run on a new proxy-opus profile. It launches claude -p against CLIProxyAPI with a scrubbed environment, so the batch draws on every admitted Claude login instead of the 12%-left account the CLI is signed in to. The runner pauses on quota errors. Rejected: waiting six days for the Codex reset, and buying credits (operator-only spend).
