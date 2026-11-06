/**
 * Decision-log service contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type { FsGuardError } from "@beep/repo-cli-kit/cli/FsGuards";
import type * as Effect from "effect/Effect";
import type { GoalDecisionLogReport } from "./Decisions.schemas.ts";
import type { GoalPacketRecord } from "./Inventory.ts";

const $I = $RepoCliId.create("commands/Goals/Decisions.service");

/**
 * Operations of the decision-log service.
 *
 * **Details**
 *
 * `report` reads a packet's `decisions/` files and compares the committed
 * `SPEC.md` / `PLAN.md` blocks with the expected projection without writing.
 * `write` regenerates every projection that applies and drifts, and refuses
 * (returning the report unchanged) while any decision file is invalid.
 *
 * @category services
 * @since 0.0.0
 */
export type GoalDecisionLogShape = {
  readonly report: (record: GoalPacketRecord) => Effect.Effect<GoalDecisionLogReport>;
  readonly write: (record: GoalPacketRecord) => Effect.Effect<GoalDecisionLogReport, FsGuardError>;
};

/**
 * Service that projects `goals/<slug>/decisions/*.md` into the packet's
 * generated Decision log and Checkpoints blocks.
 *
 * **Example** (Name the service)
 *
 * ```ts
 * import { GoalDecisionLog } from "@beep/repo-cli/commands/Goals/Decisions.service"
 *
 * console.log(typeof GoalDecisionLog.key) // "string"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GoalDecisionLog extends Context.Service<GoalDecisionLog, GoalDecisionLogShape>()($I`GoalDecisionLog`) {}
