import {
  ActivatePanelCommand,
  ApiCommandOrigin,
  ClearWorkspaceCommand,
  ClosePanelCommand,
  CommandId,
  DispatchDockCommand,
  DispatchUnknownDockCommand,
  DockCommandEnvelope,
  GroupId,
  MovePanelCommand,
  OpenPanelCommand,
  Panel,
  PanelId,
  PopulatedWorkspace,
  ResizeSplitCommand,
  RestoreDockSnapshot,
  RestoreSnapshotRequest,
  RootPlacement,
  SaveDockSnapshot,
  SplitId,
  SplitLayout,
  SplitNode,
  SplitPlacement,
  SplitRatio,
  TabPlacement,
  TabsNode,
  TextPanelView,
} from "@beep/dock";
import type { DockCommand } from "@beep/dock";

export const groupOne = GroupId.make("group-one");
export const groupTwo = GroupId.make("group-two");
export const groupThree = GroupId.make("group-three");
export const splitOne = SplitId.make("split-one");
export const splitTwo = SplitId.make("split-two");

export const panelOne = Panel.make({
  id: PanelId.make("panel-one"),
  title: "Panel One",
  view: TextPanelView.make({ text: "one" }),
});

export const panelTwo = Panel.make({
  id: PanelId.make("panel-two"),
  title: "Panel Two",
  view: TextPanelView.make({ text: "two" }),
});

export const panelThree = Panel.make({
  id: PanelId.make("panel-three"),
  title: "Panel Three",
  view: TextPanelView.make({ text: "three" }),
});

const origin = ApiCommandOrigin.make({
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
    panel: panelOne,
    placement: RootPlacement.make({ groupId: groupOne }),
  })
);

export const openPanelTwo = envelope(
  "command-open-two",
  OpenPanelCommand.make({
    panel: panelTwo,
    placement: TabPlacement.make({ groupId: groupOne }),
  })
);

export const openPanelThreeSplitRight = envelope(
  "command-open-three",
  OpenPanelCommand.make({
    panel: panelThree,
    placement: SplitPlacement.make({
      referenceGroupId: groupOne,
      newGroupId: groupTwo,
      splitId: splitOne,
      side: "right",
    }),
  })
);

export const activatePanelOne = envelope(
  "command-activate-one",
  ActivatePanelCommand.make({
    panelId: panelOne.id,
  })
);

export const movePanelOne = envelope(
  "command-move-one",
  MovePanelCommand.make({
    panelId: panelOne.id,
    target: TabPlacement.make({ groupId: groupTwo }),
  })
);

export const closePanelTwo = envelope(
  "command-close-two",
  ClosePanelCommand.make({
    panelId: panelTwo.id,
  })
);

export const resizeSplit = envelope(
  "command-resize",
  ResizeSplitCommand.make({
    splitId: splitOne,
    ratio: SplitRatio.make(6_000),
  })
);

export const clearWorkspace = envelope("command-clear", ClearWorkspaceCommand.make());

export const restoreRequest = RestoreSnapshotRequest.make({
  commandId: CommandId.make("command-restore"),
  origin,
});

export const dispatch = (command: DockCommandEnvelope) =>
  DispatchDockCommand.make({
    envelope: command,
  });

export const dispatchUnknown = (input: unknown) =>
  DispatchUnknownDockCommand.make({
    input,
  });

export const saveSnapshot = SaveDockSnapshot.make();
export const restoreSnapshot = RestoreDockSnapshot.make({
  request: restoreRequest,
});

export const duplicatePanelWorkspace = PopulatedWorkspace.make({
  root: SplitNode.make({
    splitId: SplitId.make("duplicate-panel-split"),
    layout: SplitLayout.cases.horizontal.make({
      left: TabsNode.make({
        groupId: groupOne,
        active: panelOne,
      }),
      right: TabsNode.make({
        groupId: groupTwo,
        active: panelOne,
      }),
    }),
  }),
});
