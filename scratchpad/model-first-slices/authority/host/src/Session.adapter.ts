import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { Session, Unauthorized } from "@proto/kernel/Session.middleware";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Boundary, BoundaryLive } from "./Boundary/Boundary.ts";
import * as FixtureCredential from "./Boundary/FixtureCredential.ts";

/**
 * The live half of the kernel's `Session`: read the request's credential,
 * have the boundary admit it, and run the call under the invocation it
 * built. Requires the hosted authority model.
 *
 * **Gotchas**
 *
 * The credential is a fixture ({@link FixtureCredential}). The suffix of this
 * file is an open naming question: `.adapter.ts` because it implements a
 * declared contract (the middleware) over a driver (the identity provider).
 *
 * **Example** (Serve a model's Api through the boundary)
 * ```ts
 * import * as Domain from "@alchemy.run/domain";
 * import { hostAuthority } from "@proto/authority-host/Host";
 * import { SessionLive } from "@proto/authority-host/Session.adapter";
 * import * as Layer from "effect/Layer";
 *
 * const session = SessionLive.pipe(Layer.provide(hostAuthority(Domain.InMemory)));
 * ```
 *
 * @category middleware
 * @since 0.0.0
 */
export const SessionLive = Layer.effect(
  Session,
  Effect.gen(function* () {
    const boundary = yield* Boundary;
    return (effect, { headers }) =>
      Effect.gen(function* () {
        const credential = yield* Effect.fromOption(FixtureCredential.read(headers)).pipe(
          Effect.mapError(() => new Unauthorized()),
        );
        const invocation = yield* boundary.admit(credential, yield* DateTime.now);
        return yield* Effect.provideService(effect, CurrentInvocation, invocation);
      });
  }),
).pipe(Layer.provide(BoundaryLive));
