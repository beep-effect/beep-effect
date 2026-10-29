# Live canary checkpoint

Progress: actual installed worker/frontend -> isolated pinned collector -> deployed
tailnet Phoenix passed for two synthetic records. Exact backend/local event sets,
source nanoseconds and worker visibility receipts verified. Pause, stopped service
dependency, exact unit removal, stopped/removed collector, retained queue and fresh
backend read-back after rollback passed. No real harness enrollment or production
collector change. Recovery hold remains masked/inactive. No new OOM.

Initial failed route exposed Docker bridge tailnet DNS. Retained its queue/journal;
no producer retry. A bounded network probe with isolated host mapping passed with
TLS verification intact. A fresh distinct canary then passed. Both runs are copied
with verified hashes under the private same-host observation-proof archive, outside
/tmp. This is not off-device backup. Successful proof's bundle is intentionally
tampered after stop for the checksum-refusal test; do not reuse it for deployment.

Evidence: live-canary-installed-verification.json, live-canary-dns-failure.json,
live-canary-evidence-archive.json, research/LIVE-CANARY.md. Python syntax and diff
checks pass; no TypeScript product source changed in this milestone. Previous
scoped CLI and package receipts remain historical, not a broad CLI pass.

NEXT: audit every normative SPEC item against current evidence and close the
remaining actual foundation requirements, then required review panel and repository
delivery. Do not expand the foundation into universal real-harness coverage: SPEC
explicitly allows unknown coverage and calls for CLI/desktop-marked fixtures plus
a bounded live route. Likewise do not use this canary to claim full deployment,
operational ownership, broad quality, hosted proof or goal completion. Full source
and receipt integrity must be refreshed for final acceptance. No PR yet.
