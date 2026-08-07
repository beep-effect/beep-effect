/**
 * Node URL helpers wrapped in `Effect`.
 *
 * Provides typed wrappers around Node's file URL conversion utilities so
 * path and `file:` URL conversions can participate in Effect workflows.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $UtilsId } from "@beep/identity/packages";
import { Effect, PlatformError } from "effect";
import * as S from "effect/Schema";

const $I = $UtilsId.create("NodeUrl");

class NodeUrlUnavailableError extends S.TaggedErrorClass<NodeUrlUnavailableError>($I`NodeUrlUnavailableError`)(
  "NodeUrlUnavailableError",
  {
    module: S.Literal("node:url"),
  },
  $I.annote("NodeUrlUnavailableError", {
    description: "Thrown when node:url is unavailable to URL conversion helpers.",
  })
) {}

/**
 * `node:url` handle, resolved lazily via `process.getBuiltinModule` on first
 * call (never via a static Node import) so browser bundles can import this
 * module — and `@beep/utils/Path`, which re-exports from it — without
 * evaluating Node builtins. Only invoking a helper requires a Node-compatible
 * runtime.
 */
let nodeUrlHandle: typeof import("node:url") | undefined;
const NodeUrl = (): typeof import("node:url") => {
  if (nodeUrlHandle === undefined) {
    nodeUrlHandle = globalThis.process?.getBuiltinModule?.("node:url");
    if (nodeUrlHandle === undefined) {
      throw NodeUrlUnavailableError.make({ module: "node:url" });
    }
  }
  return nodeUrlHandle;
};

/**
 * Converts a `file:` URL into a platform path string.
 *
 * **Details**
 *
 * Wraps Node's `fileURLToPath` in `Effect.try`, translating thrown errors
 * into a typed `BadArgument`.
 *
 * **Example** (Convert file URL to path)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { fromFileUrl } from "@beep/utils/NodeUrl"
 *
 * const program = Effect.gen(function* () {
 *   const path = yield* fromFileUrl(new URL("file:///tmp/beep.txt"))
 *   return path
 * })
 *
 * console.log(program)
 * ```
 *
 * **Example** (Recover from invalid URL)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { fromFileUrl } from "@beep/utils/NodeUrl"
 *
 * const invalid = fromFileUrl(new URL("https://example.com/file.txt"))
 *
 * const recovered = Effect.catchTag(invalid, "BadArgument", () =>
 *   Effect.succeed("/tmp/fallback.txt")
 * )
 *
 * console.log(recovered)
 * ```
 *
 * @param url - The `file:` URL to convert.
 * @returns An effect that succeeds with the platform path string.
 * @effects Defers Node URL conversion until the returned Effect is executed and
 * maps thrown conversion errors into `PlatformError.BadArgument`.
 * @category utilities
 * @since 0.0.0
 */
export const fromFileUrl = (url: URL): Effect.Effect<string, PlatformError.BadArgument> =>
  Effect.try({
    try: () => NodeUrl().fileURLToPath(url),
    catch: () =>
      new PlatformError.BadArgument({
        module: "Path",
        method: "fromFileUrl",
        description: "URL must be a valid file: URL",
      }),
  });

/**
 * Converts a platform path string into a `file:` URL.
 *
 * **Details**
 *
 * Wraps Node's `pathToFileURL` in `Effect.try`, translating thrown errors
 * into a typed `BadArgument`.
 *
 * **Example** (Convert path to file URL)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { toFileUrl } from "@beep/utils/NodeUrl"
 *
 * const program = Effect.gen(function* () {
 *   const url = yield* toFileUrl("/tmp/beep.txt")
 *   return url.href
 * })
 *
 * console.log(program)
 * ```
 *
 * **Example** (Recover from empty path)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { toFileUrl } from "@beep/utils/NodeUrl"
 *
 * const recovered = Effect.catchTag(toFileUrl(""), "BadArgument", () =>
 *   Effect.succeed(new URL("file:///tmp/fallback.txt"))
 * )
 *
 * console.log(recovered)
 * ```
 *
 * @param path - The platform path string to convert.
 * @returns An effect that succeeds with a `file:` URL.
 * @effects Defers Node path conversion until the returned Effect is executed and
 * maps thrown conversion errors into `PlatformError.BadArgument`.
 * @category utilities
 * @since 0.0.0
 */
export const toFileUrl = (path: string): Effect.Effect<URL, PlatformError.BadArgument> =>
  Effect.try({
    try: () => NodeUrl().pathToFileURL(path),
    catch: () =>
      new PlatformError.BadArgument({
        module: "Path",
        method: "toFileUrl",
        description: "Path must be a valid filesystem path",
      }),
  });

/**
 * Converts a `file:` URL back into a platform path string.
 *
 * **Example** (Convert file URL to path)
 *
 * ```ts
 * import { fileURLToPath } from "@beep/utils/NodeUrl"
 *
 * const path = fileURLToPath(new URL("file:///tmp/beep.txt"))
 * console.log(path)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const fileURLToPath = (url: string | URL): string => NodeUrl().fileURLToPath(url);
