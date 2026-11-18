import { expect, it } from "@effect/vitest";
import { Count, Name, Sequence } from "@proto/kernel/Measure";
import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
import { checkPublisherHandover, Handover, handoversOf, PublisherBacklog } from "@proto/tooling/PublisherHandover";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

// Phase 10 (D47): an upgrade that closes a published stream's generation, or gives it another
// writer, is refused while the outgoing writer has anything pending.
// Every value below is generated from a schema. A scene says, stream by stream, what the upgrade
// does to a generation; the current and next pins are built from it, so the handovers are known by
// construction.

/** A writer as a model declares it: a projection, its generation and the sources it reads, each once. */
const Writer = S.Struct({ projection: Name, generation: Count, sources: S.Array(Name) });
type Writer = typeof Writer.Type;
const writerOf = (writer: Writer): StreamWriter => StreamWriter.make({ ...writer, sources: A.dedupe(writer.sources) });

/** How the incoming writer differs from the outgoing one. */
const Change = S.Literals(["projection", "generation", "added", "removed"]);
/** A writer and one change to it: `extra` names what the change adds, `bump` how far a generation moves. */
const Replacement = S.Struct({ writer: Writer, change: Change, extra: Name, bump: Sequence });
type Replacement = typeof Replacement.Type;

/** The outgoing writer and the incoming one that one change made of it. */
const replacedOf = ({ writer, change, extra, bump }: Replacement) => {
  const base = writerOf(writer);
  // Longer than every source the writer reads, so not one of them.
  const withFresh = { ...base, sources: A.append(base.sources, `${A.join(base.sources, "")}${extra}`) };
  return Match.value(change).pipe(
    Match.when("projection", () => ({ outgoing: base, incoming: { ...base, projection: `${base.projection}${extra}` } })),
    Match.when("generation", () => ({ outgoing: base, incoming: { ...base, generation: base.generation + bump } })),
    Match.when("added", () => ({ outgoing: base, incoming: withFresh })),
    Match.when("removed", () => ({ outgoing: withFresh, incoming: base })),
    Match.exhaustive,
  );
};

/** What an upgrade does to one generation. */
const Case = S.TaggedUnion({
  /** Open, and still written by its writer, its sources listed in another order. */
  Kept: { writer: Writer },
  /** Open, and pinned closed by the next code. */
  Closed: { writer: Writer },
  /** Open, and retired at once by the next code. */
  Retired: { writer: Writer, length: Count },
  /** Open, and gone from the next pins. */
  Dropped: { writer: Writer },
  /** Open, and written by another writer in the next code. */
  Replaced: Replacement.fields,
  /** Closed, or retired, now: whatever the next code pins, it takes no writer (`next`: absent, closed, or open with a writer). */
  Served: { retired: S.Option(Count), next: S.Option(S.Option(Writer)) },
});
type Case = typeof Case.Type;

const Scene = S.Array(S.Struct({ stream: Name, case: Case }));
type Scene = typeof Scene.Type;
type Stream = Scene[number];

/** One pin per stream: a model pins a generation once. */
const streamsOf = (scene: Scene) => A.dedupeWith(scene, (a, b) => a.stream === b.stream);
const open = (stream: string, writer: StreamWriter) => StreamPin.cases.Open.make({ stream, writer });

const currentOf = ({ stream, case: of }: Stream): StreamPin =>
  Case.match(of, {
    Kept: ({ writer }) => open(stream, writerOf(writer)),
    Closed: ({ writer }) => open(stream, writerOf(writer)),
    Retired: ({ writer }) => open(stream, writerOf(writer)),
    Dropped: ({ writer }) => open(stream, writerOf(writer)),
    Replaced: (replaced) => open(stream, replacedOf(replaced).outgoing),
    Served: ({ retired }) =>
      O.match(retired, {
        onNone: () => StreamPin.cases.Closed.make({ stream }),
        onSome: (length) => StreamPin.cases.Retired.make({ stream, length }),
      }),
  });

const nextOf = ({ stream, case: of }: Stream): O.Option<StreamPin> =>
  Case.match(of, {
    Kept: ({ writer }) => {
      const kept = writerOf(writer);
      return O.some(open(stream, { ...kept, sources: A.reverse(kept.sources) }));
    },
    Closed: () => O.some(StreamPin.cases.Closed.make({ stream })),
    Retired: ({ length }) => O.some(StreamPin.cases.Retired.make({ stream, length })),
    Dropped: O.none,
    Replaced: (replaced) => O.some(open(stream, replacedOf(replaced).incoming)),
    Served: ({ next }) =>
      O.map(next, O.match({ onNone: () => StreamPin.cases.Closed.make({ stream }), onSome: (writer) => open(stream, writerOf(writer)) })),
  });

/** The handover a generation's case makes. */
const handoverOf = ({ stream, case: of }: Stream): O.Option<Handover> =>
  Case.match(of, {
    Kept: O.none,
    Closed: ({ writer }) => O.some(Handover.make({ stream, writer: writerOf(writer), change: "closed" })),
    Retired: ({ writer }) => O.some(Handover.make({ stream, writer: writerOf(writer), change: "closed" })),
    Dropped: ({ writer }) => O.some(Handover.make({ stream, writer: writerOf(writer), change: "closed" })),
    Replaced: (replaced) => O.some(Handover.make({ stream, writer: replacedOf(replaced).outgoing, change: "replaced" })),
    Served: O.none,
  });

