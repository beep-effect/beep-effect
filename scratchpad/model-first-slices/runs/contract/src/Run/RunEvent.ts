import { carry } from "@proto/kernel/Invocation";
import type * as S from "effect/Schema";
import { SessionId } from "./Session.id.ts";

/**
 * The fields every run event carries: its own, the session whose chain the
 * run belongs to (so a session's read can follow every run in it), and its
 * provenance.
 *
 * **Example** (A run event)
 * ```ts
 * import * as Domain from "@alchemy.run/domain";
 * import { RunEvent } from "@proto/runs-contract/Run/RunEvent";
 * import * as S from "effect/Schema";
 *
 * export class RunCompleted extends Domain.Event("RunCompleted", RunEvent.fields({ outcome: S.String }), { description: "The run finished with this outcome. `released` is the units its open reservations held, now returned." }) {}
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const RunEvent = {
  fields: <const F extends S.Struct.Fields>(fields: F) => carry({ session: SessionId, ...fields }),
};
