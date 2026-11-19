import { it } from "@effect/vitest";
import { conformance } from "@proto/conformance-upstream/conformance";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as O from "@beep/utils/Option";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Socket from "effect/socket/Socket";
import { registration, url } from "./Stack.ts";

// Upstream's ten Domain conformance cases, against the conformance model hosted on this stack's
// pool and served by its front under the root path.
const services = Layer.mergeAll(FetchHttpClient.layer, Socket.layerWebSocketConstructorGlobal, SecureRandom.layerWebCrypto);

conformance({
  // A case reads an HTTP client and secure randomness; these services are built into the case's
  // scope. `CASE_TIMEOUT` overrides upstream's per-case timeout.
  test: <E>(
    name: string,
    effect: Effect.Effect<void, E, Layer.Success<typeof services>>,
    options?: { readonly timeout?: number },
  ) =>
    it.live(
      name,
      () => Effect.flatMap(Layer.build(services), (context) => Effect.provideContext(effect, context)),
      O.getOrUndefined(O.orElse(registration.caseTimeout, () => O.fromNullishOr(options?.timeout))),
    ),
  // Upstream's waitForReady parses `/ready`'s plain "ok" as JSON, so it always retries for three
  // minutes before giving up quietly; the stack is checked ready before this suite runs instead.
  url,
  kind: "local",
});
