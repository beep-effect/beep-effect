# Domain-Layer Hardening

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `parked`
<!-- END GENERATED: EXPLORATION STATUS -->

Status note: (mirrors roadmap-paused `domain-kernel-hardening`)

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The repo's domain layer (entities, aggregates, value objects, typed errors) is
strong on substrate but uneven on hardening: three slices carry **zero** typed
domain errors, there are **two competing audit bases**, and there is no
soft-delete, temporal validity, or domain-event substrate. This packet
systematically audits every product slice's domain/schema layer against a
regret-minimization rubric and external best practice, then graduates the
strongest agreed changes into a `goals/` packet. We optimize for future-proofing,
observability, and queryability — Effect-native, schema-first throughout — and
**end on an approved plan, not code**.

## Next Open Question

Resume when roadmap-paused
[`goals/domain-kernel-hardening`](../../goals/domain-kernel-hardening/README.md)
unpauses. Packets 2–7 then receive a fresh align/shape pass because the domain
layer will have drifted.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) — machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) — the ask + locked Phase-0 decisions (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) — in-repo capability inventory (§A, done) + external grounding (§B, pending) (stage 1).
4. [`synthesis/`](./synthesis/) — per-slice audit matrices + external-corpus syntheses.
5. [`DECISIONS.md`](./DECISIONS.md) — align log + recommended-answer-first resolutions (stage 2).
6. [`BRIEF.md`](./BRIEF.md) — completed shaped pitch (stage 3).
7. [`MAP.md`](./MAP.md) — completed decomposition into candidate goals (stage 4).

The approved execution plan lives at
`~/.claude/plans/use-grill-with-docs-deep-research-vectorized-elephant.md`.

## Related Packets

- [`atlas-synthesis`](../atlas-synthesis/README.md) — the capability-inventory
  gap map that this packet's audit deepens for the domain layer specifically.
- [`epistemic-claim-lifecycle-gate`](../../goals/epistemic-claim-lifecycle-gate/README.md)
  & [`provenance-shared-claim-kernel`](../../goals/provenance-shared-claim-kernel/README.md)
  — the worked domain-hardening precedents (claim lifecycle, TextAnchor/UnitInterval
  promotion) this packet generalizes.

## Trail

<Dated one-liners, newest first: what each session did and where it stopped.>

- 2026-08-13: parked to mirror roadmap-paused
  `goals/domain-kernel-hardening`. Resume when that goal unpauses; packets 2–7
  require a fresh align/shape pass because the domain layer will have drifted.

- 2026-07-14: sibling review held all six remaining candidates behind paused
  packet 1; recorded six new bounded law-practice goals as packet-5 shaping
  inputs that must not be duplicated.
- 2026-06-29: **Adversarial review + fixes.** Ran a 6-dimension multi-agent
  adversarial review (with an independent verify pass). The Phase-1 audit held
  (code-accuracy refuted nothing load-bearing). Applied 3 upheld serious fixes —
  the headline being **cutting `TemporalValidity`/`DomainEvent` out of
  `domain-kernel-hardening`** (zero-consumer shared exports are not promotable per
  `02-shared-kernel.md`) — plus a MAP dependency-graph fix and several precision
  minors (GOLD_SYNTHESIS framing, G7 CPC/IPC, architecture-lab footnote, SPO/ontology
  + packet-5-split coordination notes, code-audit nits). Outcomes logged in
  `DECISIONS.md` §"Adversarial review outcomes"; packet re-verified (GOAL 3302/4000,
  manifest valid, whitespace clean).
- 2026-06-29: **Phase 3 shape + decompose + graduate (first packet).** Wrote
  `BRIEF.md` (problem/appetite/sketch/rabbit-holes/no-gos) and `MAP.md` (7 candidate
  packets, dependency graph, capability cites, first slice). Confirmed packet shape
  (MAP-names-many, graduate-first) + first slice (kernel) with the user. Graduated
  [`goals/domain-kernel-hardening`](../../goals/domain-kernel-hardening/README.md)
  from `goals/_template` (back-links, not copies; GOAL.md 3397/4000 chars; manifest
  valid; whitespace clean). Cross-linked manifests; advanced stage to `graduate`
  (status stays `active` — packets 2–7 pending). Initiative now executes via goals/.
- 2026-06-29: **Phase 2 external grounding complete.** Mined all six corpora
  paced/main-loop. `law_stuff/repos/GOLD_SYNTHESIS.md` (2,515 lines, generated
  today) independently corroborated the Phase-1 audit and supplied concrete
  vocabularies + shapes. Wrote `synthesis/20` (law+ontology) + `21` (signature+
  dms+notes+corpus); recorded G1–G14 adopted decisions + resolved N3/N6/N8/R3/P6/P8
  in `DECISIONS.md`. Advanced manifest to `align`. Stopped at the **Phase-3
  checkpoint** (confirm decomposition before graduating to a goals/ packet).
- 2026-06-29: **Phase 1 audit complete.** Read all five product slices + kernel
  in the main loop; wrote per-entity matrices + gap analyses to `synthesis/10`
  (shared kernel), `11` (law-practice), `12` (epistemic), `13` (workspace), `14`
  (agents), and a cross-cutting rollup `19` (P1–P12 + grounding map + decomposition
  seeds). Logged Phase-1 recommended directions + N1–N8 in `DECISIONS.md`. Key
  findings: repo-wide `*FixtureKey:String` (should be typed refs), `snapshot:
  UnknownRecord` untyped bodies on the core primitives, 8 placeholder literals,
  0 typed errors in 3 slices, `ApprovalGate` can't express approval. Stopped at
  the **Phase-2 checkpoint** (greenlight the 6-corpus mine).
- 2026-06-29: packet opened at `research`. Phase 0 (orient) done via three
  read-only exploration agents + direct greps: product direction, slice
  inventory/maturity, canonical-pattern catalog, binding rules, and the
  hardening frontier all captured in `RESEARCH.md` §A. Phase-0 gate confirmed
  (scope = all slices + kernel; new packet; full 6-corpus mine; paced
  execution). Seeded `CAPTURE.md`, `RESEARCH.md`, `DECISIONS.md`. Stopped before
  Phase 1 audit (kernel first).
