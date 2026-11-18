import { expect, it } from "@effect/vitest";
import { DeploymentDescriptor } from "@proto/kernel/Deployment";
import { FactId } from "@proto/kernel/Ids";
import { Count, Name, Sequence } from "@proto/kernel/Measure";
import { type GenerationEntry, type LiveGeneration, StreamPin } from "@proto/kernel/PublishedStream";
import { checkGenerationRetirement, type ConsumerCheckpoint, FeedRef, Retirement, RetirementRefusal } from "@proto/tooling/GenerationRetirement";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as N from "effect/Number";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Writer, writerOf } from "./Writer.ts";

// Phase 11 (D51): a closed generation stops being served only when the retirement check approves the
// pin change against the live host.
// Every value below is generated from a schema. A scene is a feed whose closed generation is
// retired the right way: its successor holds every fact it held, every consumer has read past it,
// no pin moves and every version consumed is published. Each law then breaks one condition, and
// the refusal it names is known from the scene.

/** A fact a generation holds: its id, its version and the outcome its payload carries. */
const Fact = S.Struct({ id: FactId, version: Sequence, outcome: Name });
type Fact = typeof Fact.Type;
/** A consumer of the feed: its context, the published version it consumes (by index), and how far past the retiring generation it has read. */
const Consumer = S.Struct({ context: Name, version: Count, lead: Count });

const Scene = S.Struct({
  feed: FeedRef,
  /** The feed's streams are this name with the generation's number: `<stream>1`, `<stream>2`, ... */
  stream: Name,
  /** The generations before the retiring one: what each held, and whether it is retired already. */
  earlier: S.Array(S.Struct({ facts: S.Array(Fact), retired: S.Boolean })),
  retiring: S.NonEmptyArray(Fact),
  /** What the successor holds after republishing the retiring generation's facts. */
  successor: S.Array(Fact),
  /** The writer of the successor, the open generation. */
  writer: Writer,
  publisher: Name,
  versions: S.NonEmptyArray(Sequence),
  consumers: S.NonEmptyArray(Consumer),
  /** What the platform needs of each descriptor, beside its context and its facts. */
  base: DeploymentDescriptor,
});
type Scene = typeof Scene.Type;

/** A generation holds a fact version once. */
const sameFact = (a: Fact, b: Fact) => a.id === b.id && a.version === b.version;
const distinct = (facts: ReadonlyArray<Fact>) => A.dedupeWith(facts, sameFact);
const entriesOf = (facts: ReadonlyArray<Fact>): ReadonlyArray<GenerationEntry> =>
  A.map(facts, (fact, index) => ({ position: index + 1, factId: fact.id, version: fact.version, payload: { fact: fact.id, version: fact.version, outcome: fact.outcome } }));
const generationOf = (stream: string, facts: ReadonlyArray<Fact>): LiveGeneration => ({ stream, entries: entriesOf(facts) });

/** The feed, its pins before and after the change, the descriptors, what the live host holds, and what the check should approve. */
const planOf = (scene: Scene) => {
  const name = (index: number) => `${scene.stream}${index + 1}`;
  const earlier = A.map(scene.earlier, ({ facts, retired }, index) => ({ stream: name(index), facts: distinct(facts), retired }));
  const at = A.length(earlier);
  const retiring = { stream: name(at), facts: A.dedupeWith(scene.retiring, sameFact) };
  const successor = { stream: name(at + 1), facts: distinct([...retiring.facts, ...scene.successor]) };
  const length = A.length(retiring.facts);
  const from = A.reduce(earlier, 0, (sum, generation) => sum + A.length(generation.facts));
  const through = from + length;
  const writer = writerOf(scene.writer);
  const earlierPins = A.map(earlier, ({ stream, facts, retired }) =>
    retired ? StreamPin.cases.Retired.make({ stream, length: A.length(facts) }) : StreamPin.cases.Closed.make({ stream }),
  );
  const open = StreamPin.cases.Open.make({ stream: successor.stream, writer });
  const versions = A.dedupe(scene.versions);
  const consumers = A.dedupeWith(scene.consumers, (a, b) => a.context === b.context);
  const fact = (version: number) => ({ ...scene.feed, version });
  const descriptor = (context: string, facts: { readonly publishes: ReadonlyArray<number>; readonly consumes: ReadonlyArray<number> }) =>
    DeploymentDescriptor.make({ ...scene.base, context, publishes: A.map(facts.publishes, fact), consumes: A.map(facts.consumes, fact) });
  const consumed = (index: number) => versions[index % versions.length] ?? versions[0];
  return {
    feed: scene.feed,
    current: [...earlierPins, StreamPin.cases.Closed.make({ stream: retiring.stream }), open],
    next: [...earlierPins, StreamPin.cases.Retired.make({ stream: retiring.stream, length }), open],
    descriptors: [
      descriptor(scene.publisher, { publishes: versions, consumes: [] }),
      ...A.map(consumers, ({ context, version }) => descriptor(context, { publishes: [], consumes: [consumed(version)] })),
    ],
    generations: A.append(
      [
        ...A.map(A.filter(earlier, (generation) => !generation.retired), ({ stream, facts }) => generationOf(stream, facts)),
        generationOf(retiring.stream, retiring.facts),
      ],
      generationOf(successor.stream, successor.facts),
    ),
    checkpoints: A.map(consumers, ({ context, lead }): ConsumerCheckpoint => ({ consumer: context, position: through + lead })),
    // What the laws break the plan with.
    scene: { at, retiring, successor, consumers, versions, from, through, length, writer, fact, descriptor },
  };
};
type Plan = ReturnType<typeof planOf>;

