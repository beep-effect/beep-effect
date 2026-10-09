import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as MutableHashMap from "effect/MutableHashMap";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { IntegrityHash } from "../../npm/index.ts";
import { ConfigDependencyLock } from "../ConfigDependencyLock.ts";
import { PackageManagerLock } from "../PackageManagerLock.ts";
import { splitPnpmStream } from "./documents.ts";
import type { ParseFailure } from "./shared.ts";
import { gatePnpmVersion, validationFailure } from "./shared.ts";

const $I = $ScratchpadId.create("effected/lockfiles/internal/pnpmEnv");

/** A well-formed env preamble whose recorded dependency cannot be accounted for. */
class PnpmEnvPreambleError extends S.TaggedError<PnpmEnvPreambleError>($I`PnpmEnvPreambleError`)(
	"PnpmEnvPreambleError",
	{ message: S.String.annotateKey({ description: "The env preamble's unaccounted dependency or integrity claim." }) },
	$I.annote("PnpmEnvPreambleError", { description: "An env preamble whose recorded dependency cannot be accounted for." }),
) {}

// ── Raw schema (permissive validation scaffolding, not API) ────────────────

const PnpmEnvImporterDeps = S.optionalKey(
	S.Record(S.String, S.Struct({
		specifier: S.String.annotateKey({ description: "The dependency specifier recorded verbatim by pnpm." }),
		version: S.String.annotateKey({ description: "The resolved version used to locate the dependency's package entry." }),
	}).annotate($I.annote("PnpmEnvImporterDependency", {
		description: "A dependency declaration in an env preamble importer, before integrity lookup.",
	}))).annotate($I.annote("PnpmEnvImporterDeps", {
		description: "Optional env importer dependencies keyed by package name, preserving pnpm's raw declarations.",
	})),
);

const PnpmEnvRaw = S.Struct({
	importers: S.optionalKey(
		S.Record(
			S.String,
			S.Struct({
				packageManagerDependencies: PnpmEnvImporterDeps.annotateKey({ description: "Package managers pinned by this importer." }),
				configDependencies: PnpmEnvImporterDeps.annotateKey({ description: "Configuration dependencies recorded by this importer." }),
			}).annotate($I.annote("PnpmEnvImporter", { description: "An env preamble importer's package-manager and configuration declarations." })),
		),
	).annotateKey({ description: "Env importers keyed by workspace-relative path; the root importer is '.'." }),
	packages: S.optionalKey(
		S.Record(
			S.String,
			S.Struct({
				resolution: S.optionalKey(S.Struct({
					integrity: S.optionalKey(S.String).annotateKey({ description: "The recorded integrity text, validated as SRI when the package is requested." }),
				}).annotate($I.annote("PnpmEnvResolution", { description: "A permissive package resolution carrying its optional recorded integrity." })))
					.annotateKey({ description: "The package resolution metadata recorded by pnpm." }),
			}).annotate($I.annote("PnpmEnvPackage", { description: "An env package entry whose integrity can satisfy an importer or native dependency." })),
		),
	).annotateKey({ description: "Env package entries keyed by package name and resolved version." }),
	snapshots: S.optionalKey(
		S.Record(
			S.String,
			S.Struct({
				optionalDependencies: S.optionalKey(S.Record(S.String, S.String))
					.annotateKey({ description: "Optional dependency versions keyed by name, including pnpm's native platform packages." }),
			}).annotate($I.annote("PnpmEnvSnapshot", { description: "An env dependency snapshot used to discover pnpm's optional native packages." })),
		),
	).annotateKey({ description: "Env dependency snapshots keyed by package name and resolved version." }),
}).annotate($I.annote("PnpmEnvRaw", {
	description: "The permissive env preamble boundary shape shared by the pnpm package-manager and config-dependency readers.",
}));

type PnpmEnvRawType = typeof PnpmEnvRaw.Type;

/** The package-manager package this reader resolves. */
const PNPM = "pnpm";

/** The importer pnpm records `packageManagerDependencies` under. */
const ROOT_IMPORTER = ".";

const JsonString = S.fromJsonString(S.String).annotate($I.annote("JsonString", {
	description: "A JSON-quoted string used to name env preamble keys exactly in validation messages.",
}));
const encodeJsonString = S.encodeEffect(JsonString);

/**
 * Own-property read of a decoded record. The records come from YAML, so a key
 * such as `constructor` or `__proto__` must never be answered by
 * `Object.prototype`.
 */
const own = <V>(record: Readonly<Record<string, V>> | undefined, key: string): V | undefined =>
	record !== undefined && R.has(record, key) ? record[key] : undefined;

/**
 * A located, well-formed preamble that does not hold what it promises: the
 * importer names a package the `packages:` section cannot account for. A
 * shape failure of a located document, so it rides the validation channel.
 */
const unaccounted = (message: string): ParseFailure =>
	validationFailure(PnpmEnvPreambleError.make({ message: `pnpm-lock.yaml env preamble: ${message}` }));

/**
 * The SRI integrity of `packages["<key>"]`, failing when the entry, its
 * integrity, or the SRI form of that integrity is missing. Never `undefined`:
 * the caller only asks for keys the lockfile's own graph names.
 */
