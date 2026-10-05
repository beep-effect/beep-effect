# Patent Document Schema Plan

## Status

Status: `completed-retained`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | completed | Audit live law-practice/claims surfaces and freeze fixtures. | Exact schema and consumer seam are recorded. |
| P1 Implement | completed | Add schemas, normalizers, and claims-batch consumption. | First vertical slice works. |
| P2 Verify | complete | Run focused domain/server behavior tests and required gates. | Acceptance proof is green. |
| P3 Yeet: PR to mergeable | complete | Publish and close hosted checks/review threads. | Yeet reports merge-ready. |
| P4 Close | complete | Write reflection and sync packet lifecycle/evidence. | Closeout artifacts exist. |

## Execution Notes

- Load `schema-first-development` before touching the domain.
- Preserve the goal boundaries in the exploration MAP.
- P0 contract evidence is recorded in `research/SOURCES.md`.
- Focused package proof: 176 tests passed across domain, use-cases, and server;
  the opt-in workstation-corpus test remained skipped.
- PR #867 reached merge-ready and merged as `f1383148c6` on 2026-08-30 after
  16 review threads (Codex connector, Greptile, OpenClaw) were answered and
  resolved; the lifecycle flip and reflection ride the follow-up closeout PR.
- 2026-10-05 re-proof on `main`: 71 domain, 73 use-cases, and 87 server tests
  green with the opt-in corpus test skipped.
