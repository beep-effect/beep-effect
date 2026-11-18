import { expect, it } from "@effect/vitest";
import { Count, Name, Sequence } from "@proto/kernel/Measure";
import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
import { checkPublishedStreams, driftOf, LiveStream, StreamDrift } from "@proto/tooling/PublishedStreams";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as S from "effect/Schema";

// Phase 9 (D43): a projection feeding a published stream cannot be rebuilt or re-sourced in place;
// it writes a new stream generation, pinned, and the old one is pinned closed.
// Every value below is generated from a schema. A scene says, stream by stream, how the model's
// streams stand against their pins; pins and live streams are built from it, so the drift is known
// by construction.

/** A writer as a model declares it: a projection, its generation and the sources it reads, each once. */
const Writer = S.Struct({ projection: Name, generation: Count, sources: S.Array(Name) });
type Writer = typeof Writer.Type;
const writerOf = (writer: Writer): StreamWriter => StreamWriter.make({ ...writer, sources: A.dedupe(writer.sources) });

/** How an open generation's live writer differs from the one it was opened with. */
const Change = S.Literals(["projection", "generation", "added", "removed"]);
/** A writer and one change to it: `extra` names what the change adds, `bump` how far a generation moves. */
const Drifted = S.Struct({ writer: Writer, change: Change, extra: Name, bump: Sequence });
type Drifted = typeof Drifted.Type;

/** The writer a generation was pinned with, and the live writer that one change made of it. */
const driftedOf = ({ writer, change, extra, bump }: Drifted) => {
  const base = writerOf(writer);
  // Longer than every source the writer reads, so not one of them.
  const withFresh = { ...base, sources: A.append(base.sources, `${A.join(base.sources, "")}${extra}`) };
  return Match.value(change).pipe(
    Match.when("projection", () => ({ pinned: base, live: { ...base, projection: `${base.projection}${extra}` } })),
    Match.when("generation", () => ({ pinned: base, live: { ...base, generation: base.generation + bump } })),
    Match.when("added", () => ({ pinned: base, live: withFresh })),
    Match.when("removed", () => ({ pinned: withFresh, live: base })),
    Match.exhaustive,
  );
};

/** How one stream stands: its pin, its place in the live model, and so the drift it shows. */
const Case = S.TaggedUnion({
  /** Open, and written by the writer it was opened with, its sources listed in another order. */
  Kept: { writer: Writer },
  /** Closed, or retired with `length` positions, and in the model with no writer. */
  Served: { retired: S.Option(Count) },
  /** Retired, and gone from the model. */
  Left: { length: Count },
  /** Open, and written by a writer one change away from the one it was opened with. */
  Changed: Drifted.fields,
  /** Closed, or retired, and written again. */
  Reopened: { retired: S.Option(Count), writer: Writer },
  /** Open, and in the model with no writer. */
  Unwritten: { writer: Writer },
  /** In the model, with or without a writer, and not pinned. */
  Unpinned: { writer: S.Option(Writer) },
  /** Open or closed, and gone from the model. */
  Undeclared: { writer: S.Option(Writer) },
});
type Case = typeof Case.Type;

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
    Changed: (drifted) => O.some(StreamPin.cases.Open.make({ stream, writer: driftedOf(drifted).pinned })),
    Reopened: ({ retired }) => O.some(closedOrRetired(stream, retired)),
    Unwritten: ({ writer }) => O.some(StreamPin.cases.Open.make({ stream, writer: writerOf(writer) })),
    Unpinned: O.none,
    Undeclared: ({ writer }) => O.some(openOrClosed(stream, writer)),
  });

const liveOf = ({ stream, case: of }: Stream): O.Option<LiveStream> =>
  Case.match(of, {
    Kept: ({ writer }) => {
      const opened = writerOf(writer);
      return O.some({ stream, writer: O.some({ ...opened, sources: A.reverse(opened.sources) }) });
    },
    Served: () => O.some({ stream, writer: O.none() }),
    Left: O.none,
    Changed: (drifted) => O.some({ stream, writer: O.some(driftedOf(drifted).live) }),
    Reopened: ({ writer }) => O.some({ stream, writer: O.some(writerOf(writer)) }),
    Unwritten: () => O.some({ stream, writer: O.none() }),
    Unpinned: ({ writer }) => O.some({ stream, writer: O.map(writer, writerOf) }),
    Undeclared: O.none,
  });

