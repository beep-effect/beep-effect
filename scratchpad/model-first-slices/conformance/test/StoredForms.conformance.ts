import { expect, it } from "@effect/vitest";
import { OrgId, RunId } from "@proto/kernel/Ids";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimReviewState, proposalOf } from "@proto/party-contract/Claim/ClaimReview.read";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { SessionId } from "@proto/runs-contract/Run/Session.id";
import * as A from "@beep/utils/Array";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Str from "@beep/utils/Str";
import { clients, eventually, fresh, get, hasStatus, human, outcomeOf, psql, registration, runsClient, runState, runStateAs, services, statusOf } from "./Stack.ts";

// Phase 8: state stored in the forms earlier phases wrote, read by the phase 7 code on the cluster.
// The first case writes rows straight into the cluster's object storage; the second, with
// RESTORE_PHASE=across, reads a stack restored from phase 6's dump (README, notes/phase-8.md).

/** Where each case's evidence goes (`EVIDENCE_FILE`): one timestamped JSON line per record. */
const evidenceFile = Config.String("EVIDENCE_FILE").pipe(Config.withDefault("/dev/null"));
const json = S.fromJsonString(S.Unknown);
const encodeJson = S.encodeEffect(json);
const decodeJson = S.decodeEffect(json);
const log = Effect.fn("log")(function* (label: string, value: unknown) {
  const fs = yield* FileSystem.FileSystem;
  const file = yield* evidenceFile;
  const now = yield* DateTime.now;
  const text = yield* encodeJson(value);
  yield* fs.writeFileString(file, `${DateTime.formatIso(now)} ${label}: ${text}\n`, { flag: "a" });
}, Effect.orDie);

/** A case against the deployed stack, with the stack's clients built into the case's scope. */
const live = <E>(name: string, body: Effect.Effect<void, E, Layer.Success<typeof services> | Scope.Scope>) =>
  it.live(name, () => Effect.flatMap(Layer.build(services), (context) => Effect.provideContext(body, context)), 600_000);

/** The tag of a run's stored state, read straight from the cluster's storage: `RunState` answers a status, not the stored form. */
const storedTag = (run: string) =>
  psql(`SELECT value::jsonb->'state'->>'_tag' FROM alchemy_domain_objects WHERE object = 'Practice/Runs.AgentRunAggregate/${run}' AND key = 'meta'`);

/** A frozen run state fixture (runs/model/test/stored), with this case's session and run ids in it. */
const storedRun = Effect.fn("storedRun")(function* (name: string, session: string, run: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = yield* path.fromFileUrl(new URL(`../../runs/model/test/stored/${name}`, import.meta.url));
  const text = yield* fs.readFileString(file);
  return yield* decodeJson(pipe(text, Str.replaceAll("session_2", session), Str.replaceAll("run_2", run)));
});

/** Write one row of an object's storage, as the cluster's storage writes it (compact JSON text). */
const write = Effect.fn("write")(function* (object: string, key: string, value: unknown) {
  const text = yield* encodeJson(value);
  yield* psql(
    `INSERT INTO alchemy_domain_objects (object, key, value) VALUES ('${object}', '${key}', $stored$${text}$stored$) ON CONFLICT (object, key) DO UPDATE SET value = excluded.value`,
  );
});

live("a run and a session view stored in phase 6's forms decode on the cluster, take a command and read back", Effect.gen(function* () {
  const r = yield* fresh("old");
  const session = `session_${r}`;
  const requested = `run_req_${r}`;
  const withdrawn = `run_wd_${r}`;
  // Phase 6's forms: a requested run with three nulls, and a request cancelled before its grant as
  // `Cancelled` with the same nulls (the fixtures captured from phase 6's encoding), each at version 1.
  const requestedState = yield* storedRun("AgentRun.requested.state.json", session, requested);
  const cancelledState = yield* storedRun("AgentRun.cancelled-requested.state.json", session, withdrawn);
  yield* write(`Practice/Runs.AgentRunAggregate/${requested}`, "meta", { state: requestedState, version: 1 });
  yield* write(`Practice/Runs.AgentRunAggregate/${withdrawn}`, "meta", { state: cancelledState, version: 1 });
  // The session's view, as phase 6 stored a SessionRuns key (its snapshot shape, from phase 6's dump).
  const view = `Practice/Runs.SessionRunsView/${session}`;
  yield* write(view, "bf:id", session);
  yield* write(view, "bf:done:view%3ASessionRuns", true);
  yield* write(view, "snapshot", {
    state: {
      runs: [
        { run: requested, previous: null, parent: null, status: "requested" },
        { run: withdrawn, previous: null, parent: null, status: "cancelled" },
      ],
      requesters: ["p_req"],
    },
    version: 2,
    checkpoints: { [`AgentRun/${requested}`]: 1, [`AgentRun/${withdrawn}`]: 1 },
    seq: 2,
  });
  const runs = yield* runsClient;
  // Its requester cancels the requested run: it was stored with three nulls, and is withdrawn now.
  const receipt = yield* runs.CancelRun(RunId.make(requested), { reason: "no longer needed" }, human("p_req"));
  // The one stored as phase 6's cancelled-before-grant form reads as withdrawn: a second cancel is refused.
  const refused = yield* Effect.flip(runs.CancelRun(RunId.make(withdrawn), { reason: "again" }, human("p_req")));
  // Both read as cancelled to their requester; in storage the first is today's `Withdrawn`, and the
  // second, which took no command, is still the form phase 6 wrote.
  const states = yield* Effect.all([runStateAs(requested, "p_req"), runStateAs(withdrawn, "p_req")], { concurrency: 1 });
  const tags = yield* Effect.all([storedTag(requested), storedTag(withdrawn)], { concurrency: 1 });
  const read = yield* runs.SessionRuns.get(SessionId.make(session), { ...human("p_req"), atLeast: receipt });
  const stored = yield* psql(
    `SELECT value FROM alchemy_domain_objects WHERE object = 'Practice/Runs.AgentRunAggregate/${requested}' AND key = 'meta'`,
  );
  yield* log("stored-forms", { receipt, refused, states: A.map(states, statusOf), tags, read, stored });
  expect(receipt.version).toBe(2);
  expect(refused).toMatchObject({ _tag: "RunNotRunning", status: "cancelled" });
  expect(A.map(states, statusOf)).toEqual(["cancelled", "cancelled"]);
  expect(tags[0]).toBe("Withdrawn");
  expect(read).toMatchObject({
    runs: [
      { run: requested, previous: O.none(), parent: O.none(), status: "cancelled" },
      { run: withdrawn, previous: O.none(), parent: O.none(), status: "cancelled" },
    ],
    requesters: ["p_req"],
  });
  // What the command wrote is today's form: the withdrawn run, without the request's three nulls.
  expect(pipe(stored, Str.includes('"_tag":"Withdrawn"'))).toBe(true);
  expect(pipe(stored, Str.includes('"accountable"'))).toBe(false);
}));

