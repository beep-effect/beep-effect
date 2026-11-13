import {
  OutboxAttachmentDigest,
  OutboxAuditIds,
  OutboxAuditLog,
  OutboxAuditRecord,
  OutboxDraftBasisClearedRecord,
  OutboxDraftBasisMarkedRecord,
  OutboxDraftClosedRecord,
  OutboxDraftCreatedRecord,
  OutboxDraftDeletedRecord,
  OutboxDraftIdentifiedRecord,
  OutboxEventCreatedRecord,
  OutboxSendIntentRecord,
  OutboxSendOutcomeRecord,
  openOutboxDrafts,
  outboxAuditFileName,
} from "@beep/m365-mcp";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert, describe } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
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
  const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped({ prefix: "outbox-audit-" });
  return path.join(madeTempDirectoryScoped, "audit");
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

  it("decodes a draft-created line written before pins existed with an empty basis", () => {
    // The shape create_draft wrote before the basis field: no `basis` key.
    const earlier =
      '{"_tag":"draft-created","at":"2030-01-15T12:00:00.000Z","attachments":[],"auditId":"audit-0","bcc":[],"cc":[],"draftId":"draft-1","subject":"Fixture subject","to":["first@example.test"],"version":1}';
    const record = Result.getOrThrow(decodeLine(earlier));

    assert.isTrue(S.is(OutboxDraftCreatedRecord)(record));
    if (S.is(OutboxDraftCreatedRecord)(record)) {
      assert.deepStrictEqual(record.basis, []);
      assertNone(record.internetMessageId);
      assert.strictEqual(record.draftId, DRAFT_ID);
    }
  });

  it("keeps a draft open until it is deleted, sent or closed, with its latest mark state", () => {
    const at = january;
    const open = openOutboxDrafts([
      draftCreated(at, [], "deleted"),
      OutboxDraftDeletedRecord.make({ at, auditId: "a", draftId: "deleted" }),
      draftCreated(at, [], "sent"),
      OutboxSendOutcomeRecord.make({ at, auditId: "b", draftId: "sent", outcome: "sent" }),
      draftCreated(at, [], "refused"),
      OutboxSendOutcomeRecord.make({ at, auditId: "c", draftId: "refused", outcome: "refused" }),
      draftCreated(at, [], "closed"),
      OutboxDraftClosedRecord.make({ at, auditId: "d", draftId: "closed", reason: "missing" }),
      draftCreated(at, [], "marked"),
      OutboxDraftBasisMarkedRecord.make({ at, auditId: "e", draftId: "marked", fields: [] }),
      draftCreated(at, [], "cleared"),
      OutboxDraftBasisMarkedRecord.make({ at, auditId: "f", draftId: "cleared", fields: ["start"] }),
      OutboxDraftBasisClearedRecord.make({ at, auditId: "g", draftId: "cleared" }),
      // A later draft-created record of the same draft wins and moves it to the end.
      draftCreated(february, [digest], "refused"),
    ]);

    assert.deepStrictEqual(
      A.map(open, (draft) => [draft.created.draftId, draft.basisMarked, A.length(draft.created.attachments)]),
      [
        ["marked", true, 0],
        ["cleared", false, 0],
        ["refused", false, 1],
      ]
    );
  });

  it("resolves a draft's message id from its creation record, else from the latest one learned", () => {
    const withId = OutboxDraftCreatedRecord.make({
      ...draftCreated(january, [], "with-id"),
      internetMessageId: O.some("<own@example.test>"),
    });
    const open = openOutboxDrafts([
      withId,
      draftCreated(january, [], "learned"),
      draftCreated(january, [], "unknown"),
      OutboxDraftIdentifiedRecord.make({
        at: january,
        auditId: "i1",
        draftId: "with-id",
        internetMessageId: "<other@example.test>",
      }),
      OutboxDraftIdentifiedRecord.make({
        at: january,
        auditId: "i2",
        draftId: "learned",
        internetMessageId: "<first@example.test>",
      }),
      OutboxDraftIdentifiedRecord.make({
        at: february,
        auditId: "i3",
        draftId: "learned",
        internetMessageId: "<latest@example.test>",
      }),
    ]);

    assert.deepStrictEqual(
      A.map(open, (draft) => [draft.created.draftId, draft.internetMessageId]),
      [
        ["with-id", O.some("<own@example.test>")],
        ["learned", O.some("<latest@example.test>")],
        ["unknown", O.none()],
      ]
    );
  });

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
        const readDirectory1 = yield* fs.readDirectory(directory);
        const names = pipe(readDirectory1, A.sort(Order.String));
        const lines = yield* Effect.forEach(names, (name) =>
          fs.readFileString(path.join(directory, name)).pipe(Effect.map(Str.split("\n")))
        );
        const stat = yield* fs.stat(directory);

        assert.deepStrictEqual(ids, ["audit-1", "audit-2"]);
        assert.deepStrictEqual(names, ["2030-01.jsonl", "2030-02.jsonl"]);
        assert.deepStrictEqual(
          A.map(lines, (fileLines) => A.map(fileLines, (line) => (Str.isEmpty(line) ? "" : "record"))),
          [
            ["", "record", ""],
            ["", "record", ""],
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
      "reads the open drafts from a journal of only earlier record kinds and after a closing",
      Effect.fnUntraced(function* () {
        const directory = yield* tempDirectory;

        const [before, after] = yield* useLog(directory, (log) =>
          Effect.gen(function* () {
            yield* log.append(draftCreated(january, []));
            const earlier = yield* log.openDrafts;
            yield* log.append(
              OutboxDraftClosedRecord.make({ at: february, auditId: "x", draftId: DRAFT_ID, reason: "sent" })
            );
            const later = yield* log.openDrafts;
            return [earlier, later] as const;
          })
        );

        assert.deepStrictEqual(
          A.map(before, (draft) => draft.created.draftId),
          [DRAFT_ID]
        );
        assert.deepStrictEqual(after, []);
      })
    );

    it.effect(
      "returns the latest draft-created record of a draft, and none for a draft it did not create",
      Effect.fnUntraced(function* () {
        const directory = yield* tempDirectory;

        const [found, missing] = yield* useLog(directory, (log) =>
          Effect.gen(function* () {
            yield* log.append(draftCreated(january, []));
            yield* log.append(draftCreated(february, [digest]));
            return [yield* log.createdDraft(DRAFT_ID), yield* log.createdDraft("never-created")] as const;
          })
        );

        assertSome(
          O.map(found, (record) => A.length(record.attachments)),
          1
        );
        assertNone(missing);
      })
    );

    it.effect(
      "keeps the record appended after a torn fragment that has no trailing newline",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* tempDirectory;

        const found = yield* useLog(directory, (log) =>
          Effect.gen(function* () {
            // What a crash in the middle of a write leaves: part of a record and no newline.
            yield* fs.writeFileString(path.join(directory, "2030-01.jsonl"), '{"_tag":"draft-crea');
            yield* log.append(draftCreated(january, []));
            yield* log.append(
              OutboxEventCreatedRecord.make({
                at: january,
                auditId: "audit-0",
                eventId: "event-1",
                subject: "Fixture event",
              })
            );
            return [
              yield* log.hasCreatedDraft(DRAFT_ID),
              yield* log.hasCreatedEvent("event-1"),
              yield* log.hasCreatedEvent(DRAFT_ID),
              yield* log.hasCreatedDraft("event-1"),
            ];
          })
        );

        assert.deepStrictEqual(found, [true, true, false, false]);
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
