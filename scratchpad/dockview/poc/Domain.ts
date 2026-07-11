/**
 * Schema-first domain algebra for the Dockview greenfield POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, TaggedErrorClass } from "@beep/schema";
import { Tuple } from "effect";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("dockview/poc/Domain");

/** Stable identity for a panel instance. */
export const PanelId = S.NonEmptyString.pipe(
  S.brand("DockPanelId"),
  $I.annoteSchema("PanelId", {
    description: "Stable identity for one panel instance in a dock workspace.",
  })
);
export type PanelId = typeof PanelId.Type;

/** Stable identity for a tab group. */
export const GroupId = S.NonEmptyString.pipe(
  S.brand("DockGroupId"),
  $I.annoteSchema("GroupId", {
    description: "Stable identity for one non-empty tab group.",
  })
);
export type GroupId = typeof GroupId.Type;

/** Stable identity for a binary split. */
export const SplitId = S.NonEmptyString.pipe(
  S.brand("DockSplitId"),
  $I.annoteSchema("SplitId", {
    description: "Stable identity for one binary layout split.",
  })
);
export type SplitId = typeof SplitId.Type;

/** Stable identity for a top-level command. */
export const CommandId = S.NonEmptyString.pipe(
  S.brand("DockCommandId"),
  $I.annoteSchema("CommandId", {
    description: "Causal identity shared by a command and its emitted events.",
  })
);
export type CommandId = typeof CommandId.Type;

/** Host registry key used to resolve a framework-specific panel renderer. */
export const RendererKey = S.NonEmptyString.pipe(
  S.brand("DockRendererKey"),
  $I.annoteSchema("RendererKey", {
    description: "Renderer-neutral key resolved by a host adapter outside dockview-core.",
  })
);
export type RendererKey = typeof RendererKey.Type;

/** Relative share of the start child in a binary split. */
export const SplitRatio = S.Finite.check(
  S.isBetween({
    minimum: 0.1,
    maximum: 0.9,
  })
).pipe(
  S.brand("DockSplitRatio"),
  $I.annoteSchema("SplitRatio", {
    description: "Relative share of the start child in a binary split.",
  })
);
export type SplitRatio = typeof SplitRatio.Type;

const PanelViewKind = LiteralKit(["component", "text"]);

/** JSON-safe scalar accepted by the POC renderer parameter record. */
export const PanelParameterValue = S.Union([S.String, S.Finite, S.Boolean]).pipe(
  $I.annoteSchema("PanelParameterValue", {
    description: "A JSON-safe scalar accepted by renderer-neutral panel parameters.",
  })
);
export type PanelParameterValue = typeof PanelParameterValue.Type;

/** Serializable parameters handed to a host renderer registry. */
export const PanelParameters = S.Record(S.String, PanelParameterValue).pipe(
  $I.annoteSchema("PanelParameters", {
    description: "Serializable renderer parameters keyed by host-defined names.",
  })
);
export type PanelParameters = typeof PanelParameters.Type;

/** Renderer-backed panel content that remains framework-neutral. */
export class ComponentPanelView extends S.Class<ComponentPanelView>($I`ComponentPanelView`)(
  {
    kind: S.tag("component"),
    renderer: S.toType(RendererKey),
    input: PanelParameters,
  },
  $I.annote("ComponentPanelView", {
    description: "Panel content resolved by a host renderer registry.",
  })
) {}

/** Serializable text content used by tests and simple host adapters. */
export class TextPanelView extends S.Class<TextPanelView>($I`TextPanelView`)(
  {
    kind: S.tag("text"),
    text: S.String,
  },
  $I.annote("TextPanelView", {
    description: "Renderer-independent text panel content.",
  })
) {}

