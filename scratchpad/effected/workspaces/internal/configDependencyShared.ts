// Config-dependency replay reads the real Node module store even when the supplied FileSystem is virtual.
// @effect-diagnostics nodeBuiltinImport:skip-file
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

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CatalogAssemblyError } from "../../npm/index.ts";
import { Effect, Option, Predicate, Schema } from "effect";
import type { HookReplayContext } from "../ConfigDependencyHooks.ts";

const JsonValue = Schema.fromJsonString(Schema.Unknown);

/** The typed `hooks`-source failure every rung of the ladder reports through. */
// A string cause overlaps the path argument, so optional reason makes the two call forms ambiguous.
// @effect-diagnostics-next-line missingPipeableSignature:off
export const hooksError = (
	path: string,
	cause: unknown,
	reason?: CatalogAssemblyError["reason"],
): CatalogAssemblyError =>
	CatalogAssemblyError.make({ source: "hooks", path, cause, ...(reason === undefined ? {} : { reason }) });

/** The message of a cause, for splicing into ours. */
export const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/** Where the declared spec came from, for messages: `the working tree` or `ref <ref>`. */
export const sideLabel = (side: HookReplayContext): string =>
	side.ref === undefined ? "the working tree" : `ref ${side.ref}`;

/** Whether a `node:fs` rejection means "nothing there" (as opposed to a real IO failure). */
const isAbsent = (cause: unknown): boolean =>
	Predicate.isObject(cause) && (cause.code === "ENOENT" || cause.code === "ENOTDIR");

/**
 * Run a `node:fs/promises` call, mapping an absent target to `Option.none()`
 * and ANY other rejection (`EACCES`, `EIO`, …) to a typed `hooks` error
 * attributed to `path` — never a silent skip.
 */
export const ioOrNone: {
	<A>(run: () => Promise<A>): (path: string) => Effect.Effect<Option.Option<A>, CatalogAssemblyError>;
	<A>(path: string, run: () => Promise<A>): Effect.Effect<Option.Option<A>, CatalogAssemblyError>;
} = dual(2, <A>(
	path: string,
	run: () => Promise<A>,
): Effect.Effect<Option.Option<A>, CatalogAssemblyError> =>
	Effect.tryPromise({ try: run, catch: (cause) => hooksError(path, cause) }).pipe(
		Effect.asSome,
		Effect.catchIf((error) => isAbsent(error.cause), () => Effect.succeedNone),
	));

/**
 * What the `package.json` in a directory says about its version: there is no
 * manifest, there is one carrying no usable version, or it carries `version`.
 * Closed, so no caller has to know a sentinel for "no version".
 */
export type ManifestVersion =
	| { readonly _tag: "absent" }
	| { readonly _tag: "unversioned" }
	| { readonly _tag: "version"; readonly version: string };

const ABSENT: ManifestVersion = { _tag: "absent" };
const UNVERSIONED: ManifestVersion = { _tag: "unversioned" };

/** Whether a manifest carries exactly `declared`. Only a `version` state can. */
export const carries: {
	(declared: string): (manifest: ManifestVersion) => boolean;
	(manifest: ManifestVersion, declared: string): boolean;
} = dual(2, (manifest: ManifestVersion, declared: string): boolean =>
	manifest._tag === "version" && manifest.version === declared);

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
			if (Option.isNone(text)) return Effect.succeed(ABSENT);
			return Schema.decodeEffect(JsonValue)(text.value).pipe(
				Effect.mapError((cause) => hooksError(name, cause)),
				Effect.map(
					(parsed): ManifestVersion =>
						Predicate.isObject(parsed) && typeof parsed.version === "string" && parsed.version !== ""
							? { _tag: "version", version: parsed.version }
							: UNVERSIONED,
				),
			);
		}),
	));
