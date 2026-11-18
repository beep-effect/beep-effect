import { expect, it } from "@effect/vitest";
import { type FactEnvelope, inboxKey } from "@proto/kernel/Fact";
import { OrgId, RunId } from "@proto/kernel/Ids";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimDecidedV1, ClaimDecidedV2 } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { PartyFactsFeed } from "@proto/party-contract/Facts/PartyFacts.gateway";
import { StreamPin } from "@proto/kernel/PublishedStream";
import { liveGenerationOf, partyFactsFeedFor, PartyFactsFeedLive } from "@proto/party-host/Facts/PartyFactsFeed.adapter";
import { PartyDeployment } from "@proto/party-host/Party.descriptor";
import { PartyFacts } from "@proto/party-model/Facts/PartyFacts.stream";
import { PartyFacts2 } from "@proto/party-model/Facts/PartyFacts2.stream";
import { partyStreamPins } from "@proto/party-model/Facts/StreamPins";
import { RunsDeployment } from "@proto/runs-host/Runs.descriptor";
import { checkGenerationRetirement } from "@proto/tooling/GenerationRetirement";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import { thunkEffectVoid } from "@beep/utils"

// Phase 9 (D43): the feed serves the closed generation, then generation 2 after it, and generation 2
// republishes what generation 1 holds under the same fact ids.

type Fact = ClaimDecidedV1 | ClaimDecidedV2;

const decided = (claim: string): ReadonlyArray<Fact> => {
  const common = {
    factId: `${claim}:decided`,
    claim: ClaimId.make(claim),
    org: OrgId.make("org_acme"),
    reviewRuns: [RunId.make(`review:${claim}:1`)],
  };
  return [
    ClaimDecidedV1.make({ ...common, outcome: "accepted" }),
    ClaimDecidedV2.make({ ...common, decision: "accepted", basis: "direct", approval: O.none() }),
  ];
};

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

/** Every position the feed serves, read one fact at a time from `after`. */
const oneByOne = (feed: PartyFactsFeed["Service"], after: number, seen: ReadonlyArray<number>): Effect.Effect<ReadonlyArray<number>> =>
  Effect.flatMap(feed.read({ after, take: 1 }), (page) =>
    O.match(A.head(page), {
      onNone: () => Effect.succeed(seen),
      onSome: (fact) => oneByOne(feed, fact.seq, A.append(seen, fact.seq)),
    }),
  );

it.effect("generation 2 follows the closed generation; every position is served once, in order, by any page size", () =>
  Effect.gen(function* () {
    const feed = yield* feedOf(decided("a"), [...decided("a"), ...decided("b")]);
    const all = yield* feed.read({ after: 0, take: 50 });
    expect(positions(all)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(A.map(all, (fact) => `${fact.factId}:v${fact.version}`)).toEqual([
      "a:decided:v1",
      "a:decided:v2",
      "a:decided:v1",
      "a:decided:v2",
      "b:decided:v1",
      "b:decided:v2",
    ]);
    // A page that straddles the boundary, and pages that start inside generation 2.
    const straddling = yield* feed.read({ after: 1, take: 2 });
    const second = yield* feed.read({ after: 2, take: 50 });
    const last = yield* feed.read({ after: 5, take: 50 });
    const past = yield* feed.read({ after: 6, take: 50 });
    expect(positions(straddling)).toEqual([2, 3]);
    expect(positions(second)).toEqual([3, 4, 5, 6]);
    expect(positions(last)).toEqual([6]);
    expect(past).toEqual([]);
    // One fact at a time, as a slow consumer reads: the same six, once each.
    const slow = yield* oneByOne(feed, 0, []);
    expect(slow).toEqual([1, 2, 3, 4, 5, 6]);
    // What the consumer's inbox keeps (producer, fact id, version): each fact version once.
    expect(HashSet.size(HashSet.fromIterable(A.map(all, inboxKey)))).toBe(4);
  }),
);

it.effect("with nothing in the closed generation, generation 2's positions are its own", () =>
  Effect.gen(function* () {
    const feed = yield* feedOf([], decided("a"));
    const all = yield* feed.read({ after: 0, take: 50 });
    expect(positions(all)).toEqual([1, 2]);
  }),
);

// Phase 11 (D51): generation 1 stops being served only when the retirement check approves it.
it.effect("after an allowed retirement, checkpoints keep their positions and no fact is delivered twice or missed", () =>
  Effect.gen(function* () {
    const closedFacts = decided("a");
    const openFacts = [...decided("a"), ...decided("b")];
    const served = yield* feedOf(closedFacts, openFacts);
    // What the live host holds, read as the check reads it, and the consumer's checkpoint: Runs has
    // read through claim a's republished decision (position 4), not claim b's.
    const generations = [
      yield* liveGenerationOf("PartyFacts")(host("PartyFacts", closedFacts)),
      yield* liveGenerationOf("PartyFacts2")(host("PartyFacts2", openFacts)),
    ];
    const next = [StreamPin.cases.Retired.make({ stream: "PartyFacts", length: 2 }), ...A.drop(partyStreamPins, 1)];
    const approved = yield* checkGenerationRetirement({
      feed: { producer: "party", contract: "ClaimDecided" },
      current: partyStreamPins,
      next,
      descriptors: [PartyDeployment, RunsDeployment],
      generations,
      checkpoints: [{ consumer: "runs", position: 4 }],
    });
    expect(approved).toEqual([{ stream: "PartyFacts", from: 0, through: 2 }]);
    const retired = yield* feedOf(closedFacts, openFacts, partyFactsFeedFor(next));
    // Every checkpoint at or past the retired generation reads exactly what it read before.
    const pages = (feed: PartyFactsFeed["Service"]) => Effect.forEach([2, 3, 4, 5, 6], (after) => feed.read({ after, take: 50 }), { concurrency: 1 });
    const servedPages = yield* pages(served);
    const retiredPages = yield* pages(retired);
    expect(retiredPages).toEqual(servedPages);
    // The consumer goes on from its checkpoint: claim b's two versions, nothing it had already handled.
    const before = yield* served.read({ after: 0, take: 4 });
    const after = yield* retired.read({ after: 4, take: 50 });
    expect(positions(after)).toEqual([5, 6]);
    const handled = HashSet.fromIterable(A.map(before, inboxKey));
    expect(A.filter(after, (fact) => HashSet.has(handled, inboxKey(fact)))).toEqual([]);
    expect(HashSet.size(HashSet.union(handled, HashSet.fromIterable(A.map(after, inboxKey))))).toBe(4);
    // A consumer starting now reads every fact version once, at generation 2's old positions.
    const fresh = yield* retired.read({ after: 0, take: 50 });
    expect(positions(fresh)).toEqual([3, 4, 5, 6]);
    expect(HashSet.size(HashSet.fromIterable(A.map(fresh, inboxKey)))).toBe(4);
    const slow = yield* oneByOne(retired, 0, []);
    expect(slow).toEqual([3, 4, 5, 6]);
  }),
);
