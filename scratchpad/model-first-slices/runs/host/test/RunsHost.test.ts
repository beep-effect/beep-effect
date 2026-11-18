import { expect, it } from "@effect/vitest";
import type { RunId } from "@proto/kernel/Ids";
import { IdText, Name } from "@proto/kernel/Measure";
import { requestKey } from "@proto/kernel/RequestKey";
import type { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimDecided, ClaimDecidedV1, ClaimDecidedV2 } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { RunReport, RunReportRefused, RunsGateway } from "@proto/runs-contract/Runs.gateway";
import { ClaimDecidedInbox } from "@proto/runs-host/Inbox/ClaimDecided.inbox";
import { AgentRunState } from "@proto/runs-model/Run/AgentRun.aggregate";
import * as A from "@beep/utils/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { thunkTrue } from "@beep/utils/thunk";
import { Cast, nextOf } from "./Cast.ts";
import { Harness, worldOf } from "./RunsWorld.ts";

const encodeV1 = S.encodeEffect(S.toCodecJson(ClaimDecidedV1));
const encodeV2 = S.encodeEffect(S.toCodecJson(ClaimDecidedV2));

// Every world story is a property over a generated cast (`Cast.ts`), each run in a world of its
// own on the live clock: the harness waits on real schedules. A world takes about a tenth of a
// second to build and settle, so these run 25 times each, not the default 100 (about 15 s).
const worldRuns = { arbitrary: { runs: 25 }, timeout: 120_000 };

/** The id Party gives the fact that a claim was decided. */
const factIdOf = (claim: ClaimId) => ClaimDecided.factIdOf(claim);

/** The cast's decision of a claim, published as version 1 and naming these review runs. */
const v1 = Effect.fn("v1")(function* (cast: Cast, claim: ClaimId, runs: ReadonlyArray<RunId>) {
  const factId = factIdOf(claim);
  const payload = yield* encodeV1(ClaimDecidedV1.make({ factId, claim, org: cast.org, outcome: cast.outcome, reviewRuns: runs }));
  return { producer: ClaimDecided.producer, contract: ClaimDecided.contract, version: 1, factId, payload };
});

/** The same decision as version 2, with the generated fact's basis and approval. */
const v2 = Effect.fn("v2")(function* (cast: Cast, claim: ClaimId, runs: ReadonlyArray<RunId>) {
  const factId = factIdOf(claim);
  const payload = yield* encodeV2(
    ClaimDecidedV2.make({
      factId,
      claim,
      org: cast.org,
      decision: cast.outcome,
      basis: cast.decided.basis,
      approval: cast.decided.approval,
      reviewRuns: runs,
    }),
  );
  return { producer: ClaimDecided.producer, contract: ClaimDecided.contract, version: 2, factId, payload };
});

/** What one call's reservation holds: what it uses and what it does not. */
const heldOf = ({ ledger }: Cast) => ledger.used + ledger.unused;

/** A run's allowance: one reservation's worth and what stays free beside it. */
const allowanceOf = (cast: Cast) => heldOf(cast) + cast.ledger.free;

/** A world's story, given its builders, run in a fresh world of the cast. */
const inWorld = <A, E>(cast: Cast, story: (world: ReturnType<typeof worldOf>) => Effect.Effect<A, E, Harness | RunsGateway | ClaimDecidedInbox>) => {
  const world = worldOf(cast);
  return world.World.pipe(
    Layer.build,
    Effect.flatMap((context) => story(world).pipe(Effect.provideContext(context))),
    Effect.scoped,
  );
};

/** A run requested, granted and waiting for a decision. */
const awaiting = Effect.fn("awaiting")(function* (world: ReturnType<typeof worldOf>, run: RunId) {
  const gateway = yield* RunsGateway;
  const { provenance } = yield* world.requestRun(run);
  const report = RunReport.cases.AwaitApproval.make({});
  yield* gateway.report({ provenance, hop: world.testHop(report._tag), run, report });
});

