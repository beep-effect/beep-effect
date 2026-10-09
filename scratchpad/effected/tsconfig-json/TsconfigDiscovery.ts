import { Walker } from "../walker/index.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as O from "effect/Option";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/tsconfig-json/TsconfigDiscovery");

/**
 * Options for {@link TsconfigDiscovery.findNearest}.
 *
 * **Example** (Choose a discovery filename)
 *
 * ```ts
 * import { FindNearestOptions } from "@beep/scratchpad/effected/tsconfig-json/TsconfigDiscovery";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(FindNearestOptions)({ filename: "tsconfig.build.json" }).filename) // tsconfig.build.json
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const FindNearestOptions = S.Struct({
	/** The config file name to search for. Defaults to `"tsconfig.json"`. */
	filename: S.optionalKey(S.String).annotateKey({ description: "The config filename; defaults to tsconfig.json." }),
	/** Stop ascending after this directory, inclusive. */
	stopAt: S.optionalKey(S.String).annotateKey({ description: "Stop ascending after this directory, inclusive." }),
}).annotate($I.annote("FindNearestOptions", {
	description: "Filename and inclusive directory boundary for nearest tsconfig discovery.",
}));

/**
 * The schema-derived nearest-config discovery options.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type FindNearestOptions = typeof FindNearestOptions.Type;

// Implementation of TsconfigDiscovery.findNearest; the public contract lives on the static.
const findNearest = Effect.fn("findNearest")(function* (
	start: string,
	options?: FindNearestOptions,
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem | Path.Path> {
	const path = yield* Path.Path;
	const filename = options?.filename ?? "tsconfig.json";
	const dirs = yield* Walker.ascend(start, options?.stopAt === undefined ? {} : { stopAt: options.stopAt });
	return yield* Walker.findUpward(dirs, (dir) => [path.join(dir, filename)]);
});

/**
 * Nearest-config upward discovery for `tsconfig.json`.
 *
 * **Example** (Find the nearest tsconfig from the current directory)
 *
 * ```ts
 * import { TsconfigDiscovery } from "@beep/scratchpad/effected/tsconfig-json/TsconfigDiscovery";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 *
 * // Requires `FileSystem` and `Path` in `R`; provide them from a platform layer.
 * const program = Effect.gen(function* () {
 * 	const found = yield* TsconfigDiscovery.findNearest(process.cwd());
 * 	return O.getOrUndefined(found);
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
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
	 *
	 * **Example** (Construct a bounded upward discovery effect)
	 *
	 * ```ts
	 * import { TsconfigDiscovery } from "@beep/scratchpad/effected/tsconfig-json/TsconfigDiscovery";
	 * import * as Effect from "effect/Effect";
	 *
	 * // Requires FileSystem and Path services supplied by the caller.
	 * const program = TsconfigDiscovery.findNearest("/project/app", { stopAt: "/project" });
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @category queries
	 * @since 0.0.0
	 */
	static readonly findNearest = findNearest;
}
