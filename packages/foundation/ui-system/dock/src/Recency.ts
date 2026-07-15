/**
 * Recency projections over the lossless operation feed — the first feed
 * consumer. Dockview activates by MRU on close; this kernel's zipper
 * promotion is a documented divergence, with MRU declared host/session
 * state. This module makes that claim concrete: the feed IS a recency log,
 * and a host (or an MRU close-activation policy) derives group recency from
 * it without any new kernel state.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { flow } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { Atom } from "effect/unstable/reactivity";
import { GroupId } from "./Dock.ids.ts";
import type { DockEvent } from "./Dock.events.ts";
import type { DockAtomFeedEntry } from "./Dock.protocol.ts";

// Structural narrowing on the event union: any accepted event naming a
// groupId counts as a "touch" of that group. Events without a groupId
// (workspace-level, split-level, cross-group moves) contribute nothing.
const eventGroupId = (event: DockEvent): O.Option<GroupId> => ("groupId" in event ? O.some(event.groupId) : O.none());

/**
 * Group ids touched by a batch of accepted events, in event order.
 *
 * @category projections
 * @since 0.0.0
 */
/**
 * Projects group touches from accepted events in event order.
 *
 * @example
 * ```ts
 * import { GroupId, GroupUpdatedEvent, touchedGroupsInEvents } from "@beep/dock"
 *
 * const groups = touchedGroupsInEvents([GroupUpdatedEvent.make({ groupId: GroupId.make("group-one") })])
 * console.log(groups)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const touchedGroupsInEvents: (events: ReadonlyArray<DockEvent>) => ReadonlyArray<GroupId> = flow(
  A.map(eventGroupId),
  A.getSomes
);

/**
 * Most-recently-touched group ids, newest first, deduplicated, derived
 * purely from the feed. Only successful mutation completions with a Changed
 * result contribute — failures, snapshot saves, and unchanged no-ops leave
 * recency untouched, matching the kernel's publish-once contract.
 *
 * @category projections
 * @since 0.0.0
 */
/**
 * Projects newest-first deduplicated group recency from the operation feed.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, CommandId, DockAtomFeedSuccess, DockChanged, DockMutationCompleted, DockMutationOutcome, GroupId, GroupUpdatedEvent, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView, touchedGroups } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const groupId = GroupId.make("group-one")
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId, active: panel }) })
 * const entry = DockAtomFeedSuccess.make({
 *   submission: NonNegativeInt.make(1),
 *   operationKind: "dispatchCommand",
 *   outcome: DockMutationCompleted.make({
 *     outcome: DockMutationOutcome.make({
 *       commandId: CommandId.make("command-one"),
 *       origin: ApiCommandOrigin.make({ requestId: "request-one" }),
 *       result: DockChanged.make({ previousRevision: NonNegativeInt.make(0), state: workspace, events: [GroupUpdatedEvent.make({ groupId })] })
 *     })
 *   })
 * })
 * const groups = touchedGroups([entry])
 * console.log(groups)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const touchedGroups: (entries: ReadonlyArray<DockAtomFeedEntry>) => ReadonlyArray<GroupId> = flow(
  A.flatMap((entry) =>
    entry._tag === "Success" &&
    entry.outcome.kind === "mutationCompleted" &&
    entry.outcome.outcome.result._tag === "Changed"
      ? touchedGroupsInEvents(entry.outcome.outcome.result.events)
      : A.empty<GroupId>()
  ),
  A.reverse,
  A.dedupeWith(GroupId.equals)
);

/**
 * Derived MRU atom over a host's feed atom. Hosts wanting dockview's
 * MRU-on-close behavior read this and dispatch a follow-up activation; the
 * kernel keeps zipper promotion and stays MRU-free.
 *
 * @category atoms
 * @since 0.0.0
 */
/**
 * Derives a most-recently-used group atom from a host feed atom.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, CommandId, DockAtomFeedSuccess, DockChanged, DockMutationCompleted, DockMutationOutcome, GroupId, GroupUpdatedEvent, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView, makeMruGroupsAtom } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Atom, AtomRegistry } from "effect/unstable/reactivity"
 *
 * const groupId = GroupId.make("group-one")
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId, active: panel }) })
 * const entry = DockAtomFeedSuccess.make({
 *   submission: NonNegativeInt.make(1),
 *   operationKind: "dispatchCommand",
 *   outcome: DockMutationCompleted.make({
 *     outcome: DockMutationOutcome.make({
 *       commandId: CommandId.make("command-one"),
 *       origin: ApiCommandOrigin.make({ requestId: "request-one" }),
 *       result: DockChanged.make({ previousRevision: NonNegativeInt.make(0), state: workspace, events: [GroupUpdatedEvent.make({ groupId })] })
 *     })
 *   })
 * })
 * const registry = AtomRegistry.make()
 * const mru = registry.get(makeMruGroupsAtom(Atom.make([entry])))
 * console.log(mru)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const makeMruGroupsAtom = (
  feedAtom: Atom.Atom<ReadonlyArray<DockAtomFeedEntry>>
): Atom.Atom<ReadonlyArray<GroupId>> => Atom.map(feedAtom, touchedGroups);
