/**
 * React bridge into the dock graph's own atom registry.
 *
 * The dock kernel session owns a private `AtomRegistry` (the adapter provides
 * it to panel content), while the application's atoms live in the root
 * `RegistryProvider`. Components outside the dock — the shell nav, the Home
 * cards — must read dock atoms from the graph registry explicitly;
 * `useAtomValue` would silently instantiate a detached copy in the app
 * registry instead.
 *
 * @packageDocumentation
 * @category hooks
 * @since 0.0.0
 */
import { O, P, thunkUndefined } from "@beep/utils";
import { useSyncExternalStore } from "react";
import type { GroupId } from "@beep/dock";
import type { DockviewAdapterApi } from "@beep/dock-react";
import type { Atom } from "effect/unstable/reactivity";
import type { DesktopDockGraph } from "./dock.atoms.ts";

/**
 * Subscribes to an atom inside the dock graph's registry.
 *
 * @example
 * ```ts
 * import type { DesktopDockGraph } from "@/workspace/dock.atoms"
 * import { useDockAtom } from "@/workspace/useDockAtom"
 *
 * // Rerenders when the dock workspace changes, without touching the app registry.
 * const useDockGroupCount = (graph: DesktopDockGraph): number => useDockAtom(graph, graph.groupCountAtom)
 * console.log(useDockGroupCount.name)
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const useDockAtom = <A>(graph: DesktopDockGraph, atom: Atom.Atom<A>): A =>
  useSyncExternalStore(
    (onStoreChange) => graph.registry.subscribe(atom, onStoreChange),
    () => graph.registry.get(atom),
    () => graph.registry.get(atom)
  );

/**
 * The focused dock group, once the adapter api has arrived via `onReady`.
 *
 * The subscription is inert until the api exists, so the hook is safe to call
 * unconditionally while the adapter boots.
 *
 * @example
 * ```ts
 * import { useFocusedDockGroup } from "@/workspace/useDockAtom"
 *
 * console.log(useFocusedDockGroup.length) // 2
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const useFocusedDockGroup = (graph: DesktopDockGraph, api: DockviewAdapterApi | undefined): O.Option<GroupId> =>
  useSyncExternalStore(
    (onStoreChange) =>
      P.isUndefined(api) ? thunkUndefined : graph.registry.subscribe(api.atoms.focusedGroup, onStoreChange),
    () => (P.isUndefined(api) ? O.none<GroupId>() : graph.registry.get(api.atoms.focusedGroup)),
    O.none<GroupId>
  );
