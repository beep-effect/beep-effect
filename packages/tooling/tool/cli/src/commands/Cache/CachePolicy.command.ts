/**
 * `beep quality cache-policy`: the read-only Cache qualification policy audit.
 *
 * **Details**
 *
 * The audit is Cache's own engine, so the command lives with the Cache group
 * (beep-cli-composition W1); the command path stays under `quality` so the
 * `beep` surface is unchanged.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { runCachePolicyAudit } from "./Cache.command.ts";
import { CacheQualificationLive } from "./Cache.service.ts";
import { CacheHostedProducerVerifierLive } from "./Cache.workflow.github.ts";

/**
 * Enforce Cache's reviewed qualification policy without writing qualification state.
 *
 * **Example** (Reference the registered subcommand)
 *
 * ```ts
 * console.log("bun run beep quality cache-policy")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const cachePolicyCommand = Command.make("cache-policy", {}, () =>
  findRepoRoot().pipe(Effect.flatMap((root) => runCachePolicyAudit(root, false)))
).pipe(
  Command.withDescription("Enforce Cache's reviewed qualification policy without writing qualification state"),
  Command.provide(CacheQualificationLive.pipe(Layer.provideMerge(CacheHostedProducerVerifierLive)))
);
