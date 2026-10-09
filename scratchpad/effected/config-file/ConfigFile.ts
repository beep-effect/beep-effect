import { $ScratchpadId } from "@beep/identity/packages";
import type * as SchemaAST from "effect/SchemaAST";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PubSub from "effect/PubSub";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import type { ConfigCodec } from "./ConfigCodec.ts";
import { ConfigCodecError } from "./ConfigCodec.ts";
import type { ConfigEventPayload, ConfigEvents, ConfigEventsShape } from "./ConfigEvent.ts";
import { ConfigEvent } from "./ConfigEvent.ts";
import type { ConfigMatch, ConfigProbe } from "./ConfigResolver.ts";
import { ConfigResolver } from "./ConfigResolver.ts";
import type { ConfigSource, MergeStrategy, NonEmptySources } from "./MergeStrategy.ts";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/config-file/ConfigFile");

/**
 * Indicates that the resolver chain produced no configuration source.
 *
 * @remarks
 * Its own tag, so "no config anywhere" is routable with `Effect.catchTag`
 * separately from "the config I found is broken" — the single most important
 * distinction in the error set.
 *
 * @public
 */
export class ConfigFileNotFoundError extends S.TaggedError<ConfigFileNotFoundError>($I`ConfigFileNotFoundError`)("ConfigFileNotFoundError", {
	/** The names of the resolvers that were probed, in order. */
	searched: S.Array(S.String).annotateKey({ description: "The names of the resolvers that were probed, in order." }),
	/**
	 * The candidate paths the chain actually checked on disk, in probe order
	 * across every resolver — the failure-path mirror of {@link ConfigMatch}.
	 *
	 * @remarks
	 * One `searched` name can hide many paths: an `upwardWalk` with a
	 * `filenames` list probes every name at every ancestor. Resolvers that omit
	 * the optional `resolveProbe` member contribute nothing here, so the list
	 * can be shorter than the true search (or empty for a fully hand-rolled
	 * chain) — `searched` remains the complete resolver list either way.
	 */
	candidates: S.Array(S.String).annotateKey({ description: "The candidate paths the chain actually checked on disk, in probe order across every resolver — the failure-path mirror of ConfigMatch." }),
}, $I.annote("ConfigFileNotFoundError", { description: "Indicates that the resolver chain produced no configuration source." })) {
	override get message(): string {
		const count = this.candidates.length;
		const probed = count === 0 ? "" : ` — ${count} candidate path${count === 1 ? "" : "s"} checked`;
		return `No config file found (searched: ${this.searched.join(", ")}${probed})`;
	}
}

/**
 * Indicates that a config file could not be read from the filesystem.
 *
 * @remarks
 * `cause` preserves the underlying filesystem failure structurally rather than
 * flattening it to a string.
 *
 * @public
 */
