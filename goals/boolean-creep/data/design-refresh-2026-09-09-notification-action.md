# Notification action presentation design refresh — 2026-09-09

## Scope and source

This audit covers the stable `r3-foundation-notification-action-busy` record at
`packages/foundation/ui-system/ui/src/components/notification-card.tsx:315-349`.
The source checkout was `7440cb8c4302ce64b87860069a464bafbf65f576`; the
packages/apps main corpus was
`9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

Only the design and this handoff were written. Product source, tests,
inventory, lifecycle status, dependencies, generated files, and git refs were
not changed. Formal replacement P3 remains pending.

## Full-cluster finding

The round-26 three-Boolean projection is source-correct but incomplete. Its
`isLoading,isExecuted,showLoading` tuple has 8 representable and 6 legal
combinations. Full-cluster review must also include the declared four-value
`ActionType`, all three decoded `executed` Option states, and the inline
`disabled` result consumed by the button.

Recommended canonical members are
`type,executed,isLoading,isExecuted,showLoading,disabled`. The exact cardinality
is 192 representable / 24 legal:

- representable: four action types × three executed states × four Boolean bits
  = `4 × 3 × 16 = 192`;
- legal: four action types × three executed states × two per-action loading
  match states = `4 × 3 × 2 = 24`, because the four booleans are determined.

Decoded `executed` has three states because the exported schema uses
`OptionFromOptionalKey(Boolean)` with a None default. None and Some(false)
render identically but retain different canonical encodings. Some(true)
selects executed presentation.

`loadingActionId` should remain outside the finite per-action member list. The
component uses only equality with the current action ID. Undefined and a
nonmatching string are identical for that action, while the arbitrary ID and
which sibling action matches are list-level selection facts. The existing
`isLoading` local is the exact finite projection. Action ID, label, style, card
status, callbacks, and sibling count remain independent.

## Minimal presentation quotient

One private five-value LiteralKit is sufficient:

| Presentation | Current behavior |
| --- | --- |
| `idle` | enabled; label plus action-type icon |
| `loading` | disabled; spinner only; 50% opacity |
| `loadingExecuted` | disabled; spinner only; executed cursor and effective 60% opacity |
| `modalLoading` | disabled; label plus warning icon; no loading opacity |
| `executed` | disabled; label plus check; executed cursor and 60% opacity |

This quotient preserves both combined-true cases. Nonmodal loading plus
executed continues to prefer the spinner over label/check and receives the
later executed opacity through `cn`/`tailwind-merge`. Modal loading plus
executed continues to behave exactly like executed presentation: no spinner,
label plus check, disabled, and executed styling. Modal loading without
execution remains visibly ordinary but disabled.

The classifier consumes the typed action, decoded Option, modal tag, and
per-action loading match directly. The renderer matches the presentation for
disabled state, classes, and content. `action.type` remains on the public action
for `actionIcon` and the exact callback payload; the target does not create a
20-case type/presentation cross product.

## Public and encoded compatibility

`ActionType`, `ActionStyle`, `NotificationAction`, and `NotificationCard` are
public through `@beep/ui/components/notification-card`. The repository has no
product caller beyond the Storybook story, but that does not narrow the public
contract.

The target changes no encoded or prop shape. It preserves:

- all four action tags and their existing icons;
- `type`, `id`, `label`, optional `executed`, and optional `style` keys;
- omitted keys for None and explicit false/true encoded Booleans for Some;
- all schema annotations, defaults, and schema-derived arbitrary round trips;
- `actions=[]`, `status="unread"`, and optional `loadingActionId` defaults;
- button type/key, class order, action style, callback optionality, and exact
  `(notificationId, actionId, actionType)` arguments;
- unread/read presentation, mark-as-read behavior, layout, and dates.

The presentation literal is private, transient, and never stored or encoded.
None and Some(false) remain distinct codec values even though they map to the
same UI member.

A bounded runtime check of the current `cn` helper confirmed that combined
`opacity-50` followed by `cursor-not-allowed opacity-60` produces the current
DOM class string `cursor-not-allowed opacity-60`; the `loadingExecuted` member
therefore pins the effective 60% opacity rather than retaining a dead 50%
class token.

## Producers, readers, and tests

The only in-repository action writers are the Storybook fixtures at
`notification-card.stories.tsx:7-29` and schema tests at
`schema-parity.test.ts:24-47,82-102`. The public schema accepts external callers
at the package export. The only `loadingActionId` declaration and reader are
the component prop at lines 205-218 and equality projection at line 315.

The renderer at lines 315-346 is the complete consumer graph for the busy
cluster: disabled state, two conditional class inputs, spinner branch,
executed check, type icon, and callback closure. The target removes the three
locals plus inline disabled and consumes all of those decisions in one
presentation match.

Focused tests must cover all five presentation members, None versus
Some(false), all four idle icons/callback values, and both combined-true cases.
Schema tests retain absent-key encoding and add exact false/true encodings.

Because action buttons are gesture-bearing UI, implementation also requires a
recorded Storybook browser QA round through `bun run beep qa`: real idle and
disabled clicks, spinner motion, both combined states, modal loading, hover and
focus presentation, extraction, judge ingest, green capture, and
`requiredCount: 0`. The spinner-only button's current missing visible/accessibly
derived label should be recorded as a separate existing accessibility
opportunity rather than folded into this representation change.

## Canonical recommendation

Promote the stable ID with members
`type,executed,isLoading,isExecuted,showLoading,disabled`, cardinality 192/24,
derived/internal/LiteralKit/Tier 1. Archive the raw round-26 ID as superseded.
Preserve the former D1 note as historical evidence that loading and execution
are independent; the qualification arises from the additional derived
presentation aliases and full source alternatives.

## Validation

`mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` passed:
`design coverage OK: 150 qualified ids`.

Scoped `git diff --check` passed for the design and this handoff. Formal P3
must independently verify the 24-row source matrix, exported Option encoding,
and both combined-true render outcomes before implementation.
