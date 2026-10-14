# Design Figure Review Loop

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Answer the attorney's 2026-10-10 review of the live matter's eight design-figure sheets with a
round-2 set that meets every markup item, and give `beep drawings` a review loop beside sign-off:
mailbox intake into the corpus root and review rounds keyed to the sheet-set hash they reviewed.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/design-figure-review-loop/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - review items F1-F10 and T1-T3, phases, PR lanes.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger (review mail, USPTO Guide editions, rules).
6. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - friction receipts.
7. [`research/label-glyphs.md`](./research/label-glyphs.md) - vendored label-glyph recipe, source hashes, licence handling (P2).
8. [`../design-figure-generation/`](../design-figure-generation/) - predecessor (completed-retained): pipeline contract and sign-off rules.
9. [`../../explorations/patent-drawing-pipeline/`](../../explorations/patent-drawing-pipeline/) - source exploration (re-graduated 2026-10-13).

## Current Phase

P0-P2 merged in #1644 (2026-10-14). Open: #1648 (PR-D broken-line parts), #1649 (PR-F
`beep drawings intake`), #1650 (PR-G review rounds). The corpus remodel is done and the round-2
render is in progress (P7). The attorney answered the round-1 questions on 2026-10-14 (SPEC
Decision Log rows of that date): labels become embedded Arial and Times New Roman text (PR-K, P7a)
and the tab-in-slot edge emphasis and corrugation overlay need new tooling (PR-L, P7b). Open with
the attorney: the bottom-edge question (Q7) and the overlay's edge extent.

## Latest Evidence

Not started. Round-1 facts carried in: the attorney marked up the unshaded set (PDF sha256 prefix
17e086a2), not the signable shaded set (227efb7a); both hashes are in the predecessor's
[live-matter evidence record](../design-figure-generation/history/live-matter/evidence.json).

## Notes

- Live matter material (spec, generator, renders, markup PDFs, questions draft) lives only under
  `BEEP_OPPOLD_CORPUS_ROOT`; the repo carries generic fixtures and hashes.
- Packet prose stays generic about the live article.
- Outbound round-2 mail goes through the outbox draft and is sent only after explicit approval in
  chat.
