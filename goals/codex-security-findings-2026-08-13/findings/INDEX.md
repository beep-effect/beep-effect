# Codex Security Findings Index (2026-08-13)

Captured from the authenticated Codex Cloud Security view for
`kriegcloud/beep-effect` on 2026-08-13 through the signed-in CSV export.
Full reports remain ignored under `raw/`; tracked records omit signed URLs,
auth values, email addresses, and raw local paths.

## Severity Summary

| Severity | Count |
| --- | ---: |
| High | 6 |
| Medium | 4 |
| Low | 1 |
| Informational | 2 |

## Findings

| ID | Severity | Status | Title | Owner area |
| --- | --- | --- | --- | --- |
| [CSF-001](./CSF-001.md) | High | architecture/deployment-blocked | PR code now runs on self\-hosted EC2 CI lanes | CI runner admission architecture |
| [CSF-002](./CSF-002.md) | High | fixed-locally | Non\-ephemeral CI runners expose PR jobs to trusted push secrets | Legacy CI runner lifecycle |
| [CSF-003](./CSF-003.md) | High | architecture/deployment-blocked | PR code now runs on owned EC2 CI runners | CI runner admission architecture |
| [CSF-004](./CSF-004.md) | High | architecture/deployment-blocked | Shadow runner exposes AWS role creds to job code | CI runner workload identity |
| [CSF-005](./CSF-005.md) | High | architecture/deployment-blocked | CI runner IMDS firewall rollback exposes AWS role creds | CI runner workload identity |
| [CSF-006](./CSF-006.md) | High | architecture/deployment-blocked | PR code can steal EC2 runner IAM credentials | CI runner admission architecture |
| [CSF-007](./CSF-007.md) | Medium | fixed-locally | Yeet PR footer leaks local paths and AI session IDs | Repo CLI Yeet provenance |
| [CSF-008](./CSF-008.md) | Medium | architecture/deployment-blocked | Red\-team gate misses sudo IMDS credential path | CI runner workload identity |
| [CSF-009](./CSF-009.md) | Medium | fixed-locally | Semantic\-delta probes execute untrusted archive code | Repo CLI knowledge architecture |
| [CSF-010](./CSF-010.md) | Medium | fixed-locally | Agent configs disable sandbox and approval safeguards | Repository agent policy |
| [CSF-011](./CSF-011.md) | Low | already-fixed | Candor gate can release unrelated superseded AI citations | Law practice candor policy |
| [CSF-012](./CSF-012.md) | Informational | fixed-locally | Coverage ratchet can miss offset test regressions | Repo CLI coverage architecture |
| [CSF-013](./CSF-013.md) | Informational | fixed-locally | Lambda API integrations use the wrong ARN | CI Turbo cache infrastructure |

## Current Remediation State

- 6 confirmed CI trust-boundary findings remain `remediate` and are blocked on
  runner admission/workload-identity architecture and external GitHub
  organization runner-group/AWS deployment proof.
- 6 bounded remediations are locally complete.
- 1 finding is already fixed on current HEAD by commit `618e81f4c0`.
- Publication is executing only for `CSF-002`, then `CSF-007`, then `CSF-010`;
  every other finding remains held.
- CSF-013 has source/mock proof only; no Pulumi deployment is claimed.

## Closeout Mapping

- `remediate` or `already-fixed` -> close as `Already fixed` after merge.
- Strictly proven invalid -> close as `False positive` with evidence recorded.
- Accepted risk / `Won't fix` is unavailable.
