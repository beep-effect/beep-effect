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

import { N } from "@beep/utils";
import * as S from "effect/Schema";
import { KeyValueStore } from "effect/unstable/persistence";
import { Atom } from "effect/unstable/reactivity";

const layoutRuntime = Atom.runtime(KeyValueStore.layerStorage(() => globalThis.localStorage));

/**
 * Minimum percentage of the chat surface the sidebar may occupy.
 *
 * @example
 * ```ts
 * import { SIDEBAR_MIN_PERCENT } from "@/chat/ui/layout.atoms"
 *
 * console.log(SIDEBAR_MIN_PERCENT) // 14
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SIDEBAR_MIN_PERCENT = 14;

/**
 * Maximum percentage of the chat surface the sidebar may occupy.
 *
 * @example
 * ```ts
 * import { SIDEBAR_MAX_PERCENT } from "@/chat/ui/layout.atoms"
 *
 * console.log(SIDEBAR_MAX_PERCENT) // 40
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SIDEBAR_MAX_PERCENT = 40;

/**
 * Initial percentage of the chat surface assigned to the sidebar.
 *
 * @example
 * ```ts
 * import { SIDEBAR_DEFAULT_PERCENT } from "@/chat/ui/layout.atoms"
 *
 * console.log(SIDEBAR_DEFAULT_PERCENT) // 20
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SIDEBAR_DEFAULT_PERCENT = 20;

/**
 * The sidebar's share of the chat surface, as a percentage.
 *
 * Only the sidebar's width is stored, not the whole panel layout: the main pane is
 * whatever is left, so the two can never be persisted into disagreement, and a
 * renamed panel cannot orphan the stored value.
 *
 * @example
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
  runtime: layoutRuntime,
  key: "chat:sidebar-percent",
  schema: S.Finite,
  defaultValue: () => SIDEBAR_DEFAULT_PERCENT,
});

/**
 * Clamp a stored width back into the range the panes actually allow.
 *
 * A value written by an older build — or by a hand-edited `localStorage` — must not
 * be able to hand the user a sidebar they cannot drag back.
 *
 * @example
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
 * `react-resizable-panels` reads a bare `number` size as **pixels**. Handing it the
 * percentages by their number pinned the sidebar into a fourteen-to-forty *pixel*
 * range: a sliver too narrow to read and too narrow to grab. Every size the panes are
 * given goes through here, so the unit is part of the value and not a convention
 * someone has to remember.
 *
 * @example
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
