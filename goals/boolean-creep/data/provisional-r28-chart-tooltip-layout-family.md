# Provisional R28 chart tooltip layout family

This is one P2 family draft, not a canonical design, independent census
acceptance, P3 review, or implementation. It is bound to source HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7` and main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`.

The source-adjudication receipt is
`data/design-refresh-2026-09-09-r28-first-d-census.md`, SHA-256
`838c5f88a53a7cedb88ccccc2731a998bea7cb43c359cce89ce2148f90919caa`.
That completed audit remains unchanged. The parent's single independent UI
correction must adjudicate the precise correlated member sets and the net
interpretation before these proposals become canonical cases.

The three proposed owners are `ChartTooltipIndicator`,
`ChartTooltipDefaultItem`, and `ChartTooltipItem`, all real private React
props declarations in `packages/foundation/ui-system/ui/src/components/chart.tsx`.
Their minimal correlated member set is `indicator`/`nestLabel`: derived,
internal, six representable/five legal, LiteralKit, Tier 1. Independent
`hideIndicator` stays outside that cluster. If admitted, the three eventual
per-instance designs should point to this same five-case family and land
atomically in one implementation change. No new file-role split or public
export is required.

## Current shape

`ChartTooltipContentProps` at `chart.tsx:21-28` accepts public optional
`indicator: "line" | "dot" | "dashed"`, independent `hideLabel` and
`hideIndicator`, and complete inherited Recharts tooltip/div props.
`ChartTooltipContent` defaults `indicator` to `dot` and both hide flags to
false at `467-469`. The public call shape is already meaningful and stays
unchanged.

The private component currently derives
`nestLabel = items.length === 1 && indicator !== "dot"` at `506`, after the
inactive/empty return at `501-503`. `items` is the original payload; filtering
`type === "none"` entries happens later at `517-518`. The component passes
both `indicator` and `nestLabel` into `ChartTooltipItem` (`520-532`), which
passes them to `ChartTooltipDefaultItem` (`421-429`), which passes them to
`ChartTooltipIndicator` (`370-376`). These are the only actual JSX writers.

The three props owners each have two Boolean members, `hideIndicator` and
`nestLabel`, plus the required three-valued `indicator`. Their declarations
are at `301-304`, `363-365`, and `402-405`. The raw two-Boolean pairs are
independent; the missing relation is between the co-carried literal and
nesting bit. None of these private helper functions is exported at `676`.

`ChartTooltipIndicatorMark` (`267-291`) also receives the literal and nesting
bit, but has only one Boolean. `ChartTooltipLabels` (`327-344`) receives only
the nesting bit of this relation. These are migration companions.
`tooltipIndicatorNestClass` (`264-265`) is an ordinary callable with two
parameters and is excluded as an independent census owner. The public
content function is the derivation site; this draft does not invent a
separate sibling-state owner there.

Graft discovery, followed by targeted raw references because its JSX incoming
edges were absent, found no other private-helper consumers. Public content
consumers are the same-file documentation examples, `ui/test/ui.test.ts`, and
`ui/stories/components/chart.stories.tsx`. The `DashedTooltip` story at
`319-335` explicitly documents a dashed single-series nested-label layout.

## Cardinality gap

The supported states follow directly from the sole derivation:

| Private layout case | Prior `indicator` | Prior `nestLabel` | Construction condition |
| --- | --- | --- | --- |
| `Dot` | `dot` | false | Any nonempty original payload. |
| `Line` | `line` | false | Original payload has more than one item. |
| `NestedLine` | `line` | true | Original payload has exactly one item. |
| `Dashed` | `dashed` | false | Original payload has more than one item. |
| `NestedDashed` | `dashed` | true | Original payload has exactly one item. |

The sixth product tuple, `dot/true`, cannot be produced by any supported
writer. This is the E4 implication `nestLabel => indicator !== "dot"` at
`506`. Each of the five legal rows can reach all three private props owners
with a nonfiltered item, absent formatter and no icon, so downstream branch
gating does not reduce this relation further.

`hideIndicator` independently permits both values for every legal layout.
Factoring it into the count gives `12/10`, which is mathematically correct but
not the minimal correlated cluster. Do not add it to the proposed replacement
domain. Optional configuration/icons, formatter presence/results, color,
React label content, and item payloads remain their existing independent
payloads. No required array, count, string, or callback becomes another
Boolean axis.