it.live.prop(
  "a report to a run that continued goes to the run it continued as, which the gateway returns",
  [Cast],
  ([cast]) =>
    inWorld(cast, (world) =>
      Effect.gen(function* () {
        const harness = yield* Harness;
        const gateway = yield* RunsGateway;
        const { run } = cast.runs;
        const [reservation] = cast.reservations;
        const next = nextOf(run);
        yield* harness.grant;
        const { provenance } = yield* world.requestRun(run);
        const as = (report: RunReport, to = run, from = provenance, step: string = report._tag) =>
          gateway.report({ provenance: from, hop: world.testHop(step), run: to, report });
        // A reservation is open when the run reaches its bound.
        yield* as(RunReport.cases.Reserve.make({ reservation, units: heldOf(cast) }));
        // Each step is its own hop: two steps of one name under one hop would be one report, retried.
        const recorded = yield* Effect.forEach(
          cast.steps,
          (step, index) => {
            const report = RunReport.cases.Step.make({ step });
            return as(report, run, provenance, `${report._tag}:${index}`);
          },
          { concurrency: 1 },
        );
        expect(A.lastNonEmpty(recorded).run).toBe(run);

        // The executor still names the first run: the gateway follows it, and the carried reservation settles there.
        const settled = yield* as(RunReport.cases.Settle.make({ reservation, units: cast.ledger.used }));
        expect(settled.run).toBe(next);
        expect(settled.provenance.root).toEqual({ _tag: "Agent", run: next, accountable: cast.principals.requester });
        const continued = yield* harness.run(next, AgentRunState.guards.Running);
        expect(continued).toMatchObject({
          run: { lineage: run, generation: 1, budget: { allowance: allowanceOf(cast), reserved: 0, spent: cast.ledger.used }, reservations: [] },
        });

        // The next report is made as the live run, under its own delegation.
        const waiting = yield* as(RunReport.cases.AwaitApproval.make({}), settled.run, settled.provenance);
        expect(waiting.run).toBe(next);
        yield* harness.run(next, AgentRunState.guards.AwaitingApproval);
        const first = yield* harness.run(run, thunkTrue);
        expect(first).toMatchObject({ _tag: "Continued", next });

        // The decision names the run the claim opened; the inbox concludes the live one.
        const decided = yield* v1(cast, cast.claims[0], [run]);
        yield* harness.publish(decided);
        const inbox = yield* ClaimDecidedInbox;
        yield* inbox.drain;
        const concluded = yield* harness.run(next, AgentRunState.guards.Completed);
        expect(concluded).toMatchObject({
          _tag: "Completed",
          outcome: cast.outcome,
          run: { provenance: { root: { _tag: "Agent", run: next } } },
        });
      }),
    ),
  worldRuns,
);

it.live.prop(
  "a hop refused after the grant is revoked is recorded without re-admission, and the run gives back its reservation",
  [Cast],
  ([cast]) =>
    inWorld(cast, (world) =>
      Effect.gen(function* () {
        const harness = yield* Harness;
        const gateway = yield* RunsGateway;
        const { run } = cast.runs;
        const [reservation] = cast.reservations;
        const held = heldOf(cast);
        yield* harness.grant;
        const { provenance } = yield* world.requestRun(run);
        const as = (report: RunReport) => gateway.report({ provenance, hop: world.testHop(report._tag), run, report });
        yield* as(RunReport.cases.Reserve.make({ reservation, units: held }));
        // The owner revokes the grant the run's delegation derives from, before the settle hop.
        yield* harness.revoke;
        const refused = yield* Effect.flip(as(RunReport.cases.Settle.make({ reservation, units: cast.ledger.used })));
        // The authority context refuses the hop: every grant the run names has lapsed.
        const lapsed = RunReportRefused.make({ reason: "readmission:lapsed" });
        expect(refused).toEqual(lapsed);
        const open = yield* harness.run(run, AgentRunState.guards.Running);
        expect(open).toMatchObject({ run: { budget: { reserved: held } } });
        // The executor reports the refusal; the gateway records it without re-admitting the run.
        yield* as(RunReport.cases.Refused.make({ reason: lapsed.reason }));
        const ended = yield* harness.run(run, AgentRunState.guards.Refused);
        expect(ended).toMatchObject({
          _tag: "Refused",
          reason: lapsed.reason,
          run: { budget: { allowance: allowanceOf(cast), reserved: 0, spent: 0 }, reservations: [] },
        });
      }),
    ),
  worldRuns,
);

it.live.prop(
  "a duplicate delivery of a fact changes nothing",
  [Cast],
  ([cast]) =>
    inWorld(cast, (world) =>
      Effect.gen(function* () {
        const harness = yield* Harness;
        const inbox = yield* ClaimDecidedInbox;
        const { run } = cast.runs;
        yield* harness.grant;
        yield* awaiting(world, run);
        const before = yield* harness.commitsOn(run);
        // The same fact delivered twice, at two positions.
        const decided = yield* v1(cast, cast.claims[0], [run]);
        yield* harness.publish(decided, decided);
        const read = yield* inbox.drain;
        expect(read).toBe(2);
        const concluded = yield* harness.run(run, AgentRunState.guards.Completed);
        expect(concluded).toMatchObject({ outcome: cast.outcome });
        const commits = yield* harness.commitsOn(run);
        expect(commits).toBe(before + 1);
        // Draining again reads nothing new.
        const again = yield* inbox.drain;
        expect(again).toBe(0);
        const commitsAfter = yield* harness.commitsOn(run);
        expect(commitsAfter).toBe(before + 1);
      }),
    ),
  worldRuns,
);

