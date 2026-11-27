/**
 * The config file service: `ConfigFile.Service` and `ConfigFile.layer` discover, parse, validate,
 * merge and persist one schema-typed document, `ConfigFile.read` reads one known path, and
 * `ConfigFile.testLayer` seeds files for tests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ConfigFileId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as PubSub from "effect/PubSub";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import { ConfigCodecError } from "./ConfigCodec.ts";
import { ConfigEvent, ConfigSourceRef } from "./ConfigEvent.ts";
import { ConfigMatch, ConfigProbe, ConfigResolver } from "./ConfigResolver.ts";
import type * as SchemaAST from "effect/SchemaAST";
import type { ConfigCodec } from "./ConfigCodec.ts";
import type { ConfigEventPayload, ConfigEvents, ConfigEventsShape } from "./ConfigEvent.ts";
import type { ConfigSource, MergeStrategy, NonEmptySources } from "./MergeStrategy.ts";

const $I = $ConfigFileId.create("ConfigFile");

/**
 * **Details**
 *
 * Its own tag, so "no config anywhere" is routable with `Effect.catchTag`
 * separately from "the config I found is broken" — the single most important
 * distinction in the error set.
 *
 * **Example** (Inspect an exhausted resolver chain)
 *
 * ```ts
 * import { ConfigFileNotFoundError } from "@beep/config-file/ConfigFile";
 *
 * const error = ConfigFileNotFoundError.make({ searched: ["explicitPath"], candidates: ["./app.json"] });
 * console.log(error.message) // No config file found (searched: explicitPath — 1 candidate path checked)
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ConfigFileNotFoundError extends S.TaggedError<ConfigFileNotFoundError, { readonly brand: unique symbol }>(
  $I`ConfigFileNotFoundError`
)(
  "ConfigFileNotFoundError",
  {
    /**
     * The names of the resolvers that were probed, in order.
     *
     * @since 0.0.0
     */
    searched: S.Array(S.String).pipe(
      $I.annoteKey("ConfigFileNotFoundError.searched", {
        description: "The names of the resolvers that were probed, in order.",
      })
    ),
    /**
     * The candidate paths the chain actually checked on disk, in probe order
     * across every resolver — the failure-path mirror of {@link ConfigMatch}.
     *
     * **Gotchas**
     *
     * One `searched` name can hide many paths: an `upwardWalk` with a
     * `filenames` list probes every name at every ancestor. Resolvers that omit
     * the optional `resolveProbe` member contribute nothing here, so the list
     * can be shorter than the true search (or empty for a fully hand-rolled
     * chain) — `searched` remains the complete resolver list either way.
     *
     * @since 0.0.0
     */
    candidates: S.Array(S.String).pipe(
      $I.annoteKey("ConfigFileNotFoundError.candidates", {
        description:
          "The candidate paths the chain actually checked on disk, in probe order across every resolver — the failure-path mirror of ConfigMatch.",
      })
    ),
  },
  $I.annoteError<ConfigFileNotFoundError>("ConfigFileNotFoundError", {
    description: "Indicates that the resolver chain produced no configuration source.",
  })
) {
  /**
   * Summarizes the searched resolvers and includes the candidate count when paths were probed.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { ConfigFileNotFoundError } from "@beep/config-file/ConfigFile";
   *
   * const error = ConfigFileNotFoundError.make({ searched: ["explicitPath"], candidates: ["./app.json"] });
   * console.log(error.message) // No config file found (searched: explicitPath — 1 candidate path checked)
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    const count = this.candidates.length;
    const probed = count === 0 ? "" : ` — ${count} candidate path${count === 1 ? "" : "s"} checked`;
    return `No config file found (searched: ${A.join(this.searched, ", ")}${probed})`;
  }
}

/**
 * **Details**
 *
 * `cause` preserves the underlying filesystem failure structurally rather than
 * flattening it to a string.
 *
 * **Example** (Inspect a file read failure)
 *
 * ```ts
 * import { ConfigFileReadError } from "@beep/config-file/ConfigFile";
 *
 * const error = ConfigFileReadError.make({ path: "./app.json", cause: new Error("Permission denied") });
 * console.log(error.message) // Failed to read config file at "./app.json"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ConfigFileReadError extends S.TaggedError<ConfigFileReadError, { readonly brand: unique symbol }>(
  $I`ConfigFileReadError`
)(
  "ConfigFileReadError",
  {
    /**
     * The path that could not be read.
     *
     * @since 0.0.0
     */
    path: S.String.pipe($I.annoteKey("ConfigFileReadError.path", { description: "The path that could not be read." })),
    /**
     * The underlying failure, preserved structurally.
     *
     * @since 0.0.0
     */
    cause: S.Defect().pipe(
      $I.annoteKey("ConfigFileReadError.cause", { description: "The underlying failure, preserved structurally." })
    ),
  },
  $I.annoteError<ConfigFileReadError>("ConfigFileReadError", {
    description: "Indicates that a config file could not be read from the filesystem.",
  })
) {
  /**
   * Identifies the config path whose filesystem read failed.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { ConfigFileReadError } from "@beep/config-file/ConfigFile";
   *
   * const error = ConfigFileReadError.make({ path: "./app.json", cause: new Error("Permission denied") });
   * console.log(error.message) // Failed to read config file at "./app.json"
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `Failed to read config file at "${this.path}"`;
  }
}

/**
 * **Example** (Inspect a file write failure)
 *
 * ```ts
 * import { ConfigFileWriteError } from "@beep/config-file/ConfigFile";
 *
 * const error = ConfigFileWriteError.make({ path: "./app.json", cause: new Error("Permission denied") });
 * console.log(error.message) // Failed to write config file at "./app.json"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ConfigFileWriteError extends S.TaggedError<ConfigFileWriteError, { readonly brand: unique symbol }>(
  $I`ConfigFileWriteError`
)(
  "ConfigFileWriteError",
  {
    /**
     * The path that could not be written.
     *
     * @since 0.0.0
     */
    path: S.String.pipe(
      $I.annoteKey("ConfigFileWriteError.path", { description: "The path that could not be written." })
    ),
    /**
     * The underlying failure, preserved structurally.
     *
     * @since 0.0.0
     */
    cause: S.Defect().pipe(
      $I.annoteKey("ConfigFileWriteError.cause", { description: "The underlying failure, preserved structurally." })
    ),
  },
  $I.annoteError<ConfigFileWriteError>("ConfigFileWriteError", {
    description: "Indicates that a config file could not be written to the filesystem.",
  })
) {
  /**
   * Identifies the config path whose filesystem write failed.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { ConfigFileWriteError } from "@beep/config-file/ConfigFile";
   *
   * const error = ConfigFileWriteError.make({ path: "./app.json", cause: new Error("Permission denied") });
   * console.log(error.message) // Failed to write config file at "./app.json"
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `Failed to write config file at "${this.path}"`;
  }
}

/**
 * **Details**
 *
 * It is distinct by tag from a real {@link ConfigFileWriteError}, so a caller
 * can tell "no destination was configured" from "the write failed".
 *
 * It carries no `path` field on purpose. The whole point of this failure is
 * that there is no path; a {@link ConfigFileWriteError} with a fabricated path
 * would be a lie.
 *
 * **Example** (Inspect a missing save destination)
 *
 * ```ts
 * import { ConfigDefaultPathMissingError } from "@beep/config-file/ConfigFile";
 *
 * const error = ConfigDefaultPathMissingError.make({});
 * console.log(error.message) // No `defaultPath` configured: `save` and `update` require ConfigFileOptions.defaultPath
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ConfigDefaultPathMissingError extends S.TaggedError<
  ConfigDefaultPathMissingError,
  { readonly brand: unique symbol }
>($I`ConfigDefaultPathMissingError`)(
  "ConfigDefaultPathMissingError",
  {},
  $I.annoteError<ConfigDefaultPathMissingError>("ConfigDefaultPathMissingError", {
    description:
      "Indicates that ConfigFileShape.save or ConfigFileShape.update was called on a service configured without a `defaultPath`.",
  })
) {
  /**
   * Explains that saving and updating require a configured default destination.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { ConfigDefaultPathMissingError } from "@beep/config-file/ConfigFile";
   *
   * const error = ConfigDefaultPathMissingError.make({});
   * console.log(error.message) // No `defaultPath` configured: `save` and `update` require ConfigFileOptions.defaultPath
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return "No `defaultPath` configured: `save` and `update` require ConfigFileOptions.defaultPath";
  }
}

/**
 * **Details**
 *
 * `issue` carries the **structured** schema failure — at runtime a
 * `SchemaIssue.Issue` tree, reachable through `_tag` and nested `issues`, so
 * every field a caller might branch on survives. It is typed `unknown` because
 * there is no `Schema` for `Issue`; narrow it with the `SchemaIssue` module.
 *
 * **Example** (Inspect an in-memory validation failure)
 *
 * ```ts
 * import { ConfigValidationError } from "@beep/config-file/ConfigFile";
 * import * as O from "effect/Option";
 *
 * const error = ConfigValidationError.make({ path: O.none(), issue: new Error("Invalid port") });
 * console.log(error.message) // Config validation failed
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ConfigValidationError extends S.TaggedError<ConfigValidationError, { readonly brand: unique symbol }>(
  $I`ConfigValidationError`
)(
  "ConfigValidationError",
  {
    /**
     * The offending file, absent when `validate` was called on an in-memory value.
     *
     * @since 0.0.0
     */
    path: S.Option(S.String).pipe(
      $I.annoteKey("ConfigValidationError.path", {
        description: "The offending file, absent when `validate` was called on an in-memory value.",
      })
    ),
    /**
     * The structured schema issue. Never a string.
     *
     * @since 0.0.0
     */
    issue: S.Defect().pipe(
      $I.annoteKey("ConfigValidationError.issue", { description: "The structured schema issue. Never a string." })
    ),
  },
  $I.annoteError<ConfigValidationError>("ConfigValidationError", {
    description:
      "Indicates that parsed config content did not satisfy the schema, or that a caller-supplied `validate` rejected it.",
  })
) {
  /**
   * Describes a validation failure, including the file path when one is present.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { ConfigValidationError } from "@beep/config-file/ConfigFile";
   * import * as O from "effect/Option";
   *
   * const error = ConfigValidationError.make({ path: O.none(), issue: new Error("Invalid port") });
   * console.log(error.message) // Config validation failed
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    const at = O.match(this.path, { onNone: () => "", onSome: (p) => ` at "${p}"` });
    return `Config validation failed${at}`;
  }

  /**
   * The carried failure narrowed to a `SchemaIssue.Issue`, or `None` when a
   * caller-supplied `validate` failed with some other value.
   *
   * **Details**
   *
   * A schema failure on the `ConfigFile.read` or `load` path always carries an
   * `Issue`, so an importer that only passes a schema can treat `None` as a
   * defect. Wrap the issue in `S.SchemaError` to render the standard message.
   *
   * **Example** (Narrow a validate rejection)
   *
   * ```ts
   * import { ConfigValidationError } from "@beep/config-file/ConfigFile";
   * import * as O from "effect/Option";
   *
   * const error = ConfigValidationError.make({ path: O.none(), issue: new Error("rejected") });
   * console.log(O.isNone(error.schemaIssue)) // true
   * ```
   *
   * @since 0.0.0
   */
  get schemaIssue(): O.Option<SchemaIssue.Issue> {
    return O.liftPredicate(this.issue, SchemaIssue.isIssue);
  }
}

