import { $LockfilesId } from "@beep/identity/packages";
import { IntegrityHash } from "@beep/npm-spec/IntegrityHash";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ConfigDependencyLock } from "../ConfigDependencyLock.ts";
import { PackageManagerLock } from "../PackageManagerLock.ts";
import { splitPnpmStream } from "./documents.ts";
import { gatePnpmVersion, PackageResolution, validationFailure } from "./shared.ts";
import type { ParseFailure } from "./shared.ts";

const $I = $LockfilesId.create("internal/pnpmEnv");

/**
 * A well-formed env preamble whose recorded dependency cannot be accounted for.
 */
class PnpmEnvPreambleError extends S.TaggedError<PnpmEnvPreambleError, { readonly brand: unique symbol }>(
  $I`PnpmEnvPreambleError`
)(
  "PnpmEnvPreambleError",
  {
    message: S.String.pipe(
      $I.annoteKey("PnpmEnvPreambleError.message", {
        description: "The env preamble's unaccounted dependency or integrity claim.",
      })
    ),
  },
  $I.annoteError<PnpmEnvPreambleError>("PnpmEnvPreambleError", {
    description: "An env preamble whose recorded dependency cannot be accounted for.",
  })
) {}

// ── Raw schema (permissive validation scaffolding, not API) ────────────────

const PnpmEnvImporterDeps = S.optionalKey(
  S.Record(
    S.String,
    S.Struct({
      specifier: S.String.pipe(
        $I.annoteKey("PnpmEnvImporterDependency.specifier", {
          description: "The dependency specifier recorded verbatim by pnpm.",
        })
      ),
      version: S.String.pipe(
        $I.annoteKey("PnpmEnvImporterDependency.version", {
          description: "The resolved version used to locate the dependency's package entry.",
        })
      ),
    }).pipe(
      $I.annoteSchema("PnpmEnvImporterDependency", {
        description: "A dependency declaration in an env preamble importer, before integrity lookup.",
      })
    )
  ).pipe(
    $I.annoteSchema("PnpmEnvImporterDeps", {
      description: "Optional env importer dependencies keyed by package name, preserving pnpm's raw declarations.",
    })
  )
);

const PnpmEnvRaw = S.Struct({
  importers: S.optionalKey(
    S.Record(
      S.String,
      S.Struct({
        packageManagerDependencies: PnpmEnvImporterDeps.pipe(
          $I.annoteKey("PnpmEnvImporter.packageManagerDependencies", {
            description: "Package managers pinned by this importer.",
          })
        ),
        configDependencies: PnpmEnvImporterDeps.pipe(
          $I.annoteKey("PnpmEnvImporter.configDependencies", {
            description: "Configuration dependencies recorded by this importer.",
          })
        ),
      }).pipe(
        $I.annoteKey("PnpmEnvImporter", {
          description: "An env preamble importer's package-manager and configuration declarations.",
        })
      )
    )
  ).pipe(
    $I.annoteKey("PnpmEnvRaw.importers", {
      description: "Env importers keyed by workspace-relative path; the root importer is '.'.",
    })
  ),
  packages: S.optionalKey(
    S.Record(
      S.String,
      S.Struct({
        resolution: S.optionalKey(PackageResolution).pipe(
          $I.annoteKey("PnpmEnvPackage.resolution", {
            description: "The package resolution metadata recorded by pnpm.",
          })
        ),
      }).pipe(
        $I.annoteKey("PnpmEnvPackage", {
          description: "An env package entry whose integrity can satisfy an importer or native dependency.",
        })
      )
    )
  ).pipe(
    $I.annoteKey("PnpmEnvRaw.packages", {
      description: "Env package entries keyed by package name and resolved version.",
    })
  ),
  snapshots: S.optionalKey(
    S.Record(
      S.String,
      S.Struct({
        optionalDependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
          $I.annoteKey("PnpmEnvSnapshot.optionalDependencies", {
            description: "Optional dependency versions keyed by name, including pnpm's native platform packages.",
          })
        ),
      }).pipe(
        $I.annoteKey("PnpmEnvSnapshot", {
          description: "An env dependency snapshot used to discover pnpm's optional native packages.",
        })
      )
    )
  ).pipe(
    $I.annoteKey("PnpmEnvRaw.snapshots", {
      description: "Env dependency snapshots keyed by package name and resolved version.",
    })
  ),
}).pipe(
  $I.annoteSchema("PnpmEnvRaw", {
    description:
      "The permissive env preamble boundary shape shared by the pnpm package-manager and config-dependency readers.",
  })
);

