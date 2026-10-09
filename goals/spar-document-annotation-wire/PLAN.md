# SPAR Document Annotation Wire Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Pin artifacts, notices, terms, and fold/annotation fixtures. | Acquisition contract is auditable. |
| P1 Implement | complete | Extend registry/generation and add wire/fold. | First slice works. |
| P2 Verify | complete | Run generation drift, codec, and fold tests. | Fixtures and parity passed; prepared-SDK full docgen passed in run 2. |
| P3 Yeet: PR to mergeable | pending | Publish and close hosted gates. | Merge-ready. |
| P4 Close | pending | Reflect and synchronize packet state. | Closeout complete. |

## Publication recovery

D16 records the resume ruling authorizing owner-command synchronization for the
RDF-to-Md dependency edge. Review the generated delta, prove SDK preparation and
full docgen, then publish and close in two waves. P3/P4 remain pending.
