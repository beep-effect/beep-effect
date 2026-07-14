import { fileURLToPath } from "node:url";
import { Document, P, Text } from "@beep/md";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { CuidState } from "@beep/schema/Cuid";
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { makePgliteIntegrationGate, TestDatabaseInfo } from "@beep/test-utils";
import { Thread } from "@beep/workspace-domain/entities/Thread";
import { makeDrizzleThreadStore } from "@beep/workspace-server/aggregates/Thread";
import { DbSchema } from "@beep/workspace-tables";
import { toThreadInsert } from "@beep/workspace-tables/entities/Thread";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const migrationsFolder = fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const { shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis, makePgliteLayer } = makePgliteIntegrationGate();

const decodeWorkspaceId = S.decodeUnknownEffect(WorkspaceIdentity.WorkspaceId);
const docOf = (value: string) => Document.make({ children: [P.make({ children: [Text.make({ value })] })] });
const MessagePublicId = PublicEntityId.factory(WorkspaceIdentity.MessageId);
const ThreadPublicId = PublicEntityId.factory(WorkspaceIdentity.ThreadId);
const TurnPublicId = PublicEntityId.factory(WorkspaceIdentity.TurnId);
const CuidTestLayer = CuidState.Default.pipe(Layer.provideMerge(BunCrypto.layer));

const migrateWorkspaceThread = Effect.fnUntraced(function* () {
  const info = yield* TestDatabaseInfo;
  const db = yield* makeDrizzle();
  const migrationsSchema = pipe(
    info.schema,
    O.getOrElse(() => "drizzle")
  );

  yield* migrate(db, { migrationsFolder, migrationsSchema });
});

const ThreadStoreDrizzleRepositoryLayer = makeDrizzleLayer().pipe(
  Layer.provideMerge(makePgliteLayer()),
  Layer.provideMerge(CuidTestLayer)
);

