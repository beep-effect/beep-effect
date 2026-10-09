import { Walker } from "../walker/index.ts";
import type { FileSystem, Option } from "effect";
import { Effect, Path } from "effect";

/**
 * Options for {@link TsconfigDiscovery.findNearest}.
 *
 * @public
 */
export interface FindNearestOptions {
	/** The config file name to search for. Defaults to `"tsconfig.json"`. */
	readonly filename?: string;
	/** Stop ascending after this directory, inclusive. */
	readonly stopAt?: string;
}

// Implementation of TsconfigDiscovery.findNearest; the public contract lives on the static.
const findNearest = (
	start: string,
	options?: FindNearestOptions,
): Effect.Effect<Option.Option<string>, never, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const path = yield* Path.Path;
		const filename = options?.filename ?? "tsconfig.json";
		const dirs = yield* Walker.ascend(start, options?.stopAt === undefined ? {} : { stopAt: options.stopAt });
		return yield* Walker.findUpward(dirs, (dir) => [path.join(dir, filename)]);
	});

/**
 * Nearest-config upward discovery for `tsconfig.json`.
 *
 * @example
 * ```ts
 * import { TsconfigDiscovery } from "./index.ts";
 * import { Effect, Option } from "effect";
 *
 * // Requires `FileSystem` and `Path` in `R`; provide them from a platform layer.
 * const program = Effect.gen(function* () {
 * 	const found = yield* TsconfigDiscovery.findNearest(process.cwd());
 * 	return Option.getOrUndefined(found);
 * });
 * ```
 *
 * @public
 */
export class TsconfigDiscovery {
	private constructor() {}

	/**
	 * Find the nearest `tsconfig.json` (or `options.filename`) at or above
	 * `start`, ascending toward the filesystem root. Absence — nowhere on the
	 * chain, or every candidate unreadable — is `Option.none()`, never an
	 * error; discovery is best-effort per `Walker.findUpward`'s absorption
	 * posture, and a permission-denied probe on one directory does not hide a
	 * config file above it.
	 */
	static readonly findNearest = findNearest;
}
