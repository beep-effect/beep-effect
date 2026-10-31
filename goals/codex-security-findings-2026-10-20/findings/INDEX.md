# Codex Security Findings Index (2026-10-20)

Captured from the authenticated Security Cloud findings view for
`kriegcloud/beep-effect` on 2026-10-20 through the summary-only signed-in CSV export.
Captured summaries remain ignored under `raw/`; tracked records omit signed URLs,
auth values, email addresses, and raw local paths.

## Severity Summary

| Severity | Count |
| --- | ---: |
| Low | 3 |
| Informational | 5 |

## Findings

| ID | Severity | Status | Title | Owner area |
| --- | --- | --- | --- | --- |
| [CSF-001](./CSF-001.md) | Low | Fixed; merged proof revalidated | Local clients can forge the review hub's Tailscale identity | Review hub authentication |
| [CSF-002](./CSF-002.md) | Low | Fixed; merged proof revalidated | PDF stream discovery enables CPU denial of service | PDF structure inspection |
| [CSF-003](./CSF-003.md) | Low | Fixed; merged proof revalidated | Box DOCX extraction permits decompression\-based denial of service | DOCX extraction driver |
| [CSF-004](./CSF-004.md) | Informational | Fixed; merged proof revalidated | Hub removal still disables HTTPS 443 after migration to 8787 | Review hub operational runbook |
| [CSF-005](./CSF-005.md) | Informational | Fixed; merged proof revalidated | Unbounded \.git probe bypasses snapshot memory limits | AI metrics snapshot metadata |
| [CSF-006](./CSF-006.md) | Informational | Fixed; merged proof revalidated | Palantiri telemetry may disclose Junie authentication JWTs | Accounts HTTP telemetry |
| [CSF-007](./CSF-007.md) | Informational | Fixed; merged proof revalidated | Quadratic email redaction can stall parcel reads | Parcel text redaction |
| [CSF-008](./CSF-008.md) | Informational | Fixed; merged proof revalidated | Unbounded claim\-chain expansion permits denial of service | Claim antecedent dependency traversal |

## Closeout Mapping

- `remediate` or `already-fixed` -> close as `Fixed` after merge and merged-revision verification.
- Strictly proven invalid -> close as `False positive` with evidence recorded.
- Preserve the complete `commit:` identity in every receipt; never strip its namespace.
- Before P2 verdicts, obtain Validation, Evidence, and Attack-path analysis from each finding detail.
- Record missing detail evidence explicitly and hold unsupported verdicts; the CSV contains Summary only.
- Accepted risk / `Won't fix` does not satisfy this packet's completion gate.

## Historical execution state

Full Validation, Evidence and Attack-path detail enrichment is complete for all
eight records. The remediation is published in PR #1930; scoped proof receipts
retain their execution revision and limits. Hosted coverage repair/next-head
checks, merge and exact-ID closure remain open. The status column describes
local remediation, and does not change the captured Cloud status `New`.

## Revalidation — 2026-10-28

All eight exact identities currently show Fixed. PR #1930 is merged; see
[the live reconciliation](../research/2026-10-28-cloud-refresh.md). Earlier
execution notes retain their historical state.

## Current revalidation — 2026-10-31

All eight complete Codex identities were independently rechecked Fixed.
PR #1930 remains merged; see [current exact-ID evidence](../research/2026-10-31-revalidation.md).
The supplemental dependency reconciliation is tracked in PR #2389 and the
October 28 packet; it does not reopen these historical Cloud findings.
