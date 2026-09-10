# TodoItem full-cluster design refresh

Reviewed against source `7440cb8c4302ce64b87860069a464bafbf65f576` and corpus main `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

## Scope and source proof

The audit covered `packages/foundation/ui-system/ui/src/components/todo-item.tsx`, its package export, dependency declaration, and the sole repository call site in `packages/foundation/ui-system/ui/stories/components/todo-item.stories.tsx`. It also reconciled the Round 26 raw finding in `goals/boolean-creep/data/sweeps/refresh-2026-09-08-r26-main-9b7553/r26-foundation-ui.jsonl` with the stable D1 records `todo-item-due-tone` and `r3-foundation-todo-item-presence`.

`TodoItem` derives date presence and temporal flags at source lines 132-148. An incomplete date earlier on the current UTC day is both today and overdue; the renderer's today-first order at lines 17-27 is presentation precedence, not exclusion. Completion and missing dates each force both temporal flags false. This yields 16 representable and 7 supported tuples for `[completed,hasDueDate,isToday,isOverdue]`.

Metadata visibility at lines 133-149 is an OR over the four-value priority, due-date presence, project presence, nonempty labels, and nonempty subtasks. Its complete projection is `[priority,hasDueDate,hasProject,hasLabels,hasSubtasks,hasMetadata]`: 128 representable and 64 supported tuples. The four presence inputs are independently selectable at every priority, and each input uniquely fixes metadata visibility. `hasDescription` is independent and excluded.

## Designs

- `goals/boolean-creep/designs/todo-item-due-tone.md` refreshes the stable due id as derived, internal, Tier 1, E4/E2, members `[completed,hasDueDate,isToday,isOverdue]`, cardinality 16/7. It proposes one private `TodoDueTone` LiteralKit for present dates, preserves the legitimate today-plus-overdue input through today precedence, and removes all three derived date booleans.
- `goals/boolean-creep/designs/r3-foundation-todo-item-presence.md` refreshes the stable presence id as derived, internal, Tier 1, E4/E2, members `[priority,hasDueDate,hasProject,hasLabels,hasSubtasks,hasMetadata]`, cardinality 128/64. It proposes one private visibility literal, removes the four owned boolean locals plus the jointly migrated date-presence local, and leaves each child on its exact raw prop.

The two designs coordinate one implementation edit and share `hasDueDate` as an input to distinct relations. This follows `SPEC.md:62-65`: the same declaration may contain independently adjudicated clusters, while the same cluster may not be recorded twice. The due record owns completion/date implications and temporal presentation; the metadata record owns the wrapper OR. Both consume raw `dueDate`; neither leaves or recreates a `hasDueDate` helper. Public props, defaults, date parsing/formatting, UTC semantics, classes, child order, ARIA text, click propagation, and callback payloads remain exact. There is no encoded or persisted boundary.

## Parent reconciliation recommendation

Archive the old D1 interpretations and reconcile the stable canonical ids with the metadata above. Do not admit the raw Round 26 `completed/isToday/isOverdue` record separately: it is the same due-presentation cluster as the expanded stable owner, and its provisional 8/4 count omits both date presence and the supported earlier-today combined-true state. Retain `hasDueDate` in both complete projections because it is a real input to two different outputs, but remove its implementation local once. Do not retain independent `hasDescription` in the metadata record.

## Verification

The designs require focused component/story tests plus recorded portless Storybook QA for exact date tones, metadata visibility, row click, and completion-toggle propagation. Independent P3 review remains pending. `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` passed with `design coverage OK: 151 qualified ids`; scoped `git diff --check` passed for both designs and this handoff.
