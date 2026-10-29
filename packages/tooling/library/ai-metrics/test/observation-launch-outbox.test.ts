import { makeObservationClaims } from "@beep/repo-ai-metrics/observation-launch-claims";
import {
  makeObservationLaunchFacts,
  ObservationLaunchFact,
  ObservationLaunchReceipt,
} from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeServices } from "@effect/platform-node";
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import { claimFixture, claimId, claimSubmission } from "./fixtures/observation-claims.ts";

const layer = Layer.mergeAll(NodeServices.layer, Reactivity.layer);
const input = claimSubmission();
const started = ObservationLaunchSubmission.make({
  ...input,
  fact: ObservationLaunchFact.cases.Started.make({ launchId: input.fact.launchId, processInstanceId: claimId("9") }),
});
const bound = ObservationLaunchSubmission.make({
  ...input,
  fact: ObservationLaunchFact.cases.SessionBound.make({ launchId: input.fact.launchId, sourceSessionId: claimId("8") }),
});
const finished = ObservationLaunchSubmission.make({
  ...input,
  fact: ObservationLaunchFact.cases.Finished.make({ launchId: input.fact.launchId, outcome: "cancelled" }),
});
const backend = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp", prefix: "obs-outbox-sql-" });
  const sql = yield* SqliteClient.make({ filename: `${directory}/journal.sqlite` });
  return yield* makeObservationLaunchFacts(
    TranscriptIntakeConfig.make({
      hostId: input.hostId,
      namespaceId: input.namespaceId,
      maxPages: 4,
      maxPayloadBytes: 262144,
      maxDatabasePages: 256,
    })
  ).pipe(Effect.provideService(SqlClient.SqlClient, sql));
});

it.effect("recovers a lost commit acknowledgment from immutable producer facts without repeating the operation", () =>
  Effect.gen(function* () {
    const f = yield* claimFixture();
    const claims = yield* makeObservationClaims(f.policy, f.uid);
    const facts = yield* backend;
    const count = yield* Ref.make(0);
    yield* claims.runOnce(input, () => Ref.update(count, (n) => n + 1));
    yield* claims.appendObservation(started);
    const lost = yield* claims
      .reconcile(input.fact.launchId, (submission) =>
        facts.record(submission.fact, submission.evidenceEpoch).pipe(
          Effect.filterOrFail(
            () => submission.fact._tag !== "Started",
            () => "lost-ack" as const
          )
        )
      )
      .pipe(Effect.flip);
    expect(lost).toBe("lost-ack");
    expect((yield* facts.read(input.fact.launchId, 0)).length).toBe(2);
    expect((yield* claims.readOutbox(input.fact.launchId)).receipts.length).toBe(1);
    const reopened = yield* makeObservationClaims(f.policy, f.uid);
    const recovered = yield* reopened.reconcile(input.fact.launchId, (submission) =>
      facts.record(submission.fact, submission.evidenceEpoch)
    );
    expect(recovered).toEqual(yield* facts.read(input.fact.launchId, 0));
    yield* reopened.appendObservation(bound);
    yield* reopened.appendObservation(finished);
    const complete = yield* reopened.reconcile(input.fact.launchId, (submission) =>
      facts.record(submission.fact, submission.evidenceEpoch)
    );
    expect(A.map(complete, (receipt) => receipt.fact._tag)).toEqual([
      "Prepared",
      "Started",
      "SessionBound",
      "Finished",
    ]);
    expect((yield* reopened.readOutbox(input.fact.launchId)).receipts).toEqual(complete);
    expect((yield* reopened.runOnce(input, () => Ref.update(count, (n) => n + 1)).pipe(Effect.flip)).reason).toBe(
      "claimed"
    );
    expect(yield* Ref.get(count)).toBe(1);
  }).pipe(Effect.scoped, provideScopedLayer(layer))
);

it.effect("refuses unclaimed, changed-epoch, conflicting and impossible observations without rewriting evidence", () =>
  Effect.gen(function* () {
    const f = yield* claimFixture();
    const claims = yield* makeObservationClaims(f.policy, f.uid);
    expect((yield* claims.appendObservation(started).pipe(Effect.flip)).reason).toBe("unclaimed");
    yield* claims.runOnce(input, () => Effect.void);
    expect((yield* claims.appendObservation(bound).pipe(Effect.flip)).reason).toBe("conflict");
    expect(
      (yield* claims
        .appendObservation(ObservationLaunchSubmission.make({ ...started, evidenceEpoch: 1 }))
        .pipe(Effect.flip)).reason
    ).toBe("configuration");
    yield* claims.appendObservation(started);
    expect(yield* claims.appendObservation(started)).toEqual(started);
    expect(
      (yield* claims
        .appendObservation(
          ObservationLaunchSubmission.make({
            ...started,
            fact: ObservationLaunchFact.cases.Started.make({
              launchId: input.fact.launchId,
              processInstanceId: claimId("7"),
            }),
          })
        )
        .pipe(Effect.flip)).reason
    ).toBe("conflict");
    yield* claims.appendObservation(finished);
    expect((yield* claims.appendObservation(bound).pipe(Effect.flip)).reason).toBe("conflict");
    expect((yield* claims.readOutbox(input.fact.launchId)).submissions).toEqual([input, started, finished]);
  }).pipe(Effect.scoped, provideScopedLayer(layer))
);

