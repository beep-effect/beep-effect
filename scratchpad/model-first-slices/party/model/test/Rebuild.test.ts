import * as InMemory from "@alchemy.run/domain/InMemory";
import { expect, it } from "@effect/vitest";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import type { Invocation } from "@proto/kernel/Invocation";
import { ReadmissionRefused } from "@proto/kernel/ReadmissionRefused.rejection";
import { AcceptClaim } from "@proto/party-contract/Claim/AcceptClaim.command";
import { AssertClaim } from "@proto/party-contract/Claim/AssertClaim.command";
import { PartyIntake, PartyReview } from "@proto/party-contract/Party.capabilities";
import { MergeParties } from "@proto/party-contract/Party/MergeParties.command";
import { RegisterParty } from "@proto/party-contract/Party/RegisterParty.command";
import { Proposition } from "@proto/party-contract/Proposition";
import { Authority } from "@proto/party-model/Authority.external";
import { Claim } from "@proto/party-model/Claim/Claim.aggregate";
import { partyDirectoryLive } from "@proto/party-model/Directory/PartyDirectory.handler";
import { type DirectoryWrite, MemoryPartyDirectoryStore, PartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { switchWhenCaughtUp } from "@proto/party-model/Directory/RebuildDirectory";
import { ContactSource, MailboxUnavailable } from "@proto/party-model/Evidence/ContactSource.external";
import { PartyFacts2 } from "@proto/party-model/Facts/PartyFacts2.stream";
import { PartyHandlers } from "@proto/party-model/Party.handlers";
import { PartyModel } from "@proto/party-model/Party.model";
import { Party } from "@proto/party-model/Party/Party.aggregate";
import { Reasoner, ReasonerUnavailable } from "@proto/party-model/Review/Reasoner.external";
import { ReviewRuns, RunRefused } from "@proto/party-model/Review/ReviewRuns.external";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as Ref from "effect/Ref";
import * as Order from "effect/Order";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Cast, rolesOf } from "./Cast.ts";
import { member, twoSources } from "./fixtures.ts";

const as = (invocation: Invocation) => Effect.provideService(CurrentInvocation, invocation);
const page = { after: undefined, take: 10 };

// Each run deploys the model and waits out the directory's one-second batch, so these
// properties run four times each, not the default hundred.
const runs = { timeout: 120_000, arbitrary: { runs: 4 } };

/** Who acts, and on what, in a rebuild over this cast: both parties share the family name the directory is searched for. */
const sceneOf = (cast: Cast) => {
  const roles = rolesOf(cast);
  const named = (given: string) => `${given} ${cast.names.family}`;
  return {
    ...roles,
    intake: member(roles.intake, roles.home, [PartyIntake]),
    reviewer: member(roles.reviewer, roles.home, [PartyReview]),
    survivorName: named(cast.names.survivor),
    absorbedName: named(cast.names.absorbed),
    text: Str.toLowerCase(cast.names.family),
  };
};
type Scene = ReturnType<typeof sceneOf>;
/** The directory has both parties, one of them merged into the other. */
const merged = (found: { readonly entries: ReadonlyArray<{ readonly absorbed: ReadonlyArray<unknown> }> }) =>
  found.entries.length === 2 && A.some(found.entries, (row) => row.absorbed.length === 1);

/** What each port refuses with: generated, since no assertion reads it. */
const Refusals = S.Struct({ readmission: ReadmissionRefused, run: RunRefused, reasoner: ReasonerUnavailable, mailbox: MailboxUnavailable });
type Refusals = typeof Refusals.Type;

/** Every port refuses, and counts the call: a rebuild must make none. */
const countingPorts = (calls: Ref.Ref<number>, refusals: Refusals) => {
  const refuse = <E>(error: E) => Effect.andThen(Ref.update(calls, (n) => n + 1), Effect.fail(error));
  const refused = refusals.run;
  return Layer.mergeAll(
    Authority.toLayer(Effect.succeed({ readmit: () => refuse(refusals.readmission) })),
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
    Reasoner.toLayer(Effect.succeed({ assess: () => refuse(refusals.reasoner) })),
    ContactSource.toLayer(Effect.succeed({ observe: () => refuse(refusals.mailbox) })),
  );
};

/** The Party model on a platform, writing directory generation `generation`, over a store built elsewhere. */
const deploy = (
  platform: ReturnType<typeof InMemory.make>,
  generation: number,
  store: Layer.Layer<PartyDirectoryStore>,
  ports: ReturnType<typeof countingPorts>,
) =>
  PartyModel.layer(Layer.merge(PartyHandlers, partyDirectoryLive(generation))).pipe(
    Layer.provide(Layer.mergeAll(platform.layer, ports, store)),
  );

const until = <A, E, R>(read: Effect.Effect<A, E, R>, done: (a: A) => boolean) =>
  read.pipe(Effect.repeat({ schedule: Schedule.spaced("25 millis"), until: done, times: 400 }));