export class ConfigFileReadError extends S.TaggedError<ConfigFileReadError>($I`ConfigFileReadError`)("ConfigFileReadError", {
	/** The path that could not be read. */
	path: S.String.annotateKey({ description: "The path that could not be read." }),
	/** The underlying failure, preserved structurally. */
	cause: S.Defect().annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("ConfigFileReadError", { description: "Indicates that a config file could not be read from the filesystem." })) {
	override get message(): string {
		return `Failed to read config file at "${this.path}"`;
	}
}

/**
 * Indicates that a config file could not be written to the filesystem.
 *
 * @public
 */
export class ConfigFileWriteError extends S.TaggedError<ConfigFileWriteError>($I`ConfigFileWriteError`)("ConfigFileWriteError", {
	/** The path that could not be written. */
	path: S.String.annotateKey({ description: "The path that could not be written." }),
	/** The underlying failure, preserved structurally. */
	cause: S.Defect().annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("ConfigFileWriteError", { description: "Indicates that a config file could not be written to the filesystem." })) {
	override get message(): string {
		return `Failed to write config file at "${this.path}"`;
	}
}

/**
 * Indicates that {@link ConfigFileShape.save} or {@link ConfigFileShape.update}
 * was called on a service configured without a `defaultPath`.
 *
 * @remarks
 * It is distinct by tag from a real {@link ConfigFileWriteError}, so a caller
 * can tell "no destination was configured" from "the write failed".
 *
 * It carries no `path` field on purpose. The whole point of this failure is
 * that there is no path; a {@link ConfigFileWriteError} with a fabricated path
 * would be a lie.
 *
 * @public
 */
export class ConfigDefaultPathMissingError extends S.TaggedError<ConfigDefaultPathMissingError>($I`ConfigDefaultPathMissingError`)(
	"ConfigDefaultPathMissingError",
	{}, $I.annote("ConfigDefaultPathMissingError", { description: "Indicates that ConfigFileShape.save or ConfigFileShape.update was called on a service configured without a `defaultPath`." }),
) {
	override get message(): string {
		return "No `defaultPath` configured: `save` and `update` require ConfigFileOptions.defaultPath";
	}
}

/**
 * Indicates that parsed config content did not satisfy the schema, or that a
 * caller-supplied `validate` rejected it.
 *
 * @remarks
 * `issue` carries the **structured** schema failure — at runtime a
 * `SchemaIssue.Issue` tree, reachable through `_tag` and nested `issues`, so
 * every field a caller might branch on survives. It is typed `unknown` because
 * there is no `Schema` for `Issue`; narrow it with the `SchemaIssue` module.
 *
 * @public
 */
export class ConfigValidationError extends S.TaggedError<ConfigValidationError>($I`ConfigValidationError`)("ConfigValidationError", {
	/** The offending file, absent when `validate` was called on an in-memory value. */
	path: S.Option(S.String).annotateKey({ description: "The offending file, absent when `validate` was called on an in-memory value." }),
	/** The structured schema issue. Never a string. */
	issue: S.Defect().annotateKey({ description: "The structured schema issue. Never a string." }),
}, $I.annote("ConfigValidationError", { description: "Indicates that parsed config content did not satisfy the schema, or that a caller-supplied `validate` rejected it." })) {
	override get message(): string {
		const at = O.match(this.path, { onNone: () => "", onSome: (p) => ` at "${p}"` });
		return `Config validation failed${at}`;
	}
}

/**
 * The failure modes of the full discovery-and-load path.
 *
 * @public
 */
export type ConfigLoadError = ConfigFileNotFoundError | ConfigFileReadError | ConfigCodecError | ConfigValidationError;

/**
 * The failure modes of reading one known path.
 *
 * @remarks
 * Deliberately excludes {@link ConfigFileNotFoundError}: every method typed with
 * this union either takes an explicit path or treats "nothing found" as success.
 *
 * @public
 */
export type ConfigReadError = ConfigFileReadError | ConfigCodecError | ConfigValidationError;

/**
 * The failure modes of encoding and writing one known path.
 *
 * @remarks
 * Deliberately excludes {@link ConfigFileNotFoundError} — the path is explicit,
 * so there is nothing to discover — and {@link ConfigDefaultPathMissingError},
 * because no default path is consulted.
 *
 * @public
 */
export type ConfigWriteError = ConfigFileWriteError | ConfigCodecError | ConfigValidationError;

/**
 * The failure modes of {@link ConfigFileShape.encode}: everything on the write
 * path except the write itself.
 *
 * @remarks
 * Deliberately excludes {@link ConfigFileWriteError} — nothing touches the
 * filesystem — so a `--dry-run` caller's error channel is honest about that.
 *
 * @public
 */
export type ConfigEncodeError = ConfigCodecError | ConfigValidationError;

/**
 * Options shared by {@link ConfigFileShape.encode} and {@link ConfigFileShape.write}.
 *
 * @public
 */
export interface ConfigEncodeOptions {
	/**
	 * Text emitted **verbatim** in front of the serialized document, separated
	 * from it by exactly one newline. If `header` already ends in `"\n"`, no
	 * further newline is added.
	 *
	 * @remarks
	 * The caller owns the header's validity in the target format: `#` comment
	 * lines for TOML and YAML, `//` for JSONC. JSON has no comment syntax, so a
	 * header on a JSON codec yields an unparseable file by construction — the
	 * service does not check. The motivating case is a schema directive such as
	 * `#:schema https://example.com/config.schema.json` at the top of a TOML
	 * file, which editors read for completion and validation.
	 */
	readonly header?: string;
}

/**
 * The failure modes of {@link ConfigFileShape.save}.
 *
 * @public
 */
export type ConfigSaveError = ConfigWriteError | ConfigDefaultPathMissingError;

/**
 * The failure modes of {@link ConfigFileShape.update}, which loads and then saves.
 *
 * @public
 */
export type ConfigUpdateError = ConfigLoadError | ConfigFileWriteError | ConfigDefaultPathMissingError;

/**
 * The config file service, generic over the decoded config type `A`.
 *
 * @remarks
 * Error unions are narrowed per method: `loadOrDefault` cannot fail with
 * {@link ConfigFileNotFoundError} because that is the branch it handles, and
 * `discover` treats an empty result as success.
 *
 * @public
 */
export interface ConfigFileShape<A> {
	/** Discover, decode and merge the highest-priority config source. */
	readonly load: Effect.Effect<A, ConfigLoadError>;
	/** Read, decode and validate one explicit path. */
	readonly loadFrom: (path: string) => Effect.Effect<A, ConfigReadError>;
	/**
	 * Every source the resolver chain found, in priority order. Empty is success.
	 *
	 * @remarks
	 * A found-but-corrupt source ABORTS discovery with a typed error rather than
	 * being silently skipped: silently skipping a corrupt file would mean running
	 * on the wrong config. This is deliberate.
	 */
	readonly discover: Effect.Effect<ReadonlyArray<ConfigSource<A>>, ConfigReadError>;
	/**
	 * Like {@link ConfigFileShape.load}, but yields `defaultValue` when nothing is found.
	 *
	 * @remarks
	 * `defaultValue` is returned as-is: neither the schema nor `options.validate`
	 * is applied to it. It is trusted caller input, not a discovered document.
	 */
	readonly loadOrDefault: (defaultValue: A) => Effect.Effect<A, ConfigReadError>;
	/** Decode and validate an in-memory value. */
	readonly validate: (value: unknown) => Effect.Effect<A, ConfigValidationError>;
	/**
	 * Encode `value` to its serialized text without writing anything.
	 *
	 * @remarks
	 * Produces byte-for-byte what `write(value, path, options)` puts on disk —
	 * the primitive for `--dry-run` and "show me the file" callers. Emits no
	 * event, because nothing was written. A codec failure here carries no
	 * `path`, and a validation failure's `path` is `Option.none()`: there is no
	 * file to name.
	 */
	readonly encode: (value: A, options?: ConfigEncodeOptions) => Effect.Effect<string, ConfigEncodeError>;
	/**
	 * Encode `value` and write it to an explicit `path`.
	 *
	 * @remarks
	 * Does **not** create the parent directory — that is
	 * {@link ConfigFileShape.save}'s job, and the distinction is load-bearing:
	 * `write` targets a path the caller already vouched for. `options` are the
	 * same as {@link ConfigFileShape.encode}'s, so the two stay in lockstep.
	 */
	readonly write: (value: A, path: string, options?: ConfigEncodeOptions) => Effect.Effect<void, ConfigWriteError>;
	/**
	 * Resolve `defaultPath`, `mkdir -p` its parent, encode `value` into it, and
	 * return the path written.
	 */
	readonly save: (value: A) => Effect.Effect<string, ConfigSaveError>;
	/**
	 * Load the current value, apply `fn`, {@link ConfigFileShape.save} the result
	 * and return it.
	 *
	 * @remarks
	 * With `defaultValue` the load cannot fail with
	 * {@link ConfigFileNotFoundError}; without it, it can.
	 */
	readonly update: (fn: (current: A) => A, defaultValue?: A) => Effect.Effect<A, ConfigUpdateError>;
}

/**
 * Options for {@link ConfigFile.layer}.
 *
 * @remarks
 * `RR` is the union of the resolvers' requirements. It flows into the layer's
 * `R` rather than being cast away.
 *
 * @public
 */
export interface ConfigFileOptions<A, I, RR> {
	/**
	 * The schema every discovered document is decoded through.
	 *
	 * @remarks
	 * `S.Codec<A, I>` rather than the one-parameter `S.Schema<A>`,
	 * because the encoded form `I` matters on the write path. Its decoding and
	 * encoding service channels default to `never`, keeping `decode` free of
	 * requirements.
	 */
	readonly schema: S.Codec<A, I>;
	/** How file content becomes an unknown document, and back. */
	readonly codec: ConfigCodec;
	/** The resolver chain, in priority order. */
	readonly resolvers: ReadonlyArray<ConfigResolver<RR>>;
	/** How several discovered sources become one value. */
	readonly strategy: MergeStrategy<A>;
	/** An optional caller-supplied check run after schema decoding. */
	readonly validate?: (value: A) => Effect.Effect<A, ConfigValidationError>;
	/**
	 * Parse options threaded into every schema decode this performs.
	 *
	 * @remarks
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
	 */
	readonly parseOptions?: SchemaAST.ParseOptions;
	/**
	 * Where {@link ConfigFileShape.save} writes when given no explicit path.
	 *
	 * @remarks
	 * Its requirements join the resolvers' in `RR` and flow into the layer's `R`.
	 *
	 * When absent, `save` and `update` fail with
	 * {@link ConfigDefaultPathMissingError}.
	 */
	readonly defaultPath?: Effect.Effect<string, never, RR>;
	/**
	 * The opt-in event hook. Pass the `ConfigEvents` class itself.
	 *
	 * @remarks
	 * A **key**, not an instance: the service is looked up in the ambient context
	 * at call time with `Effect.serviceOption`, so it never enters the layer's
	 * `R`. When this is omitted, `emit` is `Effect.void` — it does not even
	 * perform the lookup. That is what "zero-cost when absent" means here.
	 */
	readonly events?: Context.Key<ConfigEvents, ConfigEventsShape>;
}

// Implementation of ConfigFile.Service; the public contract lives on the static.
const Service =
	<Self, A>() =>
	<const Id extends string>(id: Id) =>
		Context.Service<Self, ConfigFileShape<A>>()(id);

/**
 * Re-raise a codec failure with the file it came from attached.
 *
 * @remarks
 * A codec is handed a string and never a path, so `ConfigCodecError.path` can
 * only be filled in here, where the resolved target is in scope. An error that
 * already carries a path is left alone — a decorator codec that knew better
 * wins — and anything that is not a `ConfigCodecError` passes through
 * untouched. The return type admits both the original error and the path-bearing
 * codec error constructed here.
 */
const withCodecPath = <E>(error: E, target: string): E | ConfigCodecError =>
	S.is(ConfigCodecError)(error) && error.path === undefined
		? ConfigCodecError.make({
				codec: error.codec,
				operation: error.operation,
				cause: error.cause,
				path: target,
			})
		: error;

/**
 * Put `header` in front of `document`, separated by exactly one newline.
 *
 * A header that already ends in a newline is not given another — a caller who
 * built the line with a trailing `"\n"` and one who did not get the same file.
 */
const prependHeader = (document: string, header: string | undefined): string =>
	header === undefined ? document : header.endsWith("\n") ? `${header}${document}` : `${header}\n${document}`;

const makeImpl = <A, I, RR>(
	options: ConfigFileOptions<A, I, RR>,
	fs: FileSystem.FileSystem,
	path: Path.Path,
	resolverEnv: Context.Context<RR>,
): ConfigFileShape<A> => {
	/**
	 * Publish one event, or nothing at all.
	 *
	 * @remarks
	 * Three properties hold, in order of how easy they are to lose:
	 *
	 * 1. **Zero-cost when absent.** No `events` option means `Effect.void` — no
	 *    context lookup, no `DateTime.now`.
	 * 2. **Never a requirement.** `Effect.serviceOption` reads the ambient context
	 *    without adding to `R`, so wiring events cannot change a layer's type.
	 * 3. **Never fatal.** A subscriber's hub is consumer-supplied code. It cannot
	 *    FAIL — `PubSub.publish` has no error channel — but it CAN throw, and
	 *    `catchDefect` absorbs that; interruption is deliberately left to
	 *    propagate, because a config load that is being interrupted must stay
	 *    interrupted.
	 */
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
						}),
					),
					Effect.catchDefect((defect) => Effect.logDebug("ConfigEvents.emit: consumer hub raised a defect", defect)),
				);

	/** The public, path-and-resolver view of the sources that fed a load. */
	const sourceRefs = (
		sources: ReadonlyArray<ConfigSource<A>>,
	): ReadonlyArray<{ readonly path: string; readonly resolver: string }> =>
		sources.map((s) => ({ path: s.path, resolver: s.resolver }));

	const decode = (parsed: unknown, at: O.Option<string>): Effect.Effect<A, ConfigValidationError> =>
		S.decodeUnknownEffect(options.schema)(parsed, options.parseOptions).pipe(
			// Normalize the schema failure at the boundary. Never leak SchemaError
			// deeper, never stringify it — carry its structured issue tree instead.
			Effect.catchTag("SchemaError", (error) =>
				Effect.fail(ConfigValidationError.make({ path: at, issue: error.issue })),
			),
		);

	const runValidate = (value: A): Effect.Effect<A, ConfigValidationError> =>
		options.validate !== undefined ? options.validate(value) : Effect.succeed(value);

	const loadFrom = Effect.fn("ConfigFile.loadFrom")(function* (target: string) {
		const raw = yield* fs
			.readFileString(target)
			.pipe(Effect.mapError((cause) => ConfigFileReadError.make({ path: target, cause })));

		const parsed = yield* options.codec.parse(raw).pipe(
			Effect.mapError((error) => withCodecPath(error, target)),
			Effect.tapError((error) => emit({ _tag: "ParseFailed", path: target, codec: options.codec.name, error })),
		);
		yield* emit({ _tag: "Parsed", path: target, codec: options.codec.name });

		// Schema decoding and the caller's `validate` are one validation step from a
		// subscriber's point of view: both answer "is this document acceptable?".
		const validated = yield* Effect.gen(function* () {
			const decoded = yield* decode(parsed, O.some(target));
			return yield* runValidate(decoded);
		}).pipe(Effect.tapError((error) => emit({ _tag: "ValidationFailed", path: target, error })));
		yield* emit({ _tag: "Validated", path: target });

		return validated;
	});

	const discover = Effect.fn("ConfigFile.discover")(function* () {
		const sources: Array<ConfigSource<A>> = [];
		const candidates: Array<string> = [];
		for (const resolver of options.resolvers) {
			// `resolve` cannot fail — the absorption contract — so no error handling here.
			// `resolveProbe` is the same lookup carrying its own detail plus the
			// paths it checked; a resolver that omits it degrades to `resolveMatch`,
			// then to a bare-path match, contributing no candidates — the mirror of
			// `ConfigSource.match` degrading when `resolveMatch` is absent.
			let found: O.Option<ConfigMatch>;
			if (resolver.resolveProbe !== undefined) {
				const probe: ConfigProbe = yield* Effect.provide(resolver.resolveProbe, resolverEnv);
				found = probe.match;
				// Only a miss consumes the probe list: on a hit the prefix says which
				// candidate won, which `ConfigMatch` already reports in full.
				if (O.isNone(found)) {
					candidates.push(...probe.probed);
				}
			} else if (resolver.resolveMatch !== undefined) {
				found = yield* Effect.provide(resolver.resolveMatch, resolverEnv);
			} else {
				found = O.map(yield* Effect.provide(resolver.resolve, resolverEnv), (path) => ({ path }));
			}
			if (O.isSome(found)) {
				const match = found.value;
				const target = match.path;
				// Emitted before the read, so a corrupt file is still reported as found.
				yield* emit({ _tag: "Discovered", path: target, resolver: resolver.name });
				sources.push({ path: target, resolver: resolver.name, match, value: yield* loadFrom(target) });
			}
		}
		return { sources, candidates };
	});

	const searched = options.resolvers.map((r) => r.name);

	/**
	 * Merge the discovered sources and announce the result. Shared by `load` and
	 * `loadOrDefault`, so the two cannot drift apart.
	 *
	 * Both events carry EVERY contributing source, because under `layeredMerge`
	 * all of them contributed.
	 */
	const mergeAndEmit: (sources: NonEmptySources<A>) => Effect.Effect<A> =
		Effect.fnUntraced(function* (sources: NonEmptySources<A>) {
			const value = yield* options.strategy.resolve(sources);
			const refs = sourceRefs(sources);
			yield* emit({ _tag: "Resolved", sources: refs, strategy: options.strategy.name });
			yield* emit({ _tag: "Loaded", sources: refs });
			return value;
		});

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

	/**
	 * Schema-encode, stringify, and prepend the header. Shared by `encode`,
	 * `write` and `save`. Untraced: it is internal, and the public
	 * boundaries that call it already open a span.
	 *
	 * `target` is the file this text is destined for, when there is one. It is
	 * only ever used to NAME the file in an error — `encode` passes `none` and
	 * its errors honestly carry no path.
	 */
	const encodeTo: (
		value: A,
		target: O.Option<string>,
		encodeOptions?: ConfigEncodeOptions,
	) => Effect.Effect<string, ConfigEncodeError> =
		Effect.fnUntraced(function* (value: A, target: O.Option<string>, encodeOptions?: ConfigEncodeOptions) {
			const encoded = yield* S.encodeEffect(options.schema)(value).pipe(
				// Same normalization as `decode`: carry the structured issue, never stringify.
				Effect.catchTag("SchemaError", (error) =>
					Effect.fail(ConfigValidationError.make({ path: target, issue: error.issue })),
				),
			);
			const serialized = yield* options.codec
				.stringify(encoded)
				.pipe(
					Effect.mapError((error) =>
						O.match(target, { onNone: () => error, onSome: (file) => withCodecPath(error, file) }),
					),
				);
			return prependHeader(serialized, encodeOptions?.header);
		});

	/**
	 * `encodeTo` a known file, then write it. Shared by `write` and `save`.
	 *
	 * `StringifyFailed` is emitted HERE, not in `encodeTo`: it is a write-path
	 * event, and `encode` promises to publish nothing. A subscriber counting
	 * failed writes must not see a dry run's codec failure.
	 */
	const encodeAndWrite: (
		value: A,
		target: string,
		encodeOptions?: ConfigEncodeOptions,
	) => Effect.Effect<void, ConfigWriteError> =
		Effect.fnUntraced(function* (value: A, target: string, encodeOptions?: ConfigEncodeOptions) {
			const serialized = yield* encodeTo(value, O.some(target), encodeOptions).pipe(
				Effect.tapError((error) =>
					error._tag === "ConfigCodecError"
						? emit({ _tag: "StringifyFailed", codec: options.codec.name, error })
						: Effect.void,
				),
			);
			yield* fs
				.writeFileString(target, serialized)
				.pipe(Effect.mapError((cause) => ConfigFileWriteError.make({ path: target, cause })));
		});

	// No event: nothing was written.
	const encode = Effect.fn("ConfigFile.encode")(function* (value: A, encodeOptions?: ConfigEncodeOptions) {
		return yield* encodeTo(value, O.none(), encodeOptions);
	});

	/**
	 * Resolve `defaultPath`, `mkdir -p` its parent and write. Shared by `save`
	 * and `update`, and — crucially — emits nothing.
	 *
	 * `update` must not call the public `save`, or one `update` would publish
	 * `Saved` as well as `Updated`. Event granularity is per-operation, so the
	 * emitting boundary sits in the public method, never in the shared internals
	 * it delegates to.
	 */
	const saveTo: (value: A) => Effect.Effect<string, ConfigSaveError> =
		Effect.fnUntraced(function* (value: A) {
			const configured = options.defaultPath;
			if (configured === undefined) return yield* ConfigDefaultPathMissingError.make({});
			// `defaultPath`'s requirements are `RR`, satisfied by the same context the
			// resolvers use. No cast needed.
			const target = yield* Effect.provide(configured, resolverEnv);
			yield* fs
				.makeDirectory(path.dirname(target), { recursive: true })
				.pipe(Effect.mapError((cause) => ConfigFileWriteError.make({ path: target, cause })));
			yield* encodeAndWrite(value, target);
			return target;
		});

	const write = Effect.fn("ConfigFile.write")(function* (
		value: A,
		target: string,
		encodeOptions?: ConfigEncodeOptions,
	) {
		// No `makeDirectory` here, deliberately: `write` trusts the caller's path.
		yield* encodeAndWrite(value, target, encodeOptions);
		yield* emit({ _tag: "Written", path: target });
	});

	const save = Effect.fn("ConfigFile.save")(function* (value: A) {
		const target = yield* saveTo(value);
		yield* emit({ _tag: "Saved", path: target });
		return target;
	});

	/**
	 * Serializes `update`'s read-modify-write. One permit, one service instance.
	 *
	 * @remarks
	 * `update` is load → transform → save. Without a lock, two concurrent calls
	 * both read the old document across the read's async boundary and both write
	 * their own transform of it, so one caller's change is silently lost. The
	 * lock covers the whole critical section, not just the write.
	 *
	 * This guards a single service instance in a single process. It is not a file
	 * lock: another process writing the same path concurrently can still clobber.
	 */
	const updateLock = Semaphore.makeUnsafe(1);

	const update = Effect.fn("ConfigFile.update")(function* (fn: (current: A) => A, defaultValue?: A) {
		return yield* updateLock.withPermits(1)(
			Effect.gen(function* () {
				const current = defaultValue !== undefined ? yield* loadOrDefault(defaultValue) : yield* load();
				const updated = fn(current);
				// `saveTo`, not `save`: calling the public method would leak its `Saved`.
				const target = yield* saveTo(updated);
				yield* emit({ _tag: "Updated", path: target });
				return updated;
			}),
		);
	});

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
};

