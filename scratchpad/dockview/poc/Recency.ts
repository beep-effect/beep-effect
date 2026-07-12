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
import { pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { Atom } from "effect/unstable/reactivity";
import type { DockAtomFeedEntry } from "./DockAtomProtocol.ts";
import type { DockEvent } from "./Domain.ts";
import { GroupId } from "./Domain.ts";

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
export const touchedGroupsInEvents = (events: ReadonlyArray<DockEvent>): ReadonlyArray<GroupId> =>
  pipe(events, A.map(eventGroupId), A.getSomes);

/**
 * Most-recently-touched group ids, newest first, deduplicated, derived
 * purely from the feed. Only successful mutation completions with a Changed
 * result contribute — failures, snapshot saves, and unchanged no-ops leave
 * recency untouched, matching the kernel's publish-once contract.
 *
 * @category projections
 * @since 0.0.0
 */
export const touchedGroups = (entries: ReadonlyArray<DockAtomFeedEntry>): ReadonlyArray<GroupId> =>
  pipe(
    entries,
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
export const makeMruGroupsAtom = (
  feedAtom: Atom.Atom<ReadonlyArray<DockAtomFeedEntry>>
): Atom.Atom<ReadonlyArray<GroupId>> => Atom.map(feedAtom, touchedGroups);