/** What the check answers for the plan: its approvals, or the refusals it names. */
const check = ({ feed, current, next, descriptors, generations, checkpoints }: Parameters<typeof checkGenerationRetirement>[0]) =>
  Effect.map(
    Effect.result(checkGenerationRetirement({ feed, current, next, descriptors, generations, checkpoints })),
    Result.mapError((refused) => refused.refusals),
  );
const refused = (...refusals: ReadonlyArray<RetirementRefusal>) => Result.fail(refusals);

/** The plan with the successor's generation built from `facts`. */
const withSuccessor = (plan: Plan, facts: ReadonlyArray<Fact>): Plan => ({
  ...plan,
  generations: A.map(plan.generations, (generation) =>
    generation.stream === plan.scene.successor.stream ? generationOf(generation.stream, facts) : generation,
  ),
});
const pick = <A>(values: A.NonEmptyReadonlyArray<A>, index: number): A => values[index % values.length] ?? A.headNonEmpty(values);

it.effect.prop("allowed when the next generation holds every fact, every consumer has read past it, no pin moves and D34 allows it", [Scene], ([scene]) =>
  Effect.gen(function* () {
    const plan = planOf(scene);
    const { retiring, from, through } = plan.scene;
    const outcome = yield* check(plan);
    expect(outcome).toEqual(Result.succeed([Retirement.make({ stream: retiring.stream, from, through })]));
  }),
);

it.effect.prop("the order in which the generations and the checkpoints were read does not matter", [Scene], ([scene]) =>
  Effect.gen(function* () {
    const plan = planOf(scene);
    const inOrder = yield* check(plan);
    const reversed = yield* check({ ...plan, generations: A.reverse(plan.generations), checkpoints: A.reverse(plan.checkpoints) });
    expect(reversed).toEqual(inOrder);
  }),
);

it.effect.prop("a change that only appends pins retires nothing and is approved, whatever was read", [Scene, S.Array(Writer), S.Array(S.Boolean)], ([scene, added, read]) =>
  Effect.gen(function* () {
    const plan = planOf(scene);
    const appended = A.map(added, (writer, index) =>
      StreamPin.cases.Open.make({ stream: `${scene.stream}${plan.scene.at + 3 + index}`, writer: writerOf(writer) }),
    );
    const generations = A.filter(plan.generations, (_, index) => O.getOrElse(A.get(read, index), () => false));
    const outcome = yield* check({ ...plan, next: [...plan.current, ...appended], generations });
    expect(outcome).toEqual(Result.succeed([]));
  }),
);

it.effect.prop("refused when a consumer is behind the last position the generation held", [Scene, Count, Count], ([scene, which, lag]) =>
  Effect.gen(function* () {
    const plan = planOf(scene);
    const { retiring, consumers, through } = plan.scene;
    const consumer = pick(consumers, which).context;
    const checkpoint = through - 1 - (lag % through);
    const behind = A.map(plan.checkpoints, (entry) => (entry.consumer === consumer ? { consumer, position: checkpoint } : entry));
    const outcome = yield* check({ ...plan, checkpoints: behind });
    expect(outcome).toEqual(
      refused(RetirementRefusal.cases.ConsumerBehind.make({ stream: retiring.stream, consumer, checkpoint, through })),
    );
  }),
);

it.effect.prop("refused when a consumer's checkpoint was not read", [Scene, Count], ([scene, which]) =>
  Effect.gen(function* () {
    const plan = planOf(scene);
    const consumer = pick(plan.scene.consumers, which).context;
    const outcome = yield* check({ ...plan, checkpoints: A.filter(plan.checkpoints, (entry) => entry.consumer !== consumer) });
    expect(outcome).toEqual(
      refused(RetirementRefusal.cases.CheckpointUnread.make({ stream: plan.scene.retiring.stream, consumer })),
    );
  }),
);

