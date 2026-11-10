---
title: "Landed levers stay in the goal with their evidence, unpaid gate items and scorecard reading"
date: 2026-11-09
reversal: "Supersede with a decision file if the exploration amends D26; the landed levers would then leave the Levers table."
---

LINT-01 and LINT-04 landed in #3019 and LINT-02 slice 1 rides open #3041. Each stays in this goal's Levers table as landed (or carried), with its commit or PR as evidence, the part of its admission gate that was never paid (fixtures, replays, digests, A/B runs) as a slice, and its reading in the certainty scorecard. A commit message that asserts parity does not pay a gate that names fixtures or digests. Rejected: deleting a lever once its code lands (its unpaid gate and its saving would have no owner).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D26).