The net question remains explicit: each proposed props owner has two Boolean
members for recall, but the final minimal correlated cluster has one Boolean
plus a literal. The independent correction must decide that interpretation.
`ChartTooltipIndicatorMark` has only one Boolean even at owner scope; it is
not separately qualified by this draft. `ChartTooltipLabels`,
`tooltipIndicatorNestClass`, and the content derivation are also migration
companions, not extra census records. Do not silently use implementation
reachability to claim new canonical qualifications.

## Target schema

Define one private `ChartTooltipLayout` LiteralKit in the existing chart
module. Use the repository's existing local schema annotation convention,
as demonstrated by private `NotificationStatus` in
`ui/src/components/notification-card.tsx:19-25`. The core domain is:

```ts
const ChartTooltipLayout = LiteralKit([
  "Dot",
  "Line",
  "NestedLine",
  "Dashed",
  "NestedDashed",
]);

type ChartTooltipLayout = typeof ChartTooltipLayout.Type;
```

This is a literal domain with no variant payload, so a tagged union or class
would add structure without expressing more information. Do not add `as const`
to the LiteralKit input, create a hand-maintained parallel string union, or
export the new schema/type. `@beep/schema` is already a direct package
dependency; its `src/index.ts:287` exports LiteralKit. No new dependency is
needed for the domain. Reuse the package's established annotation mechanism
without introducing an unrelated public helper.

Construct the literal once inside `ChartTooltipContent`, at the current
derivation point after the same early return. Match exhaustively on the
already-defaulted public indicator. The `dot` branch returns `Dot`; each of
the two remaining branches chooses its nested versus nonnested case from
`items.length === 1`. Keep that original-payload condition. There is no
stored state, reducer, atom, cache, codec, or new public validation boundary.

Replace `indicator` and `nestLabel` in each of the three private props owners
with `layout: ChartTooltipLayout`. Pass that single value through the whole
private helper chain, including `ChartTooltipIndicatorMark`; give
`ChartTooltipLabels` the same layout in place of its Boolean. Keep the
independent `hideIndicator` Boolean and all unrelated props exactly as they
are. Do not turn a hidden indicator into an extra layout variant: icon
precedence still applies when that flag is true.

Use the kit's existing `.is.Dot` and `.is.NestedDashed` guards for the matching
read sites. A nested-layout view predicate may compose the derived
`.is.NestedLine` and `.is.NestedDashed` guards with existing `P.or`; it is a
pure read projection, not another co-carried Boolean state. Use an exhaustive
LiteralKit match to select the existing indicator class values for all five
cases. Keep that projection at the rendering read; do not construct and pass
a new `{ indicator, nestLabel }` compatibility object behind the literal.

LiteralKit's local implementation documents and exposes `.is`, `.Enum`,
`$match`, and `.pickOptions` at
`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:629-648`;
`$match`'s exhaustive case contract is at `583-604`. Reuse that facility.
There are no advanced Effect codec APIs in this design.

## Migration inventory

All implementation source edits belong to the existing `chart.tsx`. Source
references below use that file unless another path is given.

