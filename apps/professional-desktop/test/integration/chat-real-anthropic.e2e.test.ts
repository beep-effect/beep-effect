/**
 * Real Anthropic chat parity E2E (gated).
 *
 * Drives the same chat orchestration used by the sidecar, but swaps the fixture
 * turn kernel for the live Anthropic kernel and keeps the real Drizzle/PgLite
 * persistence boundary. It is intentionally opt-in because it spends Anthropic
 * tokens and requires a real `AI_ANTHROPIC_API_KEY`.
 *
 * Required env:
 * - `BEEP_TEST_REAL_ANTHROPIC_CHAT=1`
 * - `AI_ANTHROPIC_API_KEY`
 *
 * Database note: this suite uses the production in-process PGlite path against
 * a temporary data directory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AnthropicTurnKernel } from "@beep/agents-server/AnthropicTurnKernel";
import { AgentTurnKernel } from "@beep/agents-use-cases/public";
import { makeDrizzleLayer } from "@beep/postgres";
import { makePgliteSqlTestLayer } from "@beep/test-utils";
import { Thread as ThreadLayers } from "@beep/workspace-server";
import { Thread } from "@beep/workspace-use-cases/server";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, it, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { decodeWorkspaceId, userDocument } from "@/chat/ChatFixtures";
import { makeChatOperations } from "@/chat/ChatOrchestrator";
import { UsageRecordSink, UsageRecordSinkDrizzle } from "@/chat/UsageRecordSink";
import { migrateProfessionalDesktopDatabase } from "@/runtime/Migrations";
import type * as Md from "@beep/md/Md.model";

const realAnthropicChatTimeoutMillis = 300_000;
const shouldRunRealAnthropic = Bun.env.BEEP_TEST_REAL_ANTHROPIC_CHAT === "1";
const anthropicApiKeyEnv = "AI_ANTHROPIC_API_KEY";
// The bundled migrations issue `CREATE EXTENSION btree_gist`, so the test
// database has to register the bundled extension exactly as the sidecar's
// `makeBundledPgliteLayer` does.
const makeInProcessPgliteLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const prompt = [
  "Return exactly these three rich blocks and no prose:",
  "1. A mermaid diagram code block with language mermaid. Use: graph TD\\n  A[Client] --> B[Sidecar] --> C[Persisted @beep/md]",
  "2. A table block with headerRow true, columns Feature and Status, and one row Rich blocks / Ready.",
  "3. A youtube block with videoId M7lc1UVf-VE.",
].join("\n");

const migrateAll = Effect.fnUntraced(function* () {
  yield* migrateProfessionalDesktopDatabase();
});

const hasStreamedMermaid = (blocks: ReadonlyArray<unknown>): boolean =>
  A.some(
    blocks,
    (block) =>
      P.isObject(block) &&
      block.type === "code" &&
      block.language === "mermaid" &&
      P.isString(block.code) &&
      Str.includes("graph")(block.code)
  );

const hasStreamedTable = (blocks: ReadonlyArray<unknown>): boolean =>
  A.some(blocks, (block) => P.isObject(block) && block.type === "table");

const hasStreamedYouTube = (blocks: ReadonlyArray<unknown>): boolean =>
  A.some(blocks, (block) => P.isObject(block) && block.type === "youtube" && block.videoId === "M7lc1UVf-VE");

const persistedAssistantDocuments = (timeline: Thread.ThreadTimeline): ReadonlyArray<Md.Document.Type> =>
  pipe(
    timeline.turns,
    A.flatMap((turn) =>
      pipe(
        A.map(turn.items, (item) =>
          item.kind === "message" && item.role === "assistant" ? O.some(item.content) : O.none()
        ),
        A.getSomes
      )
    )
  );

const hasPersistedMermaid = (document: Md.Document.Type): boolean =>
  A.some(
    document.children,
    (block) => block._tag === "pre" && O.contains(block.language, "mermaid") && Str.includes("graph")(block.value)
  );

const hasPersistedTable = (document: Md.Document.Type): boolean =>
  A.some(document.children, (block) => block._tag === "table");

const hasPersistedYouTube = (document: Md.Document.Type): boolean =>
  A.some(document.children, (block) => block._tag === "youtube" && block.videoId === "M7lc1UVf-VE");

const RealAnthropicChatLayer = Layer.mergeAll(
  ThreadLayers.ThreadStoreDrizzleLayer,
  UsageRecordSinkDrizzle,
  AnthropicTurnKernel,
  BunFileSystem.layer,
  BunPath.layer
).pipe(
  Layer.provideMerge(makeDrizzleLayer()),
  Layer.provideMerge(makeInProcessPgliteLayer()),
  Layer.provideMerge(BunCrypto.layer)
);

const hasAnthropicApiKey =
  P.isString(Bun.env[anthropicApiKeyEnv]) && Str.isNonEmpty(Str.trim(Bun.env[anthropicApiKeyEnv]));
const enabledWithoutApiKey = shouldRunRealAnthropic && !hasAnthropicApiKey;
const shouldRun = shouldRunRealAnthropic && hasAnthropicApiKey;

if (!shouldRunRealAnthropic) {
  describe.skip("Professional desktop real Anthropic chat parity E2E (set BEEP_TEST_REAL_ANTHROPIC_CHAT=1)", () => {});
} else if (enabledWithoutApiKey) {
  describe("Professional desktop real Anthropic chat parity E2E", () => {
    it("requires AI_ANTHROPIC_API_KEY when enabled", () => {
      expect.fail("Set AI_ANTHROPIC_API_KEY.");
    });
  });
} else if (shouldRun) {
  describe("Professional desktop real Anthropic chat parity E2E", { concurrent: false }, () => {
    layer(RealAnthropicChatLayer, { timeout: "10 minutes" })((it) => {
      it.effect(
        "streams and persists mermaid, table, and youtube blocks as @beep/md",
        Effect.fnUntraced(function* () {
          yield* migrateAll();
          const store = yield* Thread.ThreadStore;
          const kernel = yield* AgentTurnKernel;
          const usage = yield* UsageRecordSink;
          const ops = yield* makeChatOperations(store, kernel, usage);

          const workspaceId = decodeWorkspaceId(3);
          const thread = yield* ops.createThread(workspaceId, "Real Anthropic rich blocks");

          const streamed = yield* ops.sendMessage(thread.id, userDocument(prompt)).pipe(Stream.runCollect);

          expect(hasStreamedMermaid(streamed)).toBe(true);
          expect(hasStreamedTable(streamed)).toBe(true);
          expect(hasStreamedYouTube(streamed)).toBe(true);

          const timeline = yield* ops.getTimeline(thread.id);
          const documents = persistedAssistantDocuments(timeline);
          expect(A.length(documents)).toBeGreaterThan(0);

          const document = documents[0];
          if (document === undefined) {
            expect.fail("Expected a persisted assistant document.");
          }

          expect(hasPersistedMermaid(document)).toBe(true);
          expect(hasPersistedTable(document)).toBe(true);
          expect(hasPersistedYouTube(document)).toBe(true);
        }),
        realAnthropicChatTimeoutMillis
      );
    });
  });
}
