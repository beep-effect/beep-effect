# Codex Security Findings Index (2026-08-24)

Captured from the authenticated Codex Cloud Security view for
`kriegcloud/beep-effect` on 2026-08-24 through the signed-in CSV export.
Full reports remain ignored under `raw/`; tracked records omit signed URLs,
auth values, email addresses, and raw local paths.

## Severity Summary

| Severity | Count |
| --- | ---: |
| High | 5 |
| Medium | 4 |
| Low | 5 |
| Informational | 5 |

## Findings

| ID | Severity | Status | Title | Owner area |
| --- | --- | --- | --- | --- |
| [CSF-001](./CSF-001.md) | High | architecture/deployment-blocked | PR code now runs on self\-hosted EC2 CI lanes | CI runner admission architecture |
| [CSF-002](./CSF-002.md) | High | repo-side remediated | Anonymous conflict\-resolution endpoint by default | effect-ontology HTTP authorization |
| [CSF-003](./CSF-003.md) | High | repo-side remediated | Baked runner trusts mutable Bun binary | runner AMI bake integrity |
| [CSF-004](./CSF-004.md) | High | architecture/deployment-blocked | PR code now runs on owned EC2 CI runners | CI runner admission architecture |
| [CSF-005](./CSF-005.md) | High | architecture/deployment-blocked | Shadow runner exposes AWS role creds to job code | CI runner workload identity |
| [CSF-006](./CSF-006.md) | Medium | architecture/deployment-blocked | Red\-team gate misses sudo IMDS credential path | CI runner workload identity |
| [CSF-007](./CSF-007.md) | Medium | repo-side remediated | Yeet publish writes generated index through symlinks | repository CLI safe writes |
| [CSF-008](./CSF-008.md) | Medium | repo-side remediated | Turbo op\-run wrapper exposes all local secrets to tasks | quality-command secret minimization |
| [CSF-009](./CSF-009.md) | Medium | repo-side remediated | IMDS hook can silently remain unarmed | CI runner workload identity |
| [CSF-010](./CSF-010.md) | Low | repo-side remediated | Depth\-blind data archival segment bypasses refs gate | knowledge-reference policy |
| [CSF-011](./CSF-011.md) | Low | repo-side remediated | Lab delete prints unowned Postgres DROP instructions | delete-package data ownership |
| [CSF-012](./CSF-012.md) | Low | repo-side remediated | Docgen watchdog logs system process command lines | docgen process diagnostics |
| [CSF-013](./CSF-013.md) | Low | repo-side remediated | Watch inbox follows repo symlinks for failure writes | repository CLI safe writes |
| [CSF-014](./CSF-014.md) | Low | repo-side remediated | POSIX path redaction bypass after punctuation | knowledge diagnostic redaction |
| [CSF-015](./CSF-015.md) | Informational | repo-side remediated | Ack receipts follow symlinks out of the checkout | repository CLI safe writes |
| [CSF-016](./CSF-016.md) | Informational | repo-side remediated | Overbroad deletion changeset exemption hides residue | delete-package safety |
| [CSF-017](./CSF-017.md) | Informational | repo-side remediated | Check flake quarantine rerun no longer filters packages | flake-quarantine scoping |
| [CSF-018](./CSF-018.md) | Informational | repo-side remediated | setup\-agent\-memory requires GNU realpath | agent-memory bootstrap portability |
| [CSF-019](./CSF-019.md) | Informational | repo-side remediated | delete\-package can recursively remove workspace container trees | delete-package safety |

## Closeout Mapping

- 15 findings have repo-side remediation in this PR.
- CSF-001, CSF-004, CSF-005, and CSF-006 remain `remediate` with the
  runner-admission/workload-identity arc for external proof.
- Post-merge dashboard closure remains pending for all exact captured IDs.

- `remediate` or `already-fixed` -> close as `Already fixed` after merge.
- Strictly proven invalid -> close as `False positive` with evidence recorded.
- Accepted risk / `Won't fix` is unavailable.
