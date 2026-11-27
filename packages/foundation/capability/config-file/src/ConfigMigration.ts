/**
 * Versioned, forward-only migrations for config documents: `ConfigMigration.make` wraps a codec so
 * `parse` reads the document version and applies every newer step in order.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ConfigFileId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import type { ConfigCodec, ConfigCodecError } from "./ConfigCodec.ts";

const $I = $ConfigFileId.create("ConfigMigration");

/**
 * **Details**
 *
 * `phase` says where: reading the current version, applying a step, or writing
 * the new version back. `cause` preserves the underlying failure by identity
 * when the failing step signals recoverable failure with `Effect.fail`.
 *
 * **Example** (Inspect the failed migration phase)
 *
 * ```ts
 * import { ConfigMigrationError } from "@beep/config-file/ConfigMigration";
 *
 * const error = ConfigMigrationError.make({
 *   version: 2, migration: "rename-host", phase: "apply", cause: new Error("Invalid config"),
 * });
 * console.log(error.message) // Migration "rename-host" (v2) failed during apply
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ConfigMigrationError extends S.TaggedError<ConfigMigrationError, { readonly brand: unique symbol }>(
  $I`ConfigMigrationError`
)(
  "ConfigMigrationError",
  {
    /**
     * The target version of the step that failed. `0` when reading the version failed.
     *
     * @since 0.0.0
     */
    version: S.declare(P.isNumber)
      .annotate({
        toCodecArbitrary: () => new SchemaAST.Link(S.Finite.ast, SchemaTransformation.passthrough()),
      })
      .pipe(
        $I.annoteKey("ConfigMigrationError.version", {
          description: "The target version of the step that failed. `0` when reading the version failed.",
        })
      ),
    /**
     * The name of the step that failed; empty when reading the version failed.
     *
     * @since 0.0.0
     */
    migration: S.String.pipe(
      $I.annoteKey("ConfigMigrationError.migration", {
        description: "The name of the step that failed; empty when reading the version failed.",
      })
    ),
    /**
     * Which stage of a migration step failed.
     *
     * @since 0.0.0
     */
    phase: S.Literals(["read-version", "apply", "write-version"]).pipe(
      $I.annoteKey("ConfigMigrationError.phase", { description: "Which stage of a migration step failed." })
    ),
    /**
     * The underlying failure, preserved structurally.
     *
     * @since 0.0.0
     */
    cause: S.Defect().pipe(
      $I.annoteKey("ConfigMigrationError.cause", { description: "The underlying failure, preserved structurally." })
    ),
  },
  $I.annoteError<ConfigMigrationError>("ConfigMigrationError", {
    description: "Indicates that a versioned config migration failed.",
  })
) {
  /**
   * Describes a version-read failure or identifies the step and phase that failed.
   *
   * **Example** (Read a migration failure message)
   *
   * ```ts
   * import { ConfigMigrationError } from "@beep/config-file/ConfigMigration";
   *
   * const error = ConfigMigrationError.make({
   *   version: 2, migration: "rename-host", phase: "apply", cause: new Error("Invalid config"),
   * });
   * console.log(error.message) // Migration "rename-host" (v2) failed during apply
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return this.phase === "read-version"
      ? "Failed to read the config version"
      : `Migration "${this.migration}" (v${this.version}) failed during ${this.phase}`;
  }
}

/**
 * A single versioned migration step.
 *
 * **Gotchas**
 *
 * Steps are forward-only: there is no reverse (`down`) migration.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface ConfigFileMigration<E = unknown> {
  /**
   * A label for the step, carried on {@link ConfigMigrationError} when it fails.
   *
   * @since 0.0.0
   */
  readonly name: string;
  /**
   * Transforms the parsed config. Signal recoverable failure with `Effect.fail`;
   * a synchronous `throw` is treated as a defect, not a `ConfigMigrationError`.
   *
   * **Gotchas**
   *
   * A `throw` here, or from a {@link (VersionAccess:interface)} accessor, is a
   * programmer bug rather than a data condition. It stays a defect whether it is
   * raised while building the effect or while running it, so a consumer's
   * `catchTag("ConfigMigrationError")` cannot silently swallow it.
   *
   * @since 0.0.0
   */
  readonly up: (raw: unknown) => Effect.Effect<unknown, E>;
  /**
   * The version this step migrates the config to. Steps run in ascending order.
   *
   * @since 0.0.0
   */
  readonly version: number;
}

