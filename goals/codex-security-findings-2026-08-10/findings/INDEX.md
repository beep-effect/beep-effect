# Codex Security Findings Index (2026-08-10)

Captured from the authenticated Codex Cloud Security view for
`kriegcloud/beep-effect` on 2026-08-10 through the signed-in CSV export.
Full reports remain ignored under `raw/`; tracked records omit signed URLs,
auth values, email addresses, and raw local paths.

## Severity Summary

| Severity | Count |
| --- | ---: |
| High | 4 |
| Medium | 9 |
| Low | 4 |
| Informational | 1 |

## Findings

| ID | Severity | Status | Title | Owner area |
| --- | --- | --- | --- | --- |
| [CSF-001](./CSF-001.md) | High | defer-p2 | PR code now runs on self\-hosted EC2 CI lanes | CI fleet architecture |
| [CSF-002](./CSF-002.md) | High | defer-p2 | Non\-ephemeral CI runners expose PR jobs to trusted push secrets | CI fleet architecture |
| [CSF-003](./CSF-003.md) | High | defer-p2 | PR code now runs on owned EC2 CI runners | CI fleet architecture |
| [CSF-004](./CSF-004.md) | High | defer-p2 | Shadow runner exposes AWS role creds to job code | CI fleet architecture |
| [CSF-005](./CSF-005.md) | Medium | already-fixed | Yeet PR footer leaks local paths and AI session IDs | Repo CLI Yeet provenance |
| [CSF-006](./CSF-006.md) | Medium | fix-now | LLM title data can break out of JSDoc comments | Repo CLI quality tooling |
| [CSF-007](./CSF-007.md) | Medium | already-fixed | Shadow CI runners can be triggered by default labels | CI fleet controller |
| [CSF-008](./CSF-008.md) | Medium | fix-now | JSDoc title tool can leak API tokens to arbitrary proxy URLs | Repo CLI quality tooling |
| [CSF-009](./CSF-009.md) | Medium | already-fixed | Agent friction logging can leak secrets into public ledgers | Agent instructions |
| [CSF-010](./CSF-010.md) | Medium | already-fixed | Unescaped branch names in sweep handoff commands | Repo CLI Yeet sweep |
| [CSF-011](./CSF-011.md) | Medium | defer-p2 | Semantic\-delta probes execute untrusted archive code | Repo CLI knowledge architecture |
| [CSF-012](./CSF-012.md) | Medium | defer-p2 | Agent configs disable sandbox and approval safeguards | Repository agent policy |
| [CSF-013](./CSF-013.md) | Medium | fix-now | Git option injection via fleet origin URL | Repo CLI worktree fleet |
| [CSF-014](./CSF-014.md) | Low | fix-now | Hook\-pulse disarm can falsely succeed without disabling hooks | AI metrics instrumentation |
| [CSF-015](./CSF-015.md) | Low | already-fixed | Missing closeout artifact marks PR merge\-ready | Repo CLI Yeet status |
| [CSF-016](./CSF-016.md) | Low | already-fixed | Raw GitHub job names in TSV enable spreadsheet injection | Repo CLI CI timing reports |
| [CSF-017](./CSF-017.md) | Low | fix-now | Candor gate can release unrelated superseded AI citations | Law practice candor policy |
| [CSF-018](./CSF-018.md) | Informational | defer-p2 | Coverage ratchet can miss offset test regressions | Repo CLI coverage architecture |

## Closeout Mapping

- `remediate` or `already-fixed` -> close as `Already fixed` after merge.
- Strictly proven invalid -> close as `False positive` with evidence recorded.
- Accepted risk / `Won't fix` is unavailable.
