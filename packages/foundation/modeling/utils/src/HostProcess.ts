/**
 * Host process runtime references.
 *
 * **Details**
 *
 * This module holds the sole sanctioned direct reads of the host platform and
 * architecture (the `beep/no-global-process-runtime` lint rule allowlists it).
 * Effect code injects {@link HostProcessPlatform} or
 * {@link HostProcessArchitecture}; sync code and tests import
 * {@link currentHostPlatform} or {@link currentHostArchitecture}.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $RepoUtilsId } from "@beep/identity";
import { Context } from "effect";

const $I = $RepoUtilsId.create("HostProcess");

/**
 * The host operating system platform, read once at module load.
 *
 * **When to use**
 *
 * Use when sync code or tests branch on the real host platform and have
 * no Effect runtime to inject {@link HostProcessPlatform} into.
 *
 * **Example** (Branch on the current platform)
 *
 * ```ts
 * import { currentHostPlatform } from "@beep/utils/HostProcess"
 *
 * console.log(typeof currentHostPlatform) // "string"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const currentHostPlatform: string = process.platform;

/**
 * The host CPU architecture, read once at module load.
 *
 * **When to use**
 *
 * Use when sync code or tests branch on the real host architecture and
 * have no Effect runtime to inject {@link HostProcessArchitecture} into.
 *
 * **Example** (Branch on the current architecture)
 *
 * ```ts
 * import { currentHostArchitecture } from "@beep/utils/HostProcess"
 *
 * console.log(typeof currentHostArchitecture) // "string"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const currentHostArchitecture: string = process.arch;

/**
 * Reference for the host operating system platform.
 *
 * **When to use**
 *
 * Use to read the platform inside Effect code instead of reading `process.platform`; tests
 * override it with `Effect.provideService` to pin a platform.
 *
 * **Example** (Read the platform inside an Effect)
 *
 * ```ts
 * import { HostProcessPlatform } from "@beep/utils/HostProcess"
 * import { Effect } from "effect"
 *
 * const platform = Effect.runSync(HostProcessPlatform)
 * console.log(typeof platform) // "string"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const HostProcessPlatform = Context.Reference<string>($I`HostProcessPlatform`, {
  defaultValue: () => currentHostPlatform,
});

/**
 * Reference for the host CPU architecture.
 *
 * **When to use**
 *
 * Use to read the architecture inside Effect code instead of reading `process.arch`; tests
 * override it with `Effect.provideService` to pin an architecture.
 *
 * **Example** (Read the architecture inside an Effect)
 *
 * ```ts
 * import { HostProcessArchitecture } from "@beep/utils/HostProcess"
 * import { Effect } from "effect"
 *
 * const architecture = Effect.runSync(HostProcessArchitecture)
 * console.log(typeof architecture) // "string"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const HostProcessArchitecture = Context.Reference<string>($I`HostProcessArchitecture`, {
  defaultValue: () => currentHostArchitecture,
});
