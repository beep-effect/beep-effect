# Codex Security Findings Index (2026-09-08)

Captured from the authenticated Codex Cloud Security view for
`kriegcloud/beep-effect` on 2026-09-08 through the signed-in CSV export.
Full reports remain ignored under `raw/`; tracked records omit signed URLs,
auth values, email addresses, and raw local paths.

## Severity Summary

| Severity | Count |
| --- | ---: |
| Low | 2 |
| Informational | 7 |

## Findings

| ID | Severity | Status | Title | Owner area |
| --- | --- | --- | --- | --- |
| [CSF-001](./CSF-001.md) | Low | captured | Unscoped stash\-drop grant can destroy other agents' work | _pending P2_ |
| [CSF-002](./CSF-002.md) | Low | captured | Run mirror exposes local AI session metadata | _pending P2_ |
| [CSF-003](./CSF-003.md) | Informational | captured | Valid sectioned 1Password references are rejected | _pending P2_ |
| [CSF-004](./CSF-004.md) | Informational | captured | Cancellation can permanently strand OAuth refresh credentials | _pending P2_ |
| [CSF-005](./CSF-005.md) | Informational | captured | Newline worktree paths can make reap delete an unregistered repo | _pending P2_ |
| [CSF-006](./CSF-006.md) | Informational | captured | Symlinked residue roots allow deletion outside the home directory | _pending P2_ |
| [CSF-007](./CSF-007.md) | Informational | captured | Home\-path hygiene check rejects ordinary branch names | _pending P2_ |
| [CSF-008](./CSF-008.md) | Informational | captured | Old clients reap live state written by the new client | _pending P2_ |
| [CSF-009](./CSF-009.md) | Informational | captured | Raw worktree names escape the archive residue root | _pending P2_ |

## Closeout Mapping

- `remediate` or `already-fixed` -> close as `Already fixed` after merge.
- Strictly proven invalid -> close as `False positive` with evidence recorded.
- Accepted risk / `Won't fix` is unavailable.
