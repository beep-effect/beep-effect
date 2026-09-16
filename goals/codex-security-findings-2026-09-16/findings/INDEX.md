# Codex Security Findings Index (2026-09-16)

Captured from the authenticated Codex Cloud Security view for
`kriegcloud/beep-effect` on 2026-09-16 through the signed-in CSV export.
Full reports remain ignored under `raw/`; tracked records omit signed URLs,
auth values, email addresses, and raw local paths.

## Severity Summary

| Severity | Count |
| --- | ---: |
| Low | 1 |
| Informational | 3 |

## Findings

| ID | Severity | Status | Title | Owner area |
| --- | --- | --- | --- | --- |
| [CSF-001](./CSF-001.md) | Low | implemented | Unsanitized filenames allow CI log\-command injection | CI report rendering |
| [CSF-002](./CSF-002.md) | Informational | implemented | Nightly updater exposes provider keys to install scripts | Nightly maintenance credentials |
| [CSF-003](./CSF-003.md) | Informational | implemented | Sibling discovery follows symlinks into unrelated Git clones | Sibling clone discovery |
| [CSF-004](./CSF-004.md) | Informational | implemented | Continuation lanes use attacker\-controlled shared scratch files | Continuation scratch isolation |

## Closeout Mapping

- `remediate` or `already-fixed` -> close as `Already fixed` after merge.
- Strictly proven invalid -> close as `False positive` with evidence recorded.
- Accepted risk / `Won't fix` is unavailable.
