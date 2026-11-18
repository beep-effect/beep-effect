import { expect, it } from "@effect/vitest";
import { RunId } from "@proto/kernel/Ids";
import { requestKey } from "@proto/kernel/RequestKey";
import { ClaimDecided, ClaimDecidedV1, ClaimDecidedV2 } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ReservationId } from "@proto/runs-contract/Run/Reservation.id";
import { RunReport, RunReportRefused, RunsGateway } from "@proto/runs-contract/Runs.gateway";
import { ClaimDecidedInbox } from "@proto/runs-host/Inbox/ClaimDecided.inbox";
import { AgentRunState } from "@proto/runs-model/Run/AgentRun.aggregate";
import * as A from "@beep/utils/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import { acme, Harness, requestRun, testHop, World } from "./RunsWorld.ts";
import { thunkTrue } from "@beep/utils"

const encodeV1 = S.encodeEffect(S.toCodecJson(ClaimDecidedV1));
const encodeV2 = S.encodeEffect(S.toCodecJson(ClaimDecidedV2));

const v1 = Effect.fn("v1")(function* (factId: string, runs: ReadonlyArray<string>) {
  const payload = yield* encodeV1(
    ClaimDecidedV1.make({ factId, claim: ClaimId.make("claim_1"), org: acme, outcome: "accepted", reviewRuns: A.map(runs, (run) => RunId.make(run)) }),
  );
  return { producer: ClaimDecided.producer, contract: ClaimDecided.contract, version: 1, factId, payload };
});
const v2 = Effect.fn("v2")(function* (factId: string, runs: ReadonlyArray<string>) {
  const payload = yield* encodeV2(
    ClaimDecidedV2.make({
      factId,
      claim: ClaimId.make("claim_1"),
      org: acme,
      decision: "accepted",
      basis: "direct",
      approval: O.none(),
      reviewRuns: A.map(runs, (run) => RunId.make(run)),
    }),
  );
  return { producer: ClaimDecided.producer, contract: ClaimDecided.contract, version: 2, factId, payload };
});

/** A run requested, granted and waiting for a decision. */
const awaiting = Effect.fn("awaiting")(function* (run: string) {
  const gateway = yield* RunsGateway;
  const { provenance } = yield* requestRun(run, 20);
  yield* gateway.report({ provenance, hop: testHop("await"), run: RunId.make(run), report: RunReport.cases.AwaitApproval.make({}) });
});

