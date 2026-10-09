import { IntegrityHash } from "../../npm/index.ts";
import { Effect, Schema } from "effect";
import { ConfigDependencyLock } from "../ConfigDependencyLock.ts";
import { PackageManagerLock } from "../PackageManagerLock.ts";
import { splitPnpmStream } from "./documents.ts";
import type { ParseFailure } from "./shared.ts";
import { gatePnpmVersion, validationFailure } from "./shared.ts";

// ── Raw schema (permissive validation scaffolding, not API) ────────────────

const PnpmEnvImporterDeps = Schema.optionalKey(
	Schema.Record(Schema.String, Schema.Struct({ specifier: Schema.String, version: Schema.String })),
);

const PnpmEnvRaw = Schema.Struct({
	importers: Schema.optionalKey(
		Schema.Record(
			Schema.String,
			Schema.Struct({
				packageManagerDependencies: PnpmEnvImporterDeps,
				configDependencies: PnpmEnvImporterDeps,
			}),
		),
	),
	packages: Schema.optionalKey(
		Schema.Record(
			Schema.String,
			Schema.Struct({
				resolution: Schema.optionalKey(Schema.Struct({ integrity: Schema.optionalKey(Schema.String) })),
			}),
		),
	),
	snapshots: Schema.optionalKey(
		Schema.Record(
			Schema.String,
			Schema.Struct({
				optionalDependencies: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
			}),
		),
	),
});

type PnpmEnvRawType = typeof PnpmEnvRaw.Type;

/** The package-manager package this reader resolves. */
const PNPM = "pnpm";

/** The importer pnpm records `packageManagerDependencies` under. */
const ROOT_IMPORTER = ".";

const JsonString = Schema.fromJsonString(Schema.String);

/**
 * Own-property read of a decoded record. The records come from YAML, so a key
 * such as `constructor` or `__proto__` must never be answered by
 * `Object.prototype`.
 */
const own = <V>(record: Readonly<Record<string, V>> | undefined, key: string): V | undefined =>
	record !== undefined && Object.hasOwn(record, key) ? record[key] : undefined;

/**
 * A located, well-formed preamble that does not hold what it promises: the
 * importer names a package the `packages:` section cannot account for. A
 * shape failure of a located document, so it rides the validation channel.
 */
const unaccounted = (message: string): ParseFailure =>
	validationFailure(new Error(`pnpm-lock.yaml env preamble: ${message}`));

/**
 * The SRI integrity of `packages["<key>"]`, failing when the entry, its
 * integrity, or the SRI form of that integrity is missing. Never `undefined`:
 * the caller only asks for keys the lockfile's own graph names.
 */
const integrityOf = (raw: PnpmEnvRawType, key: string): Effect.Effect<string, ParseFailure> => {
	const integrity = own(raw.packages, key)?.resolution?.integrity;
	if (integrity === undefined) {
		return Effect.fail(unaccounted(`packages[${JSON.stringify(key)}] records no resolution.integrity`));
	}
	if (!IntegrityHash.isSri(integrity)) {
		return Effect.fail(
			unaccounted(`packages[${JSON.stringify(key)}].resolution.integrity is not an SRI integrity string`),
		);
	}
	return Effect.succeed(integrity);
};

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
const decodePreamble = (content: string): Effect.Effect<PnpmEnvRawType | undefined, ParseFailure> =>
	Effect.gen(function* () {
		const { preamble } = yield* splitPnpmStream(content);
		if (preamble === undefined) return undefined;
		yield* gatePnpmVersion(preamble);
		return yield* Schema.decodeUnknownEffect(PnpmEnvRaw)(preamble).pipe(Effect.mapError(validationFailure));
	});

/**
 * Read the package manager pinned by a `pnpm-lock.yaml`'s env preamble.
 *
 * @remarks
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
export const readPnpmPackageManager = (content: string): Effect.Effect<PackageManagerLock | undefined, ParseFailure> =>
	Effect.gen(function* () {
		const raw = yield* decodePreamble(content);
		if (raw === undefined) return undefined;
		const declared = own(own(raw.importers, ROOT_IMPORTER)?.packageManagerDependencies, PNPM);
		if (declared === undefined) return undefined;
		const integrity = yield* recordedIntegrity(raw, PNPM, PNPM, declared.version);
		const key = `${PNPM}@${declared.version}`;
		const snapshot = own(raw.snapshots, key);
		if (snapshot === undefined) {
			return yield* Effect.fail(unaccounted(`snapshots[${yield* Schema.encodeEffect(JsonString)(key).pipe(Effect.mapError(validationFailure))}] is missing`));
		}
		const natives: Array<readonly [string, string]> = [];
		for (const [name, version] of Object.entries(snapshot.optionalDependencies ?? {})) {
			natives.push([name, yield* integrityOf(raw, `${name}@${version}`)]);
		}
		return PackageManagerLock.make({
			name: PNPM,
			specifier: declared.specifier,
			version: declared.version,
			integrity,
			nativeIntegrity: Object.fromEntries(natives),
		});
	});

/**
 * Read the config dependencies recorded by a `pnpm-lock.yaml`'s env preamble,
 * keyed by name, each with the integrity pnpm recorded for it.
 *
 * @remarks
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
export const readPnpmConfigDependencies = (
	content: string,
): Effect.Effect<ReadonlyMap<string, ConfigDependencyLock>, ParseFailure> =>
	Effect.gen(function* () {
		const raw = yield* decodePreamble(content);
		const declared = own(raw?.importers, ROOT_IMPORTER)?.configDependencies;
		const locks = new Map<string, ConfigDependencyLock>();
		if (raw === undefined || declared === undefined) return locks;
		for (const [name, entry] of Object.entries(declared)) {
			const integrity = yield* recordedIntegrity(raw, `config dependency ${yield* Schema.encodeEffect(JsonString)(name).pipe(Effect.mapError(validationFailure))}`, name, entry.version);
			locks.set(
				name,
				ConfigDependencyLock.make({ name, specifier: entry.specifier, version: entry.version, integrity }),
			);
		}
		return locks;
	});
