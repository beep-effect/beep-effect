import { expect, it } from "@effect/vitest";
import { RunId } from "@proto/kernel/Ids";
import { requestKey } from "@proto/kernel/RequestKey";
import { ClaimDecided, ClaimDecidedV1, ClaimDecidedV2 } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ReservationId } from "@proto/runs-contract/Run/Reservation.id";
import { RunReport, RunsGateway } from "@proto/runs-contract/Runs.gateway";
import { ClaimDecidedInbox } from "@proto/runs-host/Inbox/ClaimDecided.inbox";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { acme, Harness, makeWorld, requestRun, testHop } from "./RunsWorld.ts";

const v1 = (factId: string, runs: ReadonlyArray<string>) => ({
  producer: ClaimDecided.producer,
  contract: ClaimDecided.contract,
  version: 1,
  factId,
  payload: S.encodeSync(S.toCodecJson(ClaimDecidedV1))(
    new ClaimDecidedV1({ factId, claim: ClaimId.make("claim_1"), org: acme, outcome: "accepted", reviewRuns: A.map(runs, (run) => RunId.make(run)) }),
  ),
});
const v2 = (factId: string, runs: ReadonlyArray<string>) => ({
  producer: ClaimDecided.producer,
  contract: ClaimDecided.contract,
  version: 2,
  factId,
  payload: S.encodeSync(S.toCodecJson(ClaimDecidedV2))(
    new ClaimDecidedV2({
      factId,
      claim: ClaimId.make("claim_1"),
      org: acme,
      decision: "accepted",
      basis: "direct",
      approval: null,
      reviewRuns: A.map(runs, (run) => RunId.make(run)),
    }),
  ),
});

/** A run requested, granted and waiting for a decision. */
const awaiting = (run: string) =>
  Effect.gen(function* () {
    const gateway = yield* RunsGateway;
    const { provenance } = yield* requestRun(run, 20);
    yield* gateway.report({ provenance, hop: testHop("await"), run: RunId.make(run), report: RunReport.cases.AwaitApproval.make({}) });
  });

it.live("a report to a run that continued goes to the run it continued as, which the gateway returns", () =>
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
    const next = yield* harness.run("run_1~1", (state) => state._tag === "Running");
    expect(next).toMatchObject({
      run: { lineage: "run_1", generation: 1, budget: { allowance: 100, reserved: 0, spent: 20 }, reservations: [] },
    });

    // The next report is made as the live run, under its own delegation.
    const waiting = yield* as(RunReport.cases.AwaitApproval.make({}), "await", settled.run, settled.provenance);
    expect(waiting.run).toBe("run_1~1");
    yield* harness.run("run_1~1", (state) => state._tag === "AwaitingApproval");
    expect(yield* harness.run("run_1", () => true)).toMatchObject({ _tag: "Continued", next: "run_1~1" });

    // The decision names the run the claim opened; the inbox concludes the live one.
    yield* harness.publish(v1("claim_1:decided", ["run_1"]));
    yield* (yield* ClaimDecidedInbox).drain;
    expect(yield* harness.run("run_1~1", (state) => state._tag === "Completed")).toMatchObject({
      _tag: "Completed",
      outcome: "accepted",
      run: { provenance: { root: { _tag: "Agent", run: "run_1~1" } } },
    });
  }).pipe(Effect.provide(makeWorld())),
);

it.live("a duplicate delivery of a fact changes nothing", () =>
  Effect.gen(function* () {
    const harness = yield* Harness;
    const inbox = yield* ClaimDecidedInbox;
    yield* harness.grant;
    yield* awaiting("run_1");
    const before = yield* harness.commitsOn("run_1");
    // The same fact delivered twice, at two positions.
    yield* harness.publish(v1("claim_1:decided", ["run_1"]), v1("claim_1:decided", ["run_1"]));
    expect(yield* inbox.drain).toBe(2);
    expect(yield* harness.run("run_1", (state) => state._tag === "Completed")).toMatchObject({ outcome: "accepted" });
    expect(yield* harness.commitsOn("run_1")).toBe(before + 1);
    // Draining again reads nothing new.
    expect(yield* inbox.drain).toBe(0);
    expect(yield* harness.commitsOn("run_1")).toBe(before + 1);
  }).pipe(Effect.provide(makeWorld())),
);

