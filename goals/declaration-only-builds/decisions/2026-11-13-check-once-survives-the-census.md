---
title: "Check-once survives the census; PR 3 goes ahead for 180 packages"
date: 2026-11-13
lane: "chore/declaration-only-builds-baseline"
reversal: "Record a decision that cuts PR 3 and leave the own-source check in every generated check script; the census mode stays as a diagnostic."
---

The census build-equivalence mode compared each emitting package's build with its own-source check in 2,912 runs: 182 packages, a clean pass and a seeded pass, from a Turbo cache restore, a warm retry and a cold build, with `TSRS_FAST` unset and `1`. Every comparison matched and every probe was effective. A warm or restored build never hid an error the check reported and never kept one after the fix. The cross-package case (an upstream export renamed under stale downstream incremental state) matched too.

So PR 3 is kept. Its scope is the 180 packages whose check program is the build program. `@beep/effect-drizzle` and `@beep/markdown` add `scripts` to their check config, so their check is wider than their build and stays. Declaration-emit diagnostics remain build-only, which makes the build the stricter of the two.

PR 3 still needs the Turbo `check` to own-`build` edge agreed with `goals/verification-route` and `goals/route-soundness-repair`, and it is still the first thing cut if the appetite runs out.

Evidence: `goals/declaration-only-builds/research/2026-11-10-build-check-equivalence.md`.
