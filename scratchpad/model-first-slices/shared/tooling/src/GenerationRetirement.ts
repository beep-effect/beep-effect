import { type DeploymentDescriptor, FactVersion } from "@proto/kernel/Deployment";
import { type GenerationEntry, type LiveGeneration, StreamPin } from "@proto/kernel/PublishedStream";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { pipe } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ledgerOf } from "./FactRetirement.ts";

/**
 * A consumer's checkpoint on the feed, read from where that consumer keeps it:
 * the last feed position it has handled.
 *
 * @category models
 * @since 0.0.0
 */
export const ConsumerCheckpoint = S.Struct({ consumer: S.String, position: S.Int });
/**
 * @category models
 * @since 0.0.0
 */
export type ConsumerCheckpoint = typeof ConsumerCheckpoint.Type;

/**
 * The feed whose generations are pinned: the producer and the fact contract it
 * serves. Its consumers are the descriptors that consume any version of it.
 *
 * @category models
 * @since 0.0.0
 */
export const FeedRef = S.Struct({ producer: S.String, contract: S.String });
/**
 * @category models
 * @since 0.0.0
 */
export type FeedRef = typeof FeedRef.Type;

/**
 * A retirement the check approved: the generation, and the feed positions it
 * held, after `from` up to and including `through`. Later generations keep
 * their positions after `through`.
 *
 * @category models
 * @since 0.0.0
 */
export const Retirement = S.Struct({ stream: S.String, from: S.Int, through: S.Int });
/**
 * @category models
 * @since 0.0.0
 */
export type Retirement = typeof Retirement.Type;

/**
 * Why a retirement is refused, by the rule's condition (D51):
 *
 * - (a) `NoSuccessor`, `FactMissing`, `PayloadDiffers`: the next served
 *   generation does not hold every fact version the retiring one held, with
 *   the same payload.
 * - (b) `ConsumerBehind`, `CheckpointUnread`: a consumer in a deployment
 *   descriptor has not read past the retiring generation, or its checkpoint
 *   was not read.
 * - (c) `PinsMoved`, `LengthDiffers`: the feed would place later generations
 *   elsewhere, because a pin was dropped or reordered, or the retired pin's
 *   length is not what the generation held.
 * - (d) `VersionUnpublished`: D34 refuses it, a descriptor consumes a version
 *   no descriptor publishes.
 * - `NotClosed`, `Unread`: only a closed generation is retired, and only one
 *   whose contents (and its successor's) were read.
 *
 * @category models
 * @since 0.0.0
 */
export const RetirementRefusal = S.TaggedUnion({
  NotClosed: { stream: S.String },
  Unread: { stream: S.String },
  NoSuccessor: { stream: S.String },
  FactMissing: { stream: S.String, successor: S.String, factId: S.String, version: S.Int },
  PayloadDiffers: { stream: S.String, successor: S.String, factId: S.String, version: S.Int },
  ConsumerBehind: { stream: S.String, consumer: S.String, checkpoint: S.Int, through: S.Int },
  CheckpointUnread: { stream: S.String, consumer: S.String },
  PinsMoved: { current: S.Array(S.String), next: S.Array(S.String) },
  LengthDiffers: { stream: S.String, pinned: S.Int, live: S.Int },
  VersionUnpublished: { consumer: S.String, fact: FactVersion },
});
/**
 * @category models
 * @since 0.0.0
 */
export type RetirementRefusal = typeof RetirementRefusal.Type;

/**
 * A pin change would retire a generation the rule does not allow to stop
 * being served (D51).
 *
 * @category errors
 * @since 0.0.0
 */
export class RetirementRefused extends S.TaggedError<RetirementRefused, { readonly brand: unique symbol }>()(
  "RetirementRefused",
  { refusals: S.Array(RetirementRefusal) },
) {}

/** The number of positions a generation held: its last entry's position, 0 when empty. */
const lengthOf = (generation: LiveGeneration): number =>
  A.reduce(generation.entries, 0, (last, entry) => Num.max(last, entry.position));

const readOf = (generations: ReadonlyArray<LiveGeneration>) => (stream: string) =>
  A.findFirst(generations, (generation) => generation.stream === stream);

