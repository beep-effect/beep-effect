/**
 * Path utilities wrapping `node:path`, mirroring effect's `Path` service
 * interface.
 *
 * The pure operations (`join`, `basename`, `parse`, ...) are plain synchronous
 * functions — they cannot fail on string input, matching effect's own sync
 * `Path` service. The `file:` URL conversions (`fromFileUrl`/`toFileUrl`) are
 * `Effect`-returning and fail with `PlatformError.BadArgument`; they are
 * re-exported from the sibling `NodeUrl` module rather than reimplemented. This
 * is the sanctioned home for `node:path` access.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UtilsId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { Path as PlatformPath } from "effect";

const $I = $UtilsId.create("Path");

class NodePathUnavailableError extends S.TaggedError<NodePathUnavailableError>($I`NodePathUnavailableError`)(
  "NodePathUnavailableError",
  {
    module: S.Literal("node:path"),
  },
  $I.annoteError<NodePathUnavailableError>("NodePathUnavailableError", {
    description: "Thrown when node:path is unavailable to path helpers.",
  })
) {}

/**
 * Synchronous `node:path` handle, resolved lazily via
 * `process.getBuiltinModule` on first call (never via a static Node import) so
 * browser bundles can import this module — and the `@beep/utils` barrel —
 * without evaluating Node builtins. Only invoking a helper requires a
 * Node-compatible runtime.
 */
let nodePathHandle: typeof import("node:path") | undefined;
const NPath = (): typeof import("node:path") => {
  if (nodePathHandle === undefined) {
    nodePathHandle = globalThis.process?.getBuiltinModule?.("node:path");
    if (nodePathHandle === undefined) {
      throw NodePathUnavailableError.make({ module: "node:path" });
    }
  }
  return nodePathHandle;
};

/**
 * `file:` URL conversions re-exported from the sibling `NodeUrl` module:
 * `fromFileUrl` (URL to path) and `toFileUrl` (path to URL). Both are
 * `Effect`-returning and fail with `PlatformError.BadArgument` on invalid input.
 *
 * **Example** (Round-trip file URL conversion)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { fromFileUrl, toFileUrl } from "@beep/utils/Path"
 *
 * const url = Effect.runSync(toFileUrl("/tmp/beep.txt"))
 * console.log(Effect.runSync(fromFileUrl(url)))
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export { fromFileUrl, toFileUrl } from "./NodeUrl.ts";

/**
 * A parsed path, mirroring effect's `Path.Parsed` (and Node's `ParsedPath`).
 *
 * **Example** (Parsed path object shape)
 *
 * ```ts
 * import type { Parsed } from "@beep/utils/Path"
 *
 * const parsed: Parsed = { root: "/", dir: "/x", base: "y.ts", ext: ".ts", name: "y" }
 * console.log(parsed.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Parsed = PlatformPath.Path.Parsed;

/**
 * The platform-specific path segment separator (`"/"` on POSIX, `"\\"` on
 * Windows).
 *
 * **Example** (Platform separator type check)
 *
 * ```ts
 * import { sep } from "@beep/utils/Path"
 *
 * console.log(typeof sep)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const sep: string = globalThis.process?.getBuiltinModule?.("node:path")?.sep ?? "/";

/**
 * Joins path segments into a single normalized path.
 *
 * **Example** (Join path segments)
 *
 * ```ts
 * import { join } from "@beep/utils/Path"
 *
 * console.log(join("a", "b", "c"))
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const join = (...paths: ReadonlyArray<string>): string => NPath().join(...paths);

/**
 * Resolves a sequence of path segments into an absolute path.
 *
 * **Example** (Resolve absolute path)
 *
 * ```ts
 * import { resolve } from "@beep/utils/Path"
 *
 * console.log(resolve("a", "b").length > 0)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const resolve = (...pathSegments: ReadonlyArray<string>): string => NPath().resolve(...pathSegments);

/**
 * Normalizes a path, collapsing `.`/`..` segments and redundant separators.
 *
 * **Example** (Collapse dots and separators)
 *
 * ```ts
 * import { normalize } from "@beep/utils/Path"
 *
 * console.log(normalize("a//b/../c"))
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const normalize: (path: string) => string = (path) => NPath().normalize(path);

/**
 * Computes the relative path from `from` to `to`.
 *
 * **Example** (Relative path between dirs)
 *
 * ```ts
 * import { relative } from "@beep/utils/Path"
 *
 * console.log(relative("/a/b", "/a/c"))
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const relative: {
  (to: string): (from: string) => string;
  (from: string, to: string): string;
} = dual(2, (from: string, to: string): string => NPath().relative(from, to));

/**
 * Returns the last portion of a path, optionally stripping `suffix`.
 *
 * **Example** (Basename with suffix strip)
 *
 * ```ts
 * import { basename } from "@beep/utils/Path"
 *
 * console.log(basename("/a/b/c.ts", ".ts"))
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const basename: {
  (suffix: string): (path: string) => string;
  (path: string, suffix: string): string;
} = dual(2, (path: string, suffix: string): string => NPath().basename(path, suffix));

/**
 * Returns the directory portion of a path.
 *
 * **Example** (Directory portion of path)
 *
 * ```ts
 * import { dirname } from "@beep/utils/Path"
 *
 * console.log(dirname("/a/b/c.ts"))
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const dirname: (path: string) => string = (path) => NPath().dirname(path);

/**
 * Returns the extension of a path, including the leading dot.
 *
 * **Example** (Extension with leading dot)
 *
 * ```ts
 * import { extname } from "@beep/utils/Path"
 *
 * console.log(extname("/a/b/c.ts"))
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const extname: (path: string) => string = (path) => NPath().extname(path);

/**
 * Reports whether a path is absolute.
 *
 * **Example** (Check absolute path)
 *
 * ```ts
 * import { isAbsolute } from "@beep/utils/Path"
 *
 * console.log(isAbsolute("/a/b"))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isAbsolute: (path: string) => boolean = (path) => NPath().isAbsolute(path);

/**
 * Parses a path into its `root`/`dir`/`base`/`ext`/`name` components.
 *
 * **Example** (Parse path components)
 *
 * ```ts
 * import { parse } from "@beep/utils/Path"
 *
 * console.log(parse("/a/b/c.ts").name)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const parse: (path: string) => Parsed = (path) => NPath().parse(path);

/**
 * Formats a {@link Parsed}-shaped object back into a path string.
 *
 * **Example** (Format Parsed into path)
 *
 * ```ts
 * import { format } from "@beep/utils/Path"
 *
 * console.log(format({ dir: "/a/b", base: "c.ts" }))
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const format: (pathObject: Partial<Parsed>) => string = (pathObject) => NPath().format(pathObject);

/**
 * Returns the equivalent namespace-prefixed path (a no-op outside Windows).
 *
 * **Example** (Namespace-prefixed path result)
 *
 * ```ts
 * import { toNamespacedPath } from "@beep/utils/Path"
 *
 * console.log(toNamespacedPath("/a/b").length > 0)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const toNamespacedPath: (path: string) => string = (path) => NPath().toNamespacedPath(path);
