# Runner Trust Boundary: sources and provenance

This goal was authored directly from operator-ratified decisions. P0 turned the
source set below into `P0-FACTS.md`, `P0-THREAT-MODEL.md`,
`P0-MECHANISM.md`, and the ratified `P0-GRILL.md` record.

## Operator authority

The 2026-08-24 charter ratifies these constraints:

- **DEFANG THE FLEET, KEEP PRS ON IT.** Heavy PR lanes remain on EC2 because
  hosted runners failed the live heavy-lane admission.
- The primary boundary is a non-privileged runner class with no usable ambient
  instance-role credentials, a sealed digest-verified AMI, and one ephemeral VM
  per job.
- Admission gating is defense in depth.
- P0 was ratified on 2026-08-24. P1 is the standalone fresh deployment proof
  for the two held Codex IDs, followed by P2 Workload identity boundary and P3
  Admission defense in depth.

## P1 deployment evidence

The tracked, sanitized chronology is
[`P1-EVIDENCE.md`](./P1-EVIDENCE.md). GitHub run pages below are the hosted
provenance for its accepted and retained-superseded results.

| Run | Role in the evidence chain | Status |
| --- | --- | --- |
| [Red-team run 32763957629](https://github.com/beep-effect/beep-effect/actions/runs/32763957629) | Final run on the serving bake #3 image: Gates A–E, `AMI_PIN`, scoped deregistration, and EC2 teardown | Accepted P1 proof |
| [Lane probe 32763957329](https://github.com/beep-effect/beep-effect/actions/runs/32763957329) | Final positive baked fast path after key, digest, owner, mode, and symlink checks | Accepted P1 proof |
| [Red-team run 32760440289](https://github.com/beep-effect/beep-effect/actions/runs/32760440289) | Gates passed; wrapper failed because it double-counted shell source and waited fleet-wide | Retained, superseded |
| [Red-team run 32761051746](https://github.com/beep-effect/beep-effect/actions/runs/32761051746) | Patched-wrapper PASS on bake #1 before `main` changed its lockfile | Retained, superseded |
| [Lane probe 32761137404](https://github.com/beep-effect/beep-effect/actions/runs/32761137404) | Bake #1 image rejected after `main` changed the lockfile key | Retained negative-path evidence |
| [Red-team run 32763386226](https://github.com/beep-effect/beep-effect/actions/runs/32763386226) | `AMI_PIN` rejected a pre-flip bake #1 worker after deploy #2 | Retained negative-path evidence |
| [Lane probe 32763385680](https://github.com/beep-effect/beep-effect/actions/runs/32763385680) | Setup rejected the stale key on a pre-flip bake #1 worker | Retained negative-path evidence |

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
| Red-team wrapper | `goals/ci-fleet-endgame/ops/redteam-verify.sh` | `P1` command, exact gate accounting, deregistration, and EC2 teardown contract |
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

## P0 evidence

The dated, sanitized record is split by purpose:

1. `P0-FACTS.md` records GitHub, launch-template, AMI-pin, role, boundary,
   policy, runner, bake-freshness, and fleet-state facts.
2. `P0-THREAT-MODEL.md` records the actor and failure-path analysis.
3. `P0-MECHANISM.md` records the ratified mechanism and external proof plan.
4. `P0-GRILL.md` records the four forks, options, pushback, rationale, packet
   changes, and assumptions that still need live proof.

Do not record tokens, raw API payloads, account numbers, instance IDs, email
addresses, machine IDs, absolute home paths, or any 1Password value.
