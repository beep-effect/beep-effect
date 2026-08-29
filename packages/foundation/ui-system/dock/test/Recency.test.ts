import {
  ApiCommandOrigin,
  CommandId,
  DockAtomFeedSuccess,
  DockChanged,
  DockMutationCompleted,
  DockMutationOutcome,
  DockSnapshotSaved,
  DockUnchanged,
  GroupUpdatedEvent,
  makeMruGroupsAtom,
  PanelOpenedEvent,
  PopulatedWorkspace,
  TabsNode,
  touchedGroups,
  touchedGroupsInEvents,
} from "@beep/dock";
import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { groupOne, groupTwo, panelOne } from "./Fixtures.ts";
import type { DockAtomFeedEntry, DockEvent } from "@beep/dock";

const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId: groupOne, active: panelOne }) });
const origin = ApiCommandOrigin.make({ requestId: "recency-test" });

const changed = (submission: number, events: readonly [DockEvent, ...ReadonlyArray<DockEvent>]) =>
  DockAtomFeedSuccess.make({
    submission: NonNegativeInt.make(submission),
    operationKind: "dispatchCommand",
    outcome: DockMutationCompleted.make({
      outcome: DockMutationOutcome.make({
        commandId: CommandId.make(`command-${submission}`),
        origin,
        result: DockChanged.make({
          previousRevision: NonNegativeInt.make(submission),
          state: workspace,
          events,
        }),
      }),
    }),
  });

const unchanged = (submission: number) =>
  DockAtomFeedSuccess.make({
    submission: NonNegativeInt.make(submission),
    operationKind: "dispatchCommand",
    outcome: DockMutationCompleted.make({
      outcome: DockMutationOutcome.make({
        commandId: CommandId.make(`command-${submission}`),
        origin,
        result: DockUnchanged.make({ revision: NonNegativeInt.make(submission), reason: "panel-already-active" }),
      }),
    }),
  });

const saved = (submission: number) =>
  DockAtomFeedSuccess.make({
    submission: NonNegativeInt.make(submission),
    operationKind: "saveSnapshot",
    outcome: DockSnapshotSaved.make({ snapshot: "{}" }),
  });

const feed: ReadonlyArray<DockAtomFeedEntry> = [
  changed(0, [PanelOpenedEvent.make({ panelId: panelOne.id, groupId: groupOne })]),
  changed(1, [GroupUpdatedEvent.make({ groupId: groupTwo })]),
  unchanged(2),
  saved(3),
  changed(4, [GroupUpdatedEvent.make({ groupId: groupOne })]),
];

describe("recency projections over the operation feed", () => {
  it("collects touched groups from events in order", () => {
    const events = [
      GroupUpdatedEvent.make({ groupId: groupTwo }),
      PanelOpenedEvent.make({ panelId: panelOne.id, groupId: groupOne }),
    ];
    expect(touchedGroupsInEvents(events)).toEqual([groupTwo, groupOne]);
  });

  it("derives most-recent-first deduplicated recency; no-ops and saves contribute nothing", () => {
    expect(touchedGroups(feed)).toEqual([groupOne, groupTwo]);
  });

  it("exposes recency as a derived atom over the host feed atom", () => {
    const feedAtom = Atom.make(feed);
    const registry = AtomRegistry.make();
    expect(registry.get(makeMruGroupsAtom(feedAtom))).toEqual([groupOne, groupTwo]);
  });
});
