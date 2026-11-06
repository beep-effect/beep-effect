# Research friction receipts

## 2026-11-06 — provider availability and stop-hook repetition

Model launch failures prevented two planned assessments. Repeated
`stop-review-gate-hook.mjs` command-not-found notifications added no research
result. A bounded retry policy, explicit omitted-assessment status, and hook-runner
error deduplication would have prevented the repeated status churn. The hook was
not bypassed or changed by this research PR. Provider availability is not evidence
for or against an ontology design.
