---
title: "The second server-side rewrite is unattributed; slice D settles it"
date: 2026-11-10
lane: "docs/stack-test-results"
reversal: "None needed: this records an open fact."
---

At 02:54:20Z on 2026-11-10, 38 seconds after another PR landed on main, both remaining test layers were rebased server-side with GitHub-signed commits. Neither the operator nor the test session did it and no repo tooling calls a branch update. If GitHub restacks on trunk moves, slice B is a precondition for any stack; if a session did it, the no-rewrite rule needs enforcing. Source: `explorations/stacked-pr-adoption/DECISIONS.md`, `second-rewrite-unattributed`.