/** Two parties, one merged into the other, and a claim asserted (its review refused) and accepted. */
const history = Effect.fnUntraced(function* (cast: Cast, scene: Scene) {
  const { home, intake, reviewer, survivor, absorbed, claim } = scene;
  const parties = yield* Party;
  const claims = yield* Claim;
  yield* as(intake)(parties.send(survivor, RegisterParty.make({ org: home, name: scene.survivorName })));
  yield* as(intake)(parties.send(absorbed, RegisterParty.make({ org: home, name: scene.absorbedName })));
  yield* as(reviewer)(parties.send(survivor, MergeParties.make({ absorbed })));
  const proposition = Proposition.cases.HasIdentifier.make({ party: survivor, scheme: cast.identifier.scheme, value: cast.identifier.value });
  yield* as(intake)(claims.send(claim, AssertClaim.make({ org: home, proposition, signals: twoSources(cast) })));
  yield* as(reviewer)(claims.send(claim, AcceptClaim.make({})));
});

it.live.prop("a rebuild writes a new generation beside the old one, with zero side effects, and switches once caught up", [Cast, Refusals], ([cast, refusals]) =>
  Effect.gen(function* () {
    const scene = sceneOf(cast);
    const platform = InMemory.make();
    const calls = yield* Ref.make(0);
    const storeContext = yield* Layer.build(MemoryPartyDirectoryStore);
    const store = Layer.succeedContext(storeContext);
    const directory = Effect.flatMap(Effect.service(PartyDirectoryStore), (s) => s.search(scene.home, scene.text, page));
    const facts = Effect.flatMap(Effect.service(PartyFacts2), (s) => s.list("claims"));

    // Generation 0: the history, its policy's port call, its published fact and its directory.
    // Each generation is one deployment: built in a scope of its own, torn down when it ends.
    const before = yield* Effect.scoped(
      Effect.gen(function* () {
        const deployment = yield* Layer.build(Layer.merge(deploy(platform, 0, store, countingPorts(calls, refusals)), store));
        return yield* Effect.gen(function* () {
          yield* history(cast, scene);
          const rows = yield* until(directory, merged);
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
        const deployment = yield* Layer.build(Layer.merge(deploy(platform, 1, store, countingPorts(calls, refusals)), store));
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
  runs,
);

it.live.prop("a crash between the store write and the library's checkpoint: the replay leaves the same directory", [Cast, Refusals], ([cast, refusals]) =>
  Effect.gen(function* () {
    const { home, intake, reviewer, survivor, absorbed, survivorName, absorbedName, text } = sceneOf(cast);
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
        apply: dual(2, (writes: ReadonlyArray<DirectoryWrite>, generation: number) =>
          inner.apply(writes, generation).pipe(
            Effect.tap((applied) => Ref.update(applies, A.append({ writes: writes.length, applied }))),
            Effect.flatMap((applied) =>
              Effect.flatMap(Ref.getAndSet(crashed, true), (done) => (done ? Effect.succeed(applied) : Effect.die("crash"))),
            ),
          ),
        ),
      })),
    ).pipe(Layer.provide(MemoryPartyDirectoryStore));
    const storeContext = yield* Layer.build(crashing);
    const store = Layer.succeedContext(storeContext);
    const rows = yield* Effect.scoped(
      Effect.gen(function* () {
        const deployment = yield* Layer.build(Layer.merge(deploy(platform, 0, store, countingPorts(calls, refusals)), store));
        return yield* Effect.gen(function* () {
          const parties = yield* Party;
          yield* as(intake)(parties.send(survivor, RegisterParty.make({ org: home, name: survivorName })));
          yield* until(Ref.get(crashed), (done) => done);
          // The next event on the same key makes the library hand the unprocessed registration over again.
          yield* as(intake)(parties.send(absorbed, RegisterParty.make({ org: home, name: absorbedName })));
          yield* as(reviewer)(parties.send(survivor, MergeParties.make({ absorbed })));
          const s = yield* PartyDirectoryStore;
          return yield* until(s.search(home, text, page), merged);
        }).pipe(Effect.provideContext(deployment));
      }),
    );
    // The registration was handed over again with the merge, and refused as already applied.
    const handed = yield* Ref.get(applies);
    expect(handed).toContainEqual({ writes: 2, applied: 1 });
    // In party id order.
    expect(rows.entries).toEqual(
      A.sort(
        [
          { partyId: survivor, org: home, name: survivorName, absorbed: [absorbed] },
          { partyId: absorbed, org: home, name: absorbedName, absorbed: [] },
        ],
        Order.mapInput(Order.String, (row: { readonly partyId: string }) => row.partyId),
      ),
    );
  }).pipe(Effect.scoped),
  runs,
);