it.effect.prop("refused when the next generation lacks a fact the retiring one held", [Scene, Count], ([scene, which]) =>
  Effect.gen(function* () {
    const plan = planOf(scene);
    const { retiring, successor } = plan.scene;
    const lacked = pick(retiring.facts, which);
    const lacking = A.filter(successor.facts, (fact) => fact.id !== lacked.id || fact.version !== lacked.version);
    const outcome = yield* check(withSuccessor(plan, lacking));
    expect(outcome).toEqual(
      refused(RetirementRefusal.cases.FactMissing.make({ stream: retiring.stream, successor: successor.stream, factId: lacked.id, version: lacked.version })),
    );
  }),
);

it.effect.prop("refused when the next generation holds a fact with a different payload", [Scene, Count, Name], ([scene, which, extra]) =>
  Effect.gen(function* () {
    const plan = planOf(scene);
    const { retiring, successor } = plan.scene;
    const changed = pick(retiring.facts, which);
    const differing = A.map(successor.facts, (fact) =>
      fact.id === changed.id && fact.version === changed.version ? { ...fact, outcome: `${fact.outcome}${extra}` } : fact,
    );
    const outcome = yield* check(withSuccessor(plan, differing));
    expect(outcome).toEqual(
      refused(RetirementRefusal.cases.PayloadDiffers.make({ stream: retiring.stream, successor: successor.stream, factId: changed.id, version: changed.version })),
    );
  }),
);

it.effect.prop("refused when the retired pin's length is not what the generation held, so later positions would move", [Scene, S.Boolean, Count], ([scene, longer, by]) =>
  Effect.gen(function* () {
    const plan = planOf(scene);
    const { at, retiring, from, length } = plan.scene;
    const pinned = longer ? length + 1 + by : length - 1 - (by % length);
    // Every consumer has read past what the pin says the generation held.
    const checkpoints = A.map(plan.scene.consumers, ({ context, lead }) => ({ consumer: context, position: from + pinned + lead }));
    const next = A.map(plan.next, (pin, index) => (index === at ? StreamPin.cases.Retired.make({ stream: retiring.stream, length: pinned }) : pin));
    const outcome = yield* check({ ...plan, next, checkpoints });
    expect(outcome).toEqual(
      refused(RetirementRefusal.cases.LengthDiffers.make({ stream: retiring.stream, pinned, live: length })),
    );
  }),
);

it.effect.prop("refused when a pin is dropped or the pins are reordered", [Scene, S.Option(Count)], ([scene, dropped]) =>
  Effect.gen(function* () {
    const plan = planOf(scene);
    const next = O.match(dropped, {
      onNone: () => A.reverse(plan.current),
      onSome: (index) => A.remove(plan.current, index % A.length(plan.current)),
    });
    const streams = (pins: ReadonlyArray<StreamPin>) => A.map(pins, (pin) => pin.stream);
    const outcome = yield* check({ ...plan, next });
    expect(outcome).toEqual(
      refused(RetirementRefusal.cases.PinsMoved.make({ current: streams(plan.current), next: streams(next) })),
    );
  }),
);

it.effect.prop("refused when the generation is not closed", [Scene], ([scene]) =>
  Effect.gen(function* () {
    const plan = planOf(scene);
    const { at, retiring, writer } = plan.scene;
    const current = A.map(plan.current, (pin, index) => (index === at ? StreamPin.cases.Open.make({ stream: retiring.stream, writer }) : pin));
    const outcome = yield* check({ ...plan, current });
    expect(outcome).toEqual(refused(RetirementRefusal.cases.NotClosed.make({ stream: retiring.stream })));
  }),
);

it.effect.prop("refused when D34 refuses: a consumer needs a version nobody publishes", [Scene, Count, Sequence], ([scene, which, beyond]) =>
  Effect.gen(function* () {
    const plan = planOf(scene);
    const { consumers, versions, fact, descriptor } = plan.scene;
    const at = which % A.length(consumers);
    const consumer = pick(consumers, at);
    const unpublished = A.reduce(versions, 0, N.max) + beyond;
    // The consumer's descriptor follows the publisher's, in the consumers' order.
    const descriptors = A.map(plan.descriptors, (entry, index) =>
      index === at + 1 ? descriptor(entry.context, { publishes: [], consumes: [...A.map(entry.consumes, (held) => held.version), unpublished] }) : entry,
    );
    const outcome = yield* check({ ...plan, descriptors });
    expect(outcome).toEqual(
      refused(RetirementRefusal.cases.VersionUnpublished.make({ consumer: consumer.context, fact: fact(unpublished) })),
    );
  }),
);

it.effect.prop("a generation not read cannot be retired, and nothing after one not read can be placed", [Scene, Count], ([scene, which]) =>
  Effect.gen(function* () {
    const plan = planOf(scene);
    const unread = pick(plan.generations, which);
    const outcome = yield* check({ ...plan, generations: A.filter(plan.generations, (generation) => generation.stream !== unread.stream) });
    expect(outcome).toEqual(
      refused(RetirementRefusal.cases.Unread.make({ stream: unread.stream })),
    );
  }),
);
