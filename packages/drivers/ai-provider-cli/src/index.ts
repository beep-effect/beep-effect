/**
 * Claude and Codex CLI status-probe driver.
 *
 * **Details**
 *
 * The public entry point exposes redacted models, typed errors, and the
 * `AiProviderCli` service used to check local CLI authentication without
 * returning raw account or token output.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Redacted provider CLI error exports.
 *
 * **Example** (Construct redacted CLI error)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AiProviderCliError } from "@beep/ai-provider-cli"
 *
 * const error = AiProviderCliError.make({
 *   command: O.some("codex"),
 *   message: "Failed to execute provider CLI status command.",
 *   operation: "checkAuth",
 *   provider: "codex",
 *   stderr: O.some("not logged in")
 * })
 *
 * console.log(error.provider) // "codex"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./AiProviderCli.errors.ts";
/**
 * Schema-backed provider CLI probe model exports.
 *
 * **Example** (Make auth probe model)
 *
 * ```ts
 * import { AiProviderCliAuthProbe } from "@beep/ai-provider-cli"
 *
 * const probe = AiProviderCliAuthProbe.make({
 *   command: "claude",
 *   provider: "claude",
 *   status: "authenticated"
 * })
 *
 * console.log(probe.status) // "authenticated"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./AiProviderCli.models.ts";
/**
 * Effect service exports for Claude and Codex auth probes.
 *
 * **Example** (Probe auth with mock runner)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { AiProviderCli, AiProviderCliProcessResult, type AiProviderCliRunner } from "@beep/ai-provider-cli"
 *
 * const runner: AiProviderCliRunner = (request) =>
 *   Effect.succeed(
 *     AiProviderCliProcessResult.make({
 *       exitCode: request.provider === "claude" ? 0 : 1,
 *       stderr: "",
 *       stdout: request.executable
 *     })
 *   )
 *
 * const program = Effect.gen(function* () {
 *   const cli = yield* AiProviderCli
 *   const probe = yield* cli.checkAuth("claude")
 *   return probe.status
 * }).pipe(Effect.provide(AiProviderCli.makeLayerFromRunner(runner)))
 *
 * console.log(Effect.runSync(program)) // "authenticated"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./AiProviderCli.service.ts";
/**
 * Provider CLI home-layout error exports.
 *
 * **Example** (Make home path conflict error)
 *
 * ```ts
 * import { AiProviderCliHomePathConflictError } from "@beep/ai-provider-cli"
 *
 * const error = AiProviderCliHomePathConflictError.make({
 *   effectiveHomePath: "/home/dev/.codex",
 *   sharedHomePath: "/home/dev/.codex"
 * })
 *
 * console.log(error._tag) // "AiProviderCliHomePathConflictError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./AiProviderCliHome.errors.ts";
/**
 * Provider CLI home-layout model exports.
 *
 * **Example** (Make Codex home layout)
 *
 * ```ts
 * import { AiProviderCliCodexHomeLayout } from "@beep/ai-provider-cli"
 *
 * const layout = AiProviderCliCodexHomeLayout.make({
 *   mode: "direct",
 *   sharedHomePath: "/home/dev/.codex"
 * })
 *
 * console.log(layout.mode) // "direct"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./AiProviderCliHome.models.ts";
/**
 * Effect service exports for provider CLI home isolation mechanics.
 *
 * **Example** (Resolve Claude home path)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { AiProviderCliHome } from "@beep/ai-provider-cli"
 *
 * const program = Effect.gen(function* () {
 *   const home = yield* AiProviderCliHome
 *   return home.resolveClaudeHome(O.none())
 * })
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./AiProviderCliHome.service.ts";