| Writer, reader, or surface | Required atomic migration |
| --- | --- |
| Imports, `9-14` | Add the existing LiteralKit facility and the package's established private schema annotation support as needed; reuse current `P`/utility imports for derived views. Do not change unrelated dependency topology. |
| Public props/type derivations, `21-29` | Keep public `indicator`, hide flags, Recharts/div intersections, and payload type exact. No public `layout` prop. |
| Indicator class table and nested class helper, `257-265` | Preserve every class string. Replace the compound nested/dashed helper with the `NestedDashed` case; select mark shape from the five-case domain. Delete the old two-parameter helper when its sole use is gone. |
| `ChartTooltipIndicatorMark`, `267-291` | Replace its `indicator`/`nestLabel` pair with `layout`. Read class shape and nested-dashed spacing from layout. Keep `indicatorColor`, CSS custom properties and the existing CSSProperties boundary intact. One-Boolean owner is a migration companion. |
| `ChartTooltipIndicator`, `293-310` | Replace the paired props and its sole child write with layout. Preserve `itemConfig` and independent `hideIndicator`. Keep icon-first, hidden-second, mark-last behavior exactly. |
| Formatter and key/color helpers, `312-325` | No behavioral rewrite. Keep `O.none` only for absent formatter/value/name and `O.some` around every actual formatter result, including null/undefined/zero. Keep current key fallback and color precedence. |
| `ChartTooltipLabels`, `327-344` | Pass layout instead of `nestLabel`; derive nested visibility at the read. Preserve nullable label node, config label fallback, item name and DOM structure. This is a migration companion. |
| `ChartTooltipValue`, `346-349` | Preserve nullish value suppression and existing value formatting. No layout prop or new presence axis is needed here. |
| `ChartTooltipDefaultItem`, `351-383` | Replace the two correlated props with layout, forward it to indicator/labels, and choose `items-end` versus `items-center` from the nested-layout view. Preserve fragment/wrapper structure and every other payload. |
| `ChartTooltipItem`, `385-433` | Replace paired props with layout. Use `Dot` for `items-center` at `417`; forward layout only in the existing default-render fallback. Preserve index, config, formatter, color, nameKey, item and tooltipLabel; retain `O.getOrElse` semantics. |
| `ChartTooltipContent`, `463-538` | Preserve defaults, `useChart`, tooltip label computation, all early returns, original payload and filtering/order. Construct layout at the former line506, read nesting for header label at515, pass layout at520-532. Remove its redundant `nestLabel` local. |
| Public export list, `676` | Keep existing six component exports and `ChartConfig` export exact. No private helper or new domain export. |
| `ui/src/index.ts:29`, package exports | Root remains VERSION-only. Existing `./components/*` source/publish mappings in `ui/package.json` continue exposing the chart module's public API. No barrel or export-map change. |
| Same-file examples, `220-244`, `435-462` | Remain valid public dot/default and line examples; no example uses the private representation. |
| `ui/stories/components/chart.stories.tsx:189,217,233,260,303,327` | All six public Content constructions remain source compatible: default/dot, line, name-key plus hidden label, and dashed variants. The dashed single-series story is a useful layout parity witness. |
| `ui/test/ui.test.ts:10-39` | Keep existing formatter fallback/suppression/zero fixtures. Add focused public-render compatibility cases described below; import through `@beep/ui/components/chart`. |

An all-source targeted reference search across `packages` and `apps` found no
private-helper caller outside `chart.tsx`. The only other Content consumers
are the story and fixture files above. Graft was used first; its missing JSX
edges did not establish completeness. No writer, reader, export or adapter
is intentionally deferred to a later partial implementation.

## Guard-deletion accounting

The concrete coherence expression removed is
`nestLabel && indicator === "dashed"` in `tooltipIndicatorNestClass` at
`264-265`: a direct `NestedDashed` case replaces it. Its two-parameter callable
helper and only call at `281` disappear. This deletion is implementation
scope, not admission of a function-parameter census case.

Delete the independently typed correlated prop slots in the three proposed
owners: three `indicator` declarations and three `nestLabel` declarations,
replaced by three layout declarations. Delete the corresponding paired JSX
writes at `370-376`, `421-429`, and `520-532`. The mark companion's two props
and paired child write at `309` similarly become one layout value. The labels
companion no longer carries its old Boolean at `335`/`378`. These are actual
representation deletions, not runtime guard deletions counted twice.

Delete the standalone `nestLabel` derivation at `506`. Its underlying
single-item/non-dot policy still exists in the one literal constructor;
construction logic cannot be claimed as eliminated behavior. Convert the
nesting reads at `340`, `377`, and `515`, the dot read at `417`, and the mark
class lookup into derived guards or an exhaustive match on layout. These
render decisions remain necessary; only their independent flag/literal
representation disappears.

There is no current runtime throw or decoder guard for `dot/true` to delete.
Do not invent one to improve deletion counts. Preserve the independent
`hideIndicator` gate, icon check, formatter absence checks, nullish value/label
checks, active/empty guards, and item filtering. They protect different
contracts and remain semantically necessary.

## Encoded-side impact

No encoded DTO, storage, JSON, RPC, CLI, or public React prop key changes.
The five-case literal is internal and does not appear in the DOM, serialized
props, CSS custom properties, or the public chart API. Public callers retain
all three indicator values, omission defaulting to dot, both optional hide
flags, nullable React label content, every formatter signature/result,
arbitrary supported Recharts item/config payloads, and div attributes.

