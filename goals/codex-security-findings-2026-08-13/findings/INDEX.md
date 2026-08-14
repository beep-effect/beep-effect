# Codex Security Findings Index (2026-08-13)

Captured from the authenticated Codex Cloud Security view for
`kriegcloud/beep-effect` on 2026-08-13 through the signed-in CSV export.
Full reports remain ignored under `raw/`; tracked records omit signed URLs,
auth values, email addresses, and raw local paths.

## Severity Summary

| Severity | Count |
| --- | ---: |
| High | 7 |
| Medium | 6 |
| Low | 2 |
| Informational | 4 |

## Findings

| ID | Severity | Status | Title | Owner area |
| --- | --- | --- | --- | --- |
| [CSF-001](./CSF-001.md) | High | architecture/deployment-blocked | PR code now runs on self\-hosted EC2 CI lanes | CI runner admission architecture |
| [CSF-002](./CSF-002.md) | High | merged | Non\-ephemeral CI runners expose PR jobs to trusted push secrets | Legacy CI runner lifecycle |
| [CSF-003](./CSF-003.md) | High | architecture/deployment-blocked | PR code now runs on owned EC2 CI runners | CI runner admission architecture |
| [CSF-004](./CSF-004.md) | High | architecture/deployment-blocked | Shadow runner exposes AWS role creds to job code | CI runner workload identity |
| [CSF-005](./CSF-005.md) | High | architecture/deployment-blocked | CI runner IMDS firewall rollback exposes AWS role creds | CI runner workload identity |
| [CSF-006](./CSF-006.md) | High | architecture/deployment-blocked | PR code can steal EC2 runner IAM credentials | CI runner admission architecture |
| [CSF-007](./CSF-007.md) | Medium | merged | Yeet PR footer leaks local paths and AI session IDs | Repo CLI Yeet provenance |
| [CSF-008](./CSF-008.md) | Medium | architecture/deployment-blocked | Red\-team gate misses sudo IMDS credential path | CI runner workload identity |
| [CSF-009](./CSF-009.md) | Medium | merged | Semantic\-delta probes execute untrusted archive code | Repo CLI knowledge architecture |
| [CSF-010](./CSF-010.md) | Medium | merged | Agent configs disable sandbox and approval safeguards | Repository agent policy |
| [CSF-011](./CSF-011.md) | Low | already-fixed | Candor gate can release unrelated superseded AI citations | Law practice candor policy |
| [CSF-012](./CSF-012.md) | Informational | fixed-locally | Coverage ratchet can miss offset test regressions | Repo CLI coverage architecture |
| [CSF-013](./CSF-013.md) | Informational | merged | Lambda API integrations use the wrong ARN | CI Turbo cache infrastructure |
| [CSF-014](./CSF-014.md) | Medium | merged | PR CI exposes Turbo cache token to checked\-out code | CI/GitHub Actions |
| [CSF-015](./CSF-015.md) | Informational | fixed-locally | Unauthenticated extraction can traverse local storage paths | scratchpad/effect-ontology storage boundary |
| [CSF-016](./CSF-016.md) | High | fixed-locally | Runner AMI bake executes unverified remote installer | Runner AMI bake supply chain |
| [CSF-017](./CSF-017.md) | Medium | fixed-locally | Claude safety policy ignores non\-Bash allow grants | AI-sync checked-in agent safety policy |
| [CSF-018](./CSF-018.md) | Low | fixed-locally | Legacy registry migration trusts one matching digest | AI metrics identity registry |
| [CSF-019](./CSF-019.md) | Informational | fixed-locally | Migration re\-baseline breaks existing databases | Postgres migration compatibility |

## Current Remediation State

<!-- codex-findings-refresh:start -->
Refresh triage: all 19 records are validated and assigned to remediation lanes.
<!-- codex-findings-refresh:end -->

- 6 confirmed CI trust-boundary findings remain `remediate` and are blocked on
  runner admission/workload-identity architecture and external GitHub
  organization runner-group/AWS deployment proof.
- 18 findings are dispositioned `remediate`; 1 is `already-fixed`.
- CSF-002, CSF-007, CSF-009, CSF-010, CSF-013, and CSF-014 are merged.
- CSF-012, CSF-015, CSF-016, CSF-017, CSF-018, and CSF-019 have focused
  local proof and are being consolidated into PR #712.
- 1 finding is already fixed on current HEAD by commit `618e81f4c0`.
- The six runner-admission/workload-identity findings require external proof;
  no Pulumi deployment is claimed.

## Closeout Mapping

- `remediate` or `already-fixed` -> close as `Already fixed` after merge.
- Strictly proven invalid -> close as `False positive` with evidence recorded.
- Accepted risk / `Won't fix` is unavailable.