/**
 * The failure modes of the full discovery-and-load path.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ConfigLoadError = ConfigFileNotFoundError | ConfigFileReadError | ConfigCodecError | ConfigValidationError;

/**
 * The failure modes of reading one known path.
 *
 * **Details**
 *
 * Deliberately excludes {@link ConfigFileNotFoundError}: every method typed with
 * this union either takes an explicit path or treats "nothing found" as success.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ConfigReadError = ConfigFileReadError | ConfigCodecError | ConfigValidationError;

/**
 * The failure modes of encoding and writing one known path.
 *
 * **Details**
 *
 * Deliberately excludes {@link ConfigFileNotFoundError} — the path is explicit,
 * so there is nothing to discover — and {@link ConfigDefaultPathMissingError},
 * because no default path is consulted.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ConfigWriteError = ConfigFileWriteError | ConfigCodecError | ConfigValidationError;

/**
 * The failure modes of {@link ConfigFileShape.encode}: everything on the write
 * path except the write itself.
 *
 * **Details**
 *
 * Deliberately excludes {@link ConfigFileWriteError} — nothing touches the
 * filesystem — so a `--dry-run` caller's error channel is honest about that.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ConfigEncodeError = ConfigCodecError | ConfigValidationError;

/**
 * **Example** (Prefix a TOML schema directive)
 *
 * ```ts
 * import { ConfigEncodeOptions } from "@beep/config-file/ConfigFile";
 *
 * const options = ConfigEncodeOptions.make({ header: "#:schema ./config.schema.json" });
 * console.log(options.header) // #:schema ./config.schema.json
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class ConfigEncodeOptions extends S.Opaque<ConfigEncodeOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Text emitted **verbatim** in front of the serialized document, separated
     * from it by exactly one newline. If `header` already ends in `"\n"`, no
     * further newline is added.
     *
     * **Gotchas**
     *
     * The caller owns the header's validity in the target format: `#` comment
     * lines for TOML and YAML, `//` for JSONC. JSON has no comment syntax, so a
     * header on a JSON codec yields an unparseable file by construction — the
     * service does not check. The motivating case is a schema directive such as
     * `#:schema https://example.com/config.schema.json` at the top of a TOML
     * file, which editors read for completion and validation.
     *
     * @since 0.0.0
     */
    header: S.optionalKey(S.String).pipe(
      $I.annoteKey("ConfigEncodeOptions.header", {
        description: "Text emitted verbatim in front of the serialized document, separated by exactly one newline.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ConfigEncodeOptions", {
      description: "Options shared by ConfigFileShape.encode and ConfigFileShape.write.",
    })
  )
) {}

