import { expect, it } from "@effect/vitest";
import { Count, Name } from "@proto/kernel/Measure";
import { StreamPin } from "@proto/kernel/PublishedStream";
import { checkPublishedStreams, driftOf, LiveStream, StreamDrift } from "@proto/tooling/PublishedStreams";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Changed, changedOf, listedOf, Listings, reordered, Writer, writerOf } from "./Writer.ts";

// Phase 9 (D43): a projection feeding a published stream cannot be rebuilt or re-sourced in place;
// it writes a new stream generation, pinned, and the old one is pinned closed.
// Every value below is generated from a schema. A scene says, stream by stream, how the model's
// streams stand against their pins; pins and live streams are built from it, so the drift is known
// by construction.

/** How one stream stands: its pin, its place in the live model, and so the drift it shows. */
const Case = S.TaggedUnion({
  /** Open, and written by the writer it was opened with, its sources listed in another order. */
  Kept: { writer: Writer },
  /** Closed, or retired with `length` positions, and in the model with no writer. */
  Served: { retired: S.Option(Count) },
  /** Retired, and gone from the model. */
  Left: { length: Count },
  /** Open, and written by a writer one change away from the one it was opened with. */
  Changed: Changed.fields,
  /** Closed, or retired, and written again. */
  Reopened: { retired: S.Option(Count), writer: Writer },
  /** Open, and in the model with no writer. */
  Unwritten: { writer: Writer },
  /** In the model, with or without a writer, and not pinned. */
  Unpinned: { writer: S.Option(Writer) },
  /** Open or closed, and gone from the model. */
  Undeclared: { writer: S.Option(Writer) },
});

const Scene = S.Array(S.Struct({ stream: Name, case: Case }));
type Scene = typeof Scene.Type;
type Stream = Scene[number];

/** One stream per name: a model declares a stream once and pins it once. */
const streamsOf = (scene: Scene) => A.dedupeWith(scene, (a, b) => a.stream === b.stream);

const closedOrRetired = (stream: string, retired: O.Option<number>) =>
  O.match(retired, {
    onNone: () => StreamPin.cases.Closed.make({ stream }),
    onSome: (length) => StreamPin.cases.Retired.make({ stream, length }),
  });
const openOrClosed = (stream: string, writer: O.Option<Writer>) =>
  O.match(writer, {
    onNone: () => StreamPin.cases.Closed.make({ stream }),
    onSome: (opened) => StreamPin.cases.Open.make({ stream, writer: writerOf(opened) }),
  });

const pinOf = ({ stream, case: of }: Stream): O.Option<StreamPin> =>
  Case.match(of, {
    Kept: ({ writer }) => O.some(StreamPin.cases.Open.make({ stream, writer: writerOf(writer) })),
    Served: ({ retired }) => O.some(closedOrRetired(stream, retired)),
    Left: ({ length }) => O.some(StreamPin.cases.Retired.make({ stream, length })),
    Changed: (changed) => O.some(StreamPin.cases.Open.make({ stream, writer: changedOf(changed).before })),
    Reopened: ({ retired }) => O.some(closedOrRetired(stream, retired)),
    Unwritten: ({ writer }) => O.some(StreamPin.cases.Open.make({ stream, writer: writerOf(writer) })),
    Unpinned: O.none<StreamPin>,
    Undeclared: ({ writer }) => O.some(openOrClosed(stream, writer)),
  });

const liveOf = ({ stream, case: of }: Stream): O.Option<LiveStream> =>
  Case.match(of, {
    Kept: ({ writer }) => O.some({ stream, writer: O.some(reordered(writer)) }),
    Served: () => O.some({ stream, writer: O.none() }),
    Left: O.none<LiveStream>,
    Changed: (changed) => O.some({ stream, writer: O.some(changedOf(changed).after) }),
    Reopened: ({ writer }) => O.some({ stream, writer: O.some(writerOf(writer)) }),
    Unwritten: () => O.some({ stream, writer: O.none() }),
    Unpinned: ({ writer }) => O.some({ stream, writer: O.map(writer, writerOf) }),
    Undeclared: O.none<LiveStream>,
  });