// Implementation of ConfigFile.layer; the public contract lives on the static.
// `tag` is pinned by three intersected parts. `Context.Key<Self, S>` captures the key's real shape;
// `Context.Key<Self, ConfigFileShape<A>>` keeps `A` inferable from the key, which a bare
// `MergeStrategy.firstMatch()` in the options needs; the conditional only checks (`NoInfer`), rejecting a
// shape wider than ConfigFileShape<A>. It cannot see through method-syntax parameter bivariance: a member
// redeclared as a method with a wider parameter still passes.
const layer = <Self, A, I, RR = never, S extends ConfigFileShape<A> = ConfigFileShape<A>>(
	tag: Context.Key<Self, S> &
		Context.Key<Self, ConfigFileShape<A>> &
		([ConfigFileShape<NoInfer<A>>] extends [S] ? unknown : never),
	options: ConfigFileOptions<A, I, RR>,
): Layer.Layer<Self, never, FileSystem.FileSystem | Path.Path | RR> =>
	Layer.effect(
		tag,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			// `save` needs `dirname`, so `Path` is required alongside `FileSystem`.
			const path = yield* Path.Path;
			const resolverEnv = yield* Effect.context<RR>();
			return makeImpl(options, fs, path, resolverEnv);
		}),
	);

/**
 * Options for {@link ConfigFile.testLayer}.
 *
 * @remarks
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
 */