const pinsOf = (scene: Scene) => ({ current: A.map(streamsOf(scene), currentOf), next: A.getSomes(A.map(streamsOf(scene), nextOf)) });
const expectedOf = (scene: Scene) => A.getSomes(A.map(streamsOf(scene), handoverOf));

it.prop("each generation is handed over as the upgrade's change to it says, in the order of the current pins", [Scene], ([scene]) => {
  expect(handoversOf(pinsOf(scene))).toEqual(expectedOf(scene));
});

it.prop("pins handed to themselves hand nothing over", [S.Array(StreamPin)], ([pins]) => {
  const current = A.dedupeWith(pins, (a, b) => a.stream === b.stream);
  expect(handoversOf({ current, next: current })).toEqual([]);
});

it.prop("the order of the next pins does not matter, and the order of the current pins orders the handovers", [Scene], ([scene]) => {
  const { current, next } = pinsOf(scene);
  expect(handoversOf({ current, next: A.reverse(next) })).toEqual(expectedOf(scene));
  expect(handoversOf({ current: A.reverse(current), next })).toEqual(A.reverse(expectedOf(scene)));
});

/** Two source lists over the same three names, so they often repeat a name and often have the same length. */
const Listings = S.Struct({ writer: Writer, names: S.Tuple([Name, Name, Name]), outgoing: S.Array(Count), incoming: S.Array(Count) });

it.prop("a writer is kept exactly when the next code reads the same set of sources with it", [Listings], ([{ writer, names, outgoing, incoming }]) => {
  const sourcesOf = (picks: ReadonlyArray<number>) => A.map(picks, (pick) => names[pick % names.length] ?? names[0]);
  const before = StreamWriter.make({ ...writer, sources: sourcesOf(outgoing) });
  const after = StreamWriter.make({ ...writer, sources: sourcesOf(incoming) });
  const setOf = (writer: StreamWriter) => HashSet.fromIterable(writer.sources);
  const sameSet = HashSet.isSubset(setOf(before), setOf(after)) && HashSet.isSubset(setOf(after), setOf(before));
  const handovers = handoversOf({ current: [open(writer.projection, before)], next: [open(writer.projection, after)] });
  expect(handovers).toEqual(sameSet ? [] : [Handover.make({ stream: writer.projection, writer: before, change: "replaced" })]);
});

/**
 * An upgrade and what the live host was read to hold: for the handover at each index, the
 * outgoing writer's pending count, if its backlog was read; and other writers of the same streams,
 * read first, with their own counts.
 */
const Upgrade = S.Struct({ scene: Scene, reads: S.Array(S.Option(Count)), others: S.Array(S.Struct({ extra: Name, pending: Count })) });
type Upgrade = typeof Upgrade.Type;

const backlogOf = ({ scene, reads, others }: Upgrade) => {
  const handovers = expectedOf(scene);
  const outgoing = A.getSomes(
    A.map(handovers, (handover, index) =>
      O.map(O.flatten(A.get(reads, index)), (pending) => PublisherBacklog.make({ stream: handover.stream, writer: handover.writer.projection, pending })),
    ),
  );
  // Another writer of the stream: never the outgoing writer, whatever it has pending.
  const otherWriters = A.flatMap(handovers, (handover) =>
    A.map(others, ({ extra, pending }) => PublisherBacklog.make({ stream: handover.stream, writer: `${handover.writer.projection}${extra}`, pending })),
  );
  return { handovers, backlog: [...otherWriters, ...outgoing] };
};


it.effect.prop("the upgrade passes with its handovers only once every outgoing writer was read and has nothing pending", [Upgrade], ([upgrade]) =>
  Effect.gen(function* () {
    const { handovers, backlog } = backlogOf(upgrade);
    const readOf = (index: number) => O.flatten(A.get(upgrade.reads, index));
    const unread = A.filter(handovers, (_, index) => O.isNone(readOf(index)));
    const pending = A.getSomes(
      A.map(handovers, (handover, index) => O.map(O.filter(readOf(index), (count) => count > 0), (count) => ({ handover, pending: count }))),
    );
    const outcome = yield* Effect.result(checkPublisherHandover({ ...pinsOf(upgrade.scene), backlog }));
    expect(Result.mapError(outcome, (refusal) => ({ pending: refusal.pending, unread: refusal.unread }))).toEqual(
      A.isReadonlyArrayEmpty(unread) && A.isReadonlyArrayEmpty(pending) ? Result.succeed(handovers) : Result.fail({ pending, unread }),
    );
  }),
);

it.effect.prop("for any pins and backlog, each handover is exactly one of unread, pending or drained", [S.Array(StreamPin), S.Array(StreamPin), S.Array(PublisherBacklog)], ([current, next, backlog]) =>
  Effect.gen(function* () {
    const handovers = handoversOf({ current, next });
    const outcome = yield* Effect.result(checkPublisherHandover({ current, next, backlog }));
    const unread = Result.match(outcome, { onSuccess: A.empty<Handover>, onFailure: (refusal) => refusal.unread });
    const pending = Result.match(outcome, { onSuccess: A.empty<Handover>, onFailure: (refusal) => A.map(refusal.pending, (entry) => entry.handover) });
    const drained = A.filter(handovers, (handover) =>
      A.some(backlog, (entry) => entry.stream === handover.stream && entry.writer === handover.writer.projection) &&
      !A.contains(pending, handover),
    );
    expect(A.length(unread) + A.length(pending) + A.length(drained)).toBe(A.length(handovers));
    expect(A.every(handovers, (handover) => A.contains(unread, handover) || A.contains(pending, handover) || A.contains(drained, handover))).toBe(true);
  }),
);
