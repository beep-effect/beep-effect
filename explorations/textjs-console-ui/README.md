# Text.js Console UI

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Text.js (https://textjs.org) renders React 19 apps into the DevTools console
with `console.log`, and the same component tree into a terminal or an
offscreen test frame. Its MCP server lets a coding agent navigate the app,
press keys and read frames as text. The operator found it very interesting and
wants to think about what it could be used for; the use cases are not yet
known.

## Next Open Question

None here. The packet graduated on 2026-11-10 into
[`goals/lane-cockpit-spike`](../../goals/lane-cockpit-spike/README.md): a
one-day, read-only live lanes board as a lab app, with one working day of
operator use as the keep test.

Re-entry: when that goal records its verdict, reopen this packet at
`decompose`. A passed keep test fires the `operator-cockpit` gate in
[`MAP.md`](./MAP.md); a kill lapses the cockpit candidates and leaves
`agent-frame-protocol` and `terminal-content-negotiation` gated on their own
conditions.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`BRIEF.md`](./BRIEF.md) - the shaped pitch: problem, appetite, sketch, rabbit holes, no-gos.
3. [`MAP.md`](./MAP.md) - the graduated goal and the four gated candidates.
4. [`DECISIONS.md`](./DECISIONS.md) - the grilling log, Q1 to Q6 and the agent calls.
5. [`RESEARCH.md`](./RESEARCH.md) - upstream read from source, maturity, comparables, in-repo bricks, smoke test.
6. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
7. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0) and
   [`assets/textjs-llms-2026-11-03.txt`](./assets/textjs-llms-2026-11-03.txt).

## Trail

- 2026-11-03: packet opened from the operator's link. `llms.txt` snapshot filed
  under `assets/`; CAPTURE holds the operator's words, the page links that stood
  out, and loose threads. Upstream repo and MIT license recorded in SOURCES.
  Stopped at capture; no research yet.
- 2026-11-10: resumed with no new capture; treated the dump as closed and ran
  research from a shallow clone of upstream at `f4ef6c9` (1.6.1): 14 MCP
  tools, the offscreen testing API, maturity (eight days old, one author),
  comparables, in-repo bricks, and a passing smoke test under Bun. Align in
  two grill rounds: operator cockpit, one-day spike, `@textjs/react` only and
  pinned, live lanes board first, read-only, keep test is a day of use. Brief
  approved as drafted. Graduated into `goals/lane-cockpit-spike` with four
  gated candidates left in the map.
