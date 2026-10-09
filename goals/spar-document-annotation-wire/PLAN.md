# SPAR Document Annotation Wire Plan

## Status

Status: `blocked`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Pin artifacts, notices, terms, and fold/annotation fixtures. | Acquisition contract is auditable. |
| P1 Implement | complete | Extend registry/generation and add wire/fold. | First slice works. |
| P2 Verify | complete | Run generation drift, codec, and fold tests. | Checks executed; introduced reds repaired; inherited infra docgen tracked under S11. |
| P3 Yeet: PR to mergeable | pending | Publish and close hosted gates. | Merge-ready. |
| P4 Close | pending | Reflect and synchronize packet state. | Closeout complete. |

## Publication blocker

P3 publication stopped before push: the RDF-to-Md workspace edge requires
repository-wide generated Fallow boundary and reviewed cache-policy synchronization.
The lane brief forbids those snapshots and explicitly names that gate as a stop.
P3/P4 remain pending; no completed-retained flip or PR number is claimed.