/** The positions a pin holds under the next pins: a retired one by its pin, a served one as the host holds it. */
const heldBy = (read: (stream: string) => O.Option<LiveGeneration>) => (pin: StreamPin): O.Option<number> =>
  StreamPin.match(pin, {
    Retired: ({ length }) => O.some(length),
    Closed: ({ stream }) => O.map(read(stream), lengthOf),
    Open: ({ stream }) => O.map(read(stream), lengthOf),
  });

const sameFact = (entry: GenerationEntry) => (other: GenerationEntry) =>
  other.factId === entry.factId && other.version === entry.version;

/** Condition (a): every fact version of the retiring generation is in its successor, with the same payload. */
const heldBySuccessor = (stream: string, retiring: LiveGeneration, successor: LiveGeneration): ReadonlyArray<RetirementRefusal> =>
  A.getSomes(
    A.map(retiring.entries, (entry) =>
      O.match(A.findFirst(successor.entries, sameFact(entry)), {
        onNone: () =>
          RetirementRefusal.cases.FactMissing.makeOption({ stream, successor: successor.stream, factId: entry.factId, version: entry.version }),
        onSome: (held) =>
          Equal.equals(held.payload, entry.payload)
            ? O.none()
            : RetirementRefusal.cases.PayloadDiffers.makeOption({ stream, successor: successor.stream, factId: entry.factId, version: entry.version }),
      }),
    ),
  );

/** The descriptors that consume the feed: any version of its producer's contract. */
const consumersOf = (feed: FeedRef, descriptors: ReadonlyArray<DeploymentDescriptor>): ReadonlyArray<string> =>
  A.map(
    A.filter(descriptors, (descriptor) =>
      A.some(descriptor.consumes, (fact) => fact.producer === feed.producer && fact.contract === feed.contract),
    ),
    (descriptor) => descriptor.context,
  );

/** Condition (b): every consumer's checkpoint is at or past `through`. */
const readPast = (
  stream: string,
  through: number,
  consumers: ReadonlyArray<string>,
  checkpoints: ReadonlyArray<ConsumerCheckpoint>,
): ReadonlyArray<RetirementRefusal> =>
  A.getSomes(
    A.map(consumers, (consumer) =>
      O.match(A.findFirst(checkpoints, (checkpoint) => checkpoint.consumer === consumer), {
        onNone: () => RetirementRefusal.cases.CheckpointUnread.makeOption({ stream, consumer }),
        onSome: ({ position }) =>
          position >= through ? O.none() : RetirementRefusal.cases.ConsumerBehind.makeOption({ stream, consumer, checkpoint: position, through }),
      }),
    ),
  );

/** The pins a change newly retires, with their place in `next`: retired there, not retired in `current`. */
const newlyRetired = (current: ReadonlyArray<StreamPin>, next: ReadonlyArray<StreamPin>) =>
  A.getSomes(
    A.map(next, (pin, index) =>
      pipe(
        O.some(pin),
        O.filter(StreamPin.guards.Retired),
        O.filter((retired) => !A.some(current, (before) => before.stream === retired.stream && StreamPin.guards.Retired(before))),
        O.map((retired) => ({ retired, index })),
      ),
    ),
  );

/**
 * The generation-retirement check (D51), run against the live host before a
 * pin change that retires a closed generation is deployed. It approves the
 * change only when, for each generation it retires:
 *
 * - (a) the next served generation holds every fact version it held, with the
 *   same payload;
 * - (b) every consumer of the feed, in every deployment descriptor, has a
 *   checkpoint at or past the last position it held;
 * - (c) the feed keeps later generations at the same positions: no pin is
 *   dropped or reordered, and the retired pin's length is what it held;
 * - (d) D34 allows it: no descriptor consumes a version nobody publishes.
 *
 * A change that retires nothing is approved with no retirements, provided it
 * moves no pin.
 *
 * **Example** (Retiring Party's generation 1)
 * ```ts
 * import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
 * import { checkGenerationRetirement } from "@proto/tooling/GenerationRetirement";
 *
 * const writer = StreamWriter.make({ projection: "ClaimDecisions", generation: 0, sources: ["Claim"] });
 * const checked = checkGenerationRetirement({
 *   feed: { producer: "party", contract: "ClaimDecided" },
 *   current: [StreamPin.cases.Closed.make({ stream: "PartyFacts" }), StreamPin.cases.Open.make({ stream: "PartyFacts2", writer })],
 *   next: [StreamPin.cases.Retired.make({ stream: "PartyFacts", length: 0 }), StreamPin.cases.Open.make({ stream: "PartyFacts2", writer })],
 *   descriptors: [],
 *   generations: [{ stream: "PartyFacts", entries: [] }, { stream: "PartyFacts2", entries: [] }],
 *   checkpoints: [],
 * });
 * ```
 *
 * @category checks
 * @since 0.0.0
 */
