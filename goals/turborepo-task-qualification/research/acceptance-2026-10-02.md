# Acceptance audit — 2026-10-02

Implementation checkpoint: `fe8ea6109d953dcef41ba536428cf2c054b75a7d`,
[PR #1389](https://github.com/beep-effect/beep-effect/pull/1389).
This audit preserves the full SPEC. The goal remains active pending final
verification and same-PR lifecycle closeout.

## Evidence identity

Native observations remain bound to frozen source
`93a19425da0f28d262cfb4b5e9190f137fbbaf58`, the exact stable 2.11.6 and
canary 2.11.5-canary.5 clients, and the named private-loopback signed profile.
Later source repairs and unit tests do not renew those observations.
The [signed qualification receipt](current-signed-qualification.json) records
the source, tools, requests, acceptance and operational ledger identities.
All fourteen referenced artifact hashes and the three frozen source checkout
heads were rechecked during closeout. This retention audit is a hash check,
not another native execution.

## Requirement audit

| SPEC acceptance requirement | Inspected evidence and result | Remaining work |
| --- | --- | --- |
| Reproducible executable census and CI/Quality/Yeet interpretation | [Adoption manifest](adoption/manifest.json) binds the artifacts and recipes. Fixed-input rebuild is byte-identical; source hashes, exact command inventory, shell/terminal sites and dispatch sources validate. Population: 145 workspaces, 3,498 graph nodes, 1,984 executable and 1,514 graph-only nodes. Nine Cache groups cover all 19 subcommands; 15 CI/Quality/Yeet branches preserve dynamic boundaries. | Conditional cohort inputs remain explicit adoption obligations; these classifications do not qualify non-pilot tasks. |
| Pure policy and operational lifecycle, evidence and drift enforcement | The curated repo-configs/cache facade and Cache service enforce tuple identity, legal transitions, expected ledger revision, root/child configuration and authenticated evidence. Full policy package audit/docgen passed; its source is unchanged since that proof. Operational native acceptance reached qualified ledger revision 8 and audit reported zero blockers. | Final implementation quality proof. |
| Synthetic success and mandatory failures | Native protocol observations include producer/replay, missing tag, invalid tag, corrupt body and wrong key. Truncated-body, unavailable and throttled controls exit nonzero and restore zero outputs. The task matrix covers configuration, lockfile, package-manager, alias/dependency, capture and missing/malformed execution controls. Focused fixture and supervisor tests exercise additional rejection paths. | Final aggregate quality proof; orchestration doubles remain unit evidence only. |
| Real pilot comparison and shadow matrix | Both exact native clients completed three fresh/fresh pairs, three signed remote pairs, ten shadow scenarios, seven mutations, four capture controls, four non-execution controls, missing-child refusal and nine protocol roots. Authenticated import accepted 103 fragments with zero blockers; the production transition qualified the named tuple and production audit passed. | No remaining native pilot claim is made for the ordinary profile or a later source revision. |
| Honest legacy and unsafe classification | The ordinary population remains 1,980 unassessed and four excluded, including 1,259 inherited cached computations. The private signed-profile ledger is separate. Narrow exclusion/suspension remains available when a live graph cannot be evaluated. | Preserve these boundaries during final publication. No broad activation is authorized. |
| Durable adoption handoff | [Adoption handoff](adoption-handoff.md) supplies population, 16 semantic families, decomposition leads, governed policy API, evidence references and invalidation rules. Its checked recipe cannot promote tuples or change the ledger. | Broad cohort rollout belongs to adoption. |
| Relevant package and protocol checks, no introduced regression | Only repo-configs and repo-cli package source/tests differ from the integrated base. Configs full audit/docgen passed with unchanged package bytes. CLI full package audit/docgen passed before the latest test-only main integration. The current full local run passed 5,262 CLI tests in 269 files, coverage, integration, property, documentation, Fallow and Nix. | The merged-preview lint-policy step exhausted ESLint's 8 GiB heap. The cached retry passed, but a cold combined shard reproduced the failure. Cold CLI and docgen scans pass independently at the same heap limit; the shard list now separates those packages. The repaired full deprecated-API scan, 72 focused lint tests and package lint/type checks pass. Final full proof remains pending. |
| Final implementation PR reaches strict Yeet readiness | The current PR is structurally mergeable. The latest two process-double review threads were answered and resolved through Yeet. Hosted code checks passed except coverage, which is retrying self-hosted runner communication loss. Vercel failures identify build rate limiting. | Strict final-head `merge-ready: yes`, a fresh review-follow-up audit and all required checks. Structural mergeability alone is insufficient. |
| Final evidence, reflection and lifecycle in the same PR | This audit and the [reflection](../history/reflections/2026-10-02-codex.md) accompany current status corrections. Historical receipts retain their original identities. | Final proof, completed-retained lifecycle publication, authorized merge and retirement. The manifest remains active until the completion gate is met. |

## Verification boundaries

The retained native result establishes one qualified computation/layer/profile/
epoch tuple. It does not establish independent-installation portability,
whole-family determinism, broad activation, or reuse of required hosted proof.
The adoption census preserves graph-only rows and reports inherited cache
settings without treating them as execution or qualification.

Local and hosted failures must be attributed before remediation. Retain the
runner-loss and heap-exhaustion logs; a passing targeted retry does not replace
the final named full proof. Update this audit with the final verified results
before changing the packet to completed-retained.