export interface ConfigFileTestOptions<A, I> {
	/** The schema every seeded document is decoded through. */
	readonly schema: S.Codec<A, I>;
	/** How file content becomes an unknown document, and back. */
	readonly codec: ConfigCodec;
	/** How several discovered sources become one value. */
	readonly strategy: MergeStrategy<A>;
	/**
	 * Filenames (relative to the temp dir) mapped to their raw contents.
	 *
	 * @remarks
	 * A name may contain separators (`"nested/.apprc"`); the parent directory is
	 * created for you.
	 */
	readonly files: Record<string, string>;
	/** An optional caller-supplied check run after schema decoding. */
	readonly validate?: (value: A) => Effect.Effect<A, ConfigValidationError>;
}

// Implementation of ConfigFile.testLayer; the public contract lives on the static.
// `tag` is pinned exactly as ConfigFile.layer's is; see the note there.
const testLayer = <Self, A, I, S extends ConfigFileShape<A> = ConfigFileShape<A>>(
	tag: Context.Key<Self, S> &
		Context.Key<Self, ConfigFileShape<A>> &
		([ConfigFileShape<NoInfer<A>>] extends [S] ? unknown : never),
	options: ConfigFileTestOptions<A, I>,
): Layer.Layer<Self, never, FileSystem.FileSystem | Path.Path> =>
	Layer.effect(
		tag,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			// The resolvers below need exactly this context. Taking it from the
			// ambient environment avoids rebuilding it — and avoids a cast.
			const resolverEnv = yield* Effect.context<FileSystem.FileSystem | Path.Path>();

			// Failures here are test-harness defects, not config errors: die.
			const dir = yield* fs.makeTempDirectory({ prefix: "effected-config-file-" }).pipe(Effect.orDie);
			yield* Effect.addFinalizer(() => fs.remove(dir, { recursive: true }).pipe(Effect.orDie));

			for (const [name, content] of R.toEntries(options.files)) {
				const target = path.join(dir, name);
				yield* fs.makeDirectory(path.dirname(target), { recursive: true }).pipe(Effect.orDie);
				yield* fs.writeFileString(target, content).pipe(Effect.orDie);
			}

			const resolvers = R.keys(options.files).map((name) => ConfigResolver.staticDir({ dir, filename: name }));

			return makeImpl(
				{
					schema: options.schema,
					codec: options.codec,
					strategy: options.strategy,
					resolvers,
					// Conditional spread: passing `validate: undefined` explicitly is not
					// the same as omitting it.
					...(options.validate !== undefined && { validate: options.validate }),
				},
				fs,
				path,
				resolverEnv,
			);
		}),
	);