if (!shouldRunPgliteIntegration) {
  describe.skip("Workspace ThreadStore Drizzle repository PgLite integration", () => {});
} else {
  describe("Workspace ThreadStore Drizzle repository PgLite integration", { concurrent: false }, () => {
    layer(ThreadStoreDrizzleRepositoryLayer, { timeout: "5 minutes" })((it) => {
      it.effect(
        "persists a thread, ordered turns, and projects a timeline through Drizzle",
        Effect.fnUntraced(function* () {
          yield* migrateWorkspaceThread();
          const store = yield* makeDrizzleThreadStore();
          const workspaceId = yield* decodeWorkspaceId(2);

          const thread = yield* store.createThread({ title: "New thread", workspaceId });
          expect(thread.title).toBe("New thread");

          yield* store.setTitleIfEmpty({
            threadId: thread.id,
            emptyTitle: "New thread",
            title: "Matter intake",
          });
          yield* store.setTitleIfEmpty({
            threadId: thread.id,
            emptyTitle: "New thread",
            title: "Ignored replacement",
          });

          const threads = yield* store.listThreads(workspaceId);
          expect(threads.map((t) => t.id)).toEqual([thread.id]);
          expect(A.map(threads, (thread) => thread.title)).toEqual(["Matter intake"]);

          const first = yield* store.appendTurn({
            threadId: thread.id,
            parentTurnId: O.none(),
            role: "user",
            content: docOf("Hello"),
          });
          expect(first.turn.turnIndex).toBe(0);
          expect(TurnPublicId.is(first.turn.publicId)).toBe(true);
          expect(MessagePublicId.is(first.message.publicId)).toBe(true);

          const second = yield* store.appendTurn({
            threadId: thread.id,
            parentTurnId: O.some(first.turn.id),
            role: "assistant",
            content: docOf("Hi there"),
          });
          expect(second.turn.turnIndex).toBe(1);
          expect(O.getOrNull(second.turn.parentTurnId)).toStrictEqual(first.turn.id);
          expect(TurnPublicId.is(second.turn.publicId)).toBe(true);
          expect(MessagePublicId.is(second.message.publicId)).toBe(true);
          expect(second.turn.publicId).not.toBe(first.turn.publicId);
          expect(second.message.publicId).not.toBe(first.message.publicId);

          const timeline = yield* store.timeline(thread.id);
          expect(timeline.threadId).toStrictEqual(thread.id);
          expect(timeline.turns.map((turn) => turn.turnIndex)).toEqual([0, 1]);
          expect(timeline.turns.every((turn) => turn.costMicros === 0)).toBe(true);

          const firstItem = timeline.turns[0]?.items[0];
          expect(firstItem?.kind).toBe("message");
          if (firstItem?.kind === "message") {
            expect(firstItem.role).toBe("user");
          }
          const secondItem = timeline.turns[1]?.items[0];
          if (secondItem?.kind === "message") {
            expect(secondItem.role).toBe("assistant");
          }
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "persists multiple threads and appends with distinct canonical public ids",
        Effect.fnUntraced(function* () {
          yield* migrateWorkspaceThread();
          const store = yield* makeDrizzleThreadStore();
          const workspaceId = yield* decodeWorkspaceId(3);

          const threads = yield* Effect.all(
            A.makeBy(8, (index) => store.createThread({ title: `Concurrent thread ${index + 1}`, workspaceId })),
            { concurrency: 1 }
          );
          const publicIds = A.map(threads, (thread) => thread.publicId);
          const generatedPublicIdLength = Str.length(WorkspaceIdentity.ThreadId.tableName) + 25;

          expect(A.every(publicIds, ThreadPublicId.is)).toBe(true);
          expect(A.every(publicIds, (publicId) => Str.length(publicId) === generatedPublicIdLength)).toBe(true);
          expect(A.length(A.dedupe(publicIds))).toBe(8);

          const appended = yield* Effect.forEach(
            threads,
            (thread, index) =>
              store.appendTurn({
                threadId: thread.id,
                parentTurnId: O.none(),
                role: "user",
                content: docOf(`Concurrent message ${index + 1}`),
              }),
            { concurrency: 1 }
          );
          const turnPublicIds = A.map(appended, ({ turn }) => turn.publicId);
          const messagePublicIds = A.map(appended, ({ message }) => message.publicId);
          const generatedTurnPublicIdLength = Str.length(WorkspaceIdentity.TurnId.tableName) + 25;
          const generatedMessagePublicIdLength = Str.length(WorkspaceIdentity.MessageId.tableName) + 25;

          expect(A.every(turnPublicIds, TurnPublicId.is)).toBe(true);
          expect(A.every(turnPublicIds, (publicId) => Str.length(publicId) === generatedTurnPublicIdLength)).toBe(true);
          expect(A.length(A.dedupe(turnPublicIds))).toBe(8);
          expect(A.every(messagePublicIds, MessagePublicId.is)).toBe(true);
          expect(A.every(messagePublicIds, (publicId) => Str.length(publicId) === generatedMessagePublicIdLength)).toBe(
            true
          );
          expect(A.length(A.dedupe(messagePublicIds))).toBe(8);
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "reads legacy sequence-shaped public ids without a migration",
        Effect.fnUntraced(function* () {
          yield* migrateWorkspaceThread();
          const db = yield* makeDrizzle();
          const store = yield* makeDrizzleThreadStore();
          const workspaceId = yield* decodeWorkspaceId(4);
          const legacy = yield* S.decodeUnknownEffect(Thread)({
            createdAt: 1,
            createdByPrincipal: { component: "Runtime", kind: "System" },
            entityType: "WorkspaceThread",
            id: 1,
            orgId: 1,
            publicId: "workspace_thread_a999999",
            rowVersion: 1,
            schemaVersion: "0.0.0",
            source: "System",
            title: "Legacy thread",
            updatedAt: 1,
            updatedByPrincipal: { component: "Runtime", kind: "System" },
            workspaceId,
          });

          yield* db.insert(DbSchema.thread).values(toThreadInsert(legacy));

          const threads = yield* store.listThreads(workspaceId);
          expect(A.some(threads, (thread) => ThreadPublicId.equivalence(thread.publicId, legacy.publicId))).toBe(true);
        }),
        pgliteIntegrationTimeoutMillis
      );
    });
  });
}