it.live("a crash between the command and the checkpoint: the redelivery is answered from the first receipt", () =>
  Effect.gen(function* () {
    const harness = yield* Harness;
    const inbox = yield* ClaimDecidedInbox;
    yield* harness.grant;
    yield* awaiting("run_1");
    const before = yield* harness.commitsOn("run_1");
    yield* harness.publish(v1("claim_1:decided", ["run_1"]));
    yield* harness.crashNextCommit;
    const crashed = yield* Effect.exit(inbox.drain);
    expect(Exit.isFailure(crashed)).toBe(true);
    // The command committed; the checkpoint did not move.
    expect(yield* harness.commitsOn("run_1")).toBe(before + 1);
    // Restarted, the inbox reads the fact again and sends the same command id: nothing new commits.
    expect(yield* inbox.drain).toBe(1);
    expect(yield* harness.commitsOn("run_1")).toBe(before + 1);
    expect(yield* harness.run("run_1", (state) => state._tag === "Completed")).toMatchObject({ outcome: "accepted" });
  }).pipe(Effect.provide(makeWorld())),
);

it.live("a version 1 consumer keeps working when the producer adds version 2", () =>
  Effect.gen(function* () {
    const harness = yield* Harness;
    const inbox = yield* ClaimDecidedInbox;
    yield* harness.grant;
    yield* awaiting("run_1");
    yield* awaiting("run_2");
    // Before: version 1 only.
    yield* harness.publish(v1("claim_1:decided", ["run_1"]));
    yield* inbox.drain;
    expect(yield* harness.run("run_1", (state) => state._tag === "Completed")).toMatchObject({ outcome: "accepted" });
    // After: Party publishes both versions of every fact; the v1 inbox acts on v1 and passes over v2.
    const before = yield* harness.commitsOn("run_2");
    yield* harness.publish(v2("claim_2:decided", ["run_2"]), v1("claim_2:decided", ["run_2"]));
    expect(yield* inbox.drain).toBe(2);
    expect(yield* harness.run("run_2", (state) => state._tag === "Completed")).toMatchObject({ outcome: "accepted" });
    expect(yield* harness.commitsOn("run_2")).toBe(before + 1);
  }).pipe(Effect.provide(makeWorld())),
);

it.effect("request keys: the same request gets the same id, whatever its key order; any difference gets another", () =>
  Effect.gen(function* () {
    const key = (tenant: string, operation: string, payload: unknown) => requestKey({ tenant, operation, payload });
    const base = yield* key("p_req", "Reserve", { run: "run_1", report: { reservation: "r1", units: 40 } });
    expect(yield* key("p_req", "Reserve", { report: { units: 40, reservation: "r1" }, run: "run_1" })).toBe(base);
    const others = yield* Effect.all([
      key("p_req", "Reserve", { run: "run_1", report: { reservation: "r1", units: 41 } }),
      key("p_req", "Reserve", { run: "run_1", report: { reservation: "r2", units: 40 } }),
      key("p_other", "Reserve", { run: "run_1", report: { reservation: "r1", units: 40 } }),
      key("p_req", "Settle", { run: "run_1", report: { reservation: "r1", units: 40 } }),
    ]);
    expect(HashSet.size(HashSet.fromIterable([base, ...others]))).toBe(5);
  }).pipe(Effect.provide(Digest.layerWebCrypto)),
);

it.live("the gateway's guard: a retried report is one command; a different report under the same hop is decided on its own", () =>
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
    expect(yield* harness.commitsOn("run_1")).toBe(once);
    // Without the guard, a caller reusing its id here would get r1's receipt (the pinned hazard).
    yield* reserve("r2", 50);
    expect(yield* harness.commitsOn("run_1")).toBe(once + 1);
    expect(yield* harness.run("run_1", () => true)).toMatchObject({
      run: { reservations: [{ reservation: "r1", units: 40 }, { reservation: "r2", units: 50 }] },
    });
  }).pipe(Effect.provide(makeWorld())),
);