/**
 * The failure modes of {@link ConfigFileShape.save}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ConfigSaveError = ConfigWriteError | ConfigDefaultPathMissingError;

/**
 * The failure modes of {@link ConfigFileShape.update}, which loads and then saves.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ConfigUpdateError = ConfigLoadError | ConfigFileWriteError | ConfigDefaultPathMissingError;

/**
 * The config file service, generic over the decoded config type `A`.
 *
 * **Details**
 *
 * Error unions are narrowed per method: `loadOrDefault` cannot fail with
 * {@link ConfigFileNotFoundError} because that is the branch it handles, and
 * `discover` treats an empty result as success.
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export interface ConfigFileShape<A> {
  /**
   * Every source the resolver chain found, in priority order. Empty is success.
   *
   * **Gotchas**
   *
   * A found-but-corrupt source ABORTS discovery with a typed error rather than
   * being silently skipped: silently skipping a corrupt file would mean running
   * on the wrong config. This is deliberate.
   *
   * @since 0.0.0
   */
  readonly discover: Effect.Effect<ReadonlyArray<ConfigSource<A>>, ConfigReadError>;
  /**
   * Encode `value` to its serialized text without writing anything.
   *
   * **Details**
   *
   * Produces byte-for-byte what `write(value, path, options)` puts on disk —
   * the primitive for `--dry-run` and "show me the file" callers. Emits no
   * event, because nothing was written. A codec failure here carries no
   * `path`, and a validation failure's `path` is `Option.none()`: there is no
   * file to name.
   *
   * @since 0.0.0
   */
  readonly encode: (value: A, options?: typeof ConfigEncodeOptions.Encoded) => Effect.Effect<string, ConfigEncodeError>;
  /**
   * Discover, decode and merge the highest-priority config source.
   *
   * @since 0.0.0
   */
  readonly load: Effect.Effect<A, ConfigLoadError>;
  /**
   * Read, decode and validate one explicit path.
   *
   * @since 0.0.0
   */
  readonly loadFrom: (path: string) => Effect.Effect<A, ConfigReadError>;
  /**
   * Like {@link ConfigFileShape.load}, but yields `defaultValue` when nothing is found.
   *
   * **Gotchas**
   *
   * `defaultValue` is returned as-is: neither the schema nor `options.validate`
   * is applied to it. It is trusted caller input, not a discovered document.
   *
   * @since 0.0.0
   */
  readonly loadOrDefault: (defaultValue: A) => Effect.Effect<A, ConfigReadError>;
  /**
   * Resolve `defaultPath`, `mkdir -p` its parent, encode `value` into it, and
   * return the path written.
   *
   * @since 0.0.0
   */
  readonly save: (value: A) => Effect.Effect<string, ConfigSaveError>;
  /**
   * Load the current value, apply `fn`, {@link ConfigFileShape.save} the result
   * and return it.
   *
   * **Details**
   *
   * With `defaultValue` the load cannot fail with
   * {@link ConfigFileNotFoundError}; without it, it can.
   *
   * Publishes `Updated` alone: the save inside it emits no `Saved`.
   *
   * **Gotchas**
   *
   * Concurrent calls on one service instance are serialized across the whole
   * load, transform and save, so neither caller's change is lost to a stale
   * read. It is not a file lock: another process writing the same path can
   * still clobber the result.
   *
   * @since 0.0.0
   */
  readonly update: {
    (fn: (current: A) => A, defaultValue?: A): Effect.Effect<A, ConfigUpdateError>;
    (defaultValue?: A): (fn: (current: A) => A) => Effect.Effect<A, ConfigUpdateError>;
  };
  /**
   * Decode and validate an in-memory value.
   *
   * @since 0.0.0
   */
  readonly validate: (value: unknown) => Effect.Effect<A, ConfigValidationError>;
  /**
   * Encode `value` and write it to an explicit `path`.
   *
   * **Gotchas**
   *
   * Does **not** create the parent directory — that is
   * {@link ConfigFileShape.save}'s job, and the distinction is load-bearing:
   * `write` targets a path the caller already vouched for. `options` are the
   * same as {@link ConfigFileShape.encode}'s, so the two stay in lockstep.
   *
   * @since 0.0.0
   */
  readonly write: {
    (value: A, path: string, options?: typeof ConfigEncodeOptions.Encoded): Effect.Effect<void, ConfigWriteError>;
    (path: string, options?: typeof ConfigEncodeOptions.Encoded): (value: A) => Effect.Effect<void, ConfigWriteError>;
  };
}

