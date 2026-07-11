import {
  ActivatePanelCommand,
  ApiCommandOrigin,
  ClearWorkspaceCommand,
  ClosePanelCommand,
  CommandId,
  type DockCommand,
  DockCommandEnvelope,
  GroupId,
  MovePanelCommand,
  OpenPanelCommand,
  Panel,
  PanelId,
  ResizeSplitCommand,
  RestoreSnapshotRequest,
  RootPlacement,
  SplitId,
  SplitPlacement,
  SplitRatio,
  TabPlacement,
  TextPanelView,
} from "../Domain.ts";

export const groupOne = GroupId.make("group-one");
export const groupTwo = GroupId.make("group-two");
export const splitOne = SplitId.make("split-one");

export const panelOne = Panel.make({
  id: PanelId.make("panel-one"),
  title: "Panel One",
  view: TextPanelView.make({ kind: "text", text: "one" }),
});

export const panelTwo = Panel.make({
  id: PanelId.make("panel-two"),
  title: "Panel Two",
  view: TextPanelView.make({ kind: "text", text: "two" }),
});

export const panelThree = Panel.make({
  id: PanelId.make("panel-three"),
  title: "Panel Three",
  view: TextPanelView.make({ kind: "text", text: "three" }),
});

const origin = ApiCommandOrigin.make({
  kind: "api",
  requestId: "poc-test",
});

export const envelope = (id: string, command: DockCommand): DockCommandEnvelope =>
  DockCommandEnvelope.make({
    commandId: CommandId.make(id),
    origin,
    command,
  });

export const openPanelOne = envelope(
  "command-open-one",
  OpenPanelCommand.make({
    kind: "openPanel",
    panel: panelOne,
    placement: RootPlacement.make({ kind: "root", groupId: groupOne }),
  })
);

export const openPanelTwo = envelope(
  "command-open-two",
  OpenPanelCommand.make({
    kind: "openPanel",
    panel: panelTwo,
    placement: TabPlacement.make({ kind: "tab", groupId: groupOne }),
  })
);

export const openPanelThreeSplitRight = envelope(
  "command-open-three",
  OpenPanelCommand.make({
    kind: "openPanel",
    panel: panelThree,
    placement: SplitPlacement.make({
      kind: "split",
      referenceGroupId: groupOne,
      newGroupId: groupTwo,
      splitId: splitOne,
      side: "right",
      ratio: SplitRatio.make(0.5),
    }),
  })
);

export const activatePanelOne = envelope(
  "command-activate-one",
  ActivatePanelCommand.make({
    kind: "activatePanel",
    panelId: panelOne.id,
  })
);

export const movePanelOne = envelope(
  "command-move-one",
  MovePanelCommand.make({
    kind: "movePanel",
    panelId: panelOne.id,
    targetGroupId: groupTwo,
  })
);

export const closePanelTwo = envelope(
  "command-close-two",
  ClosePanelCommand.make({
    kind: "closePanel",
    panelId: panelTwo.id,
  })
);

export const resizeSplit = envelope(
  "command-resize",
  ResizeSplitCommand.make({
    kind: "resizeSplit",
    splitId: splitOne,
    ratio: SplitRatio.make(0.6),
  })
);

export const clearWorkspace = envelope("command-clear", ClearWorkspaceCommand.make({ kind: "clearWorkspace" }));

export const restoreRequest = RestoreSnapshotRequest.make({
  commandId: CommandId.make("command-restore"),
  origin,
});
