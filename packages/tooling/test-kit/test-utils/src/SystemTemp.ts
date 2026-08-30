/**
 * Privacy-safe system temporary-root helpers for generated-payload tests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { platform } from "node:os";
import { env } from "node:process";

const WINDOWS_SYSTEM_ROOT_FALLBACK = "C:\\Windows";
const POSIX_SYSTEM_TEMP_ROOT = "/tmp";

/**
 * Injectable host facts for {@link privacySafeSystemTempRootForTesting}.
 *
 * @category testing
 * @since 0.0.0
 */
interface PrivacySafeSystemTempRootOptions {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly runtimePlatform: string;
}

/**
 * Resolve a user-independent system temporary root for privacy-sensitive tests.
 *
 * **Details**
 *
 * Ambient `TMPDIR`, `TMP`, and `TEMP` values can point below a user's home
 * directory. Tests whose generated payloads intentionally reject private home
 * paths need a scratch root outside that profile without mutating process-wide
 * environment variables. POSIX hosts use their conventional system scratch
 * root; Windows hosts use the system-root temp directory rather than the
 * per-user temp directory.
 *
 * The platform and environment inputs are injectable so non-Windows CI can
 * prove the Windows path selection without touching the filesystem.
 *
 * **Example** (Resolve a Windows system temp root)
 *
 * ```ts
 * import { privacySafeSystemTempRootForTesting } from "@beep/test-utils"
 *
 * const root = privacySafeSystemTempRootForTesting({
 *   environment: { SystemRoot: "C:\\Windows" },
 *   runtimePlatform: "win32"
 * })
 * console.log(root) // C:\Windows\Temp
 * ```
 *
 * @param options - Injectable platform and environment facts.
 * @returns The user-independent temporary root for the supplied host facts.
 * @category testing
 * @since 0.0.0
 */
export const privacySafeSystemTempRootForTesting = (options: PrivacySafeSystemTempRootOptions): string => {
  if (options.runtimePlatform !== "win32") {
    return POSIX_SYSTEM_TEMP_ROOT;
  }

  const systemRoot =
    options.environment.SystemRoot ||
    options.environment.WINDIR ||
    options.environment.windir ||
    WINDOWS_SYSTEM_ROOT_FALLBACK;
  return `${systemRoot.replace(/[\\/]+$/u, "")}\\Temp`;
};

/**
 * Return the current host's user-independent temporary root.
 *
 * **Example** (Read the current host system temp root)
 *
 * ```ts
 * import { privacySafeSystemTempRoot } from "@beep/test-utils"
 *
 * console.log(privacySafeSystemTempRoot())
 * ```
 *
 * @returns The current host's user-independent temporary root.
 * @category testing
 * @since 0.0.0
 */
export const privacySafeSystemTempRoot = (): string =>
  privacySafeSystemTempRootForTesting({ environment: env, runtimePlatform: platform() });
