# Codex Security Findings Index (2026-09-03)

Captured from the authenticated Codex Cloud Security view for
`kriegcloud/beep-effect` on 2026-09-03 through the signed-in CSV export.
Full reports remain ignored under `raw/`; tracked records omit signed URLs,
auth values, email addresses, and raw local paths.

## Severity Summary

| Severity | Count |
| --- | ---: |
| Informational | 12 |

## Findings

| ID | Severity | Status | Title | Owner area |
| --- | --- | --- | --- | --- |
| [CSF-001](./CSF-001.md) | Informational | implemented | Dangling worktree cleanup can delete uncommitted source | repo CLI cleanup |
| [CSF-002](./CSF-002.md) | Informational | implemented | Minimal\-fold regex permits synchronous denial of service | langextract alignment |
| [CSF-003](./CSF-003.md) | Informational | implemented | Extensible proof objects allow verified provenance forgery | provenance modeling |
| [CSF-004](./CSF-004.md) | Informational | implemented | PST output ceiling retains over\-limit data | libpff export |
| [CSF-005](./CSF-005.md) | Informational | implemented | Quadratic HTML checks enable SafeDocument RPC denial of service | Markdown and HTML modeling |
| [CSF-006](./CSF-006.md) | Informational | implemented | Nested schema drift is reported as compatible | law-practice vocabulary |
| [CSF-007](./CSF-007.md) | Informational | implemented | Predictable /tmp root permits cross\-user scheduler denial | repo CLI runtime root |
| [CSF-008](./CSF-008.md) | Informational | implemented | Unbounded claim ranges exhaust memory during normalization | patent normalization |
| [CSF-009](./CSF-009.md) | Informational | implemented | Mutable proof prototypes allow citation forgery | provenance modeling |
| [CSF-010](./CSF-010.md) | Informational | implemented | AdaFace crops allocate from unbounded detector coordinates | photo-face worker |
| [CSF-011](./CSF-011.md) | Informational | implemented | Already\-complete rows bypass source\-stability evidence | corpus preservation |
| [CSF-012](./CSF-012.md) | Informational | implemented | Unbounded photo reports allow memory\-exhaustion denial of service | photo worker boundary |

## Closeout Mapping

- `remediate` or `already-fixed` -> close as `Already fixed` after merge.
- Strictly proven invalid -> close as `False positive` with evidence recorded.
- Accepted risk / `Won't fix` is unavailable.
