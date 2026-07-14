/**
 * Public surface for the greenfield Effect Dockview POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export * from "./AnchoredBox.ts";
export * from "./DockAtomProtocol.ts";
export {
  DockAtomObservabilityLive,
  type DockAtomSessionError,
  makeDockAtoms,
  makeDockAtomsWith,
} from "./DockAtoms.ts";
export {
  DockEngine,
  DockEngineLive,
  type DockEngineShape,
  DockSnapshotStore,
  type DockSnapshotStoreShape,
  makeDockSnapshotStoreMemory,
  requireSnapshot,
} from "./DockEngine.ts";
export { type DockCommandPolicy, lockedGroupsPolicy, makePolicyDockEngineLayer } from "./DockPolicy.ts";
export * from "./Domain.ts";
export * from "./Geometry.ts";
export { makeMruGroupsAtom, touchedGroups, touchedGroupsInEvents } from "./Recency.ts";
export {
  reduceDockCommand,
  restoreDockWorkspace,
  validateWorkspace,
} from "./Reducer.ts";