const integrityOf = Effect.fnUntraced(function* (raw: PnpmEnvRawType, key: string): Effect.fn.Return<string, ParseFailure> {
	const integrity = own(raw.packages, key)?.resolution?.integrity;
	if (integrity === undefined) {
		const quotedKey = yield* encodeJsonString(key).pipe(Effect.mapError(validationFailure));
		return yield* Effect.fail(unaccounted(`packages[${quotedKey}] records no resolution.integrity`));
	}
	if (!IntegrityHash.isSri(integrity)) {
		const quotedKey = yield* encodeJsonString(key).pipe(Effect.mapError(validationFailure));
		return yield* Effect.fail(
			unaccounted(`packages[${quotedKey}].resolution.integrity is not an SRI integrity string`),
		);
	}
	return integrity;
});

/**
 * The SRI integrity of the `<name>@<version>` a preamble entry records,
 * failing first when the version is empty: an empty version names no
 * `packages` entry, and saying so beats reporting the malformed key.
 * `subject` is the entry as the empty-version message names it.
 */
const recordedIntegrity = (
	raw: PnpmEnvRawType,
	subject: string,
	name: string,
	version: string,
): Effect.Effect<string, ParseFailure> =>
	version === ""
		? Effect.fail(unaccounted(`${subject} is recorded with an empty version`))
		: integrityOf(raw, `${name}@${version}`);

/**
 * Locate and decode the env preamble of a `pnpm-lock.yaml`: `undefined` when
 * the stream carries none, typed when it is malformed or below the supported
 * lockfile version. The one decode every preamble reader shares, so they
 * cannot disagree about which document is the preamble or what shape it has.
 */
const decodePreamble = Effect.fn("decodePreamble")(function* (content: string): Effect.fn.Return<PnpmEnvRawType | undefined, ParseFailure> {
	const { preamble } = yield* splitPnpmStream(content);
	if (preamble === undefined) return undefined;
	yield* gatePnpmVersion(preamble);
	return yield* S.decodeUnknownEffect(PnpmEnvRaw)(preamble).pipe(Effect.mapError(validationFailure));
});

/**
 * Read the package manager pinned by a `pnpm-lock.yaml`'s env preamble.
 *
 * **Details**
 *
 * `undefined` means the lockfile records no package manager: no preamble, or
 * a preamble whose root importer declares no `pnpm` package-manager
 * dependency. Everything past that point is a claim the lockfile made, so a
 * claim it cannot back — a missing `pnpm@<version>` entry, a missing snapshot,
 * a missing or non-SRI integrity for pnpm or any native it lists — fails typed
 * rather than degrading to "nothing recorded".
 *
 * Native packages come from the lockfile's own graph — the optional
 * dependencies of the `pnpm@<version>` snapshot — not from a name pattern.
 *
 * @internal
 */
export const readPnpmPackageManager = Effect.fn("readPnpmPackageManager")(function* (content: string): Effect.fn.Return<PackageManagerLock | undefined, ParseFailure> {
	const raw = yield* decodePreamble(content);
	if (raw === undefined) return undefined;
	const declared = own(own(raw.importers, ROOT_IMPORTER)?.packageManagerDependencies, PNPM);
	if (declared === undefined) return undefined;
	const integrity = yield* recordedIntegrity(raw, PNPM, PNPM, declared.version);
	const key = `${PNPM}@${declared.version}`;
	const snapshot = own(raw.snapshots, key);
	if (snapshot === undefined) {
		return yield* Effect.fail(unaccounted(`snapshots[${yield* encodeJsonString(key).pipe(Effect.mapError(validationFailure))}] is missing`));
	}
	const natives: Array<readonly [string, string]> = [];
	for (const [name, version] of R.toEntries(snapshot.optionalDependencies ?? {})) {
		natives.push([name, yield* integrityOf(raw, `${name}@${version}`)]);
	}
	return PackageManagerLock.make({
		name: PNPM,
		specifier: declared.specifier,
		version: declared.version,
		integrity,
		nativeIntegrity: R.fromEntries(natives),
	});
});

/**
 * Read the config dependencies recorded by a `pnpm-lock.yaml`'s env preamble,
 * keyed by name, each with the integrity pnpm recorded for it.
 *
 * **Details**
 *
 * An empty map means the lockfile records none: no preamble, or a preamble
 * whose root importer declares no `configDependencies`. As with
 * {@link readPnpmPackageManager}, every entry the importer names is a claim,
 * so an entry whose `<name>@<version>` has no `packages` entry, no integrity,
 * a non-SRI integrity, or an empty version fails typed rather than being
 * dropped. The map is built from own keys only, so a hostile name such as
 * `__proto__` is an ordinary entry.
 *
 * @internal
 */
export const readPnpmConfigDependencies = Effect.fn("readPnpmConfigDependencies")(function* (content: string): Effect.fn.Return<HashMap.HashMap<string, ConfigDependencyLock>, ParseFailure> {
	const raw = yield* decodePreamble(content);
	const declared = own(raw?.importers, ROOT_IMPORTER)?.configDependencies;
	const locks = MutableHashMap.empty<string, ConfigDependencyLock>();
	if (raw === undefined || declared === undefined) return HashMap.fromIterable(locks);
	for (const [name, entry] of R.toEntries(declared)) {
		const integrity = yield* recordedIntegrity(raw, `config dependency ${yield* encodeJsonString(name).pipe(Effect.mapError(validationFailure))}`, name, entry.version);
		MutableHashMap.set(locks, name, ConfigDependencyLock.make({ name, specifier: entry.specifier, version: entry.version, integrity }));
	}
	return HashMap.fromIterable(locks);
});