/**
 * Options for {@link ConfigFile.layer}.
 *
 * **Details**
 *
 * `RR` is the union of the resolvers' requirements. It flows into the layer's
 * `R` rather than being cast away.
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface ConfigFileOptions<A, I, RR> {
  /**
   * How file content becomes an unknown document, and back.
   *
   * @since 0.0.0
   */
  readonly codec: ConfigCodec;
  /**
   * Where {@link ConfigFileShape.save} writes when given no explicit path.
   *
   * **Details**
   *
   * Its requirements join the resolvers' in `RR` and flow into the layer's `R`.
   *
   * When absent, `save` and `update` fail with
   * {@link ConfigDefaultPathMissingError}.
   *
   * @since 0.0.0
   */
  readonly defaultPath?: Effect.Effect<string, never, RR>;
  /**
   * The opt-in event hook. Pass the `ConfigEvents` class itself.
   *
   * **Details**
   *
   * A **key**, not an instance: the service is looked up in the ambient context
   * at call time with `Effect.serviceOption`, so it never enters the layer's
   * `R`. When this is omitted, `emit` is `Effect.void` — it does not even
   * perform the lookup. That is what "zero-cost when absent" means here.
   *
   * **Gotchas**
   *
   * Publishing is never fatal. `PubSub.publish` has no error channel, but a
   * consumer-supplied hub can still throw: that defect is logged at debug level
   * and dropped. Interruption is not caught, so a load that is being interrupted
   * stays interrupted.
   *
   * @since 0.0.0
   */
  readonly events?: Context.Key<ConfigEvents, ConfigEventsShape>;
  /**
   * Parse options threaded into every schema decode this performs.
   *
   * **Gotchas**
   *
   * The field that matters here is `onExcessProperty`. It defaults to
   * `"ignore"` in core, so a document's unknown keys are dropped silently and
   * a loader cannot report a typo'd section — or enforce a field this schema
   * deliberately removed. `{ onExcessProperty: "error" }` turns both into a
   * {@link ConfigValidationError} whose issue names the offending path.
   *
   * It cannot be expressed with {@link ConfigFileOptions.validate}: that runs
   * on the *decoded* value, by which point the excess keys are already gone.
   *
   * Keys covered by a `S.StructWithRest` rest are not excess, so a schema
   * that deliberately admits a pass-through section keeps working under
   * `"error"`.
   *
   * Absent, nothing changes: core's defaults apply.
   *
   * Pair it with `errors: "all"`. Core defaults to `"first"`, which for a
   * *loader* means a file with three typos surfaces one per run — fix,
   * re-run, discover the next. The extra work only happens on a document
   * that is already failing.
   *
   * @since 0.0.0
   */
  readonly parseOptions?: SchemaAST.ParseOptions;
  /**
   * The resolver chain, in priority order.
   *
   * @since 0.0.0
   */
  readonly resolvers: ReadonlyArray<ConfigResolver<RR>>;
  /**
   * The schema every discovered document is decoded through.
   *
   * **Details**
   *
   * `S.Codec<A, I>` rather than the one-parameter `S.Schema<A>`,
   * because the encoded form `I` matters on the write path. Its decoding and
   * encoding service channels default to `never`, keeping `decode` free of
   * requirements.
   *
   * @since 0.0.0
   */
  readonly schema: S.Codec<A, I>;
  /**
   * How several discovered sources become one value.
   *
   * @since 0.0.0
   */
  readonly strategy: MergeStrategy<A>;
  /**
   * An optional caller-supplied check run after schema decoding.
   *
   * @since 0.0.0
   */
  readonly validate?: (value: A) => Effect.Effect<A, ConfigValidationError>;
}

const Service =
  <Self, A>() =>
  <const Id extends string>(id: Id) =>
    Context.Service<Self, ConfigFileShape<A>>()(id);

const withCodecPath: {
  <E>(error: E, target: string): E | ConfigCodecError;
  (target: string): <E>(error: E) => E | ConfigCodecError;
} = dual(2, <E>(error: E, target: string): E | ConfigCodecError =>
  S.is(ConfigCodecError)(error) && error.path === undefined
    ? ConfigCodecError.make({
        codec: error.codec,
        operation: error.operation,
        cause: error.cause,
        path: target,
      })
    : error
);

const prependHeader: {
  (document: string, header: string | undefined): string;
  (header: string | undefined): (document: string) => string;
} = dual(2, (document: string, header: string | undefined): string =>
  header === undefined ? document : Str.endsWith("\n")(header) ? `${header}${document}` : `${header}\n${document}`
);

