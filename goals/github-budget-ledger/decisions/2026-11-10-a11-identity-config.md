---
title: "A11 Configured identities live in $XDG_CONFIG_HOME/beep/github/identities.json"
date: 2026-11-10
reversal: "Move it into env or the state dir."
---

The configured identity list is `$XDG_CONFIG_HOME/beep/github/identities.json`, overridable with `BEEP_GITHUB_IDENTITIES_FILE`. The sampled set is its entries, the env-selected identity and `GhCli`, deduplicated by label. `OpRef` entries require `login`, and reference fields must match `op://`.

Resolves SPEC ambiguity A11 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