export const checkGenerationRetirement = ({
  feed,
  current,
  next,
  descriptors,
  generations,
  checkpoints,
}: {
  readonly feed: FeedRef;
  readonly current: ReadonlyArray<StreamPin>;
  readonly next: ReadonlyArray<StreamPin>;
  readonly descriptors: ReadonlyArray<DeploymentDescriptor>;
  readonly generations: ReadonlyArray<LiveGeneration>;
  readonly checkpoints: ReadonlyArray<ConsumerCheckpoint>;
}): Effect.Effect<ReadonlyArray<Retirement>, RetirementRefused> => {
  const read = readOf(generations);
  const streams = (pins: ReadonlyArray<StreamPin>) => A.map(pins, (pin) => pin.stream);
  // (c) Pins are append-only: the current generations stay, in order, at the head of the next.
  const moved =
    Equal.equals(streams(current), A.take(streams(next), A.length(current)))
      ? A.empty<RetirementRefusal>()
      : [RetirementRefusal.cases.PinsMoved.make({ current: streams(current), next: streams(next) })];
  const consumers = consumersOf(feed, descriptors);
  const checked = A.map(newlyRetired(current, next), ({ retired: { stream, length }, index }) => {
    const closed = A.some(current, (before) => before.stream === stream && StreamPin.guards.Closed(before));
    // Its first position follows every generation before it; one not read leaves it unknown.
    const before = A.take(next, index);
    const unreadBefore = A.map(
      A.filter(before, (pin) => O.isNone(heldBy(read)(pin))),
      (pin) => RetirementRefusal.cases.Unread.make({ stream: pin.stream }),
    );
    const from = A.reduce(A.getSomes(A.map(before, heldBy(read))), 0, Num.sum);
    const through = from + length;
    const successor = A.findFirst(A.drop(next, index + 1), (later) => !StreamPin.guards.Retired(later));
    const refusals: ReadonlyArray<RetirementRefusal> = pipe(
      O.match(read(stream), {
        onNone: () => [RetirementRefusal.cases.Unread.make({ stream })],
        onSome: (retiring) => [
          ...(lengthOf(retiring) === length
            ? []
            : [RetirementRefusal.cases.LengthDiffers.make({ stream, pinned: length, live: lengthOf(retiring) })]),
          ...O.match(successor, {
            onNone: () => [RetirementRefusal.cases.NoSuccessor.make({ stream })],
            onSome: (later) =>
              O.match(read(later.stream), {
                onNone: () => [RetirementRefusal.cases.Unread.make({ stream: later.stream })],
                onSome: (held) => heldBySuccessor(stream, retiring, held),
              }),
          }),
        ],
      }),
      A.prependAll(closed ? unreadBefore : [RetirementRefusal.cases.NotClosed.make({ stream }), ...unreadBefore]),
      A.appendAll(readPast(stream, through, consumers, checkpoints)),
    );
    return { retirement: Retirement.make({ stream, from, through }), refusals };
  });
  // (d) D34 over the same descriptors.
  const unpublished = A.map(ledgerOf(descriptors).missing, ({ consumer, fact }) =>
    RetirementRefusal.cases.VersionUnpublished.make({ consumer, fact }),
  );
  const refusals = [...moved, ...A.flatMap(checked, (entry) => entry.refusals), ...(A.isReadonlyArrayEmpty(checked) ? [] : unpublished)];
  return A.isReadonlyArrayEmpty(refusals)
    ? Effect.succeed(A.map(checked, (entry) => entry.retirement))
    : Effect.fail(RetirementRefused.make({ refusals }));
};
