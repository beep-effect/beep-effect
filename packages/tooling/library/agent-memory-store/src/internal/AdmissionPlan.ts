/**
 * What admission decided for one operation, before it touches the log, and
 * the merge rule behind that decision.
 *
 * `admit` and `resolve` judge an operation into a {@link Plan} and then carry
 * it out: `admit` appends a `Write` alone and a `Hold` as a `WriteHeld`;
 * `resolve` appends a `Write` or `Keep` together with the `HoldResolved` that
 * settles the hold, and leaves the hold open on a `Hold` or `Refuse`.
 *
 * @internal
 */

import { ClaimGateViolation } from "@beep/epistemics/ClaimGate";
import * as Data from "effect/Data";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { MemoryGateViolation } from "../Admission.models.ts";
import type { LazyArg } from "effect/Function";
import type { MemoryViolationCode } from "../Admission.models.ts";
import type { MemoryEvent } from "../NodeEvent.events.ts";
import type { NodeId, RevisionId } from "../NodeIdentity.models.ts";

/** The admission decision for one operation. */
export type Plan = Data.TaggedEnum<{
  /** Hold the write for a resolver; `ours` is the logged text at `headRevision`. */
  Hold: {
    readonly headRevision: O.Option<RevisionId>;
    readonly ours: O.Option<string>;
    readonly violation: MemoryGateViolation;
  };
  /** The write changes nothing: the node already holds what it asks for. */
  Keep: { readonly nodeId: NodeId; readonly revisionId: RevisionId };
  /** Refuse the write outright. */
  Refuse: { readonly violation: MemoryGateViolation };
  /** Append `event`, which produces `revisionId` on `nodeId`. */
  Write: { readonly event: MemoryEvent; readonly nodeId: NodeId; readonly revisionId: RevisionId };
}>;

/** Constructors and matcher of {@link Plan}. */
export const Plan = Data.taggedEnum<Plan>();

/** One typed finding at violation severity, focused on a node. */
export const finding = (input: {
  readonly code: MemoryViolationCode;
  readonly nodeId: NodeId;
  readonly path: string;
  readonly message: string;
}): MemoryGateViolation =>
  MemoryGateViolation.make({
    code: input.code,
    violation: ClaimGateViolation.make({
      focusNode: input.nodeId,
      path: input.path,
      message: input.message,
      severity: "violation",
    }),
  });

/** What a three-way merge does in each case. */
export interface MergeCases<A> {
  readonly contested: LazyArg<A>;
  readonly keepOurs: LazyArg<A>;
  readonly takeTheirs: LazyArg<A>;
}

/**
 * The three-way merge of one node's text in P2: `base` is the text at the
 * revision the writer edited against (none for a tombstone), `ours` the head
 * text the log holds and `theirs` the writer's text.
 *
 * It never merges inside a text (ruling 2; S14 measured a character-level
 * merge mashing 48/70 contested nodes). It keeps the log's text when both
 * sides agree or the writer changed nothing, takes the writer's text when the
 * log's text is still the base, and otherwise calls the node contested, so no
 * admitted write ever drops the other writer's text.
 */
export const threeWay: {
  <A>(
    cases: MergeCases<A>
  ): (texts: { readonly base: O.Option<string>; readonly ours: string; readonly theirs: string }) => A;
  <A>(
    texts: { readonly base: O.Option<string>; readonly ours: string; readonly theirs: string },
    cases: MergeCases<A>
  ): A;
} = dual(
  2,
  <A>(
    { base, ours, theirs }: { readonly base: O.Option<string>; readonly ours: string; readonly theirs: string },
    cases: MergeCases<A>
  ): A =>
    ours === theirs || O.contains(base, theirs)
      ? cases.keepOurs()
      : O.contains(base, ours)
        ? cases.takeTheirs()
        : cases.contested()
);
