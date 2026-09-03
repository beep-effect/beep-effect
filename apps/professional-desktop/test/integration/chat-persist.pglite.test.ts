/**
 * Chat persistence PgLite integration test (gated).
 *
 * Regression coverage for the assistant-turn finalize path over the REAL
 * Drizzle/PGlite store — the boundary the in-memory contract/smoke tests do not
 * exercise. It drives {@link makeChatOperations} (FixtureTurnKernel + Drizzle
 * ThreadStore + Drizzle UsageRecordSink) directly:
 *
 *   1. CreateThread  → a thread row is created
 *   2. SendMessage   → the assistant turn streams its blocks AND the turn is
 *      finalized into the jsonb `content` column on stream completion
 *   3. GetTimeline   → the persisted assistant turn decodes back identically,
 *      including the code block's `language` Option
 *
 * The fixture always emits a fenced code block, whose `Pre.language`
 * (`OptionFromNullOr<string>`) is the only Option-bearing field in the md
 * document. Before the JSON-safe codec fix, encoding the document put a real
 * Option in the jsonb column; the read-back decode then failed ("Expected
 * Option") and the finalize hung the live stream. This test would have caught
 * that and guards against its return.
 *
 * Gated on the same PgLite integration env as the other `.pglite` suites, but
 * pinned to the in-process driver so it proves the desktop runtime wiring
 * instead of Yeet's shared external SQL test server.
 */
import { FixtureTurnKernel } from "@beep/agents-use-cases/proof";
import { AgentTurnKernel } from "@beep/agents-use-cases/public";
import * as UsageRecordTable from "@beep/epistemic-tables/entities/UsageRecord";
import { makeDrizzle, makeDrizzleLayer } from "@beep/postgres";
import { makePgliteIntegrationGate, makePgliteSqlTestLayer } from "@beep/test-utils";
import { Thread as ThreadLayers } from "@beep/workspace-server";
import { Thread } from "@beep/workspace-use-cases/server";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as Chunk from "effect/Chunk";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import { decodeWorkspaceId, userDocument } from "@/chat/ChatFixtures";
import { makeChatOperations } from "@/chat/ChatOrchestrator";
import { UsageRecordSink, UsageRecordSinkDrizzle } from "@/chat/UsageRecordSink";
import { migrateOnBoot } from "@/runtime/Migrations";

const { shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis } = makePgliteIntegrationGate();
// The bundled migrations issue `CREATE EXTENSION btree_gist`, so the test
// database has to register the bundled extension exactly as the sidecar's
// `makeBundledPgliteLayer` does.
const makeInProcessPgliteLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const migrateAll = Effect.fnUntraced(function* () {
  yield* migrateOnBoot;
});

const ChatPersistLayer = Layer.mergeAll(
  ThreadLayers.ThreadStoreDrizzleLayer,
  UsageRecordSinkDrizzle,
  FixtureTurnKernel,
  BunFileSystem.layer,
  BunPath.layer
).pipe(
  Layer.provideMerge(makeDrizzleLayer()),
  Layer.provideMerge(makeInProcessPgliteLayer()),
  Layer.provideMerge(BunCrypto.layer)
);

if (!shouldRunPgliteIntegration) {
  describe.skip("Professional desktop chat persistence PgLite integration", () => {});
} else {
  describe("Professional desktop chat persistence PgLite integration", { concurrent: false }, () => {
    layer(ChatPersistLayer, { timeout: "5 minutes" })((it) => {
      it.effect(
        "finalizes a streamed assistant turn into the jsonb content column and reads it back identically",
        Effect.fnUntraced(function* () {
          yield* migrateAll();
          const store = yield* Thread.ThreadStore;
          const kernel = yield* AgentTurnKernel;
          const usage = yield* UsageRecordSink;
          const ops = yield* makeChatOperations(store, kernel, usage);

          const workspaceId = decodeWorkspaceId(2);
          const thread = yield* ops.createThread(workspaceId, "Persisted matter");

          // The stream must complete (the finalize defect previously hung it),
          // emitting the fixture's four blocks: heading, paragraph, list, code.
          const blocks = yield* ops
            .sendMessage(thread.id, userDocument("Hello persistence"))
            .pipe(Stream.runCollect, Effect.map(Chunk.fromIterable));
          expect(Chunk.size(blocks)).toBe(4);

          // The assistant turn must be persisted and round-trip back through the
          // jsonb column on read.
          const timeline = yield* ops.getTimeline(thread.id);
          expect(timeline.turns.length).toBe(2);

          const roles = timeline.turns.flatMap((turn) =>
            turn.items.flatMap((item) => (item.kind === "message" ? [item.role] : []))
          );
          expect(roles).toEqual(["user", "assistant"]);

          const assistantItem = timeline.turns[1]?.items[0];
          expect(assistantItem?.kind).toBe("message");
          if (assistantItem?.kind === "message") {
            const codeBlock = assistantItem.content.children.find((child) => child._tag === "pre");
            expect(codeBlock?._tag).toBe("pre");
            if (codeBlock?._tag === "pre") {
              // The Option-bearing field survived the jsonb round-trip.
              expect(O.isOption(codeBlock.language)).toBe(true);
              expect(O.getOrNull(codeBlock.language)).toBe("text");
            }
          }

          const db = yield* makeDrizzle();
          const usageRows = yield* db.select().from(UsageRecordTable.Table);
          expect(usageRows).toHaveLength(1);
          expect(usageRows[0]).toMatchObject({
            activityId: null,
            costUsdApproxMicros: 0,
            inputTokens: 12,
            model: "fixture",
            outputTokens: 8,
            provider: "fixture",
            totalTokens: 20,
          });
          expect(usageRows[0]?.latencyMillis).not.toBeNull();
        }),
        pgliteIntegrationTimeoutMillis
      );
    });
  });
}
