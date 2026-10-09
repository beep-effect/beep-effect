import { $ScratchpadId } from "@beep/identity/packages";
import { dual } from "effect/Function";
// What the config-dependency ladder (`configDependencyResolution.ts`) and its
// fetch rung (`configDependencyFetch.ts`) share: the typed `hooks` failure,
// the absent-or-typed `node:fs` read, the manifest-version reading, and the
// message helpers. It imports neither of them, so both can import it without
// a cycle.
//
// Runtime-coupled by design, like the ladder: the store is a real directory
// even when a caller's `FileSystem` is virtual, so this reads through
// `node:fs`.

import { CatalogAssemblyError } from "../../npm/index.ts";
import * as Effect from "effect/Effect";
import * as O from "@beep/utils/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { HookReplayContext } from "../ConfigDependencyHooks.ts";

const $I = $ScratchpadId.create("effected/workspaces/internal/configDependencyShared");

// The caller's Effect FileSystem may be virtual; replay must read the real Node module store.
const { readFile } = process.getBuiltinModule("node:fs/promises");
const { join } = process.getBuiltinModule("node:path");

const JsonValue = S.fromJsonString(S.Unknown);

/**
 * Creates the typed `hooks`-source failure every rung of the ladder reports through.
 *
 * **Example** (Attribute a hook failure)
 *
 * ```ts
 * import { hooksError } from "@beep/scratchpad/effected/workspaces/internal/configDependencyShared"
 *
 * const error = hooksError("plugin", new Error("read failed"), undefined)
 * console.log(error.source) // hooks
 * console.log(error.path) // plugin
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const hooksError: {
	(path: string, cause: unknown, reason: CatalogAssemblyError["reason"] | undefined): CatalogAssemblyError;
	(cause: unknown, reason: CatalogAssemblyError["reason"] | undefined): (path: string) => CatalogAssemblyError;
} = dual(
	3,
	(path: string, cause: unknown, reason: CatalogAssemblyError["reason"] | undefined): CatalogAssemblyError =>
		CatalogAssemblyError.make({ source: "hooks", path, cause, ...O.getSomesStruct({ reason: O.fromUndefinedOr(reason) }) }),
);

/**
 * Extracts the message of a cause, for splicing into ours.
 *
 * **Example** (Format error and string causes)
 *
 * ```ts
 * import { messageOf } from "@beep/scratchpad/effected/workspaces/internal/configDependencyShared"
 *
 * console.log(messageOf(new Error("read failed"))) // read failed
 * console.log(messageOf("missing plugin")) // missing plugin
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/**
 * Labels where the declared spec came from, for messages: `the working tree` or `ref <ref>`.
 *
 * **Example** (Label both declaring sides)
 *
 * ```ts
 * import { sideLabel } from "@beep/scratchpad/effected/workspaces/internal/configDependencyShared"
 *
 * console.log(sideLabel({})) // the working tree
 * console.log(sideLabel({ ref: "main" })) // ref main
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const sideLabel = (side: HookReplayContext): string =>
	side.ref === undefined ? "the working tree" : `ref ${side.ref}`;

/** Whether a `node:fs` rejection means "nothing there" (as opposed to a real IO failure). */
const isAbsent = (cause: unknown): boolean =>
	P.isObject(cause) && (cause.code === "ENOENT" || cause.code === "ENOTDIR");