const makeImpl: {
  <A, I, RR>(
    options: ConfigFileOptions<A, I, RR>,
    fs: FileSystem.FileSystem,
    path: Path.Path,
    resolverEnv: Context.Context<RR>
  ): ConfigFileShape<A>;
  <RR>(
    fs: FileSystem.FileSystem,
    path: Path.Path,
    resolverEnv: Context.Context<RR>
  ): <A, I>(options: ConfigFileOptions<A, I, RR>) => ConfigFileShape<A>;
} = dual(
  4,
  <A, I, RR>(
    options: ConfigFileOptions<A, I, RR>,
    fs: FileSystem.FileSystem,
    path: Path.Path,
    resolverEnv: Context.Context<RR>
  ): ConfigFileShape<A> => {
    const emit = (payload: ConfigEventPayload): Effect.Effect<void> =>
      options.events === undefined
        ? Effect.void
        : Effect.serviceOption(options.events).pipe(
            Effect.flatMap(
              O.match({
                onNone: () => Effect.void,
                onSome: Effect.fnUntraced(function* (svc) {
                  const timestamp = yield* DateTime.now;
                  yield* PubSub.publish(svc.events, ConfigEvent.make({ timestamp, event: payload }));
                }),
              })
            ),
            Effect.catchDefect((defect) => Effect.logDebug("ConfigEvents.emit: consumer hub raised a defect", defect))
          );

    const sourceRefs = (sources: ReadonlyArray<ConfigSource<A>>): ReadonlyArray<ConfigSourceRef> =>
      A.map(sources, (s) => ConfigSourceRef.make({ path: s.path, resolver: s.resolver }));

    const decode: {
      (parsed: unknown, at: O.Option<string>): Effect.Effect<A, ConfigValidationError>;
      (at: O.Option<string>): (parsed: unknown) => Effect.Effect<A, ConfigValidationError>;
    } = dual(
      2,
      (parsed: unknown, at: O.Option<string>): Effect.Effect<A, ConfigValidationError> =>
        S.decodeUnknownEffect(options.schema)(parsed, options.parseOptions).pipe(
          Effect.catchTag("SchemaError", (error) =>
            Effect.fail(ConfigValidationError.make({ path: at, issue: error.issue }))
          )
        )
    );

    const runValidate = (value: A): Effect.Effect<A, ConfigValidationError> =>
      options.validate !== undefined ? options.validate(value) : Effect.succeed(value);

    const loadFrom = Effect.fn("ConfigFile.loadFrom")(function* (target: string) {
      const raw = yield* fs
        .readFileString(target)
        .pipe(Effect.mapError((cause) => ConfigFileReadError.make({ path: target, cause })));

      const parsed = yield* options.codec.parse(raw).pipe(
        Effect.mapError(withCodecPath(target)),
        Effect.tapError((error) => emit({ _tag: "ParseFailed", path: target, codec: options.codec.name, error }))
      );
      yield* emit({ _tag: "Parsed", path: target, codec: options.codec.name });

      const validated = yield* Effect.gen(function* () {
        const decoded = yield* decode(parsed, O.some(target));
        return yield* runValidate(decoded);
      }).pipe(Effect.tapError((error) => emit({ _tag: "ValidationFailed", path: target, error })));
      yield* emit({ _tag: "Validated", path: target });

      return validated;
    });

    const probeResolver = (resolver: ConfigResolver<RR>): Effect.Effect<ConfigProbe> =>
      Effect.provide(
        resolver.resolveProbe ??
          Effect.map(
            resolver.resolveMatch ??
              Effect.map(
                resolver.resolve,
                O.map((target) => ConfigMatch.make({ path: target }))
              ),
            (match) => ConfigProbe.make({ match, probed: [] })
          ),
        resolverEnv
      );

    const discover = Effect.fn("ConfigFile.discover")(function* () {
      const sources: Array<ConfigSource<A>> = [];
      const probedByMisses: Array<string> = [];
      for (const resolver of options.resolvers) {
        const probe = yield* probeResolver(resolver);
        if (O.isNone(probe.match)) {
          probedByMisses.push(...probe.probed);
        } else {
          const match = probe.match.value;
          yield* emit({ _tag: "Discovered", path: match.path, resolver: resolver.name });
          sources.push({ path: match.path, resolver: resolver.name, match, value: yield* loadFrom(match.path) });
        }
      }
      return { sources, candidates: probedByMisses };
    });

    const searched = A.map(options.resolvers, (r) => r.name);

    const mergeAndEmit: (sources: NonEmptySources<A>) => Effect.Effect<A, ConfigValidationError> = Effect.fnUntraced(
      function* (sources: NonEmptySources<A>) {
        const merged = yield* options.strategy.resolve(sources);
        const value = yield* S.decodeUnknownEffect(S.toType(options.schema))(merged, options.parseOptions).pipe(
          Effect.mapError((error) => ConfigValidationError.make({ path: O.none(), issue: error.issue }))
        );
        const refs = sourceRefs(sources);
        yield* emit({ _tag: "Resolved", sources: refs, strategy: options.strategy.name });
        yield* emit({ _tag: "Loaded", sources: refs });
        return value;
      }
    );

    const load = Effect.fn("ConfigFile.load")(function* () {
      const { sources, candidates } = yield* discover();
      if (!A.isArrayNonEmpty(sources)) {
        yield* emit({ _tag: "NotFound" });
        return yield* ConfigFileNotFoundError.make({ searched, candidates });
      }
      return yield* mergeAndEmit(sources);
    });

    const loadOrDefault = Effect.fn("ConfigFile.loadOrDefault")(function* (defaultValue: A) {
      const { sources } = yield* discover();
      if (!A.isArrayNonEmpty(sources)) {
        yield* emit({ _tag: "NotFound" });
        return defaultValue;
      }
      return yield* mergeAndEmit(sources);
    });

    const validate = Effect.fn("ConfigFile.validate")(function* (value: unknown) {
      const decoded = yield* decode(value, O.none());
      return yield* runValidate(decoded);
    });

    const encodeTo: {
      (
        value: A,
        target: O.Option<string>,
        encodeOptions?: typeof ConfigEncodeOptions.Encoded
      ): Effect.Effect<string, ConfigEncodeError>;
      (
        target: O.Option<string>,
        encodeOptions?: typeof ConfigEncodeOptions.Encoded
      ): (value: A) => Effect.Effect<string, ConfigEncodeError>;
    } = dual(
      (args) => O.isOption(args[1]),
      Effect.fnUntraced(function* (
        value: A,
        target: O.Option<string>,
        encodeOptions?: typeof ConfigEncodeOptions.Encoded
      ) {
        const encoded = yield* S.encodeEffect(options.schema)(value).pipe(
          Effect.catchTag("SchemaError", (error) =>
            Effect.fail(ConfigValidationError.make({ path: target, issue: error.issue }))
          )
        );
        const serialized = yield* options.codec
          .stringify(encoded)
          .pipe(
            Effect.mapError((error) =>
              O.match(target, { onNone: () => error, onSome: (file) => withCodecPath(error, file) })
            )
          );
        return prependHeader(serialized, encodeOptions?.header);
      })
    );

    const encodeAndWrite: {
      (
        value: A,
        target: string,
        encodeOptions?: typeof ConfigEncodeOptions.Encoded
      ): Effect.Effect<void, ConfigWriteError>;
      (
        target: string,
        encodeOptions?: typeof ConfigEncodeOptions.Encoded
      ): (value: A) => Effect.Effect<void, ConfigWriteError>;
    } = dual(
      (args) => P.isString(args[1]),
      Effect.fnUntraced(function* (value: A, target: string, encodeOptions?: typeof ConfigEncodeOptions.Encoded) {
        const serialized = yield* encodeTo(value, O.some(target), encodeOptions).pipe(
          Effect.tapError((error) =>
            error._tag === "ConfigCodecError"
              ? emit({ _tag: "StringifyFailed", codec: options.codec.name, error })
              : Effect.void
          )
        );
        yield* fs
          .writeFileString(target, serialized)
          .pipe(Effect.mapError((cause) => ConfigFileWriteError.make({ path: target, cause })));
      })
    );

    const encode = Effect.fn("ConfigFile.encode")(function* (
      value: A,
      encodeOptions?: typeof ConfigEncodeOptions.Encoded
    ) {
      return yield* encodeTo(value, O.none(), encodeOptions);
    });

    const saveWithoutEmitting: (value: A) => Effect.Effect<string, ConfigSaveError> = Effect.fnUntraced(function* (
      value: A
    ) {
      const configured = options.defaultPath;
      if (configured === undefined) return yield* ConfigDefaultPathMissingError.make({});
      const target = yield* Effect.provide(configured, resolverEnv);
      yield* fs
        .makeDirectory(path.dirname(target), { recursive: true })
        .pipe(Effect.mapError((cause) => ConfigFileWriteError.make({ path: target, cause })));
      yield* encodeAndWrite(value, target);
      return target;
    });

    const write: ConfigFileShape<A>["write"] = dual(
      (args) => P.isString(args[1]),
      Effect.fn("ConfigFile.write")(function* (
        value: A,
        target: string,
        encodeOptions?: typeof ConfigEncodeOptions.Encoded
      ) {
        yield* encodeAndWrite(value, target, encodeOptions);
        yield* emit({ _tag: "Written", path: target });
      })
    );

    const save = Effect.fn("ConfigFile.save")(function* (value: A) {
      const target = yield* saveWithoutEmitting(value);
      yield* emit({ _tag: "Saved", path: target });
      return target;
    });

    const updateLock = Semaphore.makeUnsafe(1);

    const update: ConfigFileShape<A>["update"] = dual(
      (args) => P.isFunction(args[0]),
      Effect.fn("ConfigFile.update")(function* (fn: (current: A) => A, defaultValue?: A) {
        return yield* updateLock.withPermits(1)(
          Effect.gen(function* () {
            const current = defaultValue !== undefined ? yield* loadOrDefault(defaultValue) : yield* load();
            const updated = fn(current);
            const target = yield* saveWithoutEmitting(updated);
            yield* emit({ _tag: "Updated", path: target });
            return updated;
          })
        );
      })
    );

    return {
      load: load(),
      loadFrom,
      discover: Effect.map(discover(), (found) => found.sources),
      loadOrDefault,
      validate,
      encode,
      write,
      save,
      update,
    };
  }
);

