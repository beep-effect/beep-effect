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

## 2026-11-07 — Fake-runner tests passed while the real runners failed

- **Doing:** smoke-testing `mine triage` and `mine read` against real models on
  a reflink copy of the library (`~/.cache/beep/library-smoke`).
- **Evidence:** T1 died with `invalid_json_schema ... got 'type: "None"'`
  because `S.toJsonSchemaDocument` emits a `$ref` root for identified
  classes; fixed with `referencePolicy: () => undefined`. T2 rejected a whole
  Opus reading over one span whose only difference was a PDF line break;
  the span check now resolves whitespace-only differences to the exact
  capture slice.
- **Would have prevented it:** a `qualify`-style bounded real probe per runner
  profile before a tier is declared ready, as the routes goal already
  requires for acquisition adapters.

## 2026-11-07 — Exploration packets were invisible as SKOS routing concepts

- **Doing:** reading the `verify` warning `library topics: skipped=116`.
- **Evidence:** `libraryTopics` decoded only `initiative-manifest/v2`; all 104
  `exploration-manifest/v1` packets were skipped, so no finding could be
  `skos:related` to an exploration. The existing test wrote a goal-shaped
  manifest into its exploration fixture, so it never caught this.
- **Would have prevented it:** fixtures copied from a real manifest of each
  schema version instead of hand-written look-alikes.