/**
 * How the version number is read from and written to the parsed config.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface VersionAccess<E = unknown> {
  /**
   * Read the current version from the parsed config.
   *
   * @since 0.0.0
   */
  readonly get: (raw: unknown) => Effect.Effect<number, E>;
  /**
   * Return the config with `version` written back.
   *
   * @since 0.0.0
   */
  readonly set: {
    (raw: unknown, version: number): Effect.Effect<unknown, E>;
    (version: number): (raw: unknown) => Effect.Effect<unknown, E>;
  };
}

class VersionAccessError extends S.TaggedError<VersionAccessError, { readonly brand: unique symbol }>(
  $I`VersionAccessError`
)(
  "VersionAccessError",
  {
    message: S.String.pipe(
      $I.annoteKey("VersionAccessError.message", {
        description:
          "Why the parsed config cannot supply its current version: it is not an object or lacks a numeric `version`",
      })
    ),
  },
  $I.annoteError<VersionAccessError>("VersionAccessError", {
    description: "The default version reader could not read a numeric top-level `version` from the parsed config",
  })
) {
  override name = "Error";
}

const setDefaultVersion: {
  (raw: unknown, version: number): Effect.Effect<unknown>;
  (version: number): (raw: unknown) => Effect.Effect<unknown>;
} = dual(
  2,
  (raw: unknown, version: number): Effect.Effect<unknown> =>
    Effect.succeed({
      ...(P.isObjectKeyword(raw) ? raw : P.isString(raw) && Str.isNonEmpty(raw) ? Str.split(raw, "") : {}),
      version,
    })
);

const defaultVersionAccess = {
  get: (raw: unknown) => {
    if (!P.isObjectOrArray(raw)) return Effect.fail(VersionAccessError.make({ message: "config is not an object" }));
    const version = P.hasProperty(raw, "version") ? raw.version : undefined;
    return P.isNumber(version)
      ? Effect.succeed(version)
      : Effect.fail(VersionAccessError.make({ message: "version field is missing or not a number" }));
  },
  set: setDefaultVersion,
};

/**
 * Reads and writes a top-level `version` field.
 *
 * **Example** (Read the default top-level version)
 *
 * ```ts
 * import { VersionAccess } from "@beep/config-file/ConfigMigration";
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.runSync(VersionAccess.default.get({ version: 2 }))) // 2
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export const VersionAccess = { default: defaultVersionAccess } as const;

/**
 * Options for {@link ConfigMigration.make}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface ConfigMigrationOptions<EM = unknown, EV = unknown> {
  /**
   * The codec being wrapped.
   *
   * @since 0.0.0
   */
  readonly codec: ConfigCodec;
  /**
   * The migration steps; they run in ascending `version` order.
   *
   * @since 0.0.0
   */
  readonly migrations: ReadonlyArray<ConfigFileMigration<EM>>;
  /**
   * How the version is read and written; defaults to {@link (VersionAccess:variable).default}, a top-level `version` field.
   *
   * @since 0.0.0
   */
  readonly versionAccess?: VersionAccess<EV>;
}

