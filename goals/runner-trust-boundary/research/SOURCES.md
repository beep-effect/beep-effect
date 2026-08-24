# Runner Trust Boundary: sources and provenance

This goal was authored directly from operator-ratified decisions. There is no
source exploration. P0 must turn the source set below into a dated fact record
before proposing remediation.

## Operator authority

The 2026-08-24 charter ratifies these constraints:

- **DEFANG THE FLEET, KEEP PRS ON IT.** Heavy PR lanes remain on EC2 because
  hosted runners failed the live heavy-lane admission.
- The primary boundary is a non-privileged runner class with no usable ambient
  instance-role credentials, a sealed digest-verified AMI, and one ephemeral VM
  per job.
- Admission gating is defense in depth.
- P0 ends at an operator grill gate. P1 is the fresh deployment proof for the
  two held Codex IDs.

## Source packets

| Source | Location | Use |
| --- | --- | --- |
| 2026-08-10 Codex packet | `goals/codex-security-findings-2026-08-10/ops/triage.json` and CSF-001 through CSF-004 | First runner handoff and original exact IDs |
| 2026-08-13 Codex packet | `goals/codex-security-findings-2026-08-13/ops/triage.json` and CSF-001, CSF-003, CSF-004, CSF-005, CSF-006, CSF-008 | Repeated identities plus admission and workload-identity split |
| 2026-08-24 Codex packet | `goals/codex-security-findings-2026-08-24/ops/triage.json` and CSF-001, CSF-003, CSF-004, CSF-005, CSF-006, CSF-009 | Current six-open allowlist, four transfers, and two held deployment proofs |
| Exact identity ledger | `goals/runner-trust-boundary/SPEC.md#findings-transfer` | Nine unique IDs and all sixteen source-packet mappings |

Tracked packet records are sanitized. Do not copy raw finding bodies into this
goal.

## Fleet and placement evidence

| Source | Location | Use |
| --- | --- | --- |
| Active fleet owner | `goals/ci-fleet-endgame/{README,SPEC,PLAN}.md` | Keeps performance and architecture ownership; current packet owns security only |
| Red-team wrapper | `goals/ci-fleet-endgame/ops/redteam-verify.sh` | P1 command, exact gate accounting, deregistration, and EC2 teardown contract |
| Live Gate E precedent | `goals/ci-fleet-residue/research/p2-acceptance-evidence.md` | 2026-08-14 run `31779611279`, all gates and teardown; precedent only |
| Baked AMI precedent | `goals/ci-fleet-residue/research/p0-activation-evidence.md` | Bake report, Pulumi pin, fast-path probe, and rollback motion |
| Residue closeout | `goals/ci-fleet-residue/{README,ops/manifest.json}` | Confirms residue stays completed-retained |
| Hosted re-fit falsification | `goals/ci-lane-economics/research/placement-decision.md` | Two hosted runner shutdowns, in-flight tasks exiting 137, and retained fleet placement |
| Current workflow routing | `.github/workflows/check.yml` | Live heavy-lane labels to recheck during P0 |

## First-party platform references

These sources define fields and platform behavior to validate. They do not
prove the current organization or deployed AWS state.

| Provider | Source | P0 use |
| --- | --- | --- |
| GitHub | [Runner groups](https://docs.github.com/en/actions/concepts/runners/runner-groups) | Runner groups as organization controls and security boundaries |
| GitHub | [Managing access to self-hosted runners using groups](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/manage-access) | Repository and workflow access, default-group behavior, and public-repository warning |
| GitHub | [REST API endpoints for self-hosted runner groups](https://docs.github.com/en/rest/actions/self-hosted-runner-groups?apiVersion=2022-11-28) | Sanitized live inventory fields and read-only evidence commands |
| AWS | [IAM roles for Amazon EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html) | Instance profiles, application role credentials, and instance identity distinction |
| AWS | [Retrieve security credentials from instance metadata](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-metadata-security-credentials.html) | The application credential path that privileged probes must deny |
| AWS | [Use the Instance Metadata Service](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html) | IMDSv2 and metadata-option facts to inspect |

No upstream code is authorized by this ledger. Official platform documentation
is reference-only.

## P0 evidence to add

P0 must add a dated, sanitized history record containing:

1. GitHub runner-group inventory and relevant policy fields.
2. Current runner membership and registration-group behavior.
3. AWS controller, launch-template, AMI pin, instance-profile, metadata,
   bootstrap/JIT, and teardown facts.
4. The threat model and rejected alternatives.
5. The operator grill receipt and ratified P1 to P4 mechanism.

Do not record tokens, raw API payloads, account numbers, instance IDs, email
addresses, machine IDs, absolute home paths, or any 1Password value.