The observable compatibility boundary is rendered output: keep the exact
mark dimensions/borders, nested dashed `my-0.5`, dot alignment, nested row
alignment, label location, icon precedence, CSS colors, value formatting and
item order. A hidden label does not remove the nested-layout state; null
tooltipLabel still leaves the same alignment. A custom formatter may suppress
the default row with null or undefined, or produce zero; none of those values
may become a fallback trigger.

The original unfiltered payload determines nesting. With two original items
and one filtered `type: none` item, the remaining visible row stays nonnested.
With one original `type: none` item, retain the current empty-row-container
and header-label behavior for that indicator. Do not introduce a fabricated
empty-layout case after the existing active/empty return.

Because the private input relation and all public input/DOM contracts migrate
atomically, this remains a Tier 1 internal derived transformation. Do not add
a legacy compatibility alias that continues carrying the old pair internally.
Public input compatibility is provided by retaining the existing public
indicator and deriving layout at its actual boundary.

## Test impact

No tests were run or changed for this P2 document. At implementation, extend
the existing package-source-alias public-render fixture with cases chosen to
verify observable compatibility rather than mirroring private implementation:

- Exercise the five legal layouts through public `indicator` and original
  payload length, checking exact mark shape, nested label placement,
  `items-end`/`items-center`, and nested dashed spacing.
- Cross nested and nonnested examples with `hideIndicator`; separately cover
  an icon with `hideIndicator: true` to retain icon precedence.
- Preserve the current absent-formatter fallback and explicit null,
  undefined, and zero formatter-result assertions. Include missing item
  value/name behavior without changing the inherited payload contract.
- Cover two original items with one filtered item, a single filtered item,
  hidden/null labels, and the existing inactive/empty return. These verify
  filtering order and label state, which a simple five-value enum test would
  miss.
- Keep story typechecking for the existing default, line and dashed public
  call sites. Use the dashed single-series story as a focused visual parity
  case; follow the repo's recorded browser-QA workflow if implementation
  requires checking the existing interactive tooltip behavior.

The eventual package handoff must run the mandated `@beep/ui` package
verification and relevant existing UI checks. No private helper needs to be
exported solely for tests. No product/package/browser commands are authorized
or executed by this source/design-only task.

## Risk

The principal census uncertainty is the distinction between the owner-level
two-Boolean recall net and its one-Boolean/literal minimal relation. The
three proposed real props owners satisfy the former; the independent
correction must explicitly judge the latter. Companion migration scope is
not evidence of additional qualified owners. If that interpretation fails,
keep this file provisional; do not use its completeness to claim admission.

The principal implementation risks are changing filtered versus original
payload cardinality, collapsing the two nested indicator styles, making
`hideIndicator` suppress configured icons, or treating falsy formatter results
as absent. Each has an exact source witness and a focused test above. A broad
cleanup of chart labels, configuration, Recharts types or payload formatting
would make compatibility harder to assess and is outside this design.

Keep one shared private literal and one atomic migration. Do not independently
implement three similar schemas, keep a redundant broad12/10 census record,
add the one-Boolean mark companion as an unreviewed fourth qualification, or
construct a reverse `{ indicator, nestLabel }` compatibility bag in helpers.
The three actual props declarations remain distinct migration/owner entries,
even though their relation is produced once.

The source receipt hashes are: chart source
`0b515cbd1ee51eb79ee36bb2d941507f180fdb1ce233b0db44526de62711e0c5`,
existing test fixture
`b7008c03aa9fcafd925feb8971081874c7617e060abe2ff002a64fa00b924f7f`,
chart stories
`5eab2be13faaf6b368f0cad5e0d79a2b1705eb9d47747cceb1dc4f28e653b63a`,
package manifest
`80bdaaa0bfeb381b58035cb8091b297ba0c3df327f37fd0f99a79877a8595043`,
and package root barrel
`cdc48ff9fa995147217ecead2ea9ab147851f0811e038516c8a51123be3b7deb`.
All five were byte-compared to the frozen source HEAD. Document validation
checks all eight required sections, all three actual proposed owners, and
the five-case state table; no implementation or independent proof is claimed.