/**
 * Runs a `node:fs/promises` call while distinguishing an absent target from an IO failure.
 *
 * **Details**
 *
 * An absent target maps to `Option.none()`.
 *
 * **Gotchas**
 *
 * Every other rejection (`EACCES`, `EIO`, …) maps to a typed `hooks` error
 * attributed to `path` — never a silent skip.
 *
 * **Example** (Observe a successful asynchronous read)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { ioOrNone } from "@beep/scratchpad/effected/workspaces/internal/configDependencyShared"
 *
 * const result = await Effect.runPromise(ioOrNone("plugin", () => Promise.resolve("manifest")))
 * console.log(O.getOrElse(result, () => "absent")) // manifest
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const ioOrNone: {
	<A>(run: () => Promise<A>): (path: string) => Effect.Effect<O.Option<A>, CatalogAssemblyError>;
	<A>(path: string, run: () => Promise<A>): Effect.Effect<O.Option<A>, CatalogAssemblyError>;
} = dual(2, <A>(
	path: string,
	run: () => Promise<A>,
): Effect.Effect<O.Option<A>, CatalogAssemblyError> =>
	Effect.tryPromise({ try: run, catch: (cause) => hooksError(path, cause, undefined) }).pipe(
		Effect.asSome,
		Effect.catchIf((error) => isAbsent(error.cause), () => Effect.succeedNone),
	));

/**
 * Represents what the `package.json` in a directory says about its version.
 *
 * **Details**
 *
 * There is no manifest, there is one carrying no usable version, or it carries
 * `version`. Closed, so no caller has to know a sentinel for "no version".
 *
 * **Example** (Distinguish versioned and absent manifests)
 *
 * ```ts
 * import { ManifestVersion } from "@beep/scratchpad/effected/workspaces/internal/configDependencyShared"
 *
 * const versioned = ManifestVersion.cases.version.make({ version: "1.2.3" })
 * const absent = ManifestVersion.cases.absent.make({})
 * console.log(ManifestVersion.guards.version(versioned)) // true
 * console.log(ManifestVersion.guards.absent(absent)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ManifestVersion = S.TaggedUnion({
	absent: {},
	unversioned: {},
	version: {
		version: S.NonEmptyString.annotateKey({ description: "The manifest's non-empty version string, read verbatim." }),
	},
}).annotate($I.annote("ManifestVersion", {
	description: "Whether a package manifest is absent, lacks a usable version, or carries a non-empty version string.",
}));

/**
 * The decoded manifest state: absent, unversioned, or carrying a non-empty version string.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ManifestVersion = typeof ManifestVersion.Type;

const ABSENT: ManifestVersion = ManifestVersion.cases.absent.make({});
const UNVERSIONED: ManifestVersion = ManifestVersion.cases.unversioned.make({});

/**
 * Checks whether a manifest carries exactly `declared`.
 *
 * **Details**
 *
 * Only a `version` state can carry the declared version.
 *
 * **Example** (Compare a declared version)
 *
 * ```ts
 * import { carries, ManifestVersion } from "@beep/scratchpad/effected/workspaces/internal/configDependencyShared"
 *
 * const manifest = ManifestVersion.cases.version.make({ version: "1.2.3" })
 * console.log(carries(manifest, "1.2.3")) // true
 * console.log(carries(ManifestVersion.cases.unversioned.make({}), "1.2.3")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const carries: {
	(declared: string): (manifest: ManifestVersion) => boolean;
	(manifest: ManifestVersion, declared: string): boolean;
} = dual(2, (manifest: ManifestVersion, declared: string): boolean =>
	ManifestVersion.guards.version(manifest) && manifest.version === declared);

/**
 * Reads the version state of the `package.json` in `dir`.
 *
 * **Details**
 *
 * Returns `absent` when there is no manifest, or `unversioned` when it carries
 * no non-empty string `version`.
 *
 * **Gotchas**
 *
 * Any other IO failure or unparseable JSON produces a typed error — a manifest
 * that exists but cannot be read is not evidence of absence.
 *
 * **Example** (Construct a manifest version read)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { manifestVersion } from "@beep/scratchpad/effected/workspaces/internal/configDependencyShared"
 *
 * const program = manifestVersion("plugin", "/workspace/node_modules/plugin")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const manifestVersion: {
	(dir: string): (name: string) => Effect.Effect<ManifestVersion, CatalogAssemblyError>;
	(name: string, dir: string): Effect.Effect<ManifestVersion, CatalogAssemblyError>;
} = dual(2, (name: string, dir: string): Effect.Effect<ManifestVersion, CatalogAssemblyError> =>
	ioOrNone(name, () => readFile(join(dir, "package.json"), "utf8")).pipe(
		Effect.flatMap((text) => {
			if (O.isNone(text)) return Effect.succeed(ABSENT);
			return S.decodeEffect(JsonValue)(text.value).pipe(
				Effect.mapError((cause) => hooksError(name, cause, undefined)),
				Effect.map(
					(parsed): ManifestVersion =>
						P.isObject(parsed) && P.isString(parsed.version) && parsed.version !== ""
							? ManifestVersion.cases.version.make({ version: parsed.version })
							: UNVERSIONED,
				),
			);
		}),
	));
