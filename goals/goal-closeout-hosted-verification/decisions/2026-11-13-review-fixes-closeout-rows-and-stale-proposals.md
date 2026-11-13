---
title: "Review fixes: closeout inbox rows follow main and set-status deletes stale proposals"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Read HEAD claims in the sweep again, clear refresh rows only on plain verified, stop acknowledging superseded finals' rows, and keep stale proposedCloseout keys in set-status."
---

Agent decision taken while fixing the PR A review findings (2026-11-13).

- The `yeet sweep --retire` closeout trigger counts only the claims on `origin/main` (`GoalClaimScope` `origin-main`). It speaks for `main`, and the owning clone's `HEAD` can be any branch, so a claim committed only there could verify a closeout and acknowledge its P0 row while `goals doctor --online` from `main` still blocks (DN-6). `goals completion refresh` and `goals doctor --online` keep the checkout scope, so a PR that adds an attribution still verifies in its own lane.
- `goals completion refresh` clears the `goal-closeout:<slug>#<n>` row for an `operatorRuling` on `origin/main` as well as for a plain `verified`, matching the sweep, which already acknowledges `operator-ruling`. A ruling found only at `HEAD` clears nothing.
- Rows for a final the packet no longer binds are acknowledged: by the sweep for every touched packet whose `origin/main` manifest decodes and binds no final or another final, and by a refresh that closes the new final. Without this, the reopen or rebind that the tools themselves prescribe left the old row open in every session. An absent or unparsable manifest on `main` is left alone. One helper, `updateGoalCloseoutShards`, writes both paths.
- `goals set-status` deletes a stale `proposedCloseout` when it keeps a committed closeout, reopens one, or flips a grandfathered gate, and refuses when the stale proposal names another final than the committed closeout. The doctor guard's remediation (`set-status <slug> completed-retained`) therefore works in every state that can carry the key.
