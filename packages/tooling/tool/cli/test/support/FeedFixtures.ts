/**
 * Builders for feed artifacts: a red gate record, a `task-outcomes/v2` record
 * indexing it, and the zip a hosted job uploads.
 *
 * @packageDocumentation
 */
import { GateRecord, GateRecordFromJson } from "@beep/gate-report/GateRecord";
import { GateReport, Totals } from "@beep/gate-report/GateReport";
import { Item, ItemDetail } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { GateFeedEntry, TaskOutcomeRecord, TaskOutcomeRecordV2 } from "@beep/repo-cli/commands/Ci";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { zipSync } from "fflate";

const encodeGateRecord = S.encodeUnknownResult(GateRecordFromJson);
const encodeV2 = S.encodeUnknownResult(S.fromJsonString(TaskOutcomeRecordV2));
const encodeV1 = S.encodeUnknownResult(S.fromJsonString(TaskOutcomeRecord));

/**
 * The bytes of a UTF-8 string.
 */
export const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

/**
 * A gate report with one failed item per message; green when there is none.
 */
export const gateReport = ({
  gate,
  subject,
  messages,
}: {
  readonly gate: string;
  readonly subject: string;
  readonly messages: ReadonlyArray<string>;
}): GateReport =>
  GateReport.make({
    gate,
    subject,
    itemKind: "test",
    runId: "20261122T100000000Z-0001",
    startedAt: DateTime.makeUnsafe(0),
    durationMs: 1200,
    inputFingerprint: "fingerprint",
    reason: A.isReadonlyArrayEmpty(messages) ? "passed" : "failed",
    outcome: A.isReadonlyArrayEmpty(messages) ? "all-pass" : "some-fail",
    units: [],
    items: A.map(messages, (message, index) =>
      Item.make({
        key: ItemKey.cases.TestKey.make({ file: "src/a.test.ts", fullName: `suite > case ${index}` }),
        unit: "src/a.test.ts",
        path: ["suite"],
        name: `case ${index}`,
        outcome: "failed",
        detail: ItemDetail.makeOption({ message }),
      })
    ),
    totals: Totals.make({ collected: messages.length, failed: messages.length }),
  });

/**
 * A gate record's JSON.
 */
export const gateRecordJson = (report: GateReport): string =>
  Result.getOrThrow(encodeGateRecord(GateRecord.make({ generatedAt: DateTime.makeUnsafe(0), report })));

/**
 * The feed entry of a package gate record.
 */
export const packageEntry = ({
  packageDir,
  gate,
  subject,
}: {
  readonly packageDir: string;
  readonly gate: string;
  readonly subject: string;
}): GateFeedEntry =>
  GateFeedEntry.make({
    gate,
    subject,
    record: `${packageDir}/.beep/gates/${gate}/report.json`,
    log: `${packageDir}/.beep/gates/${gate}/report.log`,
  });

/**
 * A `task-outcomes/v2` record's JSON.
 */
export const v2Json = ({
  job,
  reports,
}: {
  readonly job: string;
  readonly reports: ReadonlyArray<GateFeedEntry>;
}): string =>
  Result.getOrThrow(
    encodeV2(
      TaskOutcomeRecordV2.make({
        schemaVersion: "task-outcomes/v2",
        job,
        runId: O.some(1),
        runAttempt: O.some(1),
        tasks: [],
        reports,
      })
    )
  );

/**
 * A `task-outcomes/v1` record's JSON.
 */
export const v1Json = (job: string): string =>
  Result.getOrThrow(
    encodeV1(
      TaskOutcomeRecord.make({
        schemaVersion: "task-outcomes/v1",
        job,
        runId: O.none(),
        runAttempt: O.none(),
        tasks: [],
      })
    )
  );

/**
 * A feed artifact zip: the record plus files at their repository paths.
 */
export const feedZip = ({
  recordJson,
  files,
}: {
  readonly recordJson: string;
  readonly files: Readonly<Record<string, string>>;
}): Uint8Array =>
  zipSync({
    ".beep/ci-task-outcomes/record.json": bytes(recordJson),
    ...R.map(files, bytes),
  });
