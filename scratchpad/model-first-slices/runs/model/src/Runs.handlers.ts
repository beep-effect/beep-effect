// Generated from RunsModel by scripts/handlers.ts. Do not edit:
// `bun run handlers` rewrites it, and `bun run handlers --check` fails on drift.
import * as Layer from "effect/Layer";
import { ContinueAtBoundLive } from "./Run/ContinueAtBound.handler.ts";
import { GrantOnRequestLive } from "./Run/GrantOnRequest.handler.ts";
import { OpenChildOnRequestLive } from "./Run/OpenChildOnRequest.handler.ts";
import { ResumeParentLive } from "./Run/ResumeParent.handler.ts";
import { RunStateLive } from "./Run/RunState.handler.ts";
import { SessionRunsLive } from "./Run/SessionRuns.handler.ts";

/**
 * Every handler RunsModel needs, as one Layer, in model order.
 *
 * @category handlers
 * @since 0.0.0
 */
export const RunsHandlers = Layer.mergeAll(
  SessionRunsLive,
  GrantOnRequestLive,
  OpenChildOnRequestLive,
  ContinueAtBoundLive,
  ResumeParentLive,
  RunStateLive,
);
