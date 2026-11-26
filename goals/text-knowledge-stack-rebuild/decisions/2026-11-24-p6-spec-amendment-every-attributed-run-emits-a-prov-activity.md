---
title: "P6 SPEC amendment: the L5 exit's 'every run emits a prov:Activity' reads 'every attributed run, successful or failed, emits a prov:Activity'"
date: 2026-11-24
lane: "p6"
reversal: "Restore the SPEC wording and make every Operation run, plain arrows included, emit an activity"
---

Independent review of the P6 design. SPEC.md:458-464 says every run emits a prov:Activity. A plain arrow (pure, a graph catalog step, an in-process composite) has no facts, no pin and no used set, and an activity for it would be a record with nothing to attribute; the report already makes a composite a derived view with no activity of its own (research/2026-11-08-rebuild-report.md:286). The first draft narrowed the exit to attributed runs only in its exit table. This decision records the narrowing as a SPEC amendment: the runs that emit a prov:Activity are those withActivity wraps, and they emit it on success and on typed failure (decision 2026-11-24-p6-a-failed-attributed-run-records-its-activity). The acceptance row's other clauses are unchanged. Row 16 rewrites the PLAN row wording to match; SPEC's generated Decision log block carries this decision.
