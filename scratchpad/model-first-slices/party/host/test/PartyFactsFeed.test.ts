import { expect, it } from "@effect/vitest";
import { type FactEnvelope, inboxKey } from "@proto/kernel/Fact";
import { OrgId, RunId } from "@proto/kernel/Ids";
import { Count, Sequence } from "@proto/kernel/Measure";
import { ApprovalId } from "@proto/party-contract/Claim/Approval.id";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimDecided, ClaimDecidedV1, ClaimDecidedV2, Decision } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { PartyFactsFeed } from "@proto/party-contract/Facts/PartyFacts.gateway";
import { StreamPin } from "@proto/kernel/PublishedStream";
import { liveGenerationOf, partyFactsFeedFor, PartyFactsFeedLive } from "@proto/party-host/Facts/PartyFactsFeed.adapter";
import { PartyDeployment } from "@proto/party-host/Party.descriptor";
import { PartyFacts } from "@proto/party-model/Facts/PartyFacts.stream";
import { PartyFacts2 } from "@proto/party-model/Facts/PartyFacts2.stream";
import { partyStreamPins } from "@proto/party-model/Facts/StreamPins";
import { RunsDeployment } from "@proto/runs-host/Runs.descriptor";
import { checkGenerationRetirement } from "@proto/tooling/GenerationRetirement";
import * as A from "@beep/utils/Array";
import * as N from "@beep/utils/Number";
import * as O from "@beep/utils/Option";
import { thunkEffectVoid } from "@beep/utils/thunk";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

// Phase 9 (D43): the feed serves the closed generation, then generation 2 after it, and generation 2
// republishes what generation 1 holds under the same fact ids. Every claim and decision below is
// generated; the two generations are built from a scene the way Party writes them, so every
// position is known by construction. 100 runs each (the `effect/Arbitrary` default): a run builds
// the feed over in-memory pages, a few milliseconds.

type Fact = ClaimDecidedV1 | ClaimDecidedV2;

/** One decided claim: how it was decided, by whom approved if anyone, and the review runs involved. */
const Decided = S.Struct({
  claim: ClaimId,
  org: OrgId,
  decision: Decision,
  approval: S.Option(ApprovalId),
  reviewRuns: S.Array(RunId),
});
type Decided = typeof Decided.Type;

/**
 * Both generations: the claims decided while generation 1 was open (it holds their facts, and
 * generation 2 republishes them at its head), then the claims decided after (generation 2 only).
 * Each claim is decided once.
 */
const Generations = S.Struct({ before: S.Array(Decided), after: S.Array(Decided) }).check(
  S.makeFilter(
    ({ before, after }) => {
      const claims = A.map([...before, ...after], (decided) => decided.claim);
      return A.length(A.dedupe(claims)) === A.length(claims);
    },
    {
      identifier: "GenerationsCheck",
      title: "Each claim decided once",
      description: "No claim is decided twice across the two generations.",
      message: "Expected each claim to be decided once",
    },
  ),
);
type Generations = typeof Generations.Type;

/** The facts Party publishes for one decision, version 1 then version 2, under one fact id (`ClaimDecisions`). */
const factsOf = ({ claim, org, decision, approval, reviewRuns }: Decided): ReadonlyArray<Fact> => {
  const common = { factId: `${claim}:decided`, claim, org, reviewRuns };
  return [
    ClaimDecidedV1.make({ ...common, outcome: decision }),
    ClaimDecidedV2.make({ ...common, decision, basis: O.isSome(approval) ? "approval" : "direct", approval }),
  ];
};

const closedOf = ({ before }: Generations) => A.flatMap(before, factsOf);
const openOf = (generations: Generations) => A.appendAll(closedOf(generations), A.flatMap(generations.after, factsOf));
/** How many fact versions the two generations hold between them: each decided claim's two. */
const versionsOf = ({ before, after }: Generations) => 2 * (A.length(before) + A.length(after));