type ResolverRequirements<R extends ConfigResolver<unknown>> =
  | Effect.Services<R["resolve"]>
  | Effect.Services<NonNullable<R["resolveMatch"]>>
  | Effect.Services<NonNullable<R["resolveProbe"]>>;

// decision: tag-pinned-by-three-part-intersection
const layer: {
  <
    Self,
    A,
    I,
    RR = never,
    S extends ConfigFileShape<A> = ConfigFileShape<A>,
    const Rs extends ReadonlyArray<ConfigResolver<unknown>> = ReadonlyArray<ConfigResolver<RR>>,
  >(
    tag: Context.Key<Self, S> &
      Context.Key<Self, ConfigFileShape<A>> &
      ([ConfigFileShape<NoInfer<A>>] extends [S] ? unknown : never),
    options: Omit<ConfigFileOptions<A, I, RR>, "resolvers"> & { readonly resolvers: Rs }
  ): Layer.Layer<Self, never, FileSystem.FileSystem | Path.Path | RR | ResolverRequirements<Rs[number]>>;
  <A, I, RR = never, const Rs extends ReadonlyArray<ConfigResolver<unknown>> = ReadonlyArray<ConfigResolver<RR>>>(
    options: Omit<ConfigFileOptions<A, I, RR>, "resolvers"> & { readonly resolvers: Rs }
  ): <Self, S extends ConfigFileShape<A> = ConfigFileShape<A>>(
    tag: Context.Key<Self, S> &
      Context.Key<Self, ConfigFileShape<A>> &
      ([ConfigFileShape<NoInfer<A>>] extends [S] ? unknown : never)
  ) => Layer.Layer<Self, never, FileSystem.FileSystem | Path.Path | RR | ResolverRequirements<Rs[number]>>;
} = dual(
  2,
  <Self, A, I, RR = never, S extends ConfigFileShape<A> = ConfigFileShape<A>>(
    tag: Context.Key<Self, S> &
      Context.Key<Self, ConfigFileShape<A>> &
      ([ConfigFileShape<NoInfer<A>>] extends [S] ? unknown : never),
    options: ConfigFileOptions<A, I, RR>
  ): Layer.Layer<Self, never, FileSystem.FileSystem | Path.Path | RR> =>
    Layer.effect(
      tag,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const resolverEnv = yield* Effect.context<RR>();
        return makeImpl(options, fs, path, resolverEnv);
      })
    )
);

/**
 * Options for {@link ConfigFile.testLayer}.
 *
 * **Details**
 *
 * Deliberately has no `resolvers`: `testLayer` synthesizes one
 * {@link (ConfigResolver:class).staticDir} per seeded file, in `files`
 * insertion order, so the first key wins under
 * {@link (MergeStrategy:variable).firstMatch}.
 *
 * It also has no `defaultPath`. Nothing in the temp directory is a defensible
 * default write target, so `save` and `update` fail with
 * {@link ConfigDefaultPathMissingError} under this layer — the honest answer.
 * Exercise the write path with {@link ConfigFile.layer} instead.
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface ConfigFileTestOptions<A, I> {
  /**
   * How file content becomes an unknown document, and back.
   *
   * @since 0.0.0
   */
  readonly codec: ConfigCodec;
  /**
   * Filenames (relative to the temp dir) mapped to their raw contents.
   *
   * **Details**
   *
   * A name may contain separators (`"nested/.apprc"`); the parent directory is
   * created for you.
   *
   * @since 0.0.0
   */
  readonly files: Record<string, string>;
  /**
   * The schema every seeded document is decoded through.
   *
   * @since 0.0.0
   */
  readonly schema: S.Codec<A, I>;
  /**
   * How several discovered sources become one value.
   *
   * @since 0.0.0
   */
  readonly strategy: MergeStrategy<A>;
  /**
   * An optional caller-supplied check run after schema decoding.
   *
   * @since 0.0.0
   */
  readonly validate?: (value: A) => Effect.Effect<A, ConfigValidationError>;
}

