import * as Domain from "@alchemy.run/domain";
import { Actor } from "./Actor.ts";

/**
 * Who is making the current request. `Session` provides it to commands,
 * views and queries; a policy or saga provides it itself. Because it is a
 * `RequestContext`, its value is encoded with the command and travels to the
 * aggregate's instance wherever the platform hosts it.
 *
 * **Example** (Read the actor in decide)
 * ```ts
 * import { CurrentActor } from "@proto/kernel/CurrentActor.context";
 * import * as Effect from "effect/Effect";
 *
 * const whoAmI = Effect.map(Effect.service(CurrentActor), (actor) => actor._tag);
 * ```
 *
 * @category context
 * @since 0.0.0
 */
export class CurrentActor extends Domain.RequestContext<CurrentActor>()(
  "Kernel/CurrentActor",
  Actor,
) {}