// Phase 10 (D47): an upgrade republishes a decision in the new stream generation; the feed then
// serves the fact twice, versions 1 and 2 each. Every review run of the claim concludes once.
it.live.prop(
  "a fact republished in a new stream generation concludes every review run of its claim once",
  [Cast],
  ([cast]) =>
    inWorld(cast, (world) =>
      Effect.gen(function* () {
        const harness = yield* Harness;
        const inbox = yield* ClaimDecidedInbox;
        const { run, peer } = cast.runs;
        yield* harness.grant;
        yield* awaiting(world, run);
        yield* awaiting(world, peer);
        const beforeRun = yield* harness.commitsOn(run);
        const beforePeer = yield* harness.commitsOn(peer);
        const first = yield* v1(cast, cast.claims[0], [run, peer]);
        const second = yield* v2(cast, cast.claims[0], [run, peer]);
        // Generation 1, then generation 2 with the same fact.
        yield* harness.publish(first, second, first, second);
        const read = yield* inbox.drain;
        expect(read).toBe(4);
        const concluded = yield* Effect.all(
          [harness.run(run, AgentRunState.guards.Completed), harness.run(peer, AgentRunState.guards.Completed)],
          { concurrency: 1 },
        );
        expect(concluded).toMatchObject([{ outcome: cast.outcome }, { outcome: cast.outcome }]);
        const afterRun = yield* harness.commitsOn(run);
        const afterPeer = yield* harness.commitsOn(peer);
        expect([afterRun - beforeRun, afterPeer - beforePeer]).toEqual([1, 1]);
      }),
    ),
  worldRuns,
);

it.live.prop(
  "a crash between the command and the checkpoint: the redelivery is answered from the first receipt",
  [Cast],
  ([cast]) =>
    inWorld(cast, (world) =>
      Effect.gen(function* () {
        const harness = yield* Harness;
        const inbox = yield* ClaimDecidedInbox;
        const { run } = cast.runs;
        yield* harness.grant;
        yield* awaiting(world, run);
        const before = yield* harness.commitsOn(run);
        const decided = yield* v1(cast, cast.claims[0], [run]);
        yield* harness.publish(decided);
        yield* harness.crashNextCommit;
        const crashed = yield* Effect.exit(inbox.drain);
        expect(Exit.isFailure(crashed)).toBe(true);
        // The command committed; the checkpoint did not move.
        const commits = yield* harness.commitsOn(run);
        expect(commits).toBe(before + 1);
        // Restarted, the inbox reads the fact again and sends the same command id: nothing new commits.
        const read = yield* inbox.drain;
        expect(read).toBe(1);
        const commitsAfter = yield* harness.commitsOn(run);
        expect(commitsAfter).toBe(before + 1);
        const concluded = yield* harness.run(run, AgentRunState.guards.Completed);
        expect(concluded).toMatchObject({ outcome: cast.outcome });
      }),
    ),
  worldRuns,
);

it.live.prop(
  "a version 1 consumer keeps working when the producer adds version 2",
  [Cast],
  ([cast]) =>
    inWorld(cast, (world) =>
      Effect.gen(function* () {
        const harness = yield* Harness;
        const inbox = yield* ClaimDecidedInbox;
        const { run, peer } = cast.runs;
        const [claim, later] = cast.claims;
        yield* harness.grant;
        yield* awaiting(world, run);
        yield* awaiting(world, peer);
        // Before: version 1 only.
        const first = yield* v1(cast, claim, [run]);
        yield* harness.publish(first);
        yield* inbox.drain;
        const concluded = yield* harness.run(run, AgentRunState.guards.Completed);
        expect(concluded).toMatchObject({ outcome: cast.outcome });
        // After: Party publishes both versions of every fact; the v1 inbox acts on v1 and passes over v2.
        const before = yield* harness.commitsOn(peer);
        const asV2 = yield* v2(cast, later, [peer]);
        const asV1 = yield* v1(cast, later, [peer]);
        yield* harness.publish(asV2, asV1);
        const read = yield* inbox.drain;
        expect(read).toBe(2);
        const second = yield* harness.run(peer, AgentRunState.guards.Completed);
        expect(second).toMatchObject({ outcome: cast.outcome });
        const commits = yield* harness.commitsOn(peer);
        expect(commits).toBe(before + 1);
      }),
    ),
  worldRuns,
);