type PnpmEnvRawType = typeof PnpmEnvRaw.Type;

const decodePnpmEnvRaw = S.decodeUnknownEffect(PnpmEnvRaw);

/**
 * The package-manager package this reader resolves.
 */
const PNPM = "pnpm";

/**
 * The importer pnpm records `packageManagerDependencies` under.
 */
const ROOT_IMPORTER = ".";

const JsonString = S.fromJsonString(S.String).pipe(
  $I.annoteSchema("JsonString", {
    description: "A JSON-quoted string used to name env preamble keys exactly in validation messages.",
  })
);
const encodeJsonString = S.encodeEffect(JsonString);

/**
 * Own-property read of a decoded record. The records come from YAML, so a key
 * such as `constructor` or `__proto__` must never be answered by
 * `Object.prototype`.
 */
const own: {
  <V>(record: Readonly<Record<string, V>> | undefined, key: string): O.Option<V>;
  (key: string): <V>(record: Readonly<Record<string, V>> | undefined) => O.Option<V>;
} = dual(
  2,
  <V>(record: Readonly<Record<string, V>> | undefined, key: string): O.Option<V> =>
    O.flatMap(O.fromUndefinedOr(record), R.get(key))
);

// A key named exactly, JSON-quoted, for a validation message.
const quoted = (key: string): Effect.Effect<string, ParseFailure> =>
  encodeJsonString(key).pipe(Effect.mapError(validationFailure));

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
const integrityOf: {
  (raw: PnpmEnvRawType, key: string): Effect.Effect<string, ParseFailure>;
  (key: string): (raw: PnpmEnvRawType) => Effect.Effect<string, ParseFailure>;
} = dual(
  2,
  Effect.fnUntraced(function* (raw: PnpmEnvRawType, key: string): Effect.fn.Return<string, ParseFailure> {
    const integrity = O.getOrUndefined(own(raw.packages, key))?.resolution?.integrity;
    if (integrity === undefined) {
      return yield* Effect.fail(unaccounted(`packages[${yield* quoted(key)}] records no resolution.integrity`));
    }
    if (!IntegrityHash.isSri(integrity)) {
      return yield* Effect.fail(
        unaccounted(`packages[${yield* quoted(key)}].resolution.integrity is not an SRI integrity string`)
      );
    }
    return integrity;
  })
);

/**
 * The SRI integrity of the `<name>@<version>` a preamble entry records,
 * failing first when the version is empty: an empty version names no
 * `packages` entry, and saying so beats reporting the malformed key.
 * `subject` is the entry as the empty-version message names it.
 */
const recordedIntegrity: {
  (raw: PnpmEnvRawType, subject: string, name: string, version: string): Effect.Effect<string, ParseFailure>;
  (subject: string, name: string, version: string): (raw: PnpmEnvRawType) => Effect.Effect<string, ParseFailure>;
} = dual(
  4,
  (raw: PnpmEnvRawType, subject: string, name: string, version: string): Effect.Effect<string, ParseFailure> =>
    version === ""
      ? Effect.fail(unaccounted(`${subject} is recorded with an empty version`))
      : integrityOf(raw, `${name}@${version}`)
);

/**
 * Locate and decode the env preamble of a `pnpm-lock.yaml`: `None` when the
 * stream carries none, typed when it is malformed or below the supported
 * lockfile version. The one decode every preamble reader shares, so they
 * cannot disagree about which document is the preamble or what shape it has.
 */
const decodePreamble = Effect.fn("PnpmEnvLockfile.decodePreamble")(function* (
  content: string
): Effect.fn.Return<O.Option<PnpmEnvRawType>, ParseFailure> {
  const { preamble } = yield* splitPnpmStream(content);
  if (preamble === undefined) return O.none();
  yield* gatePnpmVersion(preamble);
  const pipe1 = yield* decodePnpmEnvRaw(preamble).pipe(Effect.mapError(validationFailure));
  return O.some(pipe1);
});

