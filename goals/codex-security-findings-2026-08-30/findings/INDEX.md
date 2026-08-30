# Codex Security Findings Index (2026-08-30)

Captured from the authenticated Codex Cloud Security view for
`kriegcloud/beep-effect` on 2026-08-30 through the signed-in CSV export.
Full reports remain ignored under `raw/`; tracked records omit signed URLs,
auth values, email addresses, and raw local paths.

## Severity Summary

| Severity | Count |
| --- | ---: |
| Medium | 2 |
| Low | 2 |
| Informational | 7 |

## Findings

| ID | Severity | Status | Title | Owner area |
| --- | --- | --- | --- | --- |
| [CSF-001](./CSF-001.md) | Medium | remediated | Page\-controlled validation hook enables host command execution | Impeccable live host boundary |
| [CSF-002](./CSF-002.md) | Medium | remediated | Auditor executes repository\-supplied adapters on the host | Ontology adapter execution |
| [CSF-003](./CSF-003.md) | Low | already fixed | Codex sessions now run unsandboxed without approval | Codex repo configuration |
| [CSF-004](./CSF-004.md) | Low | remediated | Packet closes while runner JIT credential remains exposed | Runner packet lifecycle |
| [CSF-005](./CSF-005.md) | Informational | remediated | Unanchored GPG status check permits forged op binary | Cloud bootstrap integrity |
| [CSF-006](./CSF-006.md) | Informational | remediated | Empty folded quote causes infinite anchor search | Semantica anchoring |
| [CSF-007](./CSF-007.md) | Informational | remediated | Raw event digesting enables stack\-exhaustion denial of service | Packet event store |
| [CSF-008](./CSF-008.md) | Informational | remediated | Applied reap can race with admission and kill live work | Quality scheduler |
| [CSF-009](./CSF-009.md) | Informational | remediated | Unpinned CDN script can steal credentials entered in docs UI | API docs Scalar UI |
| [CSF-010](./CSF-010.md) | Informational | remediated | Cloud bootstrap executes a mutable remote installer | Cloud bootstrap integrity |
| [CSF-011](./CSF-011.md) | Informational | remediated | Symlinked tmp entry deletes worktrees outside TMPDIR | Tmpfs reaper |

## Closeout Mapping

- `remediate` or `already-fixed` -> close as `Already fixed` after merge.
- Strictly proven invalid -> close as `False positive` with evidence recorded.
- Accepted risk / `Won't fix` is unavailable.