// decision: tag-pinned-by-three-part-intersection
const testLayer: {
  <Self, A, I, S extends ConfigFileShape<A> = ConfigFileShape<A>>(
    tag: Context.Key<Self, S> &
      Context.Key<Self, ConfigFileShape<A>> &
      ([ConfigFileShape<NoInfer<A>>] extends [S] ? unknown : never),
    options: ConfigFileTestOptions<A, I>
  ): Layer.Layer<Self, never, FileSystem.FileSystem | Path.Path>;
  <A, I>(
    options: ConfigFileTestOptions<A, I>
  ): <Self, S extends ConfigFileShape<A> = ConfigFileShape<A>>(
    tag: Context.Key<Self, S> &
      Context.Key<Self, ConfigFileShape<A>> &
      ([ConfigFileShape<NoInfer<A>>] extends [S] ? unknown : never)
  ) => Layer.Layer<Self, never, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  <Self, A, I, S extends ConfigFileShape<A> = ConfigFileShape<A>>(
    tag: Context.Key<Self, S> &
      Context.Key<Self, ConfigFileShape<A>> &
      ([ConfigFileShape<NoInfer<A>>] extends [S] ? unknown : never),
    options: ConfigFileTestOptions<A, I>
  ): Layer.Layer<Self, never, FileSystem.FileSystem | Path.Path> =>
    Layer.effect(
      tag,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const resolverEnv = yield* Effect.context<FileSystem.FileSystem | Path.Path>();

        const dir = yield* fs.makeTempDirectory({ prefix: "effected-config-file-" }).pipe(Effect.orDie);
        yield* Effect.addFinalizer(() => fs.remove(dir, { recursive: true }).pipe(Effect.orDie));

        for (const [name, content] of R.toEntries(options.files)) {
          const target = path.join(dir, name);
          yield* fs.makeDirectory(path.dirname(target), { recursive: true }).pipe(Effect.orDie);
          yield* fs.writeFileString(target, content).pipe(Effect.orDie);
        }

        const resolvers = A.map(R.keys(options.files), (name) => ConfigResolver.staticDir({ dir, filename: name }));

        return makeImpl(
          {
            schema: options.schema,
            codec: options.codec,
            strategy: options.strategy,
            resolvers,
            ...(options.validate !== undefined && { validate: options.validate }),
          },
          fs,
          path,
          resolverEnv
        );
      })
    )
);

/**
 * A schema {@link ConfigFile.read} can decode through: any schema with type
 * `A`, encoded side `I` and no decoding services.
 *
 * **Details**
 *
 * `S.Opaque` schemas are not assignable to `S.Codec<Self, I>` (their
 * `Rebuild` member rebuilds the branded struct, not the opaque type), so a
 * read typed on `S.Codec` would refuse them. This structural bound accepts
 * plain codecs, `S.Class` and `S.Opaque` schemas alike, and reads `A` and `I`
 * from the schema's own `Type` and `Encoded`.
 *
 * **Example** (Read through an opaque schema)
 *
 * ```ts
 * import { ConfigFile } from "@beep/config-file/ConfigFile";
 * import type { ConfigReadSchema } from "@beep/config-file/ConfigFile";
 * import { JsonCodec } from "@beep/config-file/JsonCodec";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * class Port extends S.Opaque<Port, { readonly brand: unique symbol }>()(S.Struct({ port: S.Finite })) {}
 * const schema: ConfigReadSchema<Port, typeof Port.Encoded> = Port;
 * console.log(Effect.isEffect(ConfigFile.read("./port.json", { schema, codec: JsonCodec }))) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface ConfigReadSchema<A, I> extends S.Top {
  /**
   * Decoding needs no services: a config read provides none.
   *
   * @since 0.0.0
   */
  readonly DecodingServices: never;
  /**
   * The encoded type the codec's document is read as.
   *
   * @since 0.0.0
   */
  readonly Encoded: I;
  /**
   * The decoded type.
   *
   * @since 0.0.0
   */
  readonly Type: A;
}

/**
 * Options for {@link ConfigFile.read}.
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface ConfigReadOptions<A, I> {
  /**
   * How file content becomes an unknown document.
   *
   * **Details**
   *
   * An explicit argument, never inferred from the file extension or defaulted
   * to JSON. Naming the codec at the call site is what keeps the
   * free-standing-codec tree-shaking guarantee: a consumer that only ever
   * passes `JsonCodec` never references the JSONC, YAML or TOML modules, so
   * their engines stay out of the bundle.
   *
   * @since 0.0.0
   */
  readonly codec: ConfigCodec;
  /**
   * Parse options for the decode, chiefly `onExcessProperty`.
   *
   * **Gotchas**
   *
   * See {@link ConfigFileOptions.parseOptions}; it means the same thing here.
   * Absent, core's defaults apply and unknown keys are dropped silently.
   *
   * @since 0.0.0
   */
  readonly parseOptions?: SchemaAST.ParseOptions;
  /**
   * The schema the document is decoded through; see {@link ConfigReadSchema}.
   *
   * @since 0.0.0
   */
  readonly schema: ConfigReadSchema<A, I>;
}

const read: {
  <A, I>(path: string, options: ConfigReadOptions<A, I>): Effect.Effect<A, ConfigReadError, FileSystem.FileSystem>;
  <A, I>(options: ConfigReadOptions<A, I>): (path: string) => Effect.Effect<A, ConfigReadError, FileSystem.FileSystem>;
} = dual(
  2,
  <A, I>(path: string, options: ConfigReadOptions<A, I>): Effect.Effect<A, ConfigReadError, FileSystem.FileSystem> =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;

      const raw = yield* fs
        .readFileString(path)
        .pipe(Effect.mapError((cause) => ConfigFileReadError.make({ path, cause })));

      const parsed = yield* options.codec.parse(raw).pipe(Effect.mapError(withCodecPath(path)));

      return yield* S.decodeUnknownEffect(options.schema)(parsed, options.parseOptions).pipe(
        Effect.catchTag("SchemaError", (error) =>
          Effect.fail(ConfigValidationError.make({ path: O.some(path), issue: error.issue }))
        )
      );
    }).pipe(Effect.withSpan("ConfigFile.read", { attributes: { path } }))
);