type EnvDependency = { readonly specifier: string; readonly version: string };

// The root importer's declared dependencies in one preamble section.
const rootDeclarations = (
  raw: PnpmEnvRawType,
  section: "packageManagerDependencies" | "configDependencies"
): O.Option<Readonly<Record<string, EnvDependency>>> =>
  O.flatMap(own(raw.importers, ROOT_IMPORTER), (importer) => O.fromUndefinedOr(importer[section]));

/**
 * Read the package manager pinned by a `pnpm-lock.yaml`'s env preamble.
 *
 * **Details**
 *
 * `None` means the lockfile records no package manager: no preamble, or
 * a preamble whose root importer declares no `pnpm` package-manager
 * dependency. Everything past that point is a claim the lockfile made, so a
 * claim it cannot back — a missing `pnpm@<version>` entry, a missing snapshot,
 * a missing or non-SRI integrity for pnpm or each native it lists — fails typed
 * rather than degrading to "nothing recorded".
 *
 * Native packages come from the lockfile's own graph — the optional
 * dependencies of the `pnpm@<version>` snapshot — not from a name pattern.
 *
 * **Example** (Read a stream without a manager preamble)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { readPnpmPackageManager } from "@beep/lockfiles/internal/pnpmEnv";
 *
 * console.log(O.isNone(Effect.runSync(readPnpmPackageManager("lockfileVersion: 9\nimporters:\n  .: {}")))) // true
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const readPnpmPackageManager = Effect.fn("PnpmEnvLockfile.readPackageManager")(function* (
  content: string
): Effect.fn.Return<O.Option<PackageManagerLock>, ParseFailure> {
  const raw = yield* decodePreamble(content);
  return yield* Effect.transposeOption(
    O.flatMap(raw, (preamble) =>
      O.map(O.flatMap(rootDeclarations(preamble, "packageManagerDependencies"), own(PNPM)), (declared) =>
        packageManagerLock(preamble, declared)
      )
    )
  );
});

// Native packages come from the lockfile's own graph — the optional
// dependencies of the `pnpm@<version>` snapshot — not from a name pattern.
const packageManagerLock = Effect.fnUntraced(function* (raw: PnpmEnvRawType, declared: EnvDependency) {
  const integrity = yield* recordedIntegrity(raw, PNPM, PNPM, declared.version);
  const key = `${PNPM}@${declared.version}`;
  const snapshot = own(raw.snapshots, key);
  if (O.isNone(snapshot)) return yield* Effect.fail(unaccounted(`snapshots[${yield* quoted(key)}] is missing`));
  const natives = yield* Effect.forEach(R.toEntries(snapshot.value.optionalDependencies ?? {}), ([name, version]) =>
    Effect.map(integrityOf(raw, `${name}@${version}`), (sri) => [name, sri] as const)
  );
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
 * **Example** (Read a stream without config dependencies)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as HashMap from "effect/HashMap";
 * import { readPnpmConfigDependencies } from "@beep/lockfiles/internal/pnpmEnv";
 *
 * const locks = Effect.runSync(readPnpmConfigDependencies("lockfileVersion: 9\nimporters:\n  .: {}"));
 * console.log(HashMap.size(locks)) // 0
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const readPnpmConfigDependencies = Effect.fn("PnpmEnvLockfile.readConfigDependencies")(function* (
  content: string
): Effect.fn.Return<HashMap.HashMap<string, ConfigDependencyLock>, ParseFailure> {
  const raw = yield* decodePreamble(content);
  const declared = O.flatMap(raw, (preamble) =>
    O.map(rootDeclarations(preamble, "configDependencies"), (entries) => [preamble, entries] as const)
  );
  if (O.isNone(declared)) return HashMap.empty();
  const [preamble, entries] = declared.value;
  const locks = yield* Effect.forEach(R.toEntries(entries), ([name, entry]) =>
    Effect.flatMap(quoted(name), (quotedName) =>
      Effect.map(
        recordedIntegrity(preamble, `config dependency ${quotedName}`, name, entry.version),
        (integrity) =>
          [
            name,
            ConfigDependencyLock.make({ name, specifier: entry.specifier, version: entry.version, integrity }),
          ] as const
      )
    )
  );
  return HashMap.fromIterable(locks);
});
