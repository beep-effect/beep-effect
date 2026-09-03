/**
 * Sidecar rpc-composition smoke test (gated).
 *
 * Drives the real {@link ChatRpcs} handler group — as composed by the app-local
 * fixture runtime {@link RuntimeTest} (deterministic FixtureTurnKernel +
 * in-memory ThreadStore + in-memory usage sink) — through an in-process
 * {@link RpcTest} client, exercising the exact rpc surface the bun sidecar
 * serves over http/ndjson:
 *
 *   1. CreateThread  → asserts a thread is created
 *   2. SendMessage   → asserts the assistant turn streams blocks
 *   3. GetTimeline   → asserts user+assistant turns persisted
 *
 * This proves the handler-group composition end to end without spawning a
 * subprocess or a socket server (the live PGlite-backed HTTP path is verified
 * manually via `bun run dev:sidecar`). The same `RpcClient` API and `ChatRpcs`
 * wire contract are used, so a green run here means the sidecar's rpc handlers
 * resolve, stream, and persist correctly.
 *
 * Gated on `BEEP_TEST_SIDECAR_SMOKE=1` to keep it opt-in alongside the other
 * integration-lane suites.
 */
import { ChatRpcs } from "@beep/agents-use-cases/public";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "@effect/vitest";
import * as Chunk from "effect/Chunk";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import { RpcTest } from "effect/unstable/rpc";
import { decodeWorkspaceId, userDocument } from "@/chat/ChatFixtures";
import { RuntimeTest } from "@/runtime/Layer";

const shouldRun = Bun.env.BEEP_TEST_SIDECAR_SMOKE === "1";

const smokeProgram = Effect.gen(function* () {
  const client = yield* RpcTest.makeClient(ChatRpcs);
  const workspaceId = decodeWorkspaceId(1);

  const thread = yield* client.CreateThread({ workspaceId, title: "Smoke matter" });
  expect(thread.title).toBe("Smoke matter");

  const blocks = yield* client
    .SendMessage({ threadId: thread.id, content: userDocument("hello sidecar"), requestId: "sidecar-smoke-test" })
    .pipe(Stream.runCollect, Effect.map(Chunk.fromIterable));
  expect(Chunk.size(blocks)).toBeGreaterThan(0);

  const timeline = yield* client.GetTimeline({ threadId: thread.id });
  const roles = timeline.turns.flatMap((turn) =>
    turn.items.flatMap((item) => (item.kind === "message" ? [item.role] : []))
  );
  expect(roles).toContain("user");
  expect(roles).toContain("assistant");
});

// Build a fresh in-process rpc client wired to the fixture runtime handler
// group, mirroring how the sidecar binds ChatRpcs to RuntimeLive.
const smoke = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const ontologyWorkspaceRoot = yield* fileSystem.makeTempDirectoryScoped({ prefix: "sidecar-smoke-ontology-" });
  const OntologyWorkspaceConfigTest = ConfigProvider.layer(
    ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: ontologyWorkspaceRoot })
  );
  const runtime = RuntimeTest.pipe(Layer.provide(OntologyWorkspaceConfigTest));

  yield* smokeProgram.pipe(provideScopedLayer(runtime));
}).pipe(provideScopedLayer(BunFileSystem.layer));

if (!shouldRun) {
  describe.skip("Professional desktop sidecar smoke (set BEEP_TEST_SIDECAR_SMOKE=1)", () => {});
} else {
  describe("Professional desktop sidecar smoke", { concurrent: false }, () => {
    it.effect("creates a thread, streams a fixture turn, and persists it through ChatRpcs", () => smoke);
  });
}
