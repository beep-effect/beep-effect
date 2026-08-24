# Instance

- id: `todo-item-due-tone`
- file:line: `packages/foundation/ui-system/ui/src/components/todo-item.tsx:139`
- symbol: `TodoItem`
- members: `isToday`, `isOverdue`
- evidence classes:
  - E2 at `packages/foundation/ui-system/ui/src/components/todo-item.tsx:17` — dueDateToneClassName if/else-ifs over the flags and never handles a combined-true case; both derive from the one dueDate (lines 139-141).

# Current shape

Live sibling declarations at `packages/foundation/ui-system/ui/src/components/todo-item.tsx:139`:

```ts
const isOverdue =
  dueDateTime !== undefined ? DateTime.toEpochMillis(dueDateTime) < DateTime.toEpochMillis(now) && !completed : false;
const isToday =
  dueDateTime !== undefined &&
  !completed &&
  (() => {
    const parsed = DateTime.toPartsUtc(dueDateTime);
    const nowParts = DateTime.toPartsUtc(now);
    return parsed.year === nowParts.year && parsed.month === nowParts.month && parsed.day === nowParts.day;
  })();
```

# Cardinality gap

Two booleans represent four combinations, while the rendered due-date badge has three legal tones:

- `today`: an incomplete item due on the current UTC calendar day.
- `overdue`: an incomplete item before now and not in the `today` case.
- `upcoming`: every other displayed due date, including completed items and future dates.

The live calculation can transiently produce both booleans as `true` for an incomplete timestamp earlier today, but `dueDateToneClassName` gives `today` precedence. That fourth bit pattern is not a fourth UI state; the target derivation must preserve the precedence explicitly.

# Target schema

Add `LiteralKit` and replace both derived booleans with one derived literal. The new kit/type is `DueDateTone`.

```ts
import { LiteralKit } from "@beep/schema";

const DueDateTone = LiteralKit(["today", "overdue", "upcoming"]);
type DueDateTone = typeof DueDateTone.Type;

const dueDateToneClassName = (tone: DueDateTone): string =>
  DueDateTone.$match(tone, {
    today: () => "bg-green-500/10 text-green-600 dark:text-green-400",
    overdue: () => "bg-red-500/10 text-red-600 dark:text-red-400",
    upcoming: () => "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  });

const dueTone: DueDateTone = (() => {
  if (dueDateTime === undefined || completed) return DueDateTone.Enum.upcoming;
  const dueParts = DateTime.toPartsUtc(dueDateTime);
  const nowParts = DateTime.toPartsUtc(now);
  if (dueParts.year === nowParts.year && dueParts.month === nowParts.month && dueParts.day === nowParts.day) {
    return DueDateTone.Enum.today;
  }
  return DateTime.toEpochMillis(dueDateTime) < DateTime.toEpochMillis(now)
    ? DueDateTone.Enum.overdue
    : DueDateTone.Enum.upcoming;
})();
```

This is derived state only; do not add an atom, hook state, or stored field.

# Migration inventory

- `packages/foundation/ui-system/ui/src/components/todo-item.tsx:17-27` — change `dueDateToneClassName` from two booleans and an if/else-if chain to one exhaustive `DueDateTone.$match`.
- `packages/foundation/ui-system/ui/src/components/todo-item.tsx:139-148` — replace `isOverdue` and `isToday` with the single `dueTone` derivation above, checking same-day before elapsed-time overdue to preserve current rendering precedence.
- `packages/foundation/ui-system/ui/src/components/todo-item.tsx:200` — call `dueDateToneClassName(dueTone)`.

# Guard-deletion accounting

- `packages/foundation/ui-system/ui/src/components/todo-item.tsx:17-27` — delete the boolean-priority if/else-if chain that silently treats `isToday=true, isOverdue=true` as “today.”
- `packages/foundation/ui-system/ui/src/components/todo-item.tsx:139-148` — delete two parallel due-date predicates and their duplicated `dueDateTime !== undefined` / `!completed` coherence conditions; one derivation names the precedence and returns exactly one tone.

# Encoded-side impact

none (internal)

# Test impact

No file under `packages/foundation/ui-system/ui/test/` reads `isToday`, `isOverdue`, or `dueDateToneClassName`. Add focused coverage for an earlier time today (must remain `today`, not `overdue`), yesterday (`overdue`), future (`upcoming`), and completed past items (`upcoming`). `packages/foundation/ui-system/ui/stories/components/todo-item.stories.tsx` uses the public component but does not touch these internal members.

# Risk & sequencing

The same-day-before-now overlap is the key behavioral edge. Land the derivation and renderer signature together, and preserve UTC calendar comparison and `today` precedence. This instance shares `todo-item.tsx` with unrelated boolean props and metadata presence checks; do not broaden the change to them.
