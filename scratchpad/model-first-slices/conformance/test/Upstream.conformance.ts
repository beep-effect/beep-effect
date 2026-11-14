import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Socket from "effect/socket/Socket";
import { conformance } from "../src/upstream/conformance.ts";

// Upstream's ten Domain conformance cases, against the conformance model hosted on this stack's
// pool and served by its front under the root path.
const url = process.env.CONFORMANCE_URL ?? "http://127.0.0.1:18640";
const services = Layer.mergeAll(FetchHttpClient.layer, Socket.layerWebSocketConstructorGlobal);

conformance({
  test: (name, effect, options) =>
    it.live(name, () => effect.pipe(Effect.provide(services)) as Effect.Effect<void, unknown>, Number(process.env.CASE_TIMEOUT ?? options?.timeout)),
  // Upstream's waitForReady parses `/ready`'s plain "ok" as JSON, so it always retries for three
  // minutes before giving up quietly; the stack is checked ready before this suite runs instead.
  url: Effect.succeed(url),
  kind: "local",
});
