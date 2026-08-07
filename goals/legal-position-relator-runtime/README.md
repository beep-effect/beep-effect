# Legal Position Relator Runtime

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Give the law-practice slice its structural legal core: a closed eight-member
`HohfeldPosition` domain whose correlative and opposite derivations over
`(positionKind, LegalActContent)` are total, involutive and commuting; a simple
`LegalPositionRelator` that stores one advantage-side relation and derives every
other view; and authority-gated transition events that keep attempted and
ineffective acts on the record — recording positions, exercises, and scope
alignments while legal judgment stays human.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/legal-position-relator-runtime/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (decision log and the
   inherited never-compute table included).
3. [`PLAN.md`](./PLAN.md) - active execution plan (two strict rungs).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger
   (inherited from the exploration; that packet's ledger is primary).
6. [`history/`](./history/) - evidence and closeouts, once they exist.

## Current Phase

P1 Rung 1 (domain proof) — in progress. P0 completed 2026-08-06: all 15
`research/SOURCES.md` §4 anchors re-verified CURRENT against `main`
([`research/01-surface-reverification.md`](./research/01-surface-reverification.md)),
and the rung-2 candidate handoff was **deferred with standing evidence**
([`research/02-handoff-shape-evidence.md`](./research/02-handoff-shape-evidence.md)),
architecture-guardian-checked — SPEC decision 13. Zero new `@beep/epistemic-*`
import sites in `packages/law-practice/*`; the Exception Ledger stays "None".

## Latest Evidence

P0 complete (2026-08-06): surfaces re-verification + four-shape handoff
evidence promoted into `research/`, deferral recorded as SPEC decision 13 with
guardian conditions absorbed. Graduated 2026-08-06 from
[`explorations/legal-position-relator-runtime`](../../explorations/legal-position-relator-runtime/README.md)
— BRIEF approved 2026-08-06 after a three-lens adversarial Opus review (39
findings folded, 5 P1); ten binding decisions (four wedge-scoped, six align);
the four-point definition-of-ready passed at decompose
([`MAP.md`](../../explorations/legal-position-relator-runtime/MAP.md)), whose
capability anchors were re-verified against `main` by a four-lane Opus panel
after the candor sibling's implementation (PR #575) merged.

## Why This Goal Exists

The contradiction-triage engine went live on 2026-08-02 and runs with **no
caller able to hand it legally comparable inputs**: aligning two legal claims
needs position, parties, act, conditions, jurisdiction, and time, and no schema
in the repo can express that. Zero `Hohfeld` or `LegalPositionRelator` symbols
exist anywhere in `packages/**/src` (re-confirmed 2026-08-06), there is no
`Party` entity, and no vocabulary for authority-gated transitions — while the
three foundations such a core would compose are all live.

Four traps are structural, not incidental, and the SPEC exists to make each
unrepresentable:

1. Correlative pairs stored as two independent facts that drift.
2. A collapsed Party/Role that cannot represent the same individual holding
   conflicting positions through different roles — the exact mechanism by which
   principle collisions arise.
3. An eFLINT-style uniform violation rule that erases the difference between an
   act done without permission (penalised, effective) and one done without
   power (never constituted).
4. An opposite derivation over position-kind alone, which Hohfeld's own
   privilege(enter)/duty(enter) example shows manufactures false contradictions.

## Notes

- One packet, two strict rungs. Rung 1 is the in-memory domain proof
  (deliberately not shippable protection); rung 2 carries the transition events,
  correction contract, candidate handoff, CQ fixtures, and durability.
- **Rung 2 is not the migration-lane first mover.** The candor goal's rung 2
  shipped on 2026-08-06 (PR #575), so this goal generates a delta migration
  against an existing baseline snapshot and clones a landed PGlite proof rather
  than opening the lane (SPEC decision 11).
- **The rung-2 handoff shape is a P0 output, not a pre-authorized edit.** Three
  of the four candidate shapes carry disqualifying evidence, and the fourth —
  extending the slice's documented bounded epistemic exception — sits closer to
  tripping that exception's own removal condition than to being covered by it.
  There is no clean survivor, so deferring with recorded evidence is a
  legitimate outcome and is the sibling's precedent. Rung 1 crosses no slice
  boundary at all.
- Budget circuit-breaker, in order: drop `LegalScopeContext` and the
  scope-overlap check, then degrade `Party` linkage to an opaque reference id.
  Never the `(kind, content)` derivation soundness or one-stored-relation.
- Gated criteria bind to `goals/epistemic-contradiction-triage` (itself
  landed-but-unverified — P2 Verify in progress), `goals/semantic-foundation`,
  `goals/agentic-professional-runtime`, and the queued `legal-rule-time-identity`
  wedge; none of them blocks this goal's rungs.
