---json
{"contract":{"evidenceSubject":{"digest":{"sha256":"607c532eaa5180a3c2d2018fbfc0d82cc1daa6dd20597967cfae6f82f2d809ae"},"name":"https://beep-effect.dev/contracts/qa-inventory/v1@1.0.0"},"gates":{"declarations":[{"applicability":{"kind":"always"},"evidence":{"predicateType":"https://beep-effect.dev/qa/evidence/judge-output-inventory/v1"},"id":"judge-output-inventory-decodes","remediationOwner":"@beep/repo-cli/Qa","severity":"blocking"},{"applicability":{"kind":"always"},"evidence":{"predicateType":"https://beep-effect.dev/qa/evidence/declared-round-coherent/v1"},"id":"declared-round-coherent","remediationOwner":"@beep/repo-cli/Qa","severity":"blocking"},{"applicability":{"kind":"always"},"evidence":{"predicateType":"https://beep-effect.dev/qa/evidence/cited-artifact-exists/v1"},"id":"cited-artifact-exists","remediationOwner":"@beep/repo-cli/Qa","severity":"blocking"},{"applicability":{"kind":"always"},"evidence":{"predicateType":"https://beep-effect.dev/qa/evidence/cited-event-id-exists/v1"},"id":"cited-event-id-exists","remediationOwner":"@beep/repo-cli/Qa","severity":"blocking"},{"applicability":{"kind":"always"},"evidence":{"predicateType":"https://beep-effect.dev/qa/evidence/evidence-cross-check/v1"},"id":"evidence-cross-check-clean","remediationOwner":"@beep/repo-cli/Qa","severity":"blocking"}]},"id":"https://beep-effect.dev/contracts/qa-inventory/v1","input":{"schemaId":"https://beep-effect.dev/schemas/qa-judge-input/v1"},"output":{"schemaId":"https://beep-effect.dev/schemas/qa-judge-settlement/v1"},"promise":"Validate a qa-inventory/v1 value against its declared round and cited evidence.","receiptTypes":{"failure":"https://beep-effect.dev/skill-contract/evidence/failure/v1","gateSummary":"https://beep-effect.dev/skill-contract/evidence/gate-summary/v1","ladder":{"accepted":"https://beep-effect.dev/qa/receipts/accepted/v1","delivered":"https://beep-effect.dev/qa/receipts/delivered/v1","persisted":"https://beep-effect.dev/qa/receipts/persisted/v1","semanticallyApplied":"https://beep-effect.dev/qa/receipts/semantically-applied/v1"},"recoveryAttempt":"https://beep-effect.dev/qa/receipts/recovery-attempt/v1"},"recovery":{"mode":"none"},"version":"1.0.0"},"projection":"skill-contract/skill-md/v1"}
---

# `https://beep-effect.dev/contracts/qa-inventory/v1@1.0.0`

Validate a qa\-inventory/v1 value against its declared round and cited evidence\.

## Evidence subject

**Name:** `https://beep-effect.dev/contracts/qa-inventory/v1@1.0.0`

**SHA\-256:** `607c532eaa5180a3c2d2018fbfc0d82cc1daa6dd20597967cfae6f82f2d809ae`

## Input schema reference

`https://beep-effect.dev/schemas/qa-judge-input/v1`

## Output schema reference

`https://beep-effect.dev/schemas/qa-judge-settlement/v1`

## Gates

| id | severity | applicability | evidence predicateType | remediation owner |
| --- | --- | --- | --- | --- |
| `judge-output-inventory-decodes` | blocking | always | `https://beep-effect.dev/qa/evidence/judge-output-inventory/v1` | `@beep/repo-cli/Qa` |
| `declared-round-coherent` | blocking | always | `https://beep-effect.dev/qa/evidence/declared-round-coherent/v1` | `@beep/repo-cli/Qa` |
| `cited-artifact-exists` | blocking | always | `https://beep-effect.dev/qa/evidence/cited-artifact-exists/v1` | `@beep/repo-cli/Qa` |
| `cited-event-id-exists` | blocking | always | `https://beep-effect.dev/qa/evidence/cited-event-id-exists/v1` | `@beep/repo-cli/Qa` |
| `evidence-cross-check-clean` | blocking | always | `https://beep-effect.dev/qa/evidence/evidence-cross-check/v1` | `@beep/repo-cli/Qa` |

## Receipt types

| receipt | predicateType |
| --- | --- |
| `accepted` | `https://beep-effect.dev/qa/receipts/accepted/v1` |
| `persisted` | `https://beep-effect.dev/qa/receipts/persisted/v1` |
| `delivered` | `https://beep-effect.dev/qa/receipts/delivered/v1` |
| `semanticallyApplied` | `https://beep-effect.dev/qa/receipts/semantically-applied/v1` |
| `failure` | `https://beep-effect.dev/skill-contract/evidence/failure/v1` |
| `gateSummary` | `https://beep-effect.dev/skill-contract/evidence/gate-summary/v1` |
| `recoveryAttempt` | `https://beep-effect.dev/qa/receipts/recovery-attempt/v1` |

## Recovery policy

Mode: none