/** Renderer-neutral, serializable panel content. */
export const PanelView = PanelViewKind.mapMembers(Tuple.evolve([() => ComponentPanelView, () => TextPanelView]))
  .annotate(
    $I.annote("PanelView", {
      description: "Discriminated panel content with no DOM or framework values.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
export type PanelView = typeof PanelView.Type;

/** One persistable panel instance. */
export class Panel extends S.Class<Panel>($I`Panel`)(
  {
    id: S.toType(PanelId),
    title: S.NonEmptyString,
    view: PanelView,
  },
  $I.annote("Panel", {
    description: "A renderer-neutral panel owned directly by one tab group.",
  })
) {}

export const DockAxis = LiteralKit(["horizontal", "vertical"]).annotate(
  $I.annote("DockAxis", {
    description: "Main axis of a binary dock split.",
  })
);
export type DockAxis = typeof DockAxis.Type;

/**
 * A non-empty tab group represented as a zipper.
 *
 * The active panel is stored directly, so an invalid active-panel reference is
 * not representable.
 */
export class TabsNode extends S.TaggedClass<TabsNode>($I`TabsNode`)(
  "Tabs",
  {
    groupId: S.toType(GroupId),
    before: S.Array(Panel),
    active: Panel,
    after: S.Array(Panel),
  },
  $I.annote("TabsNode", {
    description: "A non-empty ordered tab zipper with one structurally active panel.",
  })
) {}

type SplitNodeShape = {
  readonly _tag: "Split";
  readonly splitId: SplitId;
  readonly axis: DockAxis;
  readonly ratio: SplitRatio;
  readonly start: DockNodeShape;
  readonly end: DockNodeShape;
};

type DockNodeShape = TabsNode | SplitNodeShape;

/**
 * Recursive binary split schema.
 *
 * `S.TaggedStruct` is the deliberate recursive-schema exception to the usual
 * `S.Class` preference: a class cannot reference its own union in its base
 * expression without creating a TypeScript circular base.
 */
export const SplitNode: S.Codec<SplitNodeShape> = S.TaggedStruct("Split", {
  splitId: S.toType(SplitId),
  axis: DockAxis,
  ratio: S.toType(SplitRatio),
  start: S.suspend((): S.Codec<DockNodeShape> => DockNode),
  end: S.suspend((): S.Codec<DockNodeShape> => DockNode),
}).pipe(
  $I.annoteSchema("SplitNode", {
    description: "A recursive binary split with exactly two children.",
  })
);
export type SplitNode = typeof SplitNode.Type;

/** Recursive layout tree node. */
export const DockNode = S.Union([TabsNode, SplitNode])
  .annotate(
    $I.annote("DockNode", {
      description: "Recursive binary dock tree containing only non-empty leaves.",
    })
  )
  .pipe(S.toTaggedUnion("_tag"));
export type DockNode = typeof DockNode.Type;

/** Workspace with no panels and therefore no root node. */
export class EmptyWorkspace extends S.Class<EmptyWorkspace>($I`EmptyWorkspace`)(
  {
    kind: S.tag("empty"),
    revision: NonNegativeInt,
  },
  $I.annote("EmptyWorkspace", {
    description: "A dock workspace with no representable layout tree.",
  })
) {}

/** Workspace with one schema-valid root node. */
export class PopulatedWorkspace extends S.Class<PopulatedWorkspace>($I`PopulatedWorkspace`)(
  {
    kind: S.tag("populated"),
    revision: NonNegativeInt,
    root: DockNode,
  },
  $I.annote("PopulatedWorkspace", {
    description: "A dock workspace containing a non-empty binary layout tree.",
  })
) {}

const DockWorkspaceKind = LiteralKit(["empty", "populated"]);

/** Complete serializable workspace state. */
export const DockWorkspace = DockWorkspaceKind.mapMembers(
  Tuple.evolve([() => EmptyWorkspace, () => PopulatedWorkspace])
)
  .annotate(
    $I.annote("DockWorkspace", {
      description: "Complete dock state discriminated between empty and populated layouts.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
export type DockWorkspace = typeof DockWorkspace.Type;

/** Placement for the first panel in an empty workspace. */
export class RootPlacement extends S.Class<RootPlacement>($I`RootPlacement`)(
  {
    kind: S.tag("root"),
    groupId: GroupId,
  },
  $I.annote("RootPlacement", {
    description: "Creates the root tab group in an empty workspace.",
  })
) {}

/** Placement that appends a panel to an existing tab group. */
export class TabPlacement extends S.Class<TabPlacement>($I`TabPlacement`)(
  {
    kind: S.tag("tab"),
    groupId: GroupId,
  },
  $I.annote("TabPlacement", {
    description: "Appends a panel to an existing tab group and activates it.",
  })
) {}

export const DockSide = LiteralKit(["left", "right", "top", "bottom"]).annotate(
  $I.annote("DockSide", {
    description: "Semantic side on which a new tab group is inserted.",
  })
);
export type DockSide = typeof DockSide.Type;

/** Placement that creates a sibling tab group and binary split. */
export class SplitPlacement extends S.Class<SplitPlacement>($I`SplitPlacement`)(
  {
    kind: S.tag("split"),
    referenceGroupId: GroupId,
    newGroupId: GroupId,
    splitId: SplitId,
    side: DockSide,
    ratio: SplitRatio,
  },
  $I.annote("SplitPlacement", {
    description: "Creates a new tab group beside an existing group.",
  })
) {}

const DockPlacementKind = LiteralKit(["root", "tab", "split"]);

/** Semantic destination for opening a panel. */
export const DockPlacement = DockPlacementKind.mapMembers(
  Tuple.evolve([() => RootPlacement, () => TabPlacement, () => SplitPlacement])
)
  .annotate(
    $I.annote("DockPlacement", {
      description: "Semantic panel placement independent from DOM coordinates.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
export type DockPlacement = typeof DockPlacement.Type;

/** Command originating from a user interaction. */
export class UserCommandOrigin extends S.Class<UserCommandOrigin>($I`UserCommandOrigin`)(
  {
    kind: S.tag("user"),
    interactionId: S.NonEmptyString,
  },
  $I.annote("UserCommandOrigin", {
    description: "Origin metadata for a user gesture compiled into a command.",
  })
) {}

/** Command originating from a programmatic API call. */
export class ApiCommandOrigin extends S.Class<ApiCommandOrigin>($I`ApiCommandOrigin`)(
  {
    kind: S.tag("api"),
    requestId: S.NonEmptyString,
  },
  $I.annote("ApiCommandOrigin", {
    description: "Origin metadata for a programmatic dock command.",
  })
) {}

const CommandOriginKind = LiteralKit(["user", "api"]);

/** Explicit command origin replacing mutable ambient origin stacks. */
export const CommandOrigin = CommandOriginKind.mapMembers(
  Tuple.evolve([() => UserCommandOrigin, () => ApiCommandOrigin])
)
  .annotate(
    $I.annote("CommandOrigin", {
      description: "Causal origin carried with every top-level dock command.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
export type CommandOrigin = typeof CommandOrigin.Type;

/** Opens a new panel at a semantic placement. */
export class OpenPanelCommand extends S.Class<OpenPanelCommand>($I`OpenPanelCommand`)(
  {
    kind: S.tag("openPanel"),
    panel: Panel,
    placement: DockPlacement,
  },
  $I.annote("OpenPanelCommand", {
    description: "Opens one unique panel at a semantic destination.",
  })
) {}

/** Activates a panel within its owning tab zipper. */
export class ActivatePanelCommand extends S.Class<ActivatePanelCommand>($I`ActivatePanelCommand`)(
  {
    kind: S.tag("activatePanel"),
    panelId: PanelId,
  },
  $I.annote("ActivatePanelCommand", {
    description: "Makes an existing panel active within its tab group.",
  })
) {}

/** Moves a panel to the end of another tab group and activates it. */
export class MovePanelCommand extends S.Class<MovePanelCommand>($I`MovePanelCommand`)(
  {
    kind: S.tag("movePanel"),
    panelId: PanelId,
    targetGroupId: GroupId,
  },
  $I.annote("MovePanelCommand", {
    description: "Moves a panel between groups as one atomic tree transition.",
  })
) {}

/** Closes a panel, collapsing an empty leaf and its parent split. */
export class ClosePanelCommand extends S.Class<ClosePanelCommand>($I`ClosePanelCommand`)(
  {
    kind: S.tag("closePanel"),
    panelId: PanelId,
  },
  $I.annote("ClosePanelCommand", {
    description: "Closes one panel and canonically collapses empty topology.",
  })
) {}

/** Changes the ratio of an existing split. */
export class ResizeSplitCommand extends S.Class<ResizeSplitCommand>($I`ResizeSplitCommand`)(
  {
    kind: S.tag("resizeSplit"),
    splitId: SplitId,
    ratio: SplitRatio,
  },
  $I.annote("ResizeSplitCommand", {
    description: "Changes one bounded binary split ratio.",
  })
) {}

/** Clears the workspace in one transition. */
export class ClearWorkspaceCommand extends S.Class<ClearWorkspaceCommand>($I`ClearWorkspaceCommand`)(
  {
    kind: S.tag("clearWorkspace"),
  },
  $I.annote("ClearWorkspaceCommand", {
    description: "Clears every panel and layout node atomically.",
  })
) {}

const DockCommandKind = LiteralKit([
  "openPanel",
  "activatePanel",
  "movePanel",
  "closePanel",
  "resizeSplit",
  "clearWorkspace",
]);

/** Complete domain command union. */
export const DockCommand = DockCommandKind.mapMembers(
  Tuple.evolve([
    () => OpenPanelCommand,
    () => ActivatePanelCommand,
    () => MovePanelCommand,
    () => ClosePanelCommand,
    () => ResizeSplitCommand,
    () => ClearWorkspaceCommand,
  ])
)
  .annotate(
    $I.annote("DockCommand", {
      description: "Exhaustive command algebra for the POC layout kernel.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
export type DockCommand = typeof DockCommand.Type;

/** Causally identified top-level command. */
export class DockCommandEnvelope extends S.Class<DockCommandEnvelope>($I`DockCommandEnvelope`)(
  {
    commandId: CommandId,
    origin: CommandOrigin,
    command: DockCommand,
  },
  $I.annote("DockCommandEnvelope", {
    description: "Top-level dock command with explicit causal origin.",
  })
) {}

/** Causal metadata for installing a persisted snapshot. */
export class RestoreSnapshotRequest extends S.Class<RestoreSnapshotRequest>($I`RestoreSnapshotRequest`)(
  {
    commandId: CommandId,
    origin: CommandOrigin,
  },
  $I.annote("RestoreSnapshotRequest", {
    description: "Causal metadata attached to a validated snapshot installation.",
  })
) {}

/** Event emitted after opening a panel. */
export class PanelOpenedEvent extends S.Class<PanelOpenedEvent>($I`PanelOpenedEvent`)(
  {
    kind: S.tag("panelOpened"),
    panelId: PanelId,
    groupId: GroupId,
  },
  $I.annote("PanelOpenedEvent", {
    description: "A panel was installed into a tab group.",
  })
) {}

/** Event emitted after changing a tab group's active panel. */
export class PanelActivatedEvent extends S.Class<PanelActivatedEvent>($I`PanelActivatedEvent`)(
  {
    kind: S.tag("panelActivated"),
    panelId: PanelId,
    groupId: GroupId,
  },
  $I.annote("PanelActivatedEvent", {
    description: "A panel became the active member of its tab zipper.",
  })
) {}

/** Event emitted after atomically moving a panel between groups. */
export class PanelMovedEvent extends S.Class<PanelMovedEvent>($I`PanelMovedEvent`)(
  {
    kind: S.tag("panelMoved"),
    panelId: PanelId,
    fromGroupId: GroupId,
    toGroupId: GroupId,
  },
  $I.annote("PanelMovedEvent", {
    description: "A panel moved between tab groups in one tree publication.",
  })
) {}

/** Event emitted after closing a panel. */
export class PanelClosedEvent extends S.Class<PanelClosedEvent>($I`PanelClosedEvent`)(
  {
    kind: S.tag("panelClosed"),
    panelId: PanelId,
    groupId: GroupId,
  },
  $I.annote("PanelClosedEvent", {
    description: "A panel was removed and empty topology was collapsed.",
  })
) {}

/** Event emitted after resizing a split. */
export class SplitResizedEvent extends S.Class<SplitResizedEvent>($I`SplitResizedEvent`)(
  {
    kind: S.tag("splitResized"),
    splitId: SplitId,
    ratio: SplitRatio,
  },
  $I.annote("SplitResizedEvent", {
    description: "A binary split ratio changed.",
  })
) {}

/** Event emitted after clearing the workspace. */
export class WorkspaceClearedEvent extends S.Class<WorkspaceClearedEvent>($I`WorkspaceClearedEvent`)(
  {
    kind: S.tag("workspaceCleared"),
  },
  $I.annote("WorkspaceClearedEvent", {
    description: "The complete workspace was cleared atomically.",
  })
) {}

/** Event emitted after installing a validated snapshot. */
export class WorkspaceRestoredEvent extends S.Class<WorkspaceRestoredEvent>($I`WorkspaceRestoredEvent`)(
  {
    kind: S.tag("workspaceRestored"),
    revision: NonNegativeInt,
  },
  $I.annote("WorkspaceRestoredEvent", {
    description: "A fully decoded and validated snapshot replaced live state.",
  })
) {}

const DockEventKind = LiteralKit([
  "panelOpened",
  "panelActivated",
  "panelMoved",
  "panelClosed",
  "splitResized",
  "workspaceCleared",
  "workspaceRestored",
]);

/** Complete domain event union. */
export const DockEvent = DockEventKind.mapMembers(
  Tuple.evolve([
    () => PanelOpenedEvent,
    () => PanelActivatedEvent,
    () => PanelMovedEvent,
    () => PanelClosedEvent,
    () => SplitResizedEvent,
    () => WorkspaceClearedEvent,
    () => WorkspaceRestoredEvent,
  ])
)
  .annotate(
    $I.annote("DockEvent", {
      description: "Exhaustive events produced by accepted commands and restores.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
export type DockEvent = typeof DockEvent.Type;

/** Accepted command result published atomically to observers. */
export class DockTransition extends S.Class<DockTransition>($I`DockTransition`)(
  {
    commandId: CommandId,
    origin: CommandOrigin,
    previousRevision: NonNegativeInt,
    state: DockWorkspace,
    events: S.NonEmptyArray(DockEvent),
  },
  $I.annote("DockTransition", {
    description: "Atomic next state plus causally associated domain events.",
  })
) {}

export const DockRejectionReason = LiteralKit([
  "workspace-not-empty",
  "workspace-empty",
  "panel-already-open",
  "panel-not-found",
  "group-not-found",
  "split-not-found",
  "group-already-exists",
  "split-already-exists",
  "same-group-move",
]).annotate(
  $I.annote("DockRejectionReason", {
    description: "Expected business reasons for rejecting a dock command.",
  })
);
export type DockRejectionReason = typeof DockRejectionReason.Type;

/** Expected command rejection in the typed failure channel. */
export class DockCommandRejected extends TaggedErrorClass<DockCommandRejected>($I`DockCommandRejected`)(
  "DockCommandRejected",
  {
    commandId: CommandId,
    reason: DockRejectionReason,
    message: S.String,
  },
  $I.annote("DockCommandRejected", {
    description: "An expected command rejection that leaves state untouched.",
  })
) {}

export const DockInvariantReason = LiteralKit([
  "duplicate-panel-id",
  "duplicate-group-id",
  "duplicate-split-id",
]).annotate(
  $I.annote("DockInvariantReason", {
    description: "Cross-tree invariant violations not expressible by local schema shape alone.",
  })
);
export type DockInvariantReason = typeof DockInvariantReason.Type;

/** Cross-tree invariant failure discovered before state publication. */
export class DockInvariantViolation extends TaggedErrorClass<DockInvariantViolation>($I`DockInvariantViolation`)(
  "DockInvariantViolation",
  {
    reason: DockInvariantReason,
    message: S.String,
  },
  $I.annote("DockInvariantViolation", {
    description: "A global uniqueness invariant failed before state publication.",
  })
) {}

export const DockInputBoundary = LiteralKit(["command", "snapshot"]).annotate(
  $I.annote("DockInputBoundary", {
    description: "External schema boundary at which unknown input was rejected.",
  })
);
export type DockInputBoundary = typeof DockInputBoundary.Type;

/** Invalid unknown command or snapshot input. */
export class DockInputError extends TaggedErrorClass<DockInputError>($I`DockInputError`)(
  "DockInputError",
  {
    boundary: DockInputBoundary,
    message: S.String,
  },
  $I.annote("DockInputError", {
    description: "Schema decoding failure mapped at a public POC boundary.",
  })
) {}

export const DockPersistenceOperation = LiteralKit(["load", "save"]).annotate(
  $I.annote("DockPersistenceOperation", {
    description: "Snapshot-store operation that can fail in a host adapter.",
  })
);
export type DockPersistenceOperation = typeof DockPersistenceOperation.Type;

/** Typed snapshot-store failure for replaceable persistence adapters. */
export class DockPersistenceError extends TaggedErrorClass<DockPersistenceError>($I`DockPersistenceError`)(
  "DockPersistenceError",
  {
    operation: DockPersistenceOperation,
    message: S.String,
  },
  $I.annote("DockPersistenceError", {
    description: "Failure while loading or saving a dock snapshot.",
  })
) {}

/** Missing persisted snapshot requested by a restore action. */
export class DockSnapshotMissing extends TaggedErrorClass<DockSnapshotMissing>($I`DockSnapshotMissing`)(
  "DockSnapshotMissing",
  {
    message: S.String,
  },
  $I.annote("DockSnapshotMissing", {
    description: "No persisted snapshot exists for a restore action.",
  })
) {}

/** Error union for a typed dock transition. */
export type DockTransitionError = DockCommandRejected | DockInvariantViolation;

/** Error union for snapshot restoration through the Atom adapter. */
export type DockRestoreError = DockInputError | DockInvariantViolation | DockPersistenceError | DockSnapshotMissing;
