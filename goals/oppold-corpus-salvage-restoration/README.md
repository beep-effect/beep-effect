# Oppold Corpus Salvage Restoration

Lifecycle: `active`

This packet closes two separate gates. P0 preserves and independently verifies
the current T7 salvage state. The transformation wave then restores mail,
reconciles all three recycle volumes, and converts distinct legacy-Word
digests while retaining the originals.

## Next action

Finish the resumed P0 archive run (`beep corpus restore-preserve`, lane E,
2026-10-06), verify it with `restore-verify`, then land the P4 provenance
index tooling and run it on the corpus home. P1-P2 ceilings are recorded in
the decision log before the live mail slice.

## Launcher

```text
/goal follow the instructions in goals/oppold-corpus-salvage-restoration/GOAL.md
```

## Reading order

1. [`SPEC.md`](SPEC.md) - normative scope, acceptance gates, constraints,
   decision log, and capability inventory.
2. [`PLAN.md`](PLAN.md) - P0-P3 sequencing and exit criteria.
3. [`GOAL.md`](GOAL.md) - compact execution launcher.
4. [`research/SOURCES.md`](research/SOURCES.md) - inherited provenance and
   capability citations.

## Provenance

Graduated 2026-08-24 from
[`explorations/oppold-corpus-overhaul`](../../explorations/oppold-corpus-overhaul/README.md)
as G1, the exploration's only promised-now candidate. Pipeline v2, semantic
ingestion v2, enrichment v2, and practice-kg bundle v2 remain gated MAP
re-entry points. The solo-practice corpus kit remains deferred.

## Latest evidence

2026-10-06 — P0 resumed and P4 opened (lane E, corpus provenance completion).
The 2026-08-27 archive run had stalled at a 90.25 GB root-archive partial;
the source tree had since lost 1,818 operator-deleted noise files (recorded
as inherited loss, see `SPEC.md` decision log). The run resumed under
re-measured denominators on a USB 3 link. P4 schemas and service contracts
landed (`ProvenanceIndex.schemas.ts`, `ProvenanceIndex.contracts.ts`).


2026-08-27 — P0 in progress. Bar-v2 preservation schemas landed in the repo
CLI Corpus command family (`Preservation.schemas.ts`): occurrence identity,
six attempt outcomes with pre/post source-stability observations, the
five-class inherited-loss opening balance, two-state capacity preflight with
an approved ceiling, fresh-process verification outcomes, and the tagged
provenance-ledger record decoding beside legacy salvage rows. Services,
streaming runners, and synthetic proofs are next; no archive run has
occurred.
