# Instance

- id: `dock-tab-drag-phase`
- file:line: `packages/foundation/ui-system/dock-react/src/internal/Gesture.models.ts:24`
- symbol: `TabDrag`
- members: `moved`, `concluded`
- evidence classes:
  - E4 at `packages/foundation/ui-system/dock-react/src/DockviewReact.tsx:33` — concluded is only written behind a moved guard; readers pair the flags as `!drag.value.moved || drag.value.concluded` (also line 112).

# Current shape

Live declaration at `packages/foundation/ui-system/dock-react/src/internal/Gesture.models.ts:18`:

```ts
export class TabDrag extends S.Class<TabDrag>($I`TabDrag`)(
  {
    panelId: PanelId,
    fromGroupId: GroupId,
    pointer: PointerPosition,
    origin: PointerPosition,
    moved: S.Boolean,
    concluded: S.Boolean,
    pointerId: S.Int,
  },
  $I.annote("TabDrag", {
    description:
      "Active tab-drag state: source group, latest and initial pointer positions, whether the pointer has traveled past the drag-promotion threshold, and whether the gesture has concluded (Escape-cancel or commit). A concluded promoted drag stays recorded until its release's trailing click is swallowed — or until the next press — so the click can neither activate the dragged tab nor re-point focus at the source group.",
  })
) {}
```

# Cardinality gap

The two booleans represent four combinations. Three phases are legal:

- `pressed`: the pointer is down but the promotion threshold has not been crossed (`moved=false`, `concluded=false`).
- `dragging`: the drag is promoted and active (`moved=true`, `concluded=false`).
- `concluded`: a promoted drag has committed or been Escape-cancelled and its record is retained for the trailing click (`moved=true`, `concluded=true`).

`moved=false, concluded=true` is illegal.

# Target schema

Add `LiteralKit` to the existing `@beep/schema` import. `TabDragPhase` is the new payload-free domain and replaces both booleans:

```ts
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";

export const TabDragPhase = LiteralKit(["pressed", "dragging", "concluded"]).pipe(
  $I.annoteSchema("TabDragPhase", {
    description: "Lifecycle phase of a tab pointer gesture, including the retained post-drag record.",
  })
);
export type TabDragPhase = typeof TabDragPhase.Type;

export class TabDrag extends S.Class<TabDrag>($I`TabDrag`)(
  {
    panelId: PanelId,
    fromGroupId: GroupId,
    pointer: PointerPosition,
    origin: PointerPosition,
    phase: TabDragPhase,
    pointerId: S.Int,
  },
  $I.annote("TabDrag", {
    description:
      "Tab-drag state from initial press through promoted dragging and the retained concluded record used to swallow the trailing click.",
  })
) {}
```

Use `TabDragPhase.Enum.*` for writes and `TabDragPhase.is.*` for phase guards. No parallel predicate is introduced.

# Migration inventory

- `packages/foundation/ui-system/dock-react/src/internal/Gesture.models.ts:24-25` — replace `moved` and `concluded` with `phase: TabDragPhase`; update the description at line 30.
- `packages/foundation/ui-system/dock-react/src/DockviewReact.tsx:33` — replace the paired active-drag test with `!TabDragPhase.is.dragging(drag.value.phase)` and import `TabDragPhase` with `DropPreview`.
- `packages/foundation/ui-system/dock-react/src/DockviewReact.tsx:112` — make the same single-phase guard for the drag ghost.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:33` — import `TabDragPhase` beside `TabDrag` and `TabRect`.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:108` — filter out retained records with `!TabDragPhase.is.concluded(drag.phase)`.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:113` — Escape maps `dragging` to `concluded`; a `pressed` record clears. Construct the new class with `phase`, not a boolean patch.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:121` — restore focus only when `TabDragPhase.is.dragging(drag.phase)`.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:133` — swallow the click only for `concluded`.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:143` — pointer movement is accepted for any non-`concluded` phase owned by the panel.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:150` — promote `pressed` to `dragging` when the threshold is exceeded; keep `dragging` unchanged.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:158` — branch on `concluded` for the retained-record release path.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:170` — perform the release-time promotion check by producing a final `phase`, not by OR-ing `moved`.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:178` — retain a `concluded` record only when the final phase is `dragging`; clear `pressed`.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:181` — compile and submit a drop only for a final `dragging` phase.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:191` — clear a stale retained record by testing `concluded`.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:212-213` — initialize a new pointer record as `phase: TabDragPhase.Enum.pressed`.

The `moved` fields in `SashDragBase` and `FloatingGestureBase`, and their readers in `Sash.tsx` and `FloatingPane.tsx`, are different symbols and remain unchanged.

# Guard-deletion accounting

- `packages/foundation/ui-system/dock-react/src/DockviewReact.tsx:33` and `:112` — delete both `!moved || concluded` coherence guards; a single `dragging` guard replaces each.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:113` — delete the `moved ? concluded=true : none` repair that prevents the illegal concluded-without-movement state.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:143` — delete the boolean `!concluded` half-state guard.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:150` and `:170` — delete the sticky `current.moved || threshold` boolean coherence updates.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:172-175` — rewrite the comment-only invariant from correlated booleans to the explicit `dragging -> concluded` / `pressed -> none` transition.
- `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:178` — delete the final `moved` check used to decide whether `concluded` is legal.
- `packages/foundation/ui-system/dock-react/src/internal/Gesture.models.ts:30` — delete the prose-only relationship between “traveled” and “concluded”; the phase domain carries it.

# Encoded-side impact

none (internal)

# Test impact

- `packages/foundation/ui-system/dock-react/test/Gestures.test.tsx:230` and `:236` — replace assertions on `drag.concluded` with `TabDragPhase.is.concluded(drag.phase)` (or exact comparison with `TabDragPhase.Enum.concluded`); update the comment at line 232 to say “concluded phase.”
- No other file under `packages/foundation/ui-system/dock-react/test/` reads `TabDrag.moved` or `TabDrag.concluded`.

# Risk & sequencing

Land the model and all `GroupPane`/`DockviewReact` call sites atomically because `TabDrag` is exported through the adapter atom types. Gesture semantics are sensitive: preserve release-time promotion, Escape clearing of an unpromoted press, the retained concluded record, and trailing-click swallowing. This instance shares `Gesture.models.ts` with other dock gesture models; do not alter the independent sash/floating `moved` flags in this change.
