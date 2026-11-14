import type * as Domain from "@alchemy.run/domain";
import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";

/**
 * A stream as the deployed model has it: its name, and its writer, if a
 * projection lists it in `writes`.
 *
 * @category models
 * @since 0.0.0
 */
export const LiveStream = S.Struct({ stream: S.String, writer: S.Option(StreamWriter) });
/**
 * @category models
 * @since 0.0.0
 */
export type LiveStream = typeof LiveStream.Type;

/**
 * One way the model's published streams differ from their pins.
 *
 * - `Unpinned`: a stream of the model has no pin.
 * - `Changed`: an open generation's writer is not the one it was opened
 *   with: its version was bumped, a view it reads was bumped, its sources
 *   changed, or another projection writes it. Open a new generation.
 * - `Reopened`: a closed generation has a writer again.
 * - `Unwritten`: an open generation has no writer; pin it closed.
 * - `Undeclared`: a pinned generation is gone from the model, so what it
 *   published can no longer be served.
 *
 * @category models
 * @since 0.0.0
 */
export const StreamDrift = S.TaggedUnion({
  Unpinned: { stream: S.String },
  Changed: { stream: S.String, pinned: StreamWriter, live: StreamWriter },
  Reopened: { stream: S.String, writer: StreamWriter },
  Unwritten: { stream: S.String, pinned: StreamWriter },
  Undeclared: { stream: S.String },
});
/**
 * @category models
 * @since 0.0.0
 */
export type StreamDrift = typeof StreamDrift.Type;

/**
 * The model's published streams differ from their pins (D43, phase 9).
 *
 * @category errors
 * @since 0.0.0
 */
export class PublishedStreamDrift extends S.TaggedError<PublishedStreamDrift, { readonly brand: unique symbol }>()(
  "PublishedStreamDrift",
  { drift: S.Array(StreamDrift) },
) {}

const sameWriter = (a: StreamWriter, b: StreamWriter): boolean =>
  a.projection === b.projection &&
  a.generation === b.generation &&
  A.length(a.sources) === A.length(b.sources) &&
  A.every(a.sources, (source) => A.contains(b.sources, source));

const driftOfLive = (pins: ReadonlyArray<StreamPin>) => (live: LiveStream): O.Option<StreamDrift> =>
  O.match(
    A.findFirst(pins, (pin) => pin.stream === live.stream),
    {
      onNone: () => O.some(StreamDrift.cases.Unpinned.make({ stream: live.stream })),
      onSome: (pin) =>
        StreamPin.match(pin, {
          Closed: () => O.map(live.writer, (writer) => StreamDrift.cases.Reopened.make({ stream: live.stream, writer })),
          Open: ({ writer: pinned }) =>
            O.match(live.writer, {
              onNone: () => O.some(StreamDrift.cases.Unwritten.make({ stream: live.stream, pinned })),
              onSome: (writer) =>
                sameWriter(pinned, writer)
                  ? O.none()
                  : O.some(StreamDrift.cases.Changed.make({ stream: live.stream, pinned, live: writer })),
            }),
        }),
    },
  );

/**
 * How the model's streams differ from their pins: nothing when every stream
 * is pinned, each open generation is written by exactly the writer it was
 * opened with, and no closed generation has a writer.
 *
 * **Example** (A bumped publisher, caught)
 * ```ts
 * import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
 * import { driftOf } from "@proto/tooling/PublishedStreams";
 * import * as O from "effect/Option";
 *
 * const opened = StreamWriter.make({ projection: "ClaimDecisions", generation: 0, sources: ["Claim"] });
 * const drift = driftOf(
 *   [StreamPin.cases.Open.make({ stream: "PartyFacts2", writer: opened })],
 *   [{ stream: "PartyFacts2", writer: O.some({ ...opened, generation: 1 }) }],
 * );
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const driftOf: {
  (live: ReadonlyArray<LiveStream>): (pins: ReadonlyArray<StreamPin>) => ReadonlyArray<StreamDrift>;
  (pins: ReadonlyArray<StreamPin>, live: ReadonlyArray<LiveStream>): ReadonlyArray<StreamDrift>;
} = dual(2, (pins: ReadonlyArray<StreamPin>, live: ReadonlyArray<LiveStream>): ReadonlyArray<StreamDrift> => [
  ...A.getSomes(A.map(live, driftOfLive(pins))),
  ...pipe(
    pins,
    A.filter((pin) => !A.some(live, (stream) => stream.stream === pin.stream)),
    A.map((pin) => StreamDrift.cases.Undeclared.make({ stream: pin.stream })),
  ),
]);

/**
 * The stream-pin check (D43, phase 9): fails with every difference between
 * the model's published streams and their pins. A projection that feeds a
 * published stream cannot have its version bumped, inherit a view's bump, or
 * change its sources without a new stream generation pinned to it.
 *
 * **Example** (Checking Party's streams)
 * ```ts
 * import { checkPublishedStreams } from "@proto/tooling/PublishedStreams";
 *
 * const checked = checkPublishedStreams([], []);
 * ```
 *
 * @category checks
 * @since 0.0.0
 */
export const checkPublishedStreams: {
  (live: ReadonlyArray<LiveStream>): (pins: ReadonlyArray<StreamPin>) => Effect.Effect<void, PublishedStreamDrift>;
  (pins: ReadonlyArray<StreamPin>, live: ReadonlyArray<LiveStream>): Effect.Effect<void, PublishedStreamDrift>;
} = dual(2, (pins: ReadonlyArray<StreamPin>, live: ReadonlyArray<LiveStream>): Effect.Effect<void, PublishedStreamDrift> => {
  const drift = driftOf(pins, live);
  return A.isReadonlyArrayEmpty(drift) ? Effect.void : Effect.fail(PublishedStreamDrift.make({ drift }));
});

const sourceName = (source: Domain.Aggregate.Any | Domain.View.Any): string => (source.kind === "Aggregate" ? source.aggregateName : source.viewName);

/**
 * A hosted model's consumer generations (`Model.Internals` `kernel.generationOf`).
 *
 * @category models
 * @since 0.0.0
 */
export type GenerationOf = (kind: "projection", name: string) => number;

/**
 * The deployed model's streams with their writers. `generationOf` is the
 * hosted model's (`Model.Internals` `kernel.generationOf`): it includes each
 * projection's Layer version and the versions of the views it reads, which
 * the model class alone does not know.
 *
 * **Example** (Reading a hosted model's streams)
 * ```ts
 * import { liveStreamsOf } from "@proto/tooling/PublishedStreams";
 * import type * as Domain from "@alchemy.run/domain";
 *
 * declare const model: Domain.Model.Any;
 * const live = liveStreamsOf(model, () => 0);
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const liveStreamsOf: {
  (generationOf: GenerationOf): (model: Domain.Model.Any) => ReadonlyArray<LiveStream>;
  (model: Domain.Model.Any, generationOf: GenerationOf): ReadonlyArray<LiveStream>;
} = dual(2, (model: Domain.Model.Any, generationOf: GenerationOf): ReadonlyArray<LiveStream> =>
  A.map(model.definitions.streams, (stream) => ({
    stream: stream.streamName,
    writer: O.map(
      A.findFirst(model.definitions.projections, (projection) =>
        A.some(projection.definition.writes ?? [], (written) => written.streamName === stream.streamName),
      ),
      (projection) =>
        StreamWriter.make({
          projection: projection.projectionName,
          generation: generationOf("projection", projection.projectionName),
          sources: A.sort(A.map(projection.definition.from, sourceName), Order.String),
        }),
    ),
  })),
);