/**
 * Options for {@link ConfigFile.read}.
 *
 * @public
 */
export interface ConfigReadOptions<A, I> {
	/** The schema the document is decoded through. */
	readonly schema: S.Codec<A, I>;
	/**
	 * How file content becomes an unknown document.
	 *
	 * @remarks
	 * An explicit argument, never inferred from the file extension or defaulted
	 * to JSON. Naming the codec at the call site is what keeps the
	 * free-standing-codec tree-shaking guarantee: a consumer that only ever
	 * passes `JsonCodec` never references the JSONC, YAML or TOML modules, so
	 * their engines stay out of the bundle.
	 */
	readonly codec: ConfigCodec;
	/**
	 * Parse options for the decode, chiefly `onExcessProperty`.
	 *
	 * @remarks
	 * See {@link ConfigFileOptions.parseOptions}; it means the same thing here.
	 * Absent, core's defaults apply and unknown keys are dropped silently.
	 */
	readonly parseOptions?: SchemaAST.ParseOptions;
}

// Implementation of ConfigFile.read; the public contract lives on the static.
const read = <A, I>(
	path: string,
	options: ConfigReadOptions<A, I>,
): Effect.Effect<A, ConfigReadError, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;

		const raw = yield* fs
			.readFileString(path)
			.pipe(Effect.mapError((cause) => ConfigFileReadError.make({ path, cause })));

		const parsed = yield* options.codec.parse(raw).pipe(Effect.mapError((error) => withCodecPath(error, path)));

		return yield* S.decodeUnknownEffect(options.schema)(parsed, options.parseOptions).pipe(
			// The same boundary normalization the service performs: never leak a
			// SchemaError outward, and carry its issue tree rather than a string.
			Effect.catchTag("SchemaError", (error) =>
				Effect.fail(ConfigValidationError.make({ path: O.some(path), issue: error.issue })),
			),
		);
	}).pipe(Effect.withSpan("ConfigFile.read", { attributes: { path } }));

