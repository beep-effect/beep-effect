import {
  captureObservationBackup,
  ObservationBackupPolicy,
  restoreObservationBackup,
} from "@beep/repo-ai-metrics/observation-backup";
import { makeObservationClaims, ObservationClaimPolicy } from "@beep/repo-ai-metrics/observation-launch-claims";
import { makeObservationLaunchFacts } from "@beep/repo-ai-metrics/observation-launch-facts";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import { claimFixture, claimSubmission } from "./fixtures/observation-claims.ts";

it.effect("an actual older SQLite restore cannot erase the independent launch claim", () =>
  Effect.gen(function* () {
    const f = yield* claimFixture();
    const input = claimSubmission();
    const config = TranscriptIntakeConfig.make({
      hostId: input.hostId,
      namespaceId: input.namespaceId,
      maxPages: 4,
      maxPayloadBytes: 262144,
      maxDatabasePages: 256,
    });
    const sql = yield* SqliteClient.make({ filename: `${f.policy.journalDirectory}/journal.sqlite` });
    const facts = yield* makeObservationLaunchFacts(config).pipe(Effect.provideService(SqlClient.SqlClient, sql));
    const backupPolicy = ObservationBackupPolicy.make({ maxBytes: 1048576 });
    const receipt = yield* captureObservationBackup(config, backupPolicy, `${f.root}/backup`).pipe(
      Effect.provideService(SqlClient.SqlClient, sql)
    );
    const claims = yield* makeObservationClaims(f.policy, f.uid);
    yield* claims.runOnce(input, () => facts.record(input.fact, input.evidenceEpoch));
    expect((yield* facts.read(input.fact.launchId, 0)).length).toBe(1);
    const original = yield* claims.reconcile(input.fact.launchId, (submission) =>
      facts.record(submission.fact, submission.evidenceEpoch)
    );
    const verifier = yield* SqliteClient.make({ filename: ":memory:" });
    yield* restoreObservationBackup(backupPolicy, `${f.root}/backup`, `${f.root}/restored`, receipt).pipe(
      Effect.provideService(SqlClient.SqlClient, verifier)
    );
    const restoredSql = yield* SqliteClient.make({ filename: `${f.root}/restored/journal.sqlite` });
    const restoredFacts = yield* makeObservationLaunchFacts(config).pipe(
      Effect.provideService(SqlClient.SqlClient, restoredSql)
    );
    expect(yield* restoredFacts.read(input.fact.launchId, 0)).toEqual([]);
    const reopened = yield* makeObservationClaims(
      ObservationClaimPolicy.make({ ...f.policy, journalDirectory: `${f.root}/restored` }),
      f.uid
    );
    expect((yield* reopened.runOnce(input, () => restoredFacts.record(input.fact, 0)).pipe(Effect.flip)).reason).toBe(
      "claimed"
    );
    expect(yield* restoredFacts.read(input.fact.launchId, 0)).toEqual([]);
    expect((yield* reopened.snapshot)[0]?.submission).toEqual(input);
    yield* TestClock.adjust("1 second");
    expect(
      (yield* reopened
        .reconcile(input.fact.launchId, (submission) => restoredFacts.record(submission.fact, submission.evidenceEpoch))
        .pipe(Effect.flip)).reason
    ).toBe("conflict");
    expect((yield* reopened.readOutbox(input.fact.launchId)).receipts).toEqual(original);
    expect((yield* restoredFacts.read(input.fact.launchId, 0)).length).toBe(1);
  }).pipe(Effect.scoped, provideScopedLayer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, Reactivity.layer)))
);
