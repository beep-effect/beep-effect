# SPEC — Packet Convention Migration

Normative contract. Packet anchor document. Seeded 2026-08-26 from candidate 6
of the ratified
[`packet-system-redesign`](../../explorations/packet-system-redesign/MAP.md)
MAP, Session B decisions D17–D26, and the D27 post-merge recovery ruling.

## Mission

Ship the bounded fork-repair applier first, then migrate every non-v2 goal
manifest to the canonical v2 convention through an actual-shape
translate-review-amend-rerun loop. Seed only honest genesis events, report
assumptions and issues explicitly, and prove the resulting fleet with
`beep explore --check`.

## Scope

**In**

- `packages/tooling/tool/cli/src/commands/Goals/Migration/` plus the existing
  Goals and Explore command registration/export surfaces.
- Focused CLI tests and the committed packet-core fork fixture.
- Deterministic changes under `goals/*/ops/manifest.json`, `ops/events/`, and
  `ops/trace.json` produced by the migration.
- This goal packet and the parent exploration's Session B records.

**Out**

- Exploration-manifest version migration; no exploration v2 contract exists.
- Generated ATLAS/README status regions, design-approval gates, evidence
  closure, flow metrics, and UI work owned by candidates 2–5.
- Amendment J's skill-contract kernel work; D24 routes it through
  `typed-agent-skill-contracts`.
- Fabricated pre-adoption history, external attestations, signing, or
  verification.

## Significant-symbol ledger

`PacketForkRepairApplier`, `ManifestTranslation`, `TranslationReport`,
`TranslationAssumption`, `ManifestShapeProbe`, `MigrationSeverity`,
`DriftClassification`, `FleetLintFinding`, `PacketGenesisSeed`.

## Binding constraints

- D25: `repair-fork --preview|--apply` is the first vertical slice and must be
  proved alone against the committed fork fixture.
- Repair apply is staged and recoverable. It reuses `planForkRepair`, verifies
  the staged stream, and never silently chooses or drops a branch.
- Translation probes actual JSON shape; the declared schema version is
  evidence, not dispatch authority. Unknown keys are preserved.
- Every translation reports `Issues` and `Assumptions`, even when empty.
- Findings distinguish `violation` from `warning`. Drift distinguishes
  `breaking`, `additive`, and `cosmetic` and names affected packets.
- Fleet lint covers duplicate declared slugs, dependency cycles, and dangling
  packet references as unreachable edges.
- Genesis records the current manifest status and phase snapshot only. Git and
  existing reflections retain pre-adoption history; no events synthesize it.
- The operation is idempotent: a second preview after apply has no edits or
  seeds, and `bun run beep explore --check` is clean.

## Post-merge recovery ruling

D27 authorizes a separate recovery PR because implementation PR #855 merged
before the required same-PR reflection and lifecycle changes. The exception is
bounded to repairing the canonical empty-preview command, recording the
reflection, reconciling fleet drift and goal/exploration state, and proving the
recovery head through Yeet. It does not grandfather the goal and does not
assert that #855's final head was merge-ready.

## Acceptance

- [x] `beep goals repair-fork <slug> --root <root> --preview|--apply` repairs
      the committed fork fixture end to end and leaves a valid linear stream.
- [x] Actual-shape probing and translation cover v1, `1.0.0`, versionless, and
      half-migrated fixtures without dropping unknown fields.
- [x] The report carries Issues/Assumptions, severity, drift classes, and
      affected packet slugs.
- [x] Fleet lint detects cycles, duplicate declared slugs, and unreachable
      references independently of per-packet decoding.
- [x] Every non-v2 goal manifest is translated to `initiative-manifest/v2`.
- [x] Every translated goal packet receives exactly one honest genesis event
      and a fresh tip-only trace; already-streamed packets are not reseeded.
- [x] A second migration preview is empty and `bun run beep explore --check`
      reports zero findings.
- [x] Focused tests, typecheck, repo verification, and reflection lint pass for
      the shipped implementation and recovery. The full local proof applies to
      the implementation head; final-tip acceptance remains gated on terminal
      hosted checks, review closure, and Greptile 5/5 for that exact head. PR
      #855's historical final-head check and Greptile gaps remain explicitly
      recorded under D27.

## Stop conditions

- A legacy shape cannot be translated without inventing meaning: leave it
  unchanged, report a violation, and stop fleet apply.
- A fork plan cannot be staged and re-folded without issues or ambiguity.
- A migration would overwrite an existing event stream or erase unknown
  manifest fields.
- Verification requires unnamed credentials, cost, destructive effects, or a
  policy decision outside this packet.