const isVersion1 = S.is(ClaimDecidedV1);
const versionOf = (fact: Fact) => (isVersion1(fact) ? 1 : 2);
/** What a consumer's inbox keys a fact by, for a fact as Party stores it. */
const keyOf = (fact: Fact) => inboxKey({ producer: ClaimDecided.producer, factId: fact.factId, version: versionOf(fact) });

/** A stream host over fixed entries: what the feed reads of a generation. */
const host = (stream: string, facts: ReadonlyArray<Fact>) => {
  const entries = A.map(facts, (event, i) => ({
    event,
    envelope: {
      id: "claims" as const,
      stream: `${stream}/claims`,
      seq: i + 1,
      at: DateTime.makeUnsafe(0),
      commandId: `c${i + 1}`,
      correlationId: `c${i + 1}`,
    },
  }));
  return {
    peek: () => Effect.succeed(A.last(entries)),
    watch: () => Stream.empty,
    events: () => Stream.empty,
    list: (_: "claims", options?: { readonly after?: number; readonly take?: number }) =>
      Effect.succeed({
        entries: pipe(
          entries,
          A.filter((entry) => entry.envelope.seq > (options?.after ?? 0)),
          A.take(options?.take ?? A.length(entries)),
        ),
        cursor: null,
      }),
    append: thunkEffectVoid,
  };
};

const feedOver = (closed: ReadonlyArray<Fact>, open: ReadonlyArray<Fact>, feed = PartyFactsFeedLive) =>
  feed.pipe(
    Layer.provide(Layer.succeed(PartyFacts, host("PartyFacts", closed))),
    Layer.provide(Layer.succeed(PartyFacts2, host("PartyFacts2", open))),
  );

/** The feed over two generations, built in the test's scope. */
const feedOf = (closed: ReadonlyArray<Fact>, open: ReadonlyArray<Fact>, feed = PartyFactsFeedLive) =>
  Effect.map(Layer.build(feedOver(closed, open, feed)), Context.get(PartyFactsFeed));

/** The positions of a page. */
const positions = (page: ReadonlyArray<FactEnvelope>) => A.map(page, (fact) => fact.seq);

/** The positions `from` through `through`, none when `through` comes first. */
const positionsFrom = (from: number, through: number) => (through < from ? A.empty<number>() : A.range(from, through));

/** Each served fact version's inbox key, once. */
const keysOf = (page: ReadonlyArray<FactEnvelope>) => HashSet.fromIterable(A.map(page, inboxKey));

/** Every position the feed serves, read one fact at a time from `after`. */
const oneByOne = (feed: PartyFactsFeed["Service"], after: number, seen: ReadonlyArray<number>): Effect.Effect<ReadonlyArray<number>> =>
  Effect.flatMap(feed.read({ after, take: 1 }), (page) =>
    O.match(A.head(page), {
      onNone: () => Effect.succeed(seen),
      onSome: (fact) => oneByOne(feed, fact.seq, A.append(seen, fact.seq)),
    }),
  );

/** A page request: where it starts, as an offset into the feed or just past it, and its size. */
const Page = S.Struct({ offset: Count, take: Sequence });

it.effect.prop(
  "generation 2 follows the closed generation; every position is served once, in order, by any page size",
  [Generations, Page],
  ([generations, { offset, take }]) =>
    Effect.gen(function* () {
      const closed = closedOf(generations);
      const open = openOf(generations);
      const total = A.length(closed) + A.length(open);
      const feed = yield* feedOf(closed, open);
      const all = yield* feed.read({ after: 0, take: total + 1 });
      expect(positions(all)).toEqual(positionsFrom(1, total));
      expect(A.map(all, inboxKey)).toEqual(A.map([...closed, ...open], keyOf));
      // A page from anywhere, straddling the boundary or inside either generation, or past the end.
      const after = offset % (total + 2);
      const page = yield* feed.read({ after, take });
      expect(positions(page)).toEqual(positionsFrom(after + 1, N.min(after + take, total)));
      // One fact at a time, as a slow consumer reads: the same positions, once each.
      const slow = yield* oneByOne(feed, 0, []);
      expect(slow).toEqual(positionsFrom(1, total));
      // What the consumer's inbox keeps (producer, fact id, version): each fact version once.
      expect(HashSet.size(keysOf(all))).toBe(versionsOf(generations));
    }),
);

