# Patent Citation Candor Gate

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make every AI-discovered patent-reference occurrence a source-versioned,
evidence-grounded `PatentCitationEvent`, and block filing promotion until each
current one carries an attorney `CandorDisposition` bound to its exact
observation version — converting the duty of candor (37 CFR 1.56) from an
ambient risk into an explicit, auditable, fail-closed gate that never computes
legal judgment.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/patent-citation-candor-gate/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (decision log included).
3. [`PLAN.md`](./PLAN.md) - active execution plan (two rungs).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger
   (inherited from the exploration).
6. [`history/`](./history/) - evidence and closeouts, once they exist.

## Current Phase

P0 Research — next concrete action: re-verify the live surfaces against Lane
A's inventory and choose the lawful cross-slice gate shape, then start rung 1
with the failing `CandorPolicy.test.ts` (schema → service contract →
implementation).

## Latest Evidence

Not started. Graduated 2026-08-04 from
[`explorations/patent-citation-candor-gate`](../../explorations/patent-citation-candor-gate/README.md)
(BRIEF approved same day after a three-lens adversarial review + four PR #557
review refinements; four-point definition-of-ready passed at decompose).

## Notes

- One packet, two strict rungs: rung 1 is the in-memory domain proof
  (deliberately not shippable protection); rung 2 (durability + the slice's
  first db-admin migration + live promotion-path invocation) is where risk
  retirement lands.
- Budget circuit-breaker: if rung 1 busts its week, drop
  `PatentFragmentLocator` entirely — never the observation-version binding or
  the fail-closed predicate.
- Gated criteria bind to the SPECs of `uspto-prosecution-read`
  (observation identity, quarantine producer), `citation-extraction-engine`
  (`CitationMention` handoff), and `agentic-professional-runtime`
  (release-capable gate vocabulary); they never block this goal's rungs.
