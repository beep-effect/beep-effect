import { M365Auth, M365ConfigInput } from "@beep/m365";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { strictEqual } from "@effect/vitest/utils";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import type { M365TokenCachePersistence } from "@beep/m365";

// Synthetic values only; no network is reached because the empty cache sends
// MSAL straight to the (absent) interactive authorizer.
const config = M365ConfigInput.make({ tenantId: "organizations", clientId: "00000000-0000-0000-0000-000000000002" });

describe("M365Auth host token cache", () => {
  it.effect("reads the host-owned cache before MSAL looks for an account", () =>
    Effect.gen(function* () {
      const loads = yield* Ref.make(0);
      const saves = yield* Ref.make(0);
      const tokenCache: M365TokenCachePersistence = {
        load: Ref.update(loads, (count) => count + 1).pipe(Effect.as(O.none<string>())),
        save: () => Ref.update(saves, (count) => count + 1),
      };
      const services = yield* Layer.build(M365Auth.makeLayer(config, { tokenCache }));
      const error = yield* Effect.flip(Context.get(services, M365Auth).acquireToken);

      strictEqual(error.reason, "auth");
      strictEqual((yield* Ref.get(loads)) > 0, true);
      strictEqual(yield* Ref.get(saves), 0);
    })
  );
});
