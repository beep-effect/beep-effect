---
title: "Census reads product and lab source path constants; ciops KPI research inputs leave docs-only"
date: 2026-11-13
kind: checkpoint
lane: "fix/rout-03-src-pinned-consumers"
reversal: "Supersede with a later checkpoint; to undo, drop the research consumer row and the pinned-source scan."
---

A read-only verification of the census-gap PR found the ciops KPI change-event ledger and the 2026-10-01 redacted journal snapshot under the beep-ci-operational-ontology research directory still docs-only. The kpi-reading test reads them from the real repository through path constants in apps/labs/ciops/src/kpi/Pins.ts, which the census never scanned, and its temp-root exclusion silenced the one hit the scan did produce. A consumer row now joins codeRoots for both files. The census also scans bare path constants in product and lab src code (comment lines skipped), so a src-held constant a test reads is reported. Repo tooling src stays out: its packet-path constants (route corpus, cache conformance plan, harvest ledger, cache pilot pins) are command targets its tests read from temp roots. The kpi-reading exclusion is kept for its temp-root directory hit, with the reason now naming the pinned-source scan as the route for the real reads. The pinned COVE-02 comparison now asserts an empty error report. Accepted limits, none found live: a bare literal naming one packet Markdown file stays path data, and split-segment or concatenated paths are not scanned.
Source: verification findings of 2026-11-13; goal-data-consumer-census.test.ts.
