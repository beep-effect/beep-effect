# Design: r28-foundation-ui-chart-tooltip-default-item-flags

Status: designed; independent P3 review pending. Source `93217d998f851e2e93d9864e2b5315552eaa58a7`;
main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Tier 1C, derived/internal, LiteralKit.
This instance shares the mandatory [atomic family migration](./family-chart-tooltip-layout.md).
All three qualified props owners change together; no separate copy of the domain.

## Current shape

`packages/foundation/ui-system/ui/src/components/chart.tsx:351–383` declares the
private React props owner `ChartTooltipDefaultItem`. It carries indicator: line | dot | dashed
and nestLabel: boolean. The full owner also has the independent Boolean
hideIndicator, establishing the original recall net. Preserve these other payloads:
full ChartTooltipPayloadItem; optional itemConfig and indicatorColor; tooltipLabel: ReactNode; independent hideIndicator.

Item at421–429 supplies the pair; DefaultItem forwards to Indicator at370–376 and Labels at378. These private functions are not exported. Public ChartTooltipContent
retains all current props and defaults.

## Cardinality gap

The actual pair has six representable tuples and five legal tuples: dot/false,
line/false, line/true, dashed/false, dashed/true. Content:506 derives nesting
from the original, unfiltered items.length === 1 and indicator !== dot.
Therefore dot/true has no supported writer. All five reach this owner using a
nonfiltered item, absent formatter and no icon. This is E4; independent
hideIndicator is factored out and must not pad the result to12/10.

## Target schema

Use the single private ChartTooltipLayout LiteralKit defined in the shared
family: Dot, Line, NestedLine, Dashed, NestedDashed. Replace this owner's pair
with one required layout value. Derive the type and read guards from that kit;
no hand-written union, tagged payload, new state, public export or dependency.
Keep hideIndicator and every payload above. Never reconstruct the old pair.

## Migration inventory

Replace the pair with layout; pass it to Indicator and Labels. Derive items-end versus items-center at377 from the nested layout without changing fragments, wrappers or values.

The same atomic change derives layout once in Content after its existing early
return and before filtering, then updates Item, DefaultItem, Indicator, Mark
and Labels. The family gives every exact writer, reader, export, fixture and
story site. Public indicator defaults to dot; public hide flags default false.
No public API or writer is deferred to a later partial landing.

## Guard-deletion accounting

Remove its two correlated prop slots, paired Indicator write and Labels Boolean write. Retain the required alignment choice through schema-derived layout guards; do not count it as eliminated behavior.

The shared deletion ledger owns tooltipIndicatorNestClass at264–265, its only
call, the Content nesting alias and all paired helper writes. This instance
claims only its own representation deletions above. There is no existing
throw/decoder for dot/true to delete. Preserve icon, hide, formatter, nullish,
active/empty and filtering checks because they protect separate contracts.

## Encoded-side impact

No public React prop, encoded key/default, storage, RPC, JSON, CLI or DOM
attribute changes. Layout remains private. Keep exact marks, colors, nested
spacing, label placement, item ordering and full formatter behavior. The
original payload length controls nesting even when later filtering removes an
item. A Some(null), Some(undefined) or Some(0) formatter result must not become
fallback. The family specifies every public payload and rendering invariant.

## Test impact

At implementation, extend the existing public render fixtures through
@beep/ui/components/chart for all five layouts, independent hide/icon behavior,
falsy formatter results, original-versus-filtered payload length, labels and
early returns. Preserve existing stories and inspect the dashed single-series
story. Run full @beep/ui package verification and the recorded browser-qa-loop
for the affected tooltip interaction, with successful record/extract/judge and
requiredCount: 0. No product tests or browser runs were performed for this P2 design.

## Risk

The main risks are splitting this atomic family, duplicating its LiteralKit or
guard claims, changing filtering order, icon precedence or formatter fallback,
and altering public inputs. The completed R28 bounded correction confirms
source eligibility; independent P3 review must still validate the complete
family and all three instance obligations before implementation.
