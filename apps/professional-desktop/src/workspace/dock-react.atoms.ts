/**
 * Atom bridges into the dock graph's private registry.
 *
 * @packageDocumentation
 * @category atoms
 * @since 0.0.0
 */

import { O, P } from "@beep/utils";
import { dual } from "effect/Function";
import { Atom } from "effect/unstable/reactivity";
import type { GroupId } from "@beep/dock";
import type { DockviewAdapterApi } from "@beep/dock-react";
import type { DesktopDockGraph } from "./dock.atoms.ts";

const bridgedDockAtoms = Atom.family((graph: DesktopDockGraph) =>
  Atom.family(<A>(atom: Atom.Atom<A>) =>
    Atom.make((get) => {
      get.addFinalizer(graph.registry.subscribe(atom, (value) => get.setSelf(value)));
      return graph.registry.get(atom);
    })
  )
);

/**
 * Mirrors one atom from a dock graph's private registry into the application
 * registry.
 *
 * @example
 * ```tsx
 * import type { DesktopDockGraph } from "@/workspace/dock.atoms"
 * import { dockAtomBridge } from "@/workspace/dock-react.atoms"
 * import { useAtomValue } from "@effect/atom-react"
 *
 * function DockGroupCount({ graph }: { graph: DesktopDockGraph }) {
 *   const dataFirst = dockAtomBridge(graph, graph.groupCountAtom)
 *   const dataLast = dockAtomBridge(graph.groupCountAtom)(graph)
 *   const groupCount = useAtomValue(dataFirst)
 *   return <output data-same-bridge={dataFirst === dataLast}>{groupCount}</output>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const dockAtomBridge: {
  <A>(graph: DesktopDockGraph, atom: Atom.Atom<A>): Atom.Atom<A>;
  <A>(atom: Atom.Atom<A>): (graph: DesktopDockGraph) => Atom.Atom<A>;
} = dual(2, <A>(graph: DesktopDockGraph, atom: Atom.Atom<A>): Atom.Atom<A> => bridgedDockAtoms(graph)(atom));

/**
 * Mirrors the focused dock group once the adapter API has arrived.
 *
 * @example
 * ```ts
 * import { focusedDockGroupAtom } from "@/workspace/dock-react.atoms"
 *
 * console.log(typeof focusedDockGroupAtom === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const focusedDockGroupAtom = Atom.family((graph: DesktopDockGraph) =>
  Atom.family((api: DockviewAdapterApi | undefined) =>
    Atom.make((get) => (P.isUndefined(api) ? O.none<GroupId>() : get(dockAtomBridge(graph, api.atoms.focusedGroup))))
  )
);