it.live.prop(
  "the gateway's guard: a retried report is one command; a different report under the same hop is decided on its own",
  [Cast],
  ([cast]) =>
    inWorld(cast, (world) =>
      Effect.gen(function* () {
        const harness = yield* Harness;
        const gateway = yield* RunsGateway;
        const { run } = cast.runs;
        const [first, second] = cast.reservations;
        const { used, unused } = cast.ledger;
        yield* harness.grant;
        const { provenance } = yield* world.requestRun(run);
        // Every reservation is reported under one hop.
        const reserve = (report: RunReport) => gateway.report({ provenance, hop: world.testHop(report._tag), run, report });
        yield* reserve(RunReport.cases.Reserve.make({ reservation: first, units: used }));
        const once = yield* harness.commitsOn(run);
        yield* reserve(RunReport.cases.Reserve.make({ reservation: first, units: used }));
        const retried = yield* harness.commitsOn(run);
        expect(retried).toBe(once);
        // Without the guard, a caller reusing its id here would get the first reservation's receipt (the pinned hazard).
        yield* reserve(RunReport.cases.Reserve.make({ reservation: second, units: unused }));
        const other = yield* harness.commitsOn(run);
        expect(other).toBe(once + 1);
        const state = yield* harness.run(run, thunkTrue);
        expect(state).toMatchObject({
          run: { reservations: [{ reservation: first, units: used }, { reservation: second, units: unused }] },
        });
      }),
    ),
  worldRuns,
);

/** Two requests that differ in tenant, in operation, and in payload, about one payload. */
const Requests = S.Struct({
  tenants: S.Tuple([IdText, IdText]),
  operations: S.Tuple([Name, Name]),
  payload: S.Record(Name, S.Int),
  changed: Name,
}).check(
  S.makeFilter(({ tenants, operations }) => tenants[0] !== tenants[1] && operations[0] !== operations[1], {
    identifier: "RequestsCheck",
    title: "Two requests",
    description: "The two tenants differ, and so do the two operations.",
  }),
);

it.layer(Digest.layerWebCrypto)((it) => {
  // Fixed by nature: the ids the first implementation gave, so a change to the encoding cannot move ids.
  it.effect("request keys: the ids are pinned as the first implementation gave them", () =>
    Effect.gen(function* () {
      const key = (tenant: string, operation: string, payload: unknown) => requestKey({ tenant, operation, payload });
      const base = yield* key("p_req", "Reserve", { run: "run_1", report: { reservation: "r1", units: 40 } });
      // Pinned (phase 7).
      expect(base).toBe("p_req:Reserve:7acd60c7ff9c6fe1c78653c11097c9ef");
      // Integer-like keys, an undefined property, escapes and a negative fraction, as the first implementation encoded them.
      const odd = yield* key("org_acme", "Reserve", { b: [1, "x", null, true, { z: 1, a: [] }], a: "é\"\n", "10": 1, "9": 2, u: undefined, n: -0.5 });
      expect(odd).toBe("org_acme:Reserve:df99444cbda7fb89c36431d30ec2eb02");
    }),
  );

  it.effect.prop("request keys: the same request gets the same id, whatever its key order", [Requests], ([requests]) =>
    Effect.gen(function* () {
      const [tenant] = requests.tenants;
      const [operation] = requests.operations;
      const base = yield* requestKey({ tenant, operation, payload: { request: requests.payload } });
      const reordered = yield* requestKey({ tenant, operation, payload: { request: R.fromEntries(A.reverse(R.toEntries(requests.payload))) } });
      expect(reordered).toBe(base);
    }),
  );

  it.effect.prop("request keys: any difference in tenant, operation or payload gets another id", [Requests], ([requests]) =>
    Effect.gen(function* () {
      const [tenant, otherTenant] = requests.tenants;
      const [operation, otherOperation] = requests.operations;
      const { payload } = requests;
      const keys = yield* Effect.all(
        [
          requestKey({ tenant, operation, payload }),
          requestKey({ tenant: otherTenant, operation, payload }),
          requestKey({ tenant, operation: otherOperation, payload }),
          // A string where the payload holds an integer or nothing: always a different payload.
          requestKey({ tenant, operation, payload: { ...payload, [requests.changed]: requests.changed } }),
        ],
        { concurrency: 1 },
      );
      expect(HashSet.size(HashSet.fromIterable(keys))).toBe(4);
    }),
  );
});
