# Instance

- id: `r3-foundation-notification-action-busy`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/foundation/ui-system/ui/src/components/notification-card.tsx:315`
- symbol: `NotificationCard.action`
- members: `type`, `executed`, `isLoading`, `isExecuted`, `showLoading`,
  `disabled`
- evidence:
  - E4 at `notification-card.tsx:315-320` — `isLoading` is the per-action
    `loadingActionId` match, `isExecuted` projects the optional Boolean, and
    `showLoading` is exactly loading outside the modal action type.
  - E4 at `notification-card.tsx:326` — button disablement is exactly loading
    or executed, so every enabled busy tuple is unreachable.

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

The complete finite cluster includes all four declared action-type alternatives
and all three decoded `executed` alternatives, rather than only the three raw
booleans found by round 26. Four derived booleans then give
`4 × 3 × 2⁴ = 192` representable combinations. Exactly
`4 × 3 × 2 = 24` are legal: action type and decoded executed state remain
independent, while the per-action loading match is independent and determines
all four Boolean projections together with type and execution.

The narrower `isLoading,isExecuted,showLoading` projection remains 8/6, but it
omits the public source alternatives and inline `disabled` output. Adding
`disabled` still produces six distinct Boolean tuples:

| isLoading | isExecuted | showLoading | disabled | source class |
| --- | --- | --- | --- | --- |
| false | false | false | false | idle, executed None or Some(false) |
| false | true | false | true | executed without loading |
| true | false | false | true | modal loading |
| true | true | false | true | modal loading plus executed |
| true | false | true | true | nonmodal loading |
| true | true | true | true | nonmodal loading plus executed |

`loadingActionId` remains an optional card-level selector rather than a finite
member of this per-action cluster. Undefined and a nonmatching ID are
observationally identical for the current action, while arbitrary ID contents
and which sibling action matches are separate list-level facts. `isLoading` is
the exact finite projection consumed here. Action ID, label, style, card status,
callbacks, and sibling-action count are independent.

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

Promote the stable `r3-foundation-notification-action-busy` record with the
six-member full cluster above, cardinality 192/24, `storage=derived`,
`exposure=internal`, `targetShape=literalkit`, and Tier 1. Preserve the former
D1 note as discovery history: loading and execution remain independently
combinable. Supersede the raw round-26 ID because `showLoading` and `disabled`
are derived presentation aliases over that independent source state.
