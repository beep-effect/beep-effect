/**
 * The width the user gave the thread sidebar, remembered.
 *
 * A pane you can drag but that forgets where you put it is worse than a fixed
 * one: the chat surface unmounts every time you visit Ontology or Vault sync, so
 * an in-memory width would snap back on the way home. Persisted the same way
 * composer drafts are — `Atom.kvs` over `localStorage`.
 *
 * @packageDocumentation
 * @category atoms
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity/packages";
import * as N from "@beep/utils/Number";
import * as O from "@beep/utils/Option";
import * as R from "@beep/utils/Record";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { professionalStorageRuntime } from "@/runtime/ProfessionalAtomRuntime";

const $I = $ProfessionalDesktopId.create("chat/ui/layout.atoms");

/**
 * Minimum percentage of the chat surface the sidebar may occupy.
 *
 * **Example** (Logging minimum percentage)
 *
 * ```ts
 * import { SIDEBAR_MIN_PERCENT } from "@/chat/ui/layout.atoms"
 *
 * console.log(`${SIDEBAR_MIN_PERCENT}%`) // "14%"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SIDEBAR_MIN_PERCENT = 14;

/**
 * Panel id shared by the chat surface's sidebar `Panel` and the persisted
 * layout reader, so the layout-record key and the JSX id cannot drift.
 *
 * **Example** (Read the sidebar pane id)
 *
 * ```ts
 * import { SIDEBAR_PANE_ID } from "@/chat/ui/layout.atoms"
 *
 * console.log(SIDEBAR_PANE_ID) // "sidebar-pane"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SIDEBAR_PANE_ID = "sidebar-pane";

/**
 * Maximum percentage of the chat surface the sidebar may occupy.
 *
 * **Example** (Logging maximum percentage)
 *
 * ```ts
 * import { SIDEBAR_MAX_PERCENT } from "@/chat/ui/layout.atoms"
 *
 * console.log(`${SIDEBAR_MAX_PERCENT}%`) // "40%"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SIDEBAR_MAX_PERCENT = 40;

/**
 * Initial percentage of the chat surface assigned to the sidebar.
 *
 * **Example** (Logging default percentage)
 *
 * ```ts
 * import { SIDEBAR_DEFAULT_PERCENT } from "@/chat/ui/layout.atoms"
 *
 * console.log(`${SIDEBAR_DEFAULT_PERCENT}%`) // "20%"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SIDEBAR_DEFAULT_PERCENT = 20;

/**
 * Valid persisted width for the thread sidebar.
 *
 * **Example** (Validating percent with schema)
 *
 * ```ts
 * import { SidebarPercent } from "@/chat/ui/layout.atoms"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SidebarPercent)(20)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SidebarPercent = S.Finite.check(
  S.isBetween({ minimum: SIDEBAR_MIN_PERCENT, maximum: SIDEBAR_MAX_PERCENT })
).pipe(
  $I.annoteSchema("SidebarPercent", {
    description: "A sidebar percentage within the range enforced by the resizable panel.",
  })
);

/**
 * Runtime type for {@link SidebarPercent}.
 *
 * **Example** (Assigning typed percent value)
 *
 * ```ts
 * import type { SidebarPercent } from "@/chat/ui/layout.atoms"
 *
 * const percent: SidebarPercent = 20
 * console.log(percent)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
type SidebarPercent = typeof SidebarPercent.Type;

/**
 * The sidebar's share of the chat surface, as a percentage.
 *
 * **Details**
 *
 * Only the sidebar's width is stored, not the whole panel layout: the main pane is
 * whatever is left, so the two can never be persisted into disagreement, and a
 * renamed panel cannot orphan the stored value.
 *
 * **Example** (Inspecting atom object type)
 *
 * ```ts
 * import { sidebarPercentAtom } from "@/chat/ui/layout.atoms"
 *
 * console.log(typeof sidebarPercentAtom) // "object"
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const sidebarPercentAtom = Atom.kvs({
  runtime: professionalStorageRuntime,
  key: "chat:sidebar-percent",
  schema: SidebarPercent,
  defaultValue: () => SIDEBAR_DEFAULT_PERCENT,
});

class SidebarLayoutChanged extends S.Class<SidebarLayoutChanged>($I`SidebarLayoutChanged`)(
  {
    layout: S.Record(S.String, S.Finite),
    isUserInteraction: S.Boolean,
  },
  $I.annote("SidebarLayoutChanged", {
    description: "A completed resizable-panel layout accepted by the persisted layout action.",
  })
) {}

/**
 * Runtime action that persists the sidebar width after a user finishes
 * resizing the panel group.
 *
 * **Example** (Checking action atom type)
 *
 * ```ts
 * import { persistSidebarLayoutAtom } from "@/chat/ui/layout.atoms"
 *
 * console.log(typeof persistSidebarLayoutAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const persistSidebarLayoutAtom = professionalStorageRuntime.fn<SidebarLayoutChanged>()(
  Effect.fnUntraced(function* (change, ctx) {
    if (change.isUserInteraction) {
      O.map(R.get(change.layout, SIDEBAR_PANE_ID), (percent) =>
        ctx.set(sidebarPercentAtom, clampSidebarPercent(percent))
      );
    }
  })
);

/**
 * Clamp a stored width back into the range the panes actually allow.
 *
 * **Details**
 *
 * A value written by an older build — or by a hand-edited `localStorage` — must not
 * be able to hand the user a sidebar they cannot drag back.
 *
 * **Example** (Clamping oversized percent value)
 *
 * ```ts
 * import { clampSidebarPercent } from "@/chat/ui/layout.atoms"
 *
 * console.log(clampSidebarPercent(90)) // 40
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const clampSidebarPercent = (percent: number): number =>
  N.clamp(percent, { minimum: SIDEBAR_MIN_PERCENT, maximum: SIDEBAR_MAX_PERCENT });

/**
 * A pane size the panel library cannot misread.
 *
 * **Details**
 *
 * `react-resizable-panels` reads a bare `number` size as **pixels**. Handing it the
 * percentages by their number pinned the sidebar into a fourteen-to-forty *pixel*
 * range: a sliver too narrow to read and too narrow to grab. Every size the panes are
 * given goes through here, so the unit is part of the value and not a convention
 * someone has to remember.
 *
 * **Example** (Formatting size as percent)
 *
 * ```ts
 * import { sidebarSize } from "@/chat/ui/layout.atoms"
 *
 * console.log(sidebarSize(20)) // "20%"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const sidebarSize = (percent: number): `${number}%` => `${clampSidebarPercent(percent)}%`;
