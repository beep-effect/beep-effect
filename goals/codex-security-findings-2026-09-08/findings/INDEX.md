# Codex Security Findings Index (2026-09-08)

Captured from the authenticated Codex Cloud Security view for
`kriegcloud/beep-effect` on 2026-09-08 through the signed-in CSV export.
Full reports remain ignored under `raw/`; tracked records omit signed URLs,
auth values, email addresses, and raw local paths.

## Severity Summary

| Severity | Count |
| --- | ---: |
| Medium | 1 |
| Low | 3 |
| Informational | 8 |

## Findings

| ID | Severity | Status | Title | Owner area |
| --- | --- | --- | --- | --- |
| [CSF-001](./CSF-001.md) | Low | implemented | Unscoped stash\-drop grant can destroy other agents' work | Agent command permissions |
| [CSF-002](./CSF-002.md) | Low | implemented | Run mirror exposes local AI session metadata | Private provenance persistence |
| [CSF-003](./CSF-003.md) | Informational | implemented | Valid sectioned 1Password references are rejected | Remote-cache secret reference setup |
| [CSF-004](./CSF-004.md) | Informational | implemented | Cancellation can permanently strand OAuth refresh credentials | FreshBooks token rotation |
| [CSF-005](./CSF-005.md) | Informational | implemented | Newline worktree paths can make reap delete an unregistered repo | Worktree registration and deletion |
| [CSF-006](./CSF-006.md) | Informational | implemented | Symlinked residue roots allow deletion outside the home directory | Home residue cleanup |
| [CSF-007](./CSF-007.md) | Informational | implemented | Home\-path hygiene check rejects ordinary branch names | Public evidence path hygiene |
| [CSF-008](./CSF-008.md) | Informational | implemented | Old clients reap live state written by the new client | Process identity compatibility |
| [CSF-009](./CSF-009.md) | Informational | implemented | Raw worktree names escape the archive residue root | Worktree archive containment |
| [CSF-010](./CSF-010.md) | Informational | implemented | Lane\-proof cache ignores inherited environment changes | Local verification proof reuse |
| [CSF-011](./CSF-011.md) | Low | implemented | Hard\-coded user path enables cross\-account module hijacking | Graft hook installation trust |
| [CSF-012](./CSF-012.md) | Medium | implemented | Quoted JSON bypasses process\-ID corpus redaction | Public corpus process identity redaction |

## Closeout Mapping

- `remediate` or `already-fixed` -> close as `Already fixed` after merge.
- Strictly proven invalid -> close as `False positive` with evidence recorded.
- Accepted risk / `Won't fix` is unavailable.

<!-- codex-findings-refresh:start -->
Eleven findings merged in PR #1026. CSF-012 is implemented for the operator-authorized follow-up PR; proof, publication, and exact-ID closure remain in progress.
<!-- codex-findings-refresh:end -->