const runPhase: {
  <A, E>(
    phase: "read-version" | "apply" | "write-version",
    version: number,
    name: string,
    run: () => Effect.Effect<A, E>
  ): Effect.Effect<A, ConfigMigrationError>;
  <A, E>(
    version: number,
    name: string,
    run: () => Effect.Effect<A, E>
  ): (phase: "read-version" | "apply" | "write-version") => Effect.Effect<A, ConfigMigrationError>;
} = dual(
  4,
  <A, E>(
    phase: "read-version" | "apply" | "write-version",
    version: number,
    name: string,
    run: () => Effect.Effect<A, E>
  ): Effect.Effect<A, ConfigMigrationError> =>
    Effect.suspend(run).pipe(
      Effect.mapError((cause) => ConfigMigrationError.make({ version, migration: name, phase, cause }))
    )
);

const make: (options: ConfigMigrationOptions) => ConfigCodec<ConfigCodecError | ConfigMigrationError> = <EM, EV>(
  options: ConfigMigrationOptions<EM, EV>
): ConfigCodec<ConfigCodecError | ConfigMigrationError> => {
  const access = options.versionAccess ?? VersionAccess.default;
  const sorted = A.sort(
    options.migrations,
    Order.mapInput(Order.Number, (migration: ConfigFileMigration<EM>) => migration.version)
  );

  return {
    name: options.codec.name,
    stringify: options.codec.stringify,
    parse: Effect.fn("ConfigMigration.parse")(function* (raw: string) {
      let parsed = yield* options.codec.parse(raw);
      if (sorted.length === 0) return parsed;

      const current = yield* runPhase<number, EV | VersionAccessError>("read-version", 0, "", () => access.get(parsed));

      for (const migration of A.filter(sorted, (m) => m.version > current)) {
        parsed = yield* runPhase("apply", migration.version, migration.name, () => migration.up(parsed));
        parsed = yield* runPhase("write-version", migration.version, migration.name, () =>
          access.set(parsed, migration.version)
        );
      }
      return parsed;
    }),
  };
};

/**
 * Versioned migration support for config codecs.
 *
 * **Example** (Migrate a parsed configuration document)
 *
 * ```ts
 * import { ConfigMigration } from "@beep/config-file/ConfigMigration";
 * import { JsonCodec } from "@beep/config-file/JsonCodec";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const codec = ConfigMigration.make({
 *   codec: JsonCodec,
 *   migrations: [{
 *     version: 2,
 *     name: "rename-host",
 *     up: (raw) => S.decodeUnknownEffect(S.Record(S.String, S.Unknown))(raw).pipe(
 *       Effect.map((doc) => ({ ...doc, host: doc.hostname })),
 *     ),
 *   }],
 * });
 * const migrated = Effect.runSync(codec.parse('{"version":1,"hostname":"localhost"}'));
 * console.log(JSON.stringify(migrated)) // {"version":2,"hostname":"localhost","host":"localhost"}
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class ConfigMigration {
  private constructor() {}

  /**
   * Wrap a codec so that parsed content is brought up to the latest version.
   *
   * **Details**
   * The returned codec's error channel **widens** to include
   * {@link ConfigMigrationError} rather than flattening migration failures into
   * the inner codec's error — the reason the {@link (ConfigCodec:interface)} seam is generic
   * in its error type.
   *
   * **Example** (Migrate a hostname field)
   *
   * ```ts
   * import { ConfigMigration } from "@beep/config-file/ConfigMigration";
   * import { JsonCodec } from "@beep/config-file/JsonCodec";
   * import * as Effect from "effect/Effect";
   * import * as S from "effect/Schema";
   *
   * const codec = ConfigMigration.make({
   *   codec: JsonCodec,
   *   migrations: [{
   *     version: 2,
   *     name: "rename-host",
   *     up: (raw) => S.decodeUnknownEffect(S.Record(S.String, S.Unknown))(raw).pipe(
   *       Effect.map((doc) => ({ ...doc, host: doc.hostname })),
   *     ),
   *   }],
   * });
   * const migrated = Effect.runSync(codec.parse('{"version":1,"hostname":"localhost"}'));
   * console.log(JSON.stringify(migrated)) // {"version":2,"hostname":"localhost","host":"localhost"}
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly make = make;
}
