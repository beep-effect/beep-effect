import { LiteralKit } from "@beep/schema/LiteralKit";
import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";

/**
 * How an upgrade hands a published stream's generation over: it closes it, or
 * another writer takes it (a new projection, generation or source set).
 *
 * @category models
 * @since 0.0.0
 */
export const HandoverChange = LiteralKit(["closed", "replaced"]);
/**
 * @category models
 * @since 0.0.0
 */
export type HandoverChange = typeof HandoverChange.Type;

/**
 * One generation an upgrade takes from its writer: the stream, the outgoing
 * writer, and how.
 *
 * @category models
 * @since 0.0.0
 */
export const Handover = S.Struct({ stream: S.String, writer: StreamWriter, change: HandoverChange });
/**
 * @category models
 * @since 0.0.0
 */
export type Handover = typeof Handover.Type;

/**
 * What the live host has not yet published for a writer: every input of the
 * writer's that is staged upstream of it or taken in and not yet handled,
 * read from the host before the upgrade is deployed.
 *
 * @category models
 * @since 0.0.0
 */
export const PublisherBacklog = S.Struct({ stream: S.String, writer: S.String, pending: S.Int });
/**
 * @category models
 * @since 0.0.0
 */
export type PublisherBacklog = typeof PublisherBacklog.Type;

/**
 * The upgrade would take generations from writers that still have something
 * to publish (`pending`), or whose backlog was not read (`unread`).
 *
 * @category errors
 * @since 0.0.0
 */
export class PublisherPending extends S.TaggedError<PublisherPending, { readonly brand: unique symbol }>()("PublisherPending", {
  pending: S.Array(S.Struct({ handover: Handover, pending: S.Int })),
  unread: S.Array(Handover),
}) {}

const sameWriter = (a: StreamWriter, b: StreamWriter): boolean =>
  a.projection === b.projection &&
  a.generation === b.generation &&
  A.length(a.sources) === A.length(b.sources) &&
  A.every(a.sources, (source) => A.contains(b.sources, source));

const handoverOf = (next: ReadonlyArray<StreamPin>) => (pin: StreamPin): O.Option<Handover> =>
  StreamPin.match(pin, {
    Closed: O.none<Handover>,
    Retired: O.none<Handover>,
    Open: ({ stream, writer }) =>
      O.match(
        A.findFirst(next, (candidate) => candidate.stream === stream),
        {
          // A generation the next code drops is closed too (the stream-pin check refuses it anyway).
          onNone: () => Handover.makeOption({ stream, writer, change: "closed" }),
          onSome: (after) =>
            StreamPin.match(after, {
              Closed: () => Handover.makeOption({ stream, writer, change: "closed" }),
              // Retired at once: its writer is taken all the same (the retirement check refuses it).
              Retired: () => Handover.makeOption({ stream, writer, change: "closed" }),
              Open: ({ writer: incoming }) =>
                sameWriter(writer, incoming) ? O.none() : Handover.makeOption({ stream, writer, change: "replaced" }),
            }),
        },
      ),
  });

/**
 * The generations an upgrade from `current` pins to `next` pins takes from
 * their writers.
 *
 * **Example** (Phase 9's upgrade closes generation 1)
 * ```ts
 * import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
 * import { handoversOf } from "@proto/tooling/PublisherHandover";
 *
 * const handovers = handoversOf({
 *   current: [StreamPin.cases.Open.make({ stream: "PartyFacts", writer: StreamWriter.make({ projection: "ClaimFacts", generation: 1, sources: ["ClaimReview"] }) })],
 *   next: [StreamPin.cases.Closed.make({ stream: "PartyFacts" })],
 * });
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const handoversOf = ({
  current,
  next,
}: {
  readonly current: ReadonlyArray<StreamPin>;
  readonly next: ReadonlyArray<StreamPin>;
}): ReadonlyArray<Handover> => A.getSomes(A.map(current, handoverOf(next)));

/**
 * The publisher-drain check (D47): run against the live host before an
 * upgrade is deployed. It fails while any writer the upgrade takes a
 * generation from has something pending, or its backlog was not read;
 * otherwise it returns the handovers, which may then be deployed.
 *
 * **Example** (Checking an upgrade with nothing pending)
 * ```ts
 * import { checkPublisherHandover } from "@proto/tooling/PublisherHandover";
 *
 * const checked = checkPublisherHandover({ current: [], next: [], backlog: [] });
 * ```
 *
 * @category checks
 * @since 0.0.0
 */
export const checkPublisherHandover = ({
  current,
  next,
  backlog,
}: {
  readonly current: ReadonlyArray<StreamPin>;
  readonly next: ReadonlyArray<StreamPin>;
  readonly backlog: ReadonlyArray<PublisherBacklog>;
}): Effect.Effect<ReadonlyArray<Handover>, PublisherPending> => {
  const handovers = handoversOf({ current, next });
  const read = (handover: Handover) =>
    A.findFirst(backlog, (entry) => entry.stream === handover.stream && entry.writer === handover.writer.projection);
  const unread = A.filter(handovers, (handover) => O.isNone(read(handover)));
  const pending = A.getSomes(
    A.map(handovers, (handover) =>
      O.flatMap(read(handover), (entry) => (entry.pending > 0 ? O.some({ handover, pending: entry.pending }) : O.none())),
    ),
  );
  return A.isReadonlyArrayEmpty(unread) && A.isReadonlyArrayEmpty(pending)
    ? Effect.succeed(handovers)
    : Effect.fail(PublisherPending.make({ pending, unread }));
};
