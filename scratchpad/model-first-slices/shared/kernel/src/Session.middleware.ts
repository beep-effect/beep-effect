import * as RpcMiddleware from "effect/rpc/RpcMiddleware";
import * as S from "effect/Schema";
import { CurrentActor } from "./CurrentActor.context.ts";

/**
 * The request carries no session the host could resolve to an actor.
 *
 * @category errors
 * @since 0.0.0
 */
export class Unauthorized extends S.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  { httpApiStatus: 401 },
) {}

/**
 * Authenticates a request and provides who is making it as the
 * {@link CurrentActor}. This is the declaration only: a host provides the
 * live half (headers to actor). Authorization stays with each command's
 * `decide`, each view's `validate` and each query's handler.
 *
 * @category middleware
 * @since 0.0.0
 */
export class Session extends RpcMiddleware.Service<Session, { provides: CurrentActor }>()(
  "Kernel/Session",
  { error: Unauthorized },
) {}