/**
 * The config file service: a per-schema service factory, its layers, and the
 * one-shot {@link ConfigFile.read}.
 *
 * @public
 */
export class ConfigFile {
	private constructor() {}

	/**
	 * Create a uniquely-keyed service class for one config schema.
	 *
	 * @example
	 * ```ts
	 * class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("app/Config") {}
	 * ```
	 */
	static readonly Service = Service;

	/**
	 * Build the live layer for a config service class.
	 *
	 * @remarks
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
	 * @example
	 * ```ts
	 * import { ConfigFile, ConfigResolver, JsonCodec, MergeStrategy } from "./index.ts";
	 * import * as S from "effect/Schema";
	 *
	 * const AppShape = S.Struct({ port: S.Finite });
	 * class AppConfig extends ConfigFile.Service<AppConfig, typeof AppShape.Type>()("app/Config") {}
	 *
	 * const AppConfigLive = ConfigFile.layer(AppConfig, {
	 * 	schema: AppShape,
	 * 	codec: JsonCodec,
	 * 	resolvers: [ConfigResolver.explicitPath("./app.config.json")],
	 * 	strategy: MergeStrategy.firstMatch<typeof AppShape.Type>(),
	 * });
	 * ```
	 */
	static readonly layer = layer;

	/**
	 * A scoped layer that seeds `files` into a temp directory, wires the **real**
	 * live implementation over them, and removes the directory when the scope
	 * closes.
	 *
	 * @remarks
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
	 * @example
	 * ```ts
	 * const TestConfig = ConfigFile.testLayer(AppConfig, {
	 * 	schema: AppShape,
	 * 	codec: JsonCodec,
	 * 	strategy: MergeStrategy.firstMatch<AppShape>(),
	 * 	files: { ".apprc": `{"port":4242}` },
	 * }).pipe(Layer.provide(NodeServices.layer));
	 * ```
	 */
	static readonly testLayer = testLayer;

	/**
	 * Read, decode and validate one explicit path — no service, no layer, no tag.
	 *
	 * @remarks
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
	 * @example
	 * ```ts
	 * import { ConfigFile, JsonCodec } from "./index.ts";
	 * import * as Effect from "effect/Effect";
	 * import * as S from "effect/Schema";
	 *
	 * const MyConfig = S.Struct({ port: S.Finite });
	 *
	 * // Requires `FileSystem` in `R`; provide it from a platform layer.
	 * const program = Effect.gen(function* () {
	 * 	const config = yield* ConfigFile.read("./app.config.json", {
	 * 		schema: MyConfig,
	 * 		codec: JsonCodec,
	 * 	});
	 * 	return config.port;
	 * });
	 * ```
	 */
	static readonly read = read;
}