/** The drift a live stream shows, by its case. */
const liveDriftOf = ({ stream, case: of }: Stream): O.Option<StreamDrift> =>
  Case.match(of, {
    Kept: O.none,
    Served: O.none,
    Left: O.none,
    Changed: (drifted) => StreamDrift.cases.Changed.makeOption({ stream, ...driftedOf(drifted) }),
    Reopened: ({ writer }) => StreamDrift.cases.Reopened.makeOption({ stream, writer: writerOf(writer) }),
    Unwritten: ({ writer }) => StreamDrift.cases.Unwritten.makeOption({ stream, pinned: writerOf(writer) }),
    Unpinned: () => StreamDrift.cases.Unpinned.makeOption({ stream }),
    Undeclared: O.none,
  });

const pinsOf = (scene: Scene) => A.getSomes(A.map(streamsOf(scene), pinOf));
const livesOf = (scene: Scene) => A.getSomes(A.map(streamsOf(scene), liveOf));
const undeclaredOf = (scene: Scene) =>
  A.map(A.filter(streamsOf(scene), (stream) => Case.guards.Undeclared(stream.case)), ({ stream }) => StreamDrift.cases.Undeclared.make({ stream }));

/** The check's failure, if it fails, as the drift it names. */
const failedWith = (pins: ReadonlyArray<StreamPin>, live: ReadonlyArray<LiveStream>) =>
  Effect.map(Effect.option(Effect.flip(checkPublishedStreams(pins, live))), O.map((failure) => failure.drift));

it.effect.prop("any pins and live streams: the check fails with exactly the drift, and passes when there is none", [S.Array(StreamPin), S.Array(LiveStream)], ([pins, live]) =>
  Effect.gen(function* () {
    const drift = driftOf(pins, live);
    expect(S.is(S.Array(StreamDrift))(drift)).toBe(true);
    expect(yield* failedWith(pins, live)).toEqual(O.liftPredicate(drift, A.isReadonlyArrayNonEmpty));
  }),
);

it.prop("each stream drifts as its case says: the live streams in the model's order, then the pins the model dropped", [Scene], ([scene]) => {
  expect(driftOf(pinsOf(scene), livesOf(scene))).toEqual([...A.getSomes(A.map(streamsOf(scene), liveDriftOf)), ...undeclaredOf(scene)]);
});

it.effect.prop("pins taken from the live streams drift from nothing, whatever order a writer's sources are listed in", [S.Array(S.Struct({ stream: Name, writer: S.Option(Writer) }))], ([streams]) =>
  Effect.gen(function* () {
    const declared = A.dedupeWith(streams, (a, b) => a.stream === b.stream);
    const pins = A.map(declared, ({ stream, writer }) => openOrClosed(stream, writer));
    const live = A.map(declared, ({ stream, writer }) => ({
      stream,
      writer: O.map(writer, (opened) => ({ ...writerOf(opened), sources: A.reverse(writerOf(opened).sources) })),
    }));
    expect(driftOf(pins, live)).toEqual([]);
    expect(yield* failedWith(pins, live)).toEqual(O.none());
  }),
);

it.prop("the order of the pins and of the live streams only orders the drift", [Scene], ([scene]) => {
  const pins = pinsOf(scene);
  const live = livesOf(scene);
  const inModel = A.filter(driftOf(pins, live), (drift) => !StreamDrift.guards.Undeclared(drift));
  expect(driftOf(A.reverse(pins), live)).toEqual([...inModel, ...A.reverse(undeclaredOf(scene))]);
  expect(driftOf(pins, A.reverse(live))).toEqual([...A.reverse(inModel), ...undeclaredOf(scene)]);
});

/** Two source lists over the same three names, so they often repeat a name and often have the same length. */
const Listings = S.Struct({
  writer: Writer,
  names: S.Tuple([Name, Name, Name]),
  pinned: S.Array(Count),
  live: S.Array(Count),
});

it.prop("an open generation drifts exactly when its live writer reads another set of sources", [Listings], ([{ writer, names, pinned, live }]) => {
  const sourcesOf = (picks: ReadonlyArray<number>) => A.map(picks, (pick) => names[pick % names.length] ?? names[0]);
  const opened = StreamWriter.make({ ...writer, sources: sourcesOf(pinned) });
  const reading = StreamWriter.make({ ...writer, sources: sourcesOf(live) });
  const sameSet = HashSet.isSubset(HashSet.fromIterable(opened.sources), HashSet.fromIterable(reading.sources)) &&
    HashSet.isSubset(HashSet.fromIterable(reading.sources), HashSet.fromIterable(opened.sources));
  const drift = driftOf([StreamPin.cases.Open.make({ stream: writer.projection, writer: opened })], [{ stream: writer.projection, writer: O.some(reading) }]);
  expect(drift).toEqual(sameSet ? [] : [StreamDrift.cases.Changed.make({ stream: writer.projection, pinned: opened, live: reading })]);
});
