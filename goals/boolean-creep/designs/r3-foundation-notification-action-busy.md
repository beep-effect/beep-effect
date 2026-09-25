# Instance

- id: `r3-foundation-notification-action-busy`
- exact source SHA: `68d03db9ba11d3ef7f846aa8d547ff54c1ba5625`
- corpus source SHA: `5c768538e434336885d324cbf56d04fc2684959b`
- file:line: `packages/foundation/ui-system/ui/src/components/notification-card.tsx:315`
- symbol: `NotificationCard.action`
- members: `isLoading`, `isExecuted`, `showLoading`
- evidence:
  - E4 at `notification-card.tsx:315-320` — `isLoading` is the per-action
    `loadingActionId` match, `isExecuted` projects the optional Boolean, and
    `showLoading` is exactly loading outside the modal action type.
  - Consumer at `notification-card.tsx:326` — button disablement is loading
    or executed; preserve it, but do not count a JSX expression as a sibling local.

The stable ID expands the earlier two-local D1 record and supersedes the raw
round-26 `r26-foundation-ui-notification-action-show-loading` ID. Replacement
P3 review remains pending.

# Current shape

`ActionType` is an exported four-value LiteralKit: `redirect`, `api_call`,
`workflow`, and `modal`. `NotificationAction` is an exported tagged schema with
that discriminator. Its `executed` member is
`OptionFromOptionalKey(Boolean)` with a None default, so the decoded public
contract has three meaningful states: None, Some(false), and Some(true).

For each rendered action, `loadingActionId === action.id` derives `isLoading`.
The component projects only Some(true) to `isExecuted`; None and Some(false)
both remain not executed. Nonmodal loading derives `showLoading`. The button is
disabled for loading or execution. These decisions then control loading and
executed classes, spinner versus label/icon content, and whether the ordinary
action-type icon is replaced by a check.

Both loading and execution can be true. Their current observable behavior must
remain intact:

- a nonmodal loading-plus-executed action is disabled, renders the spinner
  without its label or check icon, and resolves the two opacity inputs through
  `cn`/`tailwind-merge` to the later executed `opacity-60` plus
  `cursor-not-allowed`;
- a modal loading-plus-executed action is disabled, does not render a spinner
  or loading opacity, and renders its label plus executed check with
  `cursor-not-allowed opacity-60`.

# Cardinality gap

The actual coexisting locals are isLoading, isExecuted and showLoading. They
represent 8 Boolean tuples; 6 are legal. showLoading implies isLoading,
while execution remains independent. The legal tuples in that order are
000, 010, 100, 110, 101 and 111. Nonloading yields showLoading=false;
modal loading also yields false; nonmodal loading yields true.

Action type is a four-value literal and executed is an Option<Boolean> on
the separate source action. Neither is a Boolean local in this owner.
The disabled JSX expression is a consumer, not another local declaration.
The previous192/24 count combined these separate source and consumer surfaces
and is superseded. Preserve all source alternatives and payloads without
padding the local cluster. None and Some(false) may alias in presentation but
must remain distinct encoded inputs. The current five-presentation target
below remains behaviorally appropriate for the six legal local tuples.

# Target schema

Reuse the file's `LiteralKit` import and identity owner for one private derived
presentation domain:

```ts
const NotificationActionPresentation = LiteralKit([
  "idle",
  "loading",
  "loadingExecuted",
  "modalLoading",
  "executed",
]).pipe(
  $I.annoteSchema("NotificationActionPresentation", {
    description: "Derived interaction and content presentation for one notification action.",
  })
);
type NotificationActionPresentation = typeof NotificationActionPresentation.Type;
```

Derive one presentation value directly from the existing typed action and the
per-action loading match. Do not store it on `NotificationAction`, add it to
props, or build a cross product with all four action-type literals. The five
members preserve the current observational states:

| Presentation | Disabled | Added busy classes | Button content |
| --- | --- | --- | --- |
| `idle` | no | none | label plus `actionIcon(action)` |
| `loading` | yes | `opacity-50` | spinner only |
| `loadingExecuted` | yes | effective `cursor-not-allowed opacity-60` | spinner only |
| `modalLoading` | yes | none | label plus modal action icon |
| `executed` | yes | `cursor-not-allowed opacity-60` | label plus check icon |

`executed` includes a nonloading executed action of any type and the
modal-loading-plus-executed alias because those inputs produce the same DOM.
`loadingExecuted` remains separate because nonmodal combined true suppresses
the label/check in favor of the spinner while retaining executed styling.

Keep `action.type` on the source action for the existing icon match and the
exact `onAction(id, action.id, action.type)` callback. Keep all four types as
distinct public cases even where their busy presentation aliases.

# Migration inventory

- `notification-card.tsx:8-19` — reuse `LiteralKit` and `$I`; add the private
  presentation owner without a package export.
- `notification-card.tsx:21-118` — retain `NotificationStatus`, the exported
  four-case `ActionType`, `ActionStyle`, their literals, annotations, and
  styles exactly.
- `notification-card.tsx:129-195` — retain `NotificationActionFields`, the
  executed/style `OptionFromOptionalKey` schemas and None defaults, all action
  field names, the four tagged cases, encoded shape, and exports.