// Every test gets a world of its own, on the live clock: the harness waits on real schedules.
it.layer(World, { buildPerTest: true, excludeTestServices: true })((it) => {
  it.effect("a report to a run that continued goes to the run it continued as, which the gateway returns", () =>
    Effect.gen(function* () {
      const harness = yield* Harness;
      const gateway = yield* RunsGateway;
      yield* harness.grant;
      const { provenance } = yield* requestRun("run_1", 2);
      const as = (report: RunReport, step: string, run = "run_1", from = provenance) =>
        gateway.report({ provenance: from, hop: testHop(step), run: RunId.make(run), report });
      // A reservation is open when the run reaches its bound.
      yield* as(RunReport.cases.Reserve.make({ reservation: ReservationId.make("r1"), units: 30 }), "reserve");
      yield* as(RunReport.cases.Step.make({ step: "a" }), "a");
      const atBound = yield* as(RunReport.cases.Step.make({ step: "b" }), "b");
      expect(atBound.run).toBe("run_1");

      // The executor still names run_1: the gateway follows it, and the carried reservation settles there.
      const settled = yield* as(RunReport.cases.Settle.make({ reservation: ReservationId.make("r1"), units: 20 }), "settle");
      expect(settled.run).toBe("run_1~1");
      expect(settled.provenance.root).toEqual({ _tag: "Agent", run: "run_1~1", accountable: "p_req" });
      const next = yield* harness.run("run_1~1", AgentRunState.guards.Running);
      expect(next).toMatchObject({
        run: { lineage: "run_1", generation: 1, budget: { allowance: 100, reserved: 0, spent: 20 }, reservations: [] },
      });

      // The next report is made as the live run, under its own delegation.
      const waiting = yield* as(RunReport.cases.AwaitApproval.make({}), "await", settled.run, settled.provenance);
      expect(waiting.run).toBe("run_1~1");
      yield* harness.run("run_1~1", AgentRunState.guards.AwaitingApproval);
      const first = yield* harness.run("run_1", thunkTrue);
      expect(first).toMatchObject({ _tag: "Continued", next: "run_1~1" });

      // The decision names the run the claim opened; the inbox concludes the live one.
      const decided = yield* v1("claim_1:decided", ["run_1"]);
      yield* harness.publish(decided);
      const inbox = yield* ClaimDecidedInbox;
      yield* inbox.drain;
      const concluded = yield* harness.run("run_1~1", AgentRunState.guards.Completed);
      expect(concluded).toMatchObject({
        _tag: "Completed",
        outcome: "accepted",
        run: { provenance: { root: { _tag: "Agent", run: "run_1~1" } } },
      });
    }),
  );

  it.effect("a hop refused after the grant is revoked is recorded without re-admission, and the run gives back its reservation", () =>
    Effect.gen(function* () {
      const harness = yield* Harness;
      const gateway = yield* RunsGateway;
      yield* harness.grant;
      const { provenance } = yield* requestRun("run_1", 20);
      const as = (report: RunReport, step: string) =>
        gateway.report({ provenance, hop: testHop(step), run: RunId.make("run_1"), report });
      yield* as(RunReport.cases.Reserve.make({ reservation: ReservationId.make("r1"), units: 40 }), "reserve");
      // The owner revokes the grant the run's delegation derives from, before the settle hop.
      yield* harness.revoke;
      const refused = yield* Effect.flip(as(RunReport.cases.Settle.make({ reservation: ReservationId.make("r1"), units: 12 }), "settle"));
      expect(refused).toEqual(RunReportRefused.make({ reason: "readmission:lapsed" }));
      const held = yield* harness.run("run_1", AgentRunState.guards.Running);
      expect(held).toMatchObject({ run: { budget: { reserved: 40 } } });
      // The executor reports the refusal; the gateway records it without re-admitting the run.
      yield* as(RunReport.cases.Refused.make({ reason: "readmission:lapsed" }), "refuse");
      const ended = yield* harness.run("run_1", AgentRunState.guards.Refused);
      expect(ended).toMatchObject({
        _tag: "Refused",
        reason: "readmission:lapsed",
        run: { budget: { allowance: 100, reserved: 0, spent: 0 }, reservations: [] },
      });
    }),
  );

  it.effect("a duplicate delivery of a fact changes nothing", () =>
    Effect.gen(function* () {
      const harness = yield* Harness;
      const inbox = yield* ClaimDecidedInbox;
      yield* harness.grant;
      yield* awaiting("run_1");
      const before = yield* harness.commitsOn("run_1");
      // The same fact delivered twice, at two positions.
      const decided = yield* v1("claim_1:decided", ["run_1"]);
      yield* harness.publish(decided, decided);
      const read = yield* inbox.drain;
      expect(read).toBe(2);
      const concluded = yield* harness.run("run_1", AgentRunState.guards.Completed);
      expect(concluded).toMatchObject({ outcome: "accepted" });
      const commits = yield* harness.commitsOn("run_1");
      expect(commits).toBe(before + 1);
      // Draining again reads nothing new.
      const again = yield* inbox.drain;
      expect(again).toBe(0);
      const commitsAfter = yield* harness.commitsOn("run_1");
      expect(commitsAfter).toBe(before + 1);
    }),
  );

  // Phase 10 (D47): an upgrade republishes a decision in the new stream generation; the feed then
  // serves the fact twice, versions 1 and 2 each. Every review run of the claim concludes once.
  it.effect("a fact republished in a new stream generation concludes every review run of its claim once", () =>
    Effect.gen(function* () {
      const harness = yield* Harness;
      const inbox = yield* ClaimDecidedInbox;
      yield* harness.grant;
      yield* awaiting("run_1");
      yield* awaiting("run_2");
      const before1 = yield* harness.commitsOn("run_1");
      const before2 = yield* harness.commitsOn("run_2");
      const first = yield* v1("claim_1:decided", ["run_1", "run_2"]);
      const second = yield* v2("claim_1:decided", ["run_1", "run_2"]);
      // Generation 1, then generation 2 with the same fact.
      yield* harness.publish(first, second, first, second);
      const read = yield* inbox.drain;
      expect(read).toBe(4);
      const concluded = yield* Effect.all([
        harness.run("run_1", AgentRunState.guards.Completed),
        harness.run("run_2", AgentRunState.guards.Completed),
      ], { concurrency: 1 });
      expect(concluded).toMatchObject([{ outcome: "accepted" }, { outcome: "accepted" }]);
      const after1 = yield* harness.commitsOn("run_1");
      const after2 = yield* harness.commitsOn("run_2");
      expect([after1 - before1, after2 - before2]).toEqual([1, 1]);
    }),
  );

  it.effect("a crash between the command and the checkpoint: the redelivery is answered from the first receipt", () =>
    Effect.gen(function* () {
      const harness = yield* Harness;
      const inbox = yield* ClaimDecidedInbox;
      yield* harness.grant;
      yield* awaiting("run_1");
      const before = yield* harness.commitsOn("run_1");
      const decided = yield* v1("claim_1:decided", ["run_1"]);
      yield* harness.publish(decided);
      yield* harness.crashNextCommit;
      const crashed = yield* Effect.exit(inbox.drain);
      expect(Exit.isFailure(crashed)).toBe(true);
      // The command committed; the checkpoint did not move.
      const commits = yield* harness.commitsOn("run_1");
      expect(commits).toBe(before + 1);
      // Restarted, the inbox reads the fact again and sends the same command id: nothing new commits.
      const read = yield* inbox.drain;
      expect(read).toBe(1);
      const commitsAfter = yield* harness.commitsOn("run_1");
      expect(commitsAfter).toBe(before + 1);
      const concluded = yield* harness.run("run_1", AgentRunState.guards.Completed);
      expect(concluded).toMatchObject({ outcome: "accepted" });
    }),
  );

  it.effect("a version 1 consumer keeps working when the producer adds version 2", () =>
    Effect.gen(function* () {
      const harness = yield* Harness;
      const inbox = yield* ClaimDecidedInbox;
      yield* harness.grant;
      yield* awaiting("run_1");
      yield* awaiting("run_2");
      // Before: version 1 only.
      const first = yield* v1("claim_1:decided", ["run_1"]);
      yield* harness.publish(first);
      yield* inbox.drain;
      const concluded = yield* harness.run("run_1", AgentRunState.guards.Completed);
      expect(concluded).toMatchObject({ outcome: "accepted" });
      // After: Party publishes both versions of every fact; the v1 inbox acts on v1 and passes over v2.
      const before = yield* harness.commitsOn("run_2");
      const asV2 = yield* v2("claim_2:decided", ["run_2"]);
      const asV1 = yield* v1("claim_2:decided", ["run_2"]);
      yield* harness.publish(asV2, asV1);
      const read = yield* inbox.drain;
      expect(read).toBe(2);
      const second = yield* harness.run("run_2", AgentRunState.guards.Completed);
      expect(second).toMatchObject({ outcome: "accepted" });
      const commits = yield* harness.commitsOn("run_2");
      expect(commits).toBe(before + 1);
    }),
  );

  it.effect("the gateway's guard: a retried report is one command; a different report under the same hop is decided on its own", () =>
    Effect.gen(function* () {
      const harness = yield* Harness;
      const gateway = yield* RunsGateway;
      yield* harness.grant;
      const { provenance } = yield* requestRun("run_1", 20);
      const reserve = (reservation: string, units: number) =>
        gateway.report({
          provenance,
          hop: testHop("reserve"),
          run: RunId.make("run_1"),
          report: RunReport.cases.Reserve.make({ reservation: ReservationId.make(reservation), units }),
        });
      yield* reserve("r1", 40);
      const once = yield* harness.commitsOn("run_1");
      yield* reserve("r1", 40);
      const retried = yield* harness.commitsOn("run_1");
      expect(retried).toBe(once);
      // Without the guard, a caller reusing its id here would get r1's receipt (the pinned hazard).
      yield* reserve("r2", 50);
      const other = yield* harness.commitsOn("run_1");
      expect(other).toBe(once + 1);
      const state = yield* harness.run("run_1", thunkTrue);
      expect(state).toMatchObject({
        run: { reservations: [{ reservation: "r1", units: 40 }, { reservation: "r2", units: 50 }] },
      });
    }),
  );
});

