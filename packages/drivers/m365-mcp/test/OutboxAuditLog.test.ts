import {
  OutboxAttachmentDigest,
  OutboxAuditIds,
  OutboxAuditLog,
  OutboxAuditRecord,
  OutboxDraftCreatedRecord,
  OutboxSendIntentRecord,
  OutboxSendOutcomeRecord,
  outboxAuditFileName,
} from "@beep/m365-mcp";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert, describe } from "@effect/vitest";
import { Context, DateTime, Effect, FileSystem, Layer, Order, Path, pipe, Ref, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { DRAFT_ID, digestOf } from "./OutboxWorld.fixture.ts";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const SequentialIds = Layer.effect(
  OutboxAuditIds,
  Effect.gen(function* () {
    const counter = yield* Ref.make(0);
    return OutboxAuditIds.of({
      next: Ref.updateAndGet(counter, (count) => count + 1).pipe(Effect.map((n) => `audit-${n}`)),
    });
  })
);

const january = DateTime.makeUnsafe("2030-01-31T23:59:59Z");
const february = DateTime.makeUnsafe("2030-02-01T00:00:00Z");
const digest = OutboxAttachmentDigest.make({ name: "fixture.pdf", sha256: digestOf(7), size: 16 });

const draftCreated = (at: DateTime.Utc, attachments: ReadonlyArray<OutboxAttachmentDigest>, draftId = DRAFT_ID) =>
  OutboxDraftCreatedRecord.make({
    at,
    attachments,
    auditId: "audit-0",
    bcc: [],
    cc: [],
    draftId,
    subject: "Fixture subject",
    to: ["first@example.test"],
  });

const AuditLine = S.fromJsonString(OutboxAuditRecord);
const decodeLine = S.decodeUnknownResult(AuditLine);
const encodeLine = S.encodeResult(AuditLine);

const useLog = Effect.fnUntraced(function* <A, E, R>(
  directory: string,
  use: (log: OutboxAuditLog["Service"]) => Effect.Effect<A, E, R>
) {
  const context = yield* Layer.build(OutboxAuditLog.layer(directory).pipe(Layer.provide(SequentialIds)));
  return yield* use(Context.get(context, OutboxAuditLog));
});

const tempDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return path.join(yield* fs.makeTempDirectoryScoped({ prefix: "outbox-audit-" }), "audit");
});

describe("@beep/m365-mcp outbox audit log", () => {
  it.prop(
    "round-trips every record through one JSON line",
    [Arbitrary.schema(OutboxAuditRecord)],
    ([record]) => {
      const line = Result.getOrThrow(encodeLine(record));

      assert.notInclude(line, "\n");
      assert.isTrue(S.toEquivalence(OutboxAuditRecord)(Result.getOrThrow(decodeLine(line)), record));
    },
    { arbitrary: fcRuns(50) }
  );

  it.layer(PlatformLayer, { timeout: "10 seconds" })("on disk", (it) => {
    it.effect(
      "appends one line per record to the month's file in a private directory",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* tempDirectory;

        const ids = yield* useLog(directory, (log) =>
          Effect.gen(function* () {
            const auditId = yield* log.nextAuditId;
            yield* log.append(
              OutboxSendIntentRecord.make({
                at: january,
                attachments: [],
                auditId,
                bcc: [],
                cc: [],
                draftId: DRAFT_ID,
                subject: "Fixture subject",
                to: ["first@example.test"],
              })
            );
            yield* log.append(
              OutboxSendOutcomeRecord.make({ at: february, auditId, draftId: DRAFT_ID, outcome: "sent" })
            );
            return [auditId, yield* log.nextAuditId];
          })
        );
        const names = pipe(yield* fs.readDirectory(directory), A.sort(Order.String));
        const lines = yield* Effect.forEach(names, (name) =>
          fs.readFileString(path.join(directory, name)).pipe(Effect.map(Str.split("\n")))
        );
        const stat = yield* fs.stat(directory);

        assert.deepStrictEqual(ids, ["audit-1", "audit-2"]);
        assert.deepStrictEqual(names, ["2030-01.jsonl", "2030-02.jsonl"]);
        assert.deepStrictEqual(
          A.map(lines, (fileLines) => A.map(fileLines, (line) => (Str.isEmpty(line) ? "" : "record"))),
          [
            ["record", ""],
            ["record", ""],
          ]
        );
        assert.deepStrictEqual(
          pipe(
            A.flatten(lines),
            A.filter(Str.isNonEmpty),
            A.map((line) => Result.getOrThrow(decodeLine(line))),
            A.map((record) => [record._tag, record.auditId])
          ),
          [
            ["send-intent", "audit-1"],
            ["send-outcome", "audit-1"],
          ]
        );
        assert.strictEqual(stat.mode & 0o777, 0o700);
        assert.strictEqual(outboxAuditFileName(draftCreated(january, [])), "2030-01.jsonl");
      })
    );

    it.effect(
      "knows which drafts it recorded creating, across months, skipping a torn line",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* tempDirectory;

        const found = yield* useLog(directory, (log) =>
          Effect.gen(function* () {
            const before = yield* log.hasCreatedDraft(DRAFT_ID);
            yield* log.append(draftCreated(january, [digest]));
            yield* log.append(draftCreated(february, [], "other-draft"));
            yield* fs.writeFileString(path.join(directory, "2030-02.jsonl"), '{"_tag":"draft-crea', { flag: "a" });
            return [
              before,
              yield* log.hasCreatedDraft(DRAFT_ID),
              yield* log.hasCreatedDraft("other-draft"),
              yield* log.hasCreatedDraft("never-created"),
            ];
          })
        );

        assert.deepStrictEqual(found, [false, true, true, false]);
      })
    );

    it.effect(
      "surfaces a failed append as a typed error",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* tempDirectory;

        const failure = yield* useLog(directory, (log) =>
          Effect.gen(function* () {
            yield* log.append(draftCreated(january, []));
            // A read-only directory refuses a new month's file.
            yield* Effect.acquireRelease(fs.chmod(directory, 0o500), () => Effect.ignore(fs.chmod(directory, 0o700)));
            return yield* log.append(draftCreated(february, [])).pipe(Effect.flip);
          })
        );

        assert.strictEqual(failure._tag, "OutboxAuditError");
        assert.strictEqual(failure.reason, "append");
      })
    );
  });
});
