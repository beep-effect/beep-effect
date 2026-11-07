# Research intake 2026-11 — Opportunities and friction receipts

Recorded as they happen. Paths are home-relative; no secrets, session ids or
private-archive content.

## 2026-11-07 — Graduated goal depended on a prerequisite nobody had launched

- **Doing:** starting `/goal` on this packet.
- **Evidence:** `git show origin/main:goals/research-library-routes/ops/manifest.json`
  showed `initiative.status: active` with all five phases `pending`; no
  branch, worktree, PR or session-ledger row named the routes goal. This
  packet's SPEC requires it merged before the intake runs.
- **Cost:** the intake session became the routes orchestrator and the intake
  waits on a full implementation goal.
- **Would have prevented it:** graduation (or `goals doctor`) flagging a
  goal whose `requires` capability is provided only by an unstarted packet,
  and launching packets in `requires` order.

## 2026-11-07 — Box nightly series drifted after the survey

- **Doing:** hop-0 census.
- **Evidence:** the 2026-11-06 survey counted 34 Box nightlies; the root
  folder now lists 36 nightly files (a new 2026-11-06 report and a misnamed
  byte-identical `26-11-04` alias). Local `11-05 (3)` is byte-identical to
  Box `2026-10-21`, so file names don't reliably identify dates.
- **Would have prevented it:** identity by content hash plus the report's own
  date header rather than by filename, which the snapshot now applies.
