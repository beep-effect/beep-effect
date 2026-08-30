# Patent Document Schema Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | completed | Audit live law-practice/claims surfaces and freeze fixtures. | Exact schema and consumer seam are recorded. |
| P1 Implement | completed | Add schemas, normalizers, and claims-batch consumption. | First vertical slice works. |
| P2 Verify | in-progress | Run focused domain/server behavior tests and required gates. | Acceptance proof is green. |
| P3 Yeet: PR to mergeable | pending | Publish and close hosted checks/review threads. | Yeet reports merge-ready. |
| P4 Close | pending | Write reflection and sync packet lifecycle/evidence. | Closeout artifacts exist. |

## Execution Notes

- Load `schema-first-development` before touching the domain.
- Preserve the goal boundaries in the exploration MAP.
- P0 contract evidence is recorded in `research/SOURCES.md`.
- Focused package proof: 176 tests passed across domain, use-cases, and server;
  the opt-in workstation-corpus test remained skipped.