/** What phase 6's restore case recorded before its dump (its claim view is in phase 6's form). */
const Phase6Seeded = S.Struct({
  r: S.String,
  org: S.String,
  claim: S.String,
  party: S.String,
  partyReceipt: S.Struct({ stream: S.String, version: S.Int }),
  hold: S.String,
  claimView: S.Struct({ status: S.String, proposal: S.Struct({ digest: S.String }) }),
});
/** Where phase 6's restore case left its record (`RESTORE_FILE`). */
const restoreFile = Config.String("RESTORE_FILE").pipe(Config.withDefault("/dev/null"));
/** The latest proposal in a review a client read, if it has one. */
const proposalIn = (state: ClaimReviewState | null | undefined) => O.flatMap(O.fromNullishOr(state), proposalOf);

if (O.contains(registration.restorePhase, "across")) {
  live("phase 6's dump restored under the phase 7 code: claim, run, party, directory, receipt and hold read, and approval completes the run", Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const file = yield* restoreFile;
    const text = yield* fs.readFileString(file);
    const seeded = yield* S.decodeEffect(S.fromJsonString(Phase6Seeded))(text);
    const { intake, reviewer } = yield* clients;
    const claim = ClaimId.make(seeded.claim);
    const org = OrgId.make(seeded.org);
    // The run phase 6 left waiting, stored in phase 6's form.
    const waiting = yield* runState(`review:${claim}:1`);
    // The claim's review: phase 6 stored it as a status literal; the view is version 1 now.
    const review = yield* eventually(reviewer.ClaimReview.get(claim, human("p_rev")), (found) => O.isSome(proposalIn(found)), 60);
    const party = yield* reviewer.EffectiveParty.get(PartyId.make(seeded.party), human("p_rev"));
    const page = yield* reviewer.FindParties({ org, text: seeded.r }, human("p_rev"));
    const retried = yield* intake.RegisterParty(
      PartyId.make(seeded.party),
      { org, name: `Dana ${seeded.r}` },
      { ...human("p_intake"), commandId: `reg_${seeded.r}` },
    );
    const hold = yield* get<{ readonly status: string }>(`/hold/${seeded.hold}`);
    yield* log("across-before-approval", { waiting: statusOf(waiting), review, party, page, retried, hold });
    expect(statusOf(waiting)).toBe("awaiting-approval");
    expect(O.map(proposalIn(review), (proposal) => proposal.digest)).toEqual(O.some(seeded.claimView.proposal.digest));
    expect(party).toMatchObject({ _tag: "Registered", name: `Dana ${seeded.r}` });
    expect(A.map(page.entries, (row) => row.partyId)).toEqual([seeded.party]);
    expect({ stream: retried.stream, version: retried.version }).toEqual(seeded.partyReceipt);
    expect(hold.status).toBe("expired");
    // Approving the proposal phase 6 left completes the run through the fact and the runs inbox.
    yield* reviewer.ApproveProposal(claim, { digest: seeded.claimView.proposal.digest, evidenceRevision: 1 }, human("p_rev"));
    const completed = yield* eventually(runState(`review:${claim}:1`), hasStatus("completed"), 120);
    const decided = yield* eventually(reviewer.ClaimReview.get(claim, human("p_rev")), ClaimReviewState.guards.Accepted, 60);
    yield* log("across-after-approval", { completed: O.getOrNull(completed), decided });
    expect(outcomeOf(completed)).toEqual(O.some("accepted"));
    expect(decided?._tag).toBe("Accepted");
  }));
}
