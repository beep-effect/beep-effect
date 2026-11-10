---
title: "#3056 landed four Property Laws slices; this goal accepts the layout and keeps D10's order for everything after it"
date: 2026-11-10
lane: "feat/turb-01-standards-coverage-owners"
reversal: "Return Property Laws to two slices by ci-lane-economics' recorded reversal (restore the [repo-cli, rest] matrix and its two filters); this goal may ask for it by a new decision if the census shows the four-slice layout loses or duplicates a property-executing test."
---

#3056 (741b1492b2a, ci-lane-economics, 2026-11-10) replaced the two Turbo-filter slices that D26 accepted with four: `repo-cli-1` and `repo-cli-2` are the two Vitest shards (`--shard 1/2`, `--shard 2/2`) of the @beep/repo-cli sweep, `foundation-drivers` takes `./packages/foundation/**` and `./packages/drivers/**`, and `rest` takes every other package, by complementary filters under the unchanged Property Laws aggregate. The shards now wait on Change Profile and Test Plan instead of Heavy Admission. The cause was latency: as two slices, repo-cli ran 5.7 to 7.9 min and a full rest 8.0 to 9.5 min, so one slow runner put the verdict past ten minutes. Run floors and seeds did not change.

This goes further than D26, and splitting the repo-cli sweep into two Vitest shards is the shape HOST-05 described, landed before the oracle census and the residual file split that D10 put first. This goal does not revert it: the layout is ci-lane-economics' landed state and its reversal is recorded there. D10's order still binds what follows. No further Property Laws shard or slice lands before the oracle census and the residual file split slice, and HOST-05 is read as the gate for any shard beyond these four, still only after the split slice and with the D5 ruling. The census slice must now join its (file, test, runs, seed) log across all four slices and prove the union equals the full sweep with no test in two slices, including the Vitest shard boundary inside repo-cli. The p95 that the HOST-05 gate reads is the aggregate's, over the four-slice layout.

Rejected: revert to two slices (undoes a measured latency fix owned by another goal for no proof gain); treat HOST-05 as done (the census aggregate it required has not landed).

Source: commit 741b1492b2a (`.github/workflows/check.yml` Property Laws matrix, `CiLane.ts` lane filters and `--shard`), `goals/ci-lane-economics/decisions/2026-11-10-split-property-laws-into-four-slices-and-create-them-with-the-test-shards.md`; exploration `explorations/ten-minute-certainty/DECISIONS.md` (D10, D26).
