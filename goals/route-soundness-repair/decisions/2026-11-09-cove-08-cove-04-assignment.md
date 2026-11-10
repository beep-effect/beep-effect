---
title: "COVE-08 and COVE-04 are assigned to this goal; COVE-08 makes the comparator name literal"
date: 2026-11-09
reversal: "Move COVE-08 to heavy-pool-diet beside PERIH-01 and COVE-04 to local-proof-under-ten, and supersede this decision."
---

The first draft of MAP.md's lever table left COVE-08 and COVE-04 without a home; D23 assigns both here (MAP.md goal 2 row, amended at graduation): D6 says the fixed comparator context name lands now, and D15 requires labelled coverage rows, which COVE-04 produces, before the advisory ratchet in local-proof-under-ten. COVE-08 owns making the Coverage Regression job name in `.github/workflows/check.yml` a literal. PERIH-01's probe-deletion slice (heavy-pool-diet) owns the probe step, the `legacy_integration` output, the Test Integration name conditional and the LEGACY_COVERAGE env line and assertion. The `legacy_coverage` output has one consumer on each side, so whichever of the two lands second deletes it in that PR: if the probe deletion lands first it sets `legacy_coverage` to 'false' and COVE-08 then deletes the output together with its last consumer; if COVE-08 lands first, the probe deletion removes the output outright. Whichever lands second merges `main` first. Each updates `packages/tooling/tool/cli/test/ci-runner-security.test.ts` for the lines it changes. Neither goal claims the same lines twice. COVE-04 waits for COVE-03. Rejected: leaving both unowned until a later re-plan.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D6, D15, D23).