/** The drift a live stream shows, by its case. */
const liveDriftOf = ({ stream, case: of }: Stream): O.Option<StreamDrift> =>
  Case.match(of, {
    Kept: O.none<StreamDrift>,
    Served: O.none<StreamDrift>,
    Left: O.none<StreamDrift>,
    Changed: (changed) => {
      const { before, after } = changedOf(changed);
      return StreamDrift.cases.Changed.makeOption({ stream, pinned: before, live: after });
    },
    Reopened: ({ writer }) => StreamDrift.cases.Reopened.makeOption({ stream, writer: writerOf(writer) }),
    Unwritten: ({ writer }) => StreamDrift.cases.Unwritten.makeOption({ stream, pinned: writerOf(writer) }),
    Unpinned: () => StreamDrift.cases.Unpinned.makeOption({ stream }),
    Undeclared: O.none<StreamDrift>,
  });

const pinsOf = (scene: Scene) => A.getSomes(A.map(streamsOf(scene), pinOf));
const livesOf = (scene: Scene) => A.getSomes(A.map(streamsOf(scene), liveOf));
const undeclaredOf = (scene: Scene) =>
  A.map(A.filter(streamsOf(scene), (stream) => Case.guards.Undeclared(stream.case)), ({ stream }) => StreamDrift.cases.Undeclared.make({ stream }));

/** The check's outcome, its failure read as the drift it names. */
const checked = (pins: ReadonlyArray<StreamPin>, live: ReadonlyArray<LiveStream>) =>
  Effect.map(Effect.result(checkPublishedStreams(pins, live)), Result.mapError((failure) => failure.drift));

it.effect.prop("any pins and live streams: the check fails with exactly the drift, and passes when there is none", [S.Array(StreamPin), S.Array(LiveStream)], ([pins, live]) =>
  Effect.gen(function* () {
    const drift = driftOf(pins, live);
    expect(S.is(S.Array(StreamDrift))(drift)).toBe(true);
    const outcome = yield* checked(pins, live);
    expect(outcome).toEqual(A.isReadonlyArrayEmpty(drift) ? Result.succeed(undefined) : Result.fail(drift));
  }),
);

it.prop("each stream drifts as its case says: the live streams in the model's order, then the pins the model dropped", [Scene], ([scene]) => {
  expect(driftOf(pinsOf(scene), livesOf(scene))).toEqual([...A.getSomes(A.map(streamsOf(scene), liveDriftOf)), ...undeclaredOf(scene)]);
});

it.effect.prop("pins taken from the live streams drift from nothing, whatever order a writer's sources are listed in", [S.Array(S.Struct({ stream: Name, writer: S.Option(Writer) }))], ([streams]) =>
  Effect.gen(function* () {
    const declared = A.dedupeWith(streams, (a, b) => a.stream === b.stream);
    const pins = A.map(declared, ({ stream, writer }) => openOrClosed(stream, writer));
    const live = A.map(declared, ({ stream, writer }) => ({ stream, writer: O.map(writer, reordered) }));
    expect(driftOf(pins, live)).toEqual([]);
    const outcome = yield* checked(pins, live);
    expect(outcome).toEqual(Result.succeed(undefined));
  }),
);

it.prop("the order of the pins and of the live streams only orders the drift", [Scene], ([scene]) => {
  const pins = pinsOf(scene);
  const live = livesOf(scene);
  const inModel = A.filter(driftOf(pins, live), (drift) => !StreamDrift.guards.Undeclared(drift));
  expect(driftOf(A.reverse(pins), live)).toEqual([...inModel, ...A.reverse(undeclaredOf(scene))]);
  expect(driftOf(pins, A.reverse(live))).toEqual([...A.reverse(inModel), ...undeclaredOf(scene)]);
});

it.prop("an open generation drifts exactly when its live writer reads another set of sources", [Listings], ([listings]) => {
  const { before, after, sameSources } = listedOf(listings);
  const stream = listings.writer.projection;
  const drift = driftOf([StreamPin.cases.Open.make({ stream, writer: before })], [{ stream, writer: O.some(after) }]);
  expect(drift).toEqual(sameSources ? [] : [StreamDrift.cases.Changed.make({ stream, pinned: before, live: after })]);
});
