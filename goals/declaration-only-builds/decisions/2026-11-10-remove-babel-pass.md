---
title: "Remove the Babel annotate-pure-calls pass repo-wide, proven by the declaration-only PR's hosted gate"
date: 2026-11-10
reversal: "Restore the script values in the policy and run bun run beep lint package-scripts --write."
---

The `__PURE__` markers go into `dist/*.js`, which nothing bundles: apps, tests and binaries resolve `exports` to `src`, and the effect-drizzle bundle probe aliases to `src` and relies on markers hand-written in source. On `@beep/schema` the pass cost more than the compile (0.64 s against 0.27 s, best of six). The operator asked for removal after a full-gate proof; that proof is the hosted gate on the PR that removes JavaScript emit, so both land together. The pass returns inside a publish lane at Release Lane activation. Rejected: keeping it for `packages/ecosystem/*` only, and keeping it everywhere to mirror Effect. Operator ruling.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q4).