it.effect("does not replace an original receipt when a replay returns a changed acknowledgment", () =>
  Effect.gen(function* () {
    const f = yield* claimFixture();
    const claims = yield* makeObservationClaims(f.policy, f.uid);
    const facts = yield* backend;
    yield* claims.runOnce(input, () => Effect.void);
    const original = yield* claims.reconcile(input.fact.launchId, (submission) =>
      facts.record(submission.fact, submission.evidenceEpoch)
    );
    expect(
      (yield* claims
        .reconcile(input.fact.launchId, (submission) =>
          facts
            .record(submission.fact, submission.evidenceEpoch)
            .pipe(
              Effect.map((receipt) => ObservationLaunchReceipt.make({ ...receipt, recordedAt: receipt.recordedAt + 1 }))
            )
        )
        .pipe(Effect.flip)).reason
    ).toBe("conflict");
    expect((yield* claims.readOutbox(input.fact.launchId)).receipts).toEqual(original);
  }).pipe(Effect.scoped, provideScopedLayer(layer))
);

it.effect("refuses a receipt for different metadata and retains the observation for reconciliation", () =>
  Effect.gen(function* () {
    const f = yield* claimFixture();
    const claims = yield* makeObservationClaims(f.policy, f.uid);
    const facts = yield* backend;
    yield* claims.runOnce(input, () => Effect.void);
    expect(
      (yield* claims
        .reconcile(input.fact.launchId, (submission) =>
          facts
            .record(submission.fact, submission.evidenceEpoch)
            .pipe(Effect.map((receipt) => ObservationLaunchReceipt.make({ ...receipt, hostId: claimId("7") })))
        )
        .pipe(Effect.flip)).reason
    ).toBe("conflict");
    expect((yield* claims.readOutbox(input.fact.launchId)).receipts).toEqual([]);
    expect((yield* claims.readOutbox(input.fact.launchId)).submissions).toEqual([input]);
  }).pipe(Effect.scoped, provideScopedLayer(layer))
);

it.effect("does not send from a torn outbox or infer Finished from a consumed claim", () =>
  Effect.gen(function* () {
    const f = yield* claimFixture();
    const claims = yield* makeObservationClaims(f.policy, f.uid);
    const facts = yield* backend;
    yield* claims.runOnce(input, () => Effect.void);
    expect((yield* claims.readOutbox(input.fact.launchId)).submissions).toEqual([input]);
    yield* f.fs.writeFileString(`${f.policy.directory}/fact-0-1.json`, "", { mode: 0o600 });
    expect(
      (yield* claims
        .reconcile(input.fact.launchId, (submission) => facts.record(submission.fact, submission.evidenceEpoch))
        .pipe(Effect.flip)).reason
    ).toBe("integrity");
    expect(yield* facts.read(input.fact.launchId, 0)).toEqual([]);
    expect((yield* claims.runOnce(input, () => Effect.void).pipe(Effect.flip)).reason).toBe("claimed");
  }).pipe(Effect.scoped, provideScopedLayer(layer))
);

it.effect("bounds reconciliation time and rejects overlapping local mutation while transport is pending", () =>
  Effect.gen(function* () {
    const f = yield* claimFixture();
    const claims = yield* makeObservationClaims(f.policy, f.uid);
    yield* claims.runOnce(input, () => Effect.void);
    const entered = yield* Deferred.make<void>();
    const fiber = yield* claims
      .reconcile(input.fact.launchId, () => Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)))
      .pipe(Effect.flip, Effect.forkChild);
    yield* Deferred.await(entered);
    expect((yield* claims.appendObservation(started).pipe(Effect.flip)).reason).toBe("contended");
    yield* TestClock.adjust("10 seconds");
    expect((yield* Fiber.join(fiber)).reason).toBe("ambiguous");
    expect((yield* claims.readOutbox(input.fact.launchId)).receipts).toEqual([]);
    yield* claims.appendObservation(started);
  }).pipe(Effect.scoped, provideScopedLayer(layer))
);

it.effect("a torn transport receipt does not prevent later local lifecycle observations", () =>
  Effect.gen(function* () {
    const f = yield* claimFixture();
    const claims = yield* makeObservationClaims(f.policy, f.uid);
    yield* claims.runOnce(input, () => Effect.void);
    yield* claims.appendObservation(started);
    yield* f.fs.writeFileString(`${f.policy.directory}/receipt-0-0.json`, "", { mode: 0o600 });
    expect(yield* claims.appendObservation(bound)).toEqual(bound);
    expect(yield* claims.appendObservation(finished)).toEqual(finished);
    expect(yield* claims.appendObservation(finished)).toEqual(finished);
    expect((yield* claims.readOutbox(input.fact.launchId).pipe(Effect.flip)).reason).toBe("integrity");
    expect(yield* f.fs.readFileString(`${f.policy.directory}/receipt-0-0.json`)).toBe("");
  }).pipe(Effect.scoped, provideScopedLayer(layer))
);
