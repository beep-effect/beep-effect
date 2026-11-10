---
title: "Reviewer constraints bind HOST-09, PERIH-04 and PERIL-01"
date: 2026-11-09
reversal: "Lift a constraint only by a new decision that cites a replacement proof (for example a merge gate that reads commit statuses as holding) and keeps its failure-injection or seeded-failure fixture."
---

HOST-09: the PR size label write never sits on the Change Profile to Test Unit / Heavy Admission dependency path; it is a separate non-blocking step or job that fails open, reports a failure through its own step summary line and a label_failed output (never the job exit status), and ships a failure-injection fixture showing Change Profile green, Test Unit and Heavy Admission scheduled and the failure visible. PERIH-04: Labs is excluded, because Coverage Regression requires its manifest from a successful producer. PERIL-01: the Fallow host job carries checks: write (statuses: write only if a commit status is also posted) and creates a check run, not only a commit status; the standalone Fallow job stays wherever publication is unavailable (fork PRs, any host without the permission); a seeded-failure fixture shows the Yeet merge gate refusing the PR before the standalone job is removed. Rejected: a status-only Fallow fold (GateTable reports a failed status without holding GATE-MET).
Source: exploration `explorations/ten-minute-certainty/MAP.md` (Reviewer constraints, CodeRabbit on #3017, 2026-11-09).