- `notification-card.tsx:197-203` — retain `actionIcon` and its four exhaustive
  icons. The presentation match calls it only for the existing nonexecuted,
  nonspinner content branches.
- `notification-card.tsx:205-218` — retain the public component signature and
  all prop optionality, especially `actions`, `loadingActionId`, and
  `onAction`.
- `notification-card.tsx:248-313` — retain defaults (`status="unread"`,
  `actions=[]`), unread/read styling, mark-as-read behavior, layout, and date
  behavior.
- `notification-card.tsx:314-349` — replace `isLoading`, `isExecuted`, and
  `showLoading` plus inline disabled/content/class guards with one presentation
  derivation and exhaustive match. Preserve button key/type, action styling,
  class order/effective Tailwind result, label/icon/spinner structure, and
  callback arguments.
- `ui/test/schema-parity.test.ts:24-47,82-102` — retain schema-derived action
  round trips and the exact absent-executed/style encoding. Add explicit
  Some(false) and Some(true) round trips without changing omission defaults.
- `ui/stories/components/notification-card.stories.tsx:7-111` — retain existing
  sample actions, controls, defaults, and click assertions; add state fixtures
  that exercise all five presentation members and both combined-true aliases.

Repository-wide source search found no product caller beyond the package's
Storybook story. The schema and component remain public through
`@beep/ui/components/notification-card`; absence of an in-repository app caller
does not authorize narrowing their accepted props or encoded action values.

# Guard-deletion accounting

Delete all three local declarations `isLoading`, `isExecuted`, and
`showLoading`. Delete the inline `isLoading || isExecuted` disabled expression,
the two conditional class inputs, the spinner ternary, and the executed-icon
ternary. One schema-derived presentation match owns disabled state, busy class,
and content selection.

Do not recreate these values as a returned Boolean object or ad-hoc predicate
family. The classifier may inspect the loading ID match, the existing
`action.executed` Option, and the modal case directly to return one literal.
Keep `actionIcon` because action type remains an independent public behavior,
and keep the optional callback guard because callback presence is independent.

# Encoded-side impact

None. `NotificationActionPresentation` is private render-time state.
`NotificationAction` remains the public codec with the same `type`, `id`,
`label`, optional `executed`, and optional `style` keys. None still encodes by
omitting the optional key; Some(false) and Some(true) retain their explicit
Boolean values. All four action tags, defaults, decoded Option values, prop
names, callback arguments, and component exports remain unchanged.

The design does not infer execution from loading, clear execution on load, or
normalize Some(false) to None at the schema boundary. Those source values are
presentation aliases but remain observably distinct to codec users.

# Test impact

Add a table-driven render test covering the five presentation members plus the
two executed encodings that map to idle. Assert exact `disabled`, spinner,
label, icon, `animate-spin`, `cursor-not-allowed`, and effective opacity
behavior. Explicitly prove:

- nonmodal loading plus executed keeps spinner precedence and executed 60%
  opacity/cursor styling;
- modal loading plus executed keeps label/check and executed styling without a
  spinner or loading opacity;
- modal loading without execution is disabled while retaining label/modal icon
  and ordinary visual classes;
- idle invokes `onAction` once with notification ID, action ID, and the exact
  action type, while every disabled state blocks real user activation;
- redirect, API-call, workflow, and modal idle actions retain their current
  icons and callback type values.

Retain schema parity for omitted executed/style keys and add explicit false and
true encodings. No test should replace the public action with the private
presentation literal.

Run the recorded browser QA loop against the Storybook surface after
implementation. Use real pointer clicks and capture at least these scenarios:

1. idle redirect hover and click, proving its arrow, label, focus/hover state,
   and exact callback arguments;
2. nonmodal loading, proving spinner motion, disabled click suppression,
   hidden label/icon, and 50% opacity;
3. nonmodal loading plus executed, proving spinner precedence, disabled click,
   cursor styling, and effective 60% opacity;
4. modal loading, proving disabled click with no spinner/loading dimming and
   the warning icon retained;
5. executed nonloading and modal loading-plus-executed, proving label/check,
   disabled click, no spinner, and executed styling.

Record, extract, build the judge pack, ingest the vision result, and require a
green capture plus `requiredCount: 0`. The current spinner-only button has no
label content and therefore may lack an accessible name; record that as a
separate existing accessibility opportunity rather than changing public UI
behavior inside this representation migration.

# Risk and sequencing

Tier 1 private derived-state migration. The main risks are collapsing the two
combined-true cases, treating modal loading as idle and accidentally enabling
it, or normalizing public Option values because None and Some(false) render the
same. Preserve the public schema first, land the private classifier and reader
match atomically, then run focused schema/render tests, package verification,
and recorded browser QA. Formal P3 review remains required before apply.

# Qualification recommendation

Retain stable ID `r3-foundation-notification-action-busy` as designed with
members `isLoading`, `isExecuted`, `showLoading`, cardinality 8/6,
`storage=derived`, `exposure=internal`, `targetShape=literalkit`, and Tier 1.
Loading and execution remain independent, but showLoading implies loading.
Preserve discovery history and the raw report. Do not count source fields
or JSX consumers as local Boolean members. This corrected P2 proposal grants
no independent P3, implementation, or dry-round credit.
