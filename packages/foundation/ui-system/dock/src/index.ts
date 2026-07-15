/**
 * Public surface for the headless dock workspace kernel.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export {
  /**
   * @category value-objects
   * @since 0.0.0
   */
  AnchoredBox,
  /**
   * @category value-objects
   * @since 0.0.0
   */
  AnchoredSize,
  /**
   * @category value-objects
   * @since 0.0.0
   */
  BottomLeft,
  /**
   * @category value-objects
   * @since 0.0.0
   */
  BottomLeftAnchoredBox,
  /**
   * @category value-objects
   * @since 0.0.0
   */
  BottomRight,
  /**
   * @category value-objects
   * @since 0.0.0
   */
  BottomRightAnchoredBox,
  /**
   * @category value-objects
   * @since 0.0.0
   */
  TopLeft,
  /**
   * @category value-objects
   * @since 0.0.0
   */
  TopLeftAnchoredBox,
  /**
   * @category value-objects
   * @since 0.0.0
   */
  TopRight,
  /**
   * @category value-objects
   * @since 0.0.0
   */
  TopRightAnchoredBox,
} from "./AnchoredBox.ts";
export {
  /**
   * @category atoms
   * @since 0.0.0
   */
  DockAtomObservabilityLive,
  /**
   * @category atoms
   * @since 0.0.0
   */
  makeDockAtoms,
  /**
   * @category atoms
   * @since 0.0.0
   */
  makeDockAtomsWith,
} from "./Dock.atoms.ts";
export {
  /**
   * @category commands
   * @since 0.0.0
   */
  ActivatePanelCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  ApiCommandOrigin,
  /**
   * @category commands
   * @since 0.0.0
   */
  ClearWorkspaceCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  ClosePanelCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  CommandOrigin,
  /**
   * @category commands
   * @since 0.0.0
   */
  DockCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  DockCommandEnvelope,
  /**
   * @category commands
   * @since 0.0.0
   */
  DockFloatingGroupCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  FloatGroupCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  MaximizeGroupCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  MoveFloatingGroupCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  MoveGroupCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  MovePanelCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  OpenPanelCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  ResizeSplitCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  RestoreMaximizedCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  RestoreSnapshotRequest,
  /**
   * @category commands
   * @since 0.0.0
   */
  UpdateGroupCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  UpdatePanelCommand,
  /**
   * @category commands
   * @since 0.0.0
   */
  UserCommandOrigin,
} from "./Dock.commands.ts";
export {
  /**
   * @category errors
   * @since 0.0.0
   */
  DockCommandRejected,
  /**
   * @category errors
   * @since 0.0.0
   */
  DockInputBoundary,
  /**
   * @category errors
   * @since 0.0.0
   */
  DockInputError,
  /**
   * @category errors
   * @since 0.0.0
   */
  DockInvariantReason,
  /**
   * @category errors
   * @since 0.0.0
   */
  DockInvariantViolation,
  /**
   * @category errors
   * @since 0.0.0
   */
  DockPersistenceError,
  /**
   * @category errors
   * @since 0.0.0
   */
  DockPersistenceOperation,
  /**
   * @category errors
   * @since 0.0.0
   */
  DockRejectionReason,
  /**
   * @category errors
   * @since 0.0.0
   */
  DockSnapshotMissing,
  /**
   * @category errors
   * @since 0.0.0
   */
  DockTransitionError,
} from "./Dock.errors.ts";
export {
  /**
   * @category events
   * @since 0.0.0
   */
  DockEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  FloatingGroupMovedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  GroupDockedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  GroupFloatedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  GroupMaximizedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  GroupMergedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  GroupMovedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  GroupRestoredEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  GroupUpdatedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  PanelActivatedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  PanelClosedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  PanelMovedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  PanelOpenedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  PanelRenderModeChangedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  PanelReorderedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  PanelTabComponentChangedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  PanelTitleChangedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  PanelViewChangedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  SplitResizedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  WorkspaceClearedEvent,
  /**
   * @category events
   * @since 0.0.0
   */
  WorkspaceRestoredEvent,
} from "./Dock.events.ts";
export {
  /**
   * @category models
   * @since 0.0.0
   */
  DockBox,
  /**
   * @category models
   * @since 0.0.0
   */
  DockGeometry,
  /**
   * @category models
   * @since 0.0.0
   */
  FloatingGeometry,
  /**
   * @category models
   * @since 0.0.0
   */
  GeometryOptions,
  /**
   * @category models
   * @since 0.0.0
   */
  GroupGeometry,
  /**
   * @category models
   * @since 0.0.0
   */
  type GroupMinimaRecord,
  /**
   * @category models
   * @since 0.0.0
   */
  type GroupMinimumLookup,
  /**
   * @category projections
   * @since 0.0.0
   */
  makeDockGeometryAtoms,
  /**
   * @category projections
   * @since 0.0.0
   */
  project,
  /**
   * @category projections
   * @since 0.0.0
   */
  projectWorkspace,
  /**
   * @category projections
   * @since 0.0.0
   */
  resolveAnchoredBox,
  /**
   * @category models
   * @since 0.0.0
   */
  SashGeometry,
} from "./Dock.geometry.ts";
export {
  /**
   * @category identifiers
   * @since 0.0.0
   */
  CommandId,
  /**
   * @category identifiers
   * @since 0.0.0
   */
  GroupId,
  /**
   * @category identifiers
   * @since 0.0.0
   */
  PanelId,
  /**
   * @category identifiers
   * @since 0.0.0
   */
  RendererKey,
  /**
   * @category identifiers
   * @since 0.0.0
   */
  SplitId,
  /**
   * @category identifiers
   * @since 0.0.0
   */
  SplitRatio,
} from "./Dock.ids.ts";
export {
  /**
   * @category models
   * @since 0.0.0
   */
  ComponentPanelView,
  /**
   * @category models
   * @since 0.0.0
   */
  GroupHeaderPosition,
  /**
   * @category models
   * @since 0.0.0
   */
  GroupLockedMode,
  /**
   * @category models
   * @since 0.0.0
   */
  GroupMetadata,
  /**
   * @category models
   * @since 0.0.0
   */
  GroupPatch,
  /**
   * @category models
   * @since 0.0.0
   */
  Panel,
  /**
   * @category models
   * @since 0.0.0
   */
  PanelParameters,
  /**
   * @category models
   * @since 0.0.0
   */
  PanelParameterValue,
  /**
   * @category models
   * @since 0.0.0
   */
  PanelPatch,
  /**
   * @category models
   * @since 0.0.0
   */
  PanelRenderMode,
  /**
   * @category models
   * @since 0.0.0
   */
  PanelView,
  /**
   * @category models
   * @since 0.0.0
   */
  TextPanelView,
} from "./Dock.models.ts";
export {
  /**
   * @category models
   * @since 0.0.0
   */
  DockChanged,
  /**
   * @category models
   * @since 0.0.0
   */
  DockMutationOutcome,
  /**
   * @category models
   * @since 0.0.0
   */
  DockMutationResult,
  /**
   * @category models
   * @since 0.0.0
   */
  DockUnchanged,
  /**
   * @category models
   * @since 0.0.0
   */
  DockUnchangedReason,
} from "./Dock.outcomes.ts";
export {
  /**
   * @category models
   * @since 0.0.0
   */
  DockGroupMoveTarget,
  /**
   * @category models
   * @since 0.0.0
   */
  DockMoveTarget,
  /**
   * @category models
   * @since 0.0.0
   */
  DockPlacement,
  /**
   * @category models
   * @since 0.0.0
   */
  DockSide,
  /**
   * @category models
   * @since 0.0.0
   */
  GroupRootSplitPlacement,
  /**
   * @category models
   * @since 0.0.0
   */
  GroupSplitPlacement,
  /**
   * @category models
   * @since 0.0.0
   */
  RootPlacement,
  /**
   * @category models
   * @since 0.0.0
   */
  RootSplitPlacement,
  /**
   * @category models
   * @since 0.0.0
   */
  SplitPlacement,
  /**
   * @category models
   * @since 0.0.0
   */
  TabPlacement,
} from "./Dock.placement.ts";
export {
  /**
   * @category protocols
   * @since 0.0.0
   */
  DispatchDockCommand,
  /**
   * @category protocols
   * @since 0.0.0
   */
  DispatchUnknownDockCommand,
  /**
   * @category protocols
   * @since 0.0.0
   */
  DockAtomFeedEntry,
  /**
   * @category protocols
   * @since 0.0.0
   */
  DockAtomFeedFailure,
  /**
   * @category protocols
   * @since 0.0.0
   */
  DockAtomFeedSuccess,
  /**
   * @category protocols
   * @since 0.0.0
   */
  DockAtomOperation,
  /**
   * @category protocols
   * @since 0.0.0
   */
  DockAtomOperationKind,
  /**
   * @category protocols
   * @since 0.0.0
   */
  DockAtomOperationOutcome,
  /**
   * @category protocols
   * @since 0.0.0
   */
  DockAtomSessionError,
  /**
   * @category protocols
   * @since 0.0.0
   */
  DockMutationCompleted,
  /**
   * @category protocols
   * @since 0.0.0
   */
  DockSnapshotSaved,
  /**
   * @category protocols
   * @since 0.0.0
   */
  RestoreDockSnapshot,
  /**
   * @category protocols
   * @since 0.0.0
   */
  SaveDockSnapshot,
} from "./Dock.protocol.ts";
export {
  /**
   * @category utilities
   * @since 0.0.0
   */
  reduceDockCommand,
  /**
   * @category utilities
   * @since 0.0.0
   */
  restoreDockWorkspace,
  /**
   * @category validation
   * @since 0.0.0
   */
  validateWorkspace,
} from "./Dock.reducer.ts";
export {
  /**
   * @category models
   * @since 0.0.0
   */
  DockNode,
  /**
   * @category models
   * @since 0.0.0
   */
  DockSnapshot,
  /**
   * @category models
   * @since 0.0.0
   */
  DockWorkspace,
  /**
   * @category models
   * @since 0.0.0
   */
  EmptyWorkspace,
  /**
   * @category models
   * @since 0.0.0
   */
  FloatingMember,
  /**
   * @category models
   * @since 0.0.0
   */
  HorizontalSplitLayout,
  /**
   * @category models
   * @since 0.0.0
   */
  PopulatedWorkspace,
  /**
   * @category models
   * @since 0.0.0
   */
  SplitLayout,
  /**
   * @category models
   * @since 0.0.0
   */
  SplitNode,
  /**
   * @category models
   * @since 0.0.0
   */
  TabsNode,
  /**
   * @category models
   * @since 0.0.0
   */
  VerticalSplitLayout,
} from "./Dock.tree.ts";
export {
  /**
   * @category services
   * @since 0.0.0
   */
  DockEngine,
  /**
   * @category layers
   * @since 0.0.0
   */
  DockEngineLive,
  /**
   * @category services
   * @since 0.0.0
   */
  type DockEngineShape,
  /**
   * @category services
   * @since 0.0.0
   */
  DockSnapshotStore,
  /**
   * @category services
   * @since 0.0.0
   */
  type DockSnapshotStoreShape,
  /**
   * @category constructors
   * @since 0.0.0
   */
  makeDockSnapshotStoreMemory,
  /**
   * @category services
   * @since 0.0.0
   */
  requireSnapshot,
} from "./DockEngine.service.ts";
export {
  /**
   * @category policies
   * @since 0.0.0
   */
  type DockCommandPolicy,
  /**
   * @category policies
   * @since 0.0.0
   */
  lockedGroupsPolicy,
  /**
   * @category policies
   * @since 0.0.0
   */
  makePolicyDockEngineLayer,
} from "./DockPolicy.ts";
export {
  /**
   * @category projections
   * @since 0.0.0
   */
  makeTitleMinimaAtom,
  /**
   * @category models
   * @since 0.0.0
   */
  TabChrome,
  /**
   * @category projections
   * @since 0.0.0
   */
  titleMinima,
  /**
   * @category projections
   * @since 0.0.0
   */
  titleWords,
} from "./Minima.ts";
export {
  /**
   * @category projections
   * @since 0.0.0
   */
  makeMruGroupsAtom,
  /**
   * @category projections
   * @since 0.0.0
   */
  touchedGroups,
  /**
   * @category projections
   * @since 0.0.0
   */
  touchedGroupsInEvents,
} from "./Recency.ts";
