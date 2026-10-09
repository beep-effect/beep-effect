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

/** The typed `hooks`-source failure every rung of the ladder reports through. */
export const hooksError: {
	(path: string, cause: unknown, reason: CatalogAssemblyError["reason"] | undefined): CatalogAssemblyError;
	(cause: unknown, reason: CatalogAssemblyError["reason"] | undefined): (path: string) => CatalogAssemblyError;
} = dual(
	3,
	(path: string, cause: unknown, reason: CatalogAssemblyError["reason"] | undefined): CatalogAssemblyError =>
		CatalogAssemblyError.make({ source: "hooks", path, cause, ...O.getSomesStruct({ reason: O.fromUndefinedOr(reason) }) }),
);

/** The message of a cause, for splicing into ours. */
export const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/** Where the declared spec came from, for messages: `the working tree` or `ref <ref>`. */
export const sideLabel = (side: HookReplayContext): string =>
	side.ref === undefined ? "the working tree" : `ref ${side.ref}`;

/** Whether a `node:fs` rejection means "nothing there" (as opposed to a real IO failure). */
const isAbsent = (cause: unknown): boolean =>
	P.isObject(cause) && (cause.code === "ENOENT" || cause.code === "ENOTDIR");

/**
 * Run a `node:fs/promises` call, mapping an absent target to `Option.none()`
 * and ANY other rejection (`EACCES`, `EIO`, …) to a typed `hooks` error
 * attributed to `path` — never a silent skip.
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
 * What the `package.json` in a directory says about its version: there is no
 * manifest, there is one carrying no usable version, or it carries `version`.
 * Closed, so no caller has to know a sentinel for "no version".
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

export type ManifestVersion = typeof ManifestVersion.Type;

const ABSENT: ManifestVersion = ManifestVersion.cases.absent.make({});
const UNVERSIONED: ManifestVersion = ManifestVersion.cases.unversioned.make({});

/** Whether a manifest carries exactly `declared`. Only a `version` state can. */
export const carries: {
	(declared: string): (manifest: ManifestVersion) => boolean;
	(manifest: ManifestVersion, declared: string): boolean;
} = dual(2, (manifest: ManifestVersion, declared: string): boolean =>
	ManifestVersion.guards.version(manifest) && manifest.version === declared);

/**
 * The version state of the `package.json` in `dir`: `absent` when there is
 * no manifest, `unversioned` when it carries no non-empty string `version`,
 * typed on any other IO failure or on unparseable JSON — a manifest that
 * exists but cannot be read is not evidence of absence.
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
