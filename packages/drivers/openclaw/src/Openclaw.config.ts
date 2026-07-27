/**
 * Runtime constants and hermetic environment policy for the OpenClaw driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Duration } from "effect";
import * as O from "effect/Option";
import { OpenclawCompatibilitySet } from "./Openclaw.models.ts";
import type { OpenclawInvocationContext } from "./Openclaw.models.ts";

const HERMETIC_BASE_PATH = "/usr/bin:/bin";

const optionalEnvEntry = (name: string, value: O.Option<string>): Record<string, string> =>
  O.match(value, {
    onNone: () => ({}),
    onSome: (resolved) => ({ [name]: resolved }),
  });

/**
 * Maximum time allowed for `openclaw --version`.
 *
 * @example
 * ```ts
 * import { OPENCLAW_VERSION_TIMEOUT } from "@beep/openclaw/Openclaw.config"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toSeconds(OPENCLAW_VERSION_TIMEOUT)) // 10
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_VERSION_TIMEOUT = Duration.seconds(10);

/**
 * Maximum time allowed for `openclaw config validate`.
 *
 * Matches the 45-second bound the P0 spikes used for hermetic validation.
 *
 * @example
 * ```ts
 * import { OPENCLAW_VALIDATE_TIMEOUT } from "@beep/openclaw/Openclaw.config"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toSeconds(OPENCLAW_VALIDATE_TIMEOUT)) // 45
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_VALIDATE_TIMEOUT = Duration.seconds(45);

/**
 * Maximum time allowed for `openclaw config schema`.
 *
 * @example
 * ```ts
 * import { OPENCLAW_SCHEMA_TIMEOUT } from "@beep/openclaw/Openclaw.config"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toSeconds(OPENCLAW_SCHEMA_TIMEOUT)) // 45
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_SCHEMA_TIMEOUT = Duration.seconds(45);

/**
 * Maximum time allowed for `openclaw doctor --non-interactive`.
 *
 * @example
 * ```ts
 * import { OPENCLAW_DOCTOR_TIMEOUT } from "@beep/openclaw/Openclaw.config"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toSeconds(OPENCLAW_DOCTOR_TIMEOUT)) // 60
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_DOCTOR_TIMEOUT = Duration.seconds(60);

/**
 * Maximum time allowed for `openclaw secrets reload`.
 *
 * @example
 * ```ts
 * import { OPENCLAW_RELOAD_TIMEOUT } from "@beep/openclaw/Openclaw.config"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toSeconds(OPENCLAW_RELOAD_TIMEOUT)) // 30
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_RELOAD_TIMEOUT = Duration.seconds(30);

/**
 * Maximum time allowed for `openclaw gateway call health`.
 *
 * @example
 * ```ts
 * import { OPENCLAW_HEALTH_TIMEOUT } from "@beep/openclaw/Openclaw.config"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toSeconds(OPENCLAW_HEALTH_TIMEOUT)) // 15
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_HEALTH_TIMEOUT = Duration.seconds(15);

/**
 * Maximum time allowed for `openclaw channels status --probe`.
 *
 * @example
 * ```ts
 * import { OPENCLAW_CHANNEL_PROBE_TIMEOUT } from "@beep/openclaw/Openclaw.config"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toSeconds(OPENCLAW_CHANNEL_PROBE_TIMEOUT)) // 20
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_CHANNEL_PROBE_TIMEOUT = Duration.seconds(20);

/**
 * Maximum time allowed for an HTTP liveness or readiness probe.
 *
 * @example
 * ```ts
 * import { OPENCLAW_HTTP_PROBE_TIMEOUT } from "@beep/openclaw/Openclaw.config"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMillis(OPENCLAW_HTTP_PROBE_TIMEOUT)) // 2500
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_HTTP_PROBE_TIMEOUT = Duration.millis(2_500);

/**
 * Maximum time allowed for a `systemctl --user` operation.
 *
 * @example
 * ```ts
 * import { OPENCLAW_SYSTEMCTL_TIMEOUT } from "@beep/openclaw/Openclaw.config"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toSeconds(OPENCLAW_SYSTEMCTL_TIMEOUT)) // 30
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_SYSTEMCTL_TIMEOUT = Duration.seconds(30);

/**
 * Environment variable naming the active `openclaw.json` path.
 *
 * @example
 * ```ts
 * import { OPENCLAW_CONFIG_PATH } from "@beep/openclaw/Openclaw.config"
 *
 * console.log(OPENCLAW_CONFIG_PATH) // "OPENCLAW_CONFIG_PATH"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_CONFIG_PATH = "OPENCLAW_CONFIG_PATH";

/**
 * Environment variable naming the OpenClaw state root directory.
 *
 * @example
 * ```ts
 * import { OPENCLAW_STATE_DIR } from "@beep/openclaw/Openclaw.config"
 *
 * console.log(OPENCLAW_STATE_DIR) // "OPENCLAW_STATE_DIR"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_STATE_DIR = "OPENCLAW_STATE_DIR";

/**
 * Environment variable enabling OpenClaw's application-layer write guard.
 *
 * With `OPENCLAW_NIX_MODE=1` the binary treats `openclaw.json` as immutable
 * and refuses config mutations with a typed `NixModeConfigMutationError`.
 *
 * @example
 * ```ts
 * import { OPENCLAW_NIX_MODE } from "@beep/openclaw/Openclaw.config"
 *
 * console.log(OPENCLAW_NIX_MODE) // "OPENCLAW_NIX_MODE"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_NIX_MODE = "OPENCLAW_NIX_MODE";

/**
 * Environment variable carrying the gateway auth token.
 *
 * Tokens travel exclusively through this environment variable — never argv,
 * unit text, or logs.
 *
 * @example
 * ```ts
 * import { OPENCLAW_GATEWAY_TOKEN } from "@beep/openclaw/Openclaw.config"
 *
 * console.log(OPENCLAW_GATEWAY_TOKEN) // "OPENCLAW_GATEWAY_TOKEN"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_GATEWAY_TOKEN = "OPENCLAW_GATEWAY_TOKEN";

/**
 * Build the hermetic child-process environment for an OpenClaw invocation.
 *
 * The result is the complete environment (`env -i` equivalent — spawn with
 * `extendEnv: false`): a minimal PATH optionally prefixed with the pinned
 * Node bin directory, HOME/config/state paths when present, the nix-mode
 * write guard, and finally `extraEnv`, which wins on collision — that is how
 * the gateway token is injected.
 *
 * @example
 * ```ts
 * import { hermeticOpenclawEnv } from "@beep/openclaw/Openclaw.config"
 * import { OpenclawInvocationContext } from "@beep/openclaw/Openclaw.models"
 * import * as O from "effect/Option"
 *
 * const env = hermeticOpenclawEnv(
 *   OpenclawInvocationContext.make({
 *     binaryPath: "/opt/openclaw/node_modules/.bin/openclaw",
 *     nodeBinDir: O.some("/opt/node/bin")
 *   })
 * )
 * console.log(env.PATH) // "/opt/node/bin:/usr/bin:/bin"
 * console.log(env.OPENCLAW_NIX_MODE) // "1"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const hermeticOpenclawEnv = (ctx: OpenclawInvocationContext): Record<string, string> => ({
  PATH: O.match(ctx.nodeBinDir, {
    onNone: () => HERMETIC_BASE_PATH,
    onSome: (nodeBinDir) => `${nodeBinDir}:${HERMETIC_BASE_PATH}`,
  }),
  ...optionalEnvEntry("HOME", ctx.home),
  ...optionalEnvEntry(OPENCLAW_CONFIG_PATH, ctx.configPath),
  ...optionalEnvEntry(OPENCLAW_STATE_DIR, ctx.stateDir),
  ...(ctx.nixMode ? { [OPENCLAW_NIX_MODE]: "1" } : {}),
  ...ctx.extraEnv,
});

/**
 * The pinned Node/OpenClaw/adapter compatibility set this driver targets.
 *
 * OpenClaw `2026.7.1-2` (`0790d9f`) from the npm registry, verified against
 * the recorded dist shasum and integrity, running under Node `24.16.0`, with
 * render-adapter version `1`.
 *
 * @example
 * ```ts
 * import { OPENCLAW_COMPATIBILITY_SET } from "@beep/openclaw/Openclaw.config"
 *
 * console.log(OPENCLAW_COMPATIBILITY_SET.openclawVersion) // "2026.7.1-2"
 * console.log(OPENCLAW_COMPATIBILITY_SET.adapterVersion) // 1
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENCLAW_COMPATIBILITY_SET = OpenclawCompatibilitySet.make({
  adapterVersion: 1,
  nodeVersion: "24.16.0",
  npmIntegrity: "sha512-ycF3yPcbjN6bUPeaUx6Mh6vze1hQWoD3CT/wWcmD7a8xaHHHRUaAlaq+lFxMHf1ssEgODVAwjlzYqp2twkYZ7g==",
  npmShasum: "4583b987ea7277230ce1c7b2b8535d3e219f57ac",
  openclawCommit: "0790d9f",
  openclawVersion: "2026.7.1-2",
});
