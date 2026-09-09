# Instance

- id: `todo-item-due-tone`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/foundation/ui-system/ui/src/components/todo-item.tsx:132`
- symbol: `TodoItem`
- members: `completed`, `hasDueDate`, `isToday`, `isOverdue`
- evidence classes:
  - E4 at `todo-item.tsx:132-148` — an absent date forces both temporal flags false, and completion independently forces both false.
  - E2 at `todo-item.tsx:17-27,196-205` — a present incomplete date selects today before overdue and otherwise uses the neutral tone.

# Current shape

`TodoItem` accepts public `completed` and optional `dueDate` props at lines 47-59. It derives date presence, parses a present date, samples the clock, and derives separate today and overdue booleans at lines 132-148. The overdue comparison is instant-based while today compares UTC calendar parts. Consequently, an incomplete timestamp earlier on the current UTC day makes both flags true. `dueDateToneClassName` deliberately gives today precedence at lines 17-27. Completion also controls row opacity, title decoration, toggle appearance, ARIA text, and callback inversion at lines 153-179, so it remains a public input rather than becoming part of stored due state.

# Cardinality gap

Four booleans represent 16 tuples. Exactly seven are supported. Columns are `completed hasDueDate isToday isOverdue`:

| bits | supported case | rendered tone when present |
| --- | --- | --- |
| `0000` | incomplete, no date | no badge |
| `1000` | completed, no date | no badge |
| `0100` | incomplete, future or current non-earlier date outside today | neutral |
| `0101` | incomplete, earlier date outside today | overdue |
| `0110` | incomplete, today and not earlier than the sampled instant | today |
| `0111` | incomplete, earlier today | today |
| `1100` | completed with a date | neutral |

An absent date cannot be today or overdue. A completed item cannot be today or overdue. All four pairs of temporal flags are reachable for an incomplete present date, including combined true for earlier today. The previous two-member D1 correctly rejected treating `isToday` and `isOverdue` alone as exclusive; the expanded cluster exposes the actual implications without outlawing that overlap.

# Target schema

Add one private `TodoDueTone = LiteralKit(["today", "overdue", "neutral"])` beside the component helpers. For a present date, derive exactly one tone from `completed`, the parsed date, and one captured `now`: completed selects neutral; an incomplete date on the current UTC calendar day selects today; another incomplete date earlier than `now` selects overdue; the remainder selects neutral. Match the literal to the exact existing class strings.

Render the badge directly when `dueDate !== undefined`, so absence remains ordinary optional input rather than a sentinel tone. Preserve today-before-overdue priority, which maps the legal `0111` state to today. Do not store the tone, expose it, or combine completion's independent row behavior with date presentation.

# Migration inventory

- `packages/foundation/ui-system/ui/src/components/todo-item.tsx:9-13` — import `LiteralKit` from the already-declared `@beep/schema` dependency and define the private literal owner locally.
- `todo-item.tsx:15-27` — retain the four-value `TodoPriority`; replace the two-boolean `dueDateToneClassName` API with an exhaustive `TodoDueTone` match that returns the same three class strings.
- `todo-item.tsx:47-61,115-129` — keep the public props and defaults unchanged, including `completed` and optional `dueDate`.
- `todo-item.tsx:132-148` — remove the three derived boolean locals and classify a present date from the raw prop. Preserve `toUtcDateTime`, `DateTime.nowUnsafe`, epoch comparison, UTC part comparison, and a single `now` sample for the classifier.
- `todo-item.tsx:153-179` — no control-flow edit; preserve completion opacity, title/toggle styling, ARIA label, propagation stop, and `onToggleComplete(id, !completed)`.
- `todo-item.tsx:194-205` — test the raw optional date for badge presence and consume the tone. Preserve badge position, icons, `formatDate(dueDate)`, and all class strings.
- `todo-item.tsx:86-99` — no edit to date text formatting or its independent clock sample; retain Today/Tomorrow/Yesterday/day-count/short-date behavior exactly.
- `packages/foundation/ui-system/ui/stories/components/todo-item.stories.tsx:53-90` — retain row-click and populated metadata stories; add deterministic due-tone cases and toggle propagation coverage.
- `packages/foundation/ui-system/ui/package.json:29,92-103` — no dependency or export change; `@beep/schema` already exists and `TodoItem` remains available through `./components/*`.

Targeted repository and barrel search found no other writer or reader of `hasDueDate`, `isToday`, `isOverdue`, or `dueDateToneClassName`. The metadata design also includes `hasDueDate` in its separate wrapper-visibility proof because SPEC permits distinct clusters to share an input. The atomic implementation still deletes the one local once and lets both classifiers inspect the raw optional date.

# Guard-deletion accounting

Delete `hasDueDate`, `isToday`, and `isOverdue` at lines 132 and 139-148, the conditional used solely to manufacture `dueDateTime`, the two-boolean helper signature, and its today/overdue conditional chain. Replace them with one present-date `TodoDueTone` derivation and exhaustive match. Keep `completed` because it has independent visible and callback readers. Keep `dueDate` as the public optional value; both due presentation and metadata visibility inspect it directly without relocating a presence flag.

# Encoded-side impact

None. `TodoItemProps` is a transient React prop contract and has no schema codec, persistence, JSON, URL, or wire reader. Its public prop names, optional/default behavior, date parsing, callback payloads, DOM, text, and classes remain unchanged. The literal is private derived control flow and introduces no stored state.

# Test impact

Add focused component/story coverage with a controlled clock for all seven supported tuples. Assert no badge without a date; neutral tone for completed dates and incomplete future non-today dates; red for overdue non-today dates; and green for both future-today and earlier-today dates. The earlier-today case is the regression proof that combined `isToday`/`isOverdue` remains legitimate and today keeps precedence. Preserve exact formatted text around UTC day boundaries.

Retain interaction proof: clicking the title calls `onClick(id)` once; clicking the completion control stops propagation and calls `onToggleComplete(id, !completed)` once; completion classes and ARIA text remain exact. During implementation run the `browser-qa-loop` through the portless Storybook surface and retain record, extract, and judge evidence with `requiredCount: 0` for the due tones, row click, and completion control.

# Risk and sequencing

Tier 1 private derived refactor. Land with `r3-foundation-todo-item-presence` because both consume date presence while the atomic edit removes the one `hasDueDate` local once. They are independently adjudicated clusters: this record constrains temporal presentation and the other constrains wrapper visibility. The main risks are changing UTC calendar semantics, sampling `now` at a different point, making overdue win over today, or changing callback propagation. No new public API, stored state, dependency, generated file, or generic helper is introduced.