it.effect.prop("with nothing in the closed generation, generation 2's positions are its own", [Generations], ([generations]) =>
  Effect.gen(function* () {
    const open = A.flatMap(generations.after, factsOf);
    const feed = yield* feedOf([], open);
    const all = yield* feed.read({ after: 0, take: A.length(open) + 1 });
    expect(positions(all)).toEqual(positionsFrom(1, A.length(open)));
  }),
);

// Phase 11 (D51): generation 1 stops being served only when the retirement check approves it.
it.effect.prop(
  "after an allowed retirement, checkpoints keep their positions and no fact is delivered twice or missed",
  [Generations, Count],
  ([generations, offset]) =>
    Effect.gen(function* () {
      const closed = closedOf(generations);
      const open = openOf(generations);
      const closedLength = A.length(closed);
      const total = closedLength + A.length(open);
      // The consumer's checkpoint: anywhere at or past the closed generation, as the check requires.
      const checkpoint = closedLength + (offset % (A.length(open) + 1));
      const served = yield* feedOf(closed, open);
      // What the live host holds, read as the check reads it.
      const live = [
        yield* liveGenerationOf("PartyFacts")(host("PartyFacts", closed)),
        yield* liveGenerationOf("PartyFacts2")(host("PartyFacts2", open)),
      ];
      const next = [StreamPin.cases.Retired.make({ stream: "PartyFacts", length: closedLength }), ...A.drop(partyStreamPins, 1)];
      const approved = yield* checkGenerationRetirement({
        feed: { producer: ClaimDecided.producer, contract: ClaimDecided.contract },
        current: partyStreamPins,
        next,
        descriptors: [PartyDeployment, RunsDeployment],
        generations: live,
        checkpoints: [{ consumer: RunsDeployment.context, position: checkpoint }],
      });
      expect(approved).toEqual([{ stream: "PartyFacts", from: 0, through: closedLength }]);
      const retired = yield* feedOf(closed, open, partyFactsFeedFor(next));
      // Every checkpoint at or past the retired generation reads exactly what it read before.
      const pages = (feed: PartyFactsFeed["Service"]) =>
        Effect.forEach(positionsFrom(closedLength, total), (after) => feed.read({ after, take: total }), { concurrency: 1 });
      const servedPages = yield* pages(served);
      const retiredPages = yield* pages(retired);
      expect(retiredPages).toEqual(servedPages);
      // The consumer goes on from its checkpoint, and misses nothing. What it is served again is
      // only generation 2's republished head (which its inbox keeps once), never a fact decided later.
      const before = yield* served.read({ after: 0, take: checkpoint });
      const after = yield* retired.read({ after: checkpoint, take: total + 1 });
      expect(positions(after)).toEqual(positionsFrom(checkpoint + 1, total));
      const handled = keysOf(before);
      expect(positions(A.filter(after, (fact) => HashSet.has(handled, inboxKey(fact))))).toEqual(
        positionsFrom(checkpoint + 1, 2 * closedLength),
      );
      expect(HashSet.size(HashSet.union(handled, keysOf(after)))).toBe(versionsOf(generations));
      // A consumer starting now reads every fact version once, at generation 2's old positions.
      const fresh = yield* retired.read({ after: 0, take: total + 1 });
      expect(positions(fresh)).toEqual(positionsFrom(closedLength + 1, total));
      expect(HashSet.size(keysOf(fresh))).toBe(versionsOf(generations));
      const slow = yield* oneByOne(retired, 0, []);
      expect(slow).toEqual(positionsFrom(closedLength + 1, total));
    }),
);
