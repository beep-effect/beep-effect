# Oppold Corpus Salvage Restoration

Lifecycle: `active`

This packet closes two separate gates. P0 preserves and independently verifies
the current T7 salvage state. The transformation wave then restores mail,
reconciles all three recycle volumes, and converts distinct legacy-Word
digests while retaining the originals.

## Next action

Start P0 with the archive-object and ledger schemas, then define the streaming
hasher and archive-runner services. The existing `corpus salvage` command is
not the P0 runner: it hashes a whole source in memory before copying and fails
closed when the destination exists.

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

Not started.