/**
 * The config file service: a per-schema service factory, its layers, and the
 * one-shot {@link ConfigFile.read}.
 *
 * **Example** (Construct a one-shot config read)
 *
 * ```ts
 * import { ConfigFile } from "@beep/config-file/ConfigFile";
 * import { JsonCodec } from "@beep/config-file/JsonCodec";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const program = ConfigFile.read("./app.json", { schema: S.Struct({ port: S.Finite }), codec: JsonCodec });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class ConfigFile {
  private constructor() {}

  /**
   * Create a uniquely-keyed service class for one config schema.
   *
   * **Example** (Create an application config service)
   *
   * ```ts
   * import { ConfigFile } from "@beep/config-file/ConfigFile";
   * import * as S from "effect/Schema";
   *
   * const AppShape = S.Struct({ port: S.Finite });
   * class AppConfig extends ConfigFile.Service<AppConfig, typeof AppShape.Type>()("app/Config") {}
   *
   * console.log(AppConfig.key) // app/Config
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly Service = Service;

  /**
   * Build the live layer for a config service class.
   *
   * **Gotchas**
   *
   * Resolver requirements flow into the layer's `R` type: the result is
   * `Layer<Self, never, FileSystem | Path | RR>`, so the platform services and
   * every resolver's needs are visible at the provide site.
   *
   * `ConfigFile.layer` is a layer-RETURNING function, not a layer: calling it
   * twice builds two independent service instances. Bind its result to a const
   * and provide that const — do not call `ConfigFile.layer(...)` inline at each
   * provide site.
   *
   * `tag` is a {@link ConfigFile.Service} key — its service type
   * `ConfigFileShape<A>` for the schema's `A`. A key whose shape adds members
   * (`ConfigFileShape<A> & { … }`) is a compile error, reported as an argument
   * "not assignable to parameter of type 'never'", because this layer could not
   * supply them. The check cannot see through method-syntax parameter
   * bivariance: a member redeclared as a method with a wider parameter still
   * compiles.
   *
   * **Example** (Build a JSON config layer for an explicit path)
   *
   * ```ts
   * import { ConfigFile } from "@beep/config-file/ConfigFile";
   * import { JsonCodec } from "@beep/config-file/JsonCodec";
   * import { MergeStrategy } from "@beep/config-file/MergeStrategy";
   * import { ConfigResolver } from "@beep/config-file/ConfigResolver";
   * import * as Layer from "effect/Layer";
   * import * as S from "effect/Schema";
   *
   * const AppShape = S.Struct({ port: S.Finite });
   * class AppConfig extends ConfigFile.Service<AppConfig, typeof AppShape.Type>()("app/Config") {}
   *
   * const AppConfigLive = ConfigFile.layer(AppConfig, {
   *   schema: AppShape,
   *   codec: JsonCodec,
   *   resolvers: [ConfigResolver.explicitPath("./app.config.json")],
   *   strategy: MergeStrategy.firstMatch<typeof AppShape.Type>(),
   * });
   * console.log(Layer.isLayer(AppConfigLive)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = layer;

  /**
   * A scoped layer that seeds `files` into a temp directory, wires the **real**
   * live implementation over them, and removes the directory when the scope
   * closes.
   *
   * **Details**
   *
   * Deliberately not a mock. It delegates to the very same `makeImpl` that
   * {@link ConfigFile.layer} uses, so tests exercise the actual codec, resolver
   * and merge pipeline rather than a parallel implementation that can drift from
   * it. A stubbed test layer would make every downstream test a claim about the
   * stub instead of about the code under test.
   *
   * Platform-agnostic: the consumer supplies the `FileSystem` layer, and the temp
   * directory is created through `FileSystem.makeTempDirectory` rather than
   * `node:fs`.
   *
   * The temp directory is removed by a finalizer bound to the layer's own scope,
   * so cleanup runs on release without surfacing `Scope` in the layer's
   * requirements.
   *
   * `tag` takes the same `ConfigFileShape<A>` key as {@link ConfigFile.layer},
   * with the same check: a shape that adds members is a compile error.
   *
   * **Example** (Seed a temporary JSON config for tests)
   *
   * ```ts
   * import { ConfigFile } from "@beep/config-file/ConfigFile";
   * import { JsonCodec } from "@beep/config-file/JsonCodec";
   * import { MergeStrategy } from "@beep/config-file/MergeStrategy";
   * import * as Layer from "effect/Layer";
   * import * as S from "effect/Schema";
   *
   * const AppShape = S.Struct({ port: S.Finite });
   * class AppConfig extends ConfigFile.Service<AppConfig, typeof AppShape.Type>()("app/Config") {}
   *
   * const TestConfig = ConfigFile.testLayer(AppConfig, {
   *   schema: AppShape,
   *   codec: JsonCodec,
   *   strategy: MergeStrategy.firstMatch<typeof AppShape.Type>(),
   *   files: { ".apprc": `{"port":4242}` },
   * });
   * console.log(Layer.isLayer(TestConfig)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly testLayer = testLayer;

  /**
   * Read, decode and validate one explicit path — no service, no layer, no tag.
   *
   * **Details**
   *
   * The one-shot form. {@link ConfigFile.layer} binds schema and codec at layer
   * construction, which is the right model for a config file an application
   * *has* — several candidate locations, `save`/`update`, migrations, events —
   * and heavy for a call site that decodes one known path once, where it costs a
   * service subclass, a layer bound to a const and a provide at the boundary.
   * Unlike the service, `read` takes its schema per call, so one call site can
   * read several unrelated files without a service class each.
   *
   * It is deliberately read-only and discovery-free: there is no resolver chain
   * and no write path. Reach for {@link ConfigFile.layer} the moment either is
   * wanted, rather than growing this.
   *
   * The error channel is `ConfigReadError` — the same narrowed union
   * {@link ConfigFileShape.loadFrom} carries, with causes and schema issues held
   * structurally rather than flattened into a message.
   *
   * **Example** (Read a port from a validated JSON file)
   *
   * ```ts
   * import { ConfigFile } from "@beep/config-file/ConfigFile";
   * import { JsonCodec } from "@beep/config-file/JsonCodec";
   * import * as Effect from "effect/Effect";
   * import * as S from "effect/Schema";
   *
   * const MyConfig = S.Struct({ port: S.Finite });
   *
   * // Requires `FileSystem` in `R`; provide it from a platform layer.
   * const program = Effect.gen(function* () {
   *   const config = yield* ConfigFile.read("./app.config.json", {
   *     schema: MyConfig,
   *     codec: JsonCodec,
   *   });
   *   return config.port;
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly read = read;
}
