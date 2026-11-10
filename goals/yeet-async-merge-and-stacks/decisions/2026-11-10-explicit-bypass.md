---
title: "Strict merges never bypass; relaxed merges request it with attribution"
date: 2026-11-10
lane: "docs/stack-test-results"
reversal: "Send bypass_rules from relaxed mode unconditionally, as the legacy endpoint did in effect."
---

The async endpoint takes `bypass_rules`, default false. Strict mode sends false. Only `--relaxed` (S11) sends true, with the attributed reds the gate already records. 42.9% of pushes to main bypassed the ruleset in the week to 2026-11-09 as a side effect of who held the token. Source: `explorations/stacked-pr-adoption/RESEARCH.md`, 2026-11-09 section.