it.layer(Digest.layerWebCrypto)((it) => {
  it.effect("request keys: the same request gets the same id, whatever its key order; any difference gets another", () =>
    Effect.gen(function* () {
      const key = (tenant: string, operation: string, payload: unknown) => requestKey({ tenant, operation, payload });
      const base = yield* key("p_req", "Reserve", { run: "run_1", report: { reservation: "r1", units: 40 } });
      // Pinned (phase 7): the id the first implementation gave, so a change to the encoding cannot move ids.
      expect(base).toBe("p_req:Reserve:7acd60c7ff9c6fe1c78653c11097c9ef");
      const reordered = yield* key("p_req", "Reserve", { report: { units: 40, reservation: "r1" }, run: "run_1" });
      expect(reordered).toBe(base);
      // Integer-like keys, an undefined property, escapes and a negative fraction, as the first implementation encoded them.
      const odd = yield* key("org_acme", "Reserve", { b: [1, "x", null, true, { z: 1, a: [] }], a: "é\"\n", "10": 1, "9": 2, u: undefined, n: -0.5 });
      expect(odd).toBe("org_acme:Reserve:df99444cbda7fb89c36431d30ec2eb02");
      const others = yield* Effect.all([
        key("p_req", "Reserve", { run: "run_1", report: { reservation: "r1", units: 41 } }),
        key("p_req", "Reserve", { run: "run_1", report: { reservation: "r2", units: 40 } }),
        key("p_other", "Reserve", { run: "run_1", report: { reservation: "r1", units: 40 } }),
        key("p_req", "Settle", { run: "run_1", report: { reservation: "r1", units: 40 } }),
      ], { concurrency: 1 });
      expect(HashSet.size(HashSet.fromIterable([base, ...others]))).toBe(5);
    }),
  );
});
