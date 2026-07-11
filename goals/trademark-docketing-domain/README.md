# Trademark Docketing Domain

## Status

Lifecycle: `paused`

Status: `deferred/blocked`

Execution capable: `false` - no `GOAL.md` yet because this packet blocks on
`goals/semantic-foundation` M3 vocabulary contracts.

## Mission

Define law-practice slice domain entities for trademark practice once the shared
semantic contracts exist: `TrademarkAsset`; docketing obligations for
application, office-action, statement-of-use, opposition, section 8-9-15, and
renewal deadlines; and Nice classification attachment.

## Blocker

Do not implement this packet until
[`goals/semantic-foundation`](../semantic-foundation/README.md) M3 supplies the
docketing/deadline and party-role vocabulary modules, including the separation
between enduring party identity and time-bounded legal roles.

## Provenance

- [`explorations/legal-ontology-landscape/DECISIONS.md`](../../explorations/legal-ontology-landscape/DECISIONS.md)
  records the 2026-07-08 slice-split decision: trademark docketing entities are
  deferred out of the semantic foundation packet.
- [`explorations/legal-ontology-landscape/research/01-direction-grounding.md`](../../explorations/legal-ontology-landscape/research/01-direction-grounding.md)
  records CQs 8 and 9 for trademark docketing obligations and Nice
  classification attachment once `TrademarkAsset` exists.

## Reading Order

- [ops/manifest.json](./ops/manifest.json) - machine-readable deferred stub
  routing
- [`goals/semantic-foundation/SPEC.md`](../semantic-foundation/SPEC.md) - M3
  dependency contract
- [`explorations/legal-ontology-landscape/MAP.md`](../../explorations/legal-ontology-landscape/MAP.md)
  - packet sequencing map

## Next Action

When semantic-foundation M3 is stable and product pull exists, expand this stub
from `goals/_template`: add `SPEC.md`, `PLAN.md`, and `GOAL.md`; switch the
manifest to `executionCapable: true`; and define the implementation phases and
verification lane.
