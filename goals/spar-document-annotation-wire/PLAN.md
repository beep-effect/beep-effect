# SPAR Document Annotation Wire Plan

## Status

Status: `completed-retained`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Pin artifacts, notices, terms, and fold/annotation fixtures. | Acquisition contract is auditable. |
| P1 Implement | complete | Extend registry/generation and add wire/fold. | First slice works. |
| P2 Verify | complete | Run generation drift, codec, and fold tests. | Fixtures and parity passed; prepared-SDK full docgen passed in run 2. |
| P3 Yeet: PR to mergeable | complete | Publish final content and address reviews. | PR #1588; ready handoff under S11, hosted/merge gate owned by orchestrator. |
| P4 Close | complete | Reflect and synchronize packet state. | Reflection, completed-retained status and PR citation in the same PR. |

## Publication and closeout

D16 authorizes owner-command synchronization for the RDF-to-Md edge; the
reviewed delta is committed. Wave 1 opened PR #1588. Wave 2 carries the
reflection and completed-retained closeout. The orchestrator owns hosted
readiness and merge under S11; no worker merge or lane retirement is claimed.
