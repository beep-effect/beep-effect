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
- the machine-local `pretext` upstream clone — API reference; npm
  `@chenglou/pretext` is the actual dependency (catalog).
- `standards/architecture/03-driver-boundaries.md` — dev-safe driver duties
  (typed services, centralized technical errors, test layers, no product
  vocabulary).

## Goal 2 — [`thread-virtualization`](../../goals/thread-virtualization/README.md) (GRADUATED 2026-08-13)

Exact-height virtualization for the thread renderer in the editor stack.
**Gate:** coordinate with the beep-effect6 write lane, secure an explicit
ownership agreement, and complete the pretext-driver handoff before opening
the packet. Consumes `@beep/pretext` root surface + a capture pass in the
client. **Gate status 2026-07-14:** the beep-effect6 write-gate on
`apps/professional-desktop` shell surfaces was RELEASED (owner confirmation;
lane rotated off desktop) for
[`goals/dock-substrate-landing`](../../goals/dock-substrate-landing/README.md);
the editor-stack (thread renderer) surface is distinct. **Gate resolved
2026-08-13:** the operator confirmed ownership clear for the thread renderer
surface and authorized the goal scaffold.

## Goal 3 — `dock-substrate-landing` (OPENED 2026-07-14)

Graduate the dock kernel/adapter into `@beep/dock` + `@beep/dock-react`
(`packages/foundation/ui-system/`) and land the dock workspace as the root
shell of `apps/professional-desktop`. Owned by
[`goals/dock-substrate-landing`](../../goals/dock-substrate-landing/README.md);
plan-of-record lives in that packet's SPEC/PLAN, not here.

## Routed residue (2026-07-14 sibling review)

- Q2 v2 contract residue — segment kinds, emoji correction, font-descriptor
  normalization, and `PreparedText` alignment — is **ROUTED** to
  [`goals/pretext-driver`](../../goals/pretext-driver/README.md).
- Dock-kernel max constraints, `LayoutPriority`, and snap-to-collapse are
  **ROUTED** to
  [`scratchpad/dockview/WHAT-IS-LEFT.md`](../../scratchpad/dockview/WHAT-IS-LEFT.md).

## Later candidates (unsequenced)

- **Layout-as-unit-tests doctrine** — promote the fixture-oracle pattern into
  a documented testing practice once the driver's test layers exist.

(Landed and removed from this list: dock-adapter minima wiring — PR #396,
2026-07-14; bubble shrinkwrap — PR #399, 2026-07-14.)

## Sequencing rationale

Driver first because every other candidate imports it; virtualization second
because it is the highest product value but crosses a live write lane;
adapter wiring floats free (this lane's territory) and can interleave after
the driver lands.
