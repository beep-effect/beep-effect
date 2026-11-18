// Generated from AuthorityModel by scripts/handlers.ts. Do not edit:
// `bun run handlers` rewrites it, and `bun run handlers --check` fails on drift.
import * as Layer from "effect/Layer";
import { OpenOnDelegateLive } from "./Delegation/OpenOnDelegate.handler.ts";
import { ExpireAtDeadlineLive } from "./Grant/ExpireAtDeadline.handler.ts";

/**
 * Every handler AuthorityModel needs, as one Layer, in model order.
 *
 * @category handlers
 * @since 0.0.0
 */
export const AuthorityHandlers = Layer.mergeAll(
  ExpireAtDeadlineLive,
  OpenOnDelegateLive,
);
