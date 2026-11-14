import * as InMemory from "@alchemy.run/domain/InMemory";
import { expect, it } from "@effect/vitest";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import type { Invocation } from "@proto/kernel/Invocation";
import { ReadmissionRefused } from "@proto/kernel/ReadmissionRefused.rejection";
import { AcceptClaim } from "@proto/party-contract/Claim/AcceptClaim.command";
import { AssertClaim } from "@proto/party-contract/Claim/AssertClaim.command";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { PartyIntake, PartyReview } from "@proto/party-contract/Party.capabilities";
import { MergeParties } from "@proto/party-contract/Party/MergeParties.command";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { RegisterParty } from "@proto/party-contract/Party/RegisterParty.command";
import { Proposition } from "@proto/party-contract/Proposition";
import { Authority } from "@proto/party-model/Authority.external";
import { Claim } from "@proto/party-model/Claim/Claim.aggregate";
import { partyDirectoryLive } from "@proto/party-model/Directory/PartyDirectory.handler";
import { MemoryPartyDirectoryStore, PartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { switchWhenCaughtUp } from "@proto/party-model/Directory/RebuildDirectory";
import { ContactSource, MailboxUnavailable } from "@proto/party-model/Evidence/ContactSource.external";
import { PartyFacts } from "@proto/party-model/Facts/PartyFacts.stream";
import { PartyHandlers } from "@proto/party-model/Party.handlers";
import { PartyModel } from "@proto/party-model/Party.model";
import { Party } from "@proto/party-model/Party/Party.aggregate";
import { Reasoner, ReasonerUnavailable } from "@proto/party-model/Review/Reasoner.external";
import { ReviewRuns, RunRefused } from "@proto/party-model/Review/ReviewRuns.external";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import { acme, human, onOrg, twoSources } from "./fixtures.ts";

const intake = human("p_intake", [onOrg("g_intake", PartyIntake, acme)]);
const reviewer = human("p_rev", [onOrg("g_rev", PartyReview, acme)]);
const as = (invocation: Invocation) => Effect.provideService(CurrentInvocation, invocation);
const partyA = PartyId.make("party_a");
const partyB = PartyId.make("party_b");
const page = { after: undefined, take: 10 };

/** Every port refuses, and counts the call: a rebuild must make none. */
const countingPorts = (calls: Ref.Ref<number>) => {
  const refuse = <E>(error: E) => Effect.andThen(Ref.update(calls, (n) => n + 1), Effect.fail(error));
  const refused = RunRefused.make({ reason: "test" });
  return Layer.mergeAll(
    Authority.toLayer(Effect.succeed({ readmit: () => refuse(ReadmissionRefused.make({ reason: "lapsed", lapsed: [] })) })),
    ReviewRuns.toLayer(
      Effect.succeed({
        open: () => refuse(refused),
        reserve: () => refuse(refused),
        settle: () => refuse(refused),
        release: () => refuse(refused),
        step: () => refuse(refused),
        awaitApproval: () => refuse(refused),
        exhaust: () => refuse(refused),
        refuse: () => refuse(refused),
      }),
    ),
    Reasoner.toLayer(Effect.succeed({ assess: () => refuse(ReasonerUnavailable.make({ reason: "test" })) })),
    ContactSource.toLayer(Effect.succeed({ observe: () => refuse(MailboxUnavailable.make({ mailbox: "test" })) })),
  );
};

/** The Party model on a platform, writing directory generation `generation`, over a store built elsewhere. */
const deploy = (
  platform: ReturnType<typeof InMemory.make>,
  generation: number,
  store: Layer.Layer<PartyDirectoryStore>,
  calls: Ref.Ref<number>,
) =>
  PartyModel.layer(Layer.merge(PartyHandlers, partyDirectoryLive(generation))).pipe(
    Layer.provide(Layer.mergeAll(platform.layer, countingPorts(calls), store)),
  );

const until = <A, E, R>(read: Effect.Effect<A, E, R>, done: (a: A) => boolean) =>
  read.pipe(Effect.repeat({ schedule: Schedule.spaced("25 millis"), until: done, times: 400 }));

/** Two parties, one merged into the other, and a claim asserted (its review refused) and accepted. */
const history = Effect.gen(function* () {
  const parties = yield* Party;
  const claims = yield* Claim;
  yield* as(intake)(parties.send(partyA, RegisterParty.make({ org: acme, name: "Dana A" })));
  yield* as(intake)(parties.send(partyB, RegisterParty.make({ org: acme, name: "Dana B" })));
  yield* as(reviewer)(parties.send(partyA, MergeParties.make({ absorbed: partyB })));
  const proposition = Proposition.cases.HasIdentifier.make({ party: partyA, scheme: "email", value: "dana@acme.test" });
  yield* as(intake)(claims.send(ClaimId.make("claim_1"), AssertClaim.make({ org: acme, proposition, signals: twoSources })));
  yield* as(reviewer)(claims.send(ClaimId.make("claim_1"), AcceptClaim.make({})));
});

it.live("a rebuild writes a new generation beside the old one, with zero side effects, and switches once caught up", () =>
  Effect.gen(function* () {
    const platform = InMemory.make();
    const calls = yield* Ref.make(0);
    const storeContext = yield* Layer.build(MemoryPartyDirectoryStore);
    const store = Layer.succeedContext(storeContext);
    const directory = Effect.flatMap(Effect.service(PartyDirectoryStore), (s) => s.search(acme, "dana", page));
    const facts = Effect.flatMap(Effect.service(PartyFacts), (s) => s.list("claims"));

    // Generation 0: the history, its policy's port call, its published fact and its directory.
    // Each generation is one deployment: built in a scope of its own, torn down when it ends.
    const before = yield* Effect.scoped(
      Effect.gen(function* () {
        const deployment = yield* Layer.build(Layer.merge(deploy(platform, 0, store, calls), store));
        return yield* Effect.gen(function* () {
          yield* history;
          const rows = yield* until(directory, (found) => found.entries.length === 2 && found.entries[0]!.absorbed.length === 1);
          const published = yield* until(facts, (page) => page.entries.length === 2);
          return { rows, published: published.entries };
        }).pipe(Effect.provideContext(deployment));
      }),
    );
    yield* until(Ref.get(calls), (n) => n >= 1);
    const commits = platform.control.commits.length;
    const callsBefore = yield* Ref.get(calls);

    // Generation 1: the same platform and store, the projection's version bumped.
    yield* Effect.scoped(
      Effect.gen(function* () {
        const deployment = yield* Layer.build(Layer.merge(deploy(platform, 1, store, calls), store));
        yield* Effect.gen(function* () {
          const s = yield* PartyDirectoryStore;
          // Until the switch, queries read the old generation.
          const activeBefore = yield* s.active;
          expect(activeBefore).toEqual(O.some(0));
          const rowsBefore = yield* directory;
          expect(rowsBefore).toEqual(before.rows);
          yield* switchWhenCaughtUp(1);
          const activeAfter = yield* s.active;
          expect(activeAfter).toEqual(O.some(1));
          // The new generation replayed every party stream itself.
          const checkpoints = yield* s.checkpoints(1);
          expect(HashMap.size(checkpoints)).toBe(2);
          const rowsAfter = yield* directory;
          expect(rowsAfter).toEqual(before.rows);
          // Nothing fired, called out, started or was published.
          expect((yield* facts).entries).toEqual(before.published);
        }).pipe(Effect.provideContext(deployment));
      }),
    );
    expect(platform.control.commits.length).toBe(commits);
    const callsAfter = yield* Ref.get(calls);
    expect(callsAfter).toBe(callsBefore);
    expect(platform.control.deaths).toEqual([]);
    expect(platform.control.failures).toEqual([]);
  }).pipe(Effect.scoped),
);

it.live("a crash between the store write and the library's checkpoint: the replay leaves the same directory", () =>
  Effect.gen(function* () {
    const platform = InMemory.make();
    const calls = yield* Ref.make(0);
    const crashed = yield* Ref.make(false);
    // Every batch the store was handed: how many writes, and how many it applied.
    const applies = yield* Ref.make<ReadonlyArray<{ readonly writes: number; readonly applied: number }>>([]);
    // The first apply writes, then dies before the library records the batch as processed.
    const crashing = Layer.effect(
      PartyDirectoryStore,
      Effect.map(Effect.service(PartyDirectoryStore), (inner) => ({
        ...inner,
        apply: (generation: number, writes: Parameters<typeof inner.apply>[1]) =>
          inner.apply(generation, writes).pipe(
            Effect.tap((applied) => Ref.update(applies, A.append({ writes: writes.length, applied }))),
            Effect.flatMap((applied) =>
              Effect.flatMap(Ref.getAndSet(crashed, true), (done) => (done ? Effect.succeed(applied) : Effect.die("crash"))),
            ),
          ),
      })),
    ).pipe(Layer.provide(MemoryPartyDirectoryStore));
    const storeContext = yield* Layer.build(crashing);
    const store = Layer.succeedContext(storeContext);
    const rows = yield* Effect.scoped(
      Effect.gen(function* () {
        const deployment = yield* Layer.build(Layer.merge(deploy(platform, 0, store, calls), store));
        return yield* Effect.gen(function* () {
          const parties = yield* Party;
          yield* as(intake)(parties.send(partyA, RegisterParty.make({ org: acme, name: "Dana A" })));
          yield* until(Ref.get(crashed), (done) => done);
          // The next event on the same key makes the library hand the unprocessed registration over again.
          yield* as(intake)(parties.send(partyB, RegisterParty.make({ org: acme, name: "Dana B" })));
          yield* as(reviewer)(parties.send(partyA, MergeParties.make({ absorbed: partyB })));
          const s = yield* PartyDirectoryStore;
          return yield* until(s.search(acme, "dana", page), (found) =>
            found.entries.length === 2 && found.entries[0]!.absorbed.length === 1,
          );
        }).pipe(Effect.provideContext(deployment));
      }),
    );
    // The registration was handed over again with the merge, and refused as already applied.
    const handed = yield* Ref.get(applies);
    expect(handed).toContainEqual({ writes: 2, applied: 1 });
    expect(rows.entries).toEqual([
      { partyId: partyA, org: acme, name: "Dana A", absorbed: [partyB] },
      { partyId: partyB, org: acme, name: "Dana B", absorbed: [] },
    ]);
  }).pipe(Effect.scoped),
);
