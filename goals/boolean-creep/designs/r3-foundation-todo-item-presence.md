# Instance

- id: `r3-foundation-todo-item-presence`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/foundation/ui-system/ui/src/components/todo-item.tsx:132`
- symbol: `TodoItem.metadata`
- members: `priority`, `hasDueDate`, `hasProject`, `hasLabels`, `hasSubtasks`, `hasMetadata`
- evidence classes:
  - E4 at `todo-item.tsx:132-149` — metadata visibility is the OR of non-none priority, date presence, project presence, nonempty labels, and nonempty subtasks.
  - E2 at `todo-item.tsx:194-249` — the wrapper is the sole reader of `hasMetadata`; each child retains its own raw value/presence rendering rule.

R28 source revalidation: the complete component bytes are unchanged from the
original design pin at current HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`.
The actual metadata OR is line 149 and date formulas are lines 139-148.
See `../data/design-refresh-2026-09-09-r28-first-d-census.md`; replacement
independent P3 review remains pending.

# Current shape

The public props provide a four-value required priority, an optional due date and project, and default-empty label and subtask arrays at lines 47-59 and 115-129. Lines 132-149 derive five presence booleans and OR them with non-none priority into `hasMetadata`. The wrapper at lines 194-249 reads only `hasMetadata`; its children separately read the raw date, project, labels, priority, and subtasks.

`hasDescription` at line 131 is independent: it controls a sibling paragraph at line 191 and does not contribute to metadata visibility. It remains outside this owner. `hasDueDate` also participates in the independently adjudicated due-tone cluster. That shared input is legitimate under SPEC because the clusters constrain different outputs. The implementation has one presence observation today and must not duplicate it during migration.

# Cardinality gap

The cluster has a four-value `priority` domain and five booleans, so it represents `4 * 2^5 = 128` tuples. Exactly 64 are supported. The four source-presence axes `hasDueDate`, `hasProject`, `hasLabels`, and `hasSubtasks` are independently selectable for every priority value, giving `4 * 2^4 = 64` inputs. Each input uniquely determines `hasMetadata`: it is false only for priority `none` with all four presence axes false and true for the other 63 inputs.

The original six-boolean D1 mixed independent description presence into the OR family and omitted the four-value priority domain, obscuring both the relationship and its exact cardinality. Sharing `hasDueDate` with the due-tone proof does not record the same cluster twice: this owner proves the metadata OR, while the due owner proves completion/date implications and temporal precedence.

# Target schema

Add one private `TodoMetadataVisibility = LiteralKit(["hidden", "visible"])` near `TodoItem`. Derive it from the raw props: visible when priority is not `none`, `dueDate` or `project` is present, or either array is nonempty; hidden otherwise. Exhaustively match the literal around the existing metadata wrapper.

Keep each child branch on its raw value: the date badge follows `dueDate !== undefined`, the project follows `project !== undefined`, labels use `A.map`, priority follows `priority !== "none"`, and subtasks follow `subtasks.length > 0`. The disposition owns wrapper visibility only. Do not create a combined metadata payload, a 64-case enum, stored state, or a reusable generic visibility helper.

# Migration inventory

- `packages/foundation/ui-system/ui/src/components/todo-item.tsx:9-15` — share the local `LiteralKit` import introduced with `todo-item-due-tone`; add the private `TodoMetadataVisibility` owner.
- `todo-item.tsx:47-61,115-129` — preserve every public prop and the empty-array/default selection behavior.
- `todo-item.tsx:130-151` — remove `hasProject`, `hasLabels`, `hasSubtasks`, and `hasMetadata`; derive one visibility literal directly from `priority`, `dueDate`, `project`, `labels`, and `subtasks`. `hasDescription` and `completedSubtasks` remain independent.
- `todo-item.tsx:191` — no edit; keep nonempty description rendering independent of metadata.
- `todo-item.tsx:194-249` — match visibility around the existing wrapper. Preserve child order as due date, project, labels, priority, subtasks and preserve every icon, key, color override, class, capitalized label, and completed/total subtask count.
- `todo-item.tsx:196-205` — coordinate with `todo-item-due-tone`: test raw `dueDate` for the badge and use its derived tone; do not reintroduce a date-presence local.
- `packages/foundation/ui-system/ui/stories/components/todo-item.stories.tsx:12-48,67-95` — retain all four priority control values, public defaults, completed/detailed/selected stories, and callback spies; add one-source metadata cases and the fully empty case.
- `packages/foundation/ui-system/ui/package.json:29,92-103` — no dependency or export change.

Targeted repository and barrel search found no other writer or reader of these local presence facts. `TodoItemProps` is consumed through the package's `./components/*` export; the story is the only repository call site found. `todo-item-due-tone` shares the `hasDueDate` source axis for a different relation; the two designs specify one atomic edit and no duplicate helper or state.

# Guard-deletion accounting

Delete `hasProject`, `hasLabels`, `hasSubtasks`, and `hasMetadata` at lines 133-135 and 149, including the five-way boolean OR. Delete the metadata wrapper's boolean guard at line 194 in favor of the visibility literal match. The coordinated due design deletes `hasDueDate`; this design reads raw `dueDate` directly for visibility. Child branches already consume raw values, so no replacement presence locals are introduced. Retain `hasDescription` because its nonempty-string rule and paragraph are independent.

# Encoded-side impact

None. The public React props and direct `./components/*` package export remain unchanged, and there is no codec, persisted record, or wire representation for the private locals. Preserve optional prop acceptance, default-empty arrays, exact child data, ordering, rendered classes/text, and callbacks. The new literal is transient derived control flow.

# Test impact

Add public component/story cases proving the wrapper is absent only for `priority="none"`, absent due date/project, and empty labels/subtasks. Prove each source alone makes the wrapper visible: every non-none priority value, a due date, a project, one label, and one subtask. Assert exact child order and content in the fully populated case, project/label colors, priority styling/text, and completed-subtask count. Include description-only input to prove it renders the paragraph without manufacturing the metadata wrapper.

Retain row/toggle interaction coverage from the due design. During implementation run `browser-qa-loop` through the portless Storybook surface and retain record, extract, and judge evidence with `requiredCount: 0`, including the empty, each-source, description-only, and detailed cases plus the existing click/toggle behavior.

# Risk and sequencing

Tier 1 private derived refactor. Land with `todo-item-due-tone` so the shared old `hasDueDate` local is removed once and both decisions inspect raw `dueDate` without recreating it. The main risks are hiding the wrapper for due-only input, showing an empty wrapper, moving child order, or folding description into metadata. No public API, stored state, dependency, generated file, or generic helper is introduced.
