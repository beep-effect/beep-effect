# Codex Security Findings Index (2026-10-28)

Captured from the authenticated Security Cloud findings view for
`kriegcloud/beep-effect` on 2026-10-28 through the summary-only signed-in CSV export.
Captured summaries remain ignored under `raw/`; tracked records omit signed URLs,
auth values, email addresses, and raw local paths.

## Severity Summary

| Severity | Count |
| --- | ---: |
| Low | 1 |
| Informational | 6 |

## Findings

| ID | Severity | Status | Title | Owner area |
| --- | --- | --- | --- | --- |
| [CSF-001](./CSF-001.md) | Low | implemented; closure pending | Named\-pipe replacement can expose the hub bearer token | pipe-owner |
| [CSF-002](./CSF-002.md) | Informational | implemented; closure pending | Skill recovery follows symlinked parents outside the repository | skill-containment |
| [CSF-003](./CSF-003.md) | Informational | implemented; closure pending | Abandoned recovery journals bypass backup path containment | abandoned-backup |
| [CSF-004](./CSF-004.md) | Informational | implemented; closure pending | Quadratic link\-fragment scan enables repository\-content DoS | link-scanner |
| [CSF-005](./CSF-005.md) | Informational | implemented; closure pending | Post\-capture settling can delete unarchived worktree changes | post-capture-walker |
| [CSF-006](./CSF-006.md) | Informational | implemented; closure pending | Underscore\-containing keys bypass new stderr redaction | stderr-redaction |
| [CSF-007](./CSF-007.md) | Informational | implemented; closure pending | Bridge clients send bearer tokens over non\-loopback plaintext | bridge-transport |

## Closeout Mapping

- `remediate` or `already-fixed` -> close as `Fixed` after merge and merged-revision verification.
- Strictly proven invalid -> close as `False positive` with evidence recorded.
- Preserve the complete `commit:` identity in every receipt; never strip its namespace.
- Before P2 verdicts, obtain Validation, Evidence, and Attack-path analysis from each finding detail.
- Record missing detail evidence explicitly and hold unsupported verdicts; the CSV contains Summary only.
- Accepted risk / `Won't fix` does not satisfy this packet's completion gate.

All seven full reports were reviewed. The captured Cloud state is New; no external status was changed.
