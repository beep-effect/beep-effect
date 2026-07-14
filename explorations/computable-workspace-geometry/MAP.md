# Map — decomposition and sequencing

Stage 4 (decompose) artifact. Candidate goals, sequencing, first slice,
capability cites. Decisions in [`DECISIONS.md`](./DECISIONS.md); shape in
[`BRIEF.md`](./BRIEF.md).

## Goal 1 — `pretext-driver` (graduates now)

`packages/drivers/pretext` → `@beep/pretext`. The driver alone: root pure
surface + `/browser` capture + fixture test layers + typed errors. Zero
product surface; no write-lane collision.

Capability cites (what already exists and moves or is consumed):

- `scratchpad/computable-layout/FontMetrics.schema.ts` + `FontMetricsV1.schema.ts`
  — the contracts to promote (v1 envelope + EngineProfile).
- `scratchpad/computable-layout/fixture.json` + `fixture-v1.json` — first
  fixture metrics for the test layer (Chrome/150, Linux, 16px Arial).
- `scratchpad/computable-layout/layout.ts` + tests — pure-consumer proof
  shapes to port as driver examples/tests (the micro breaker itself is
  superseded by pretext's real APIs).
- `scratchpad/computable-layout/full-circle.test.ts` — the integration proof
  pattern (metrics → minimum lookup → dock geometry).
- `~/YeeBois/dev/pretext` — upstream clone for API reference; npm
  `@chenglou/pretext` is the actual dependency (catalog).
- `standards/architecture/03-driver-boundaries.md` — dev-safe driver duties
  (typed services, centralized technical errors, test layers, no product
  vocabulary).

## Goal 2 — `thread-virtualization` (coordination-gated)

Exact-height virtualization for the thread renderer in the editor stack.
**Gate:** coordinate with the beep-effect6 write lane (it owns the
professional-desktop/editor surfaces) before opening the packet. Consumes
`@beep/pretext` root surface + a capture pass in the client.

## Later candidates (unsequenced)

- **Dock-adapter minima wiring** — panels measure tab titles via the driver
  and feed `makeDockGeometryAtoms.minimaAtom` (kernel + atom already landed
  2026-07-12; adapter wiring only).
- **Bubble shrinkwrap** — `measureLineStats`/`walkLineRanges` shrinkwrap for
  chat bubbles.
- **Layout-as-unit-tests doctrine** — promote the fixture-oracle pattern into
  a documented testing practice once the driver's test layers exist.

## Sequencing rationale

Driver first because every other candidate imports it; virtualization second
because it is the highest product value but crosses a live write lane;
adapter wiring floats free (this lane's territory) and can interleave after
the driver lands.
