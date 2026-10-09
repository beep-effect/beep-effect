// What the runner host is — the two facts several services resolve once at
// construction, spelled once.
//
// Both read the environment **shape**, not the service, so a layer resolves
// `ActionEnvironment` once and every member's `R` stays `never`. Both are
// optional reads: off a runner the variables are absent, and the answer is
// the host default rather than a failure, so merely composing a layer outside
// Actions never fails.

import type * as Path from "effect/Path";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Function from "effect/Function";
import type { ActionEnvironmentShape } from "../ActionEnvironment.ts";

/**
 * Whether `RUNNER_OS` says Windows. `false` when unset — off a runner, the
 * POSIX shape is the honest default.
 *
 * @internal
 */
export const isWindowsRunner = (env: ActionEnvironmentShape): Effect.Effect<boolean> =>
	Effect.map(env.getOptional("RUNNER_OS"), (found) =>
		O.match(found, { onNone: () => false, onSome: (os) => os.toLowerCase() === "windows" }),
	);

/**
 * The tool-cache root: `RUNNER_TOOL_CACHE`, or `/tmp/runner-tool-cache` off a
 * runner.
 *
 * @remarks
 * Resolved at layer construction, never at import: the source package read
 * the variable into a module-level constant, which fixed the root before any
 * layer could say otherwise and made it impossible to point a test elsewhere.
 * `ToolInstaller` is its only reader: a consumer that needs the final cache
 * path (`PackageManagerInstaller`, for its shims) asks the installer's own
 * `cachePath` member rather than resolving the root a second time.
 *
 * @internal
 */
export const toolCacheRoot: {
	(env: ActionEnvironmentShape, path: Path.Path): Effect.Effect<string>;
	(path: Path.Path): (env: ActionEnvironmentShape) => Effect.Effect<string>;
} = Function.dual(2, (env: ActionEnvironmentShape, path: Path.Path): Effect.Effect<string> =>
	Effect.map(env.getOptional("RUNNER_TOOL_CACHE"), (found) =>
		O.getOrElse(found, () => path.join("/tmp", "runner-tool-cache")),
	));
