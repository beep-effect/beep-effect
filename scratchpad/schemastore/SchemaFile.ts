/**
 * Read and write SchemaStore documents over core `FileSystem` / `Path`.
 *
 * The package's only IO surface: write-if-changed serialization plus a
 * drift-check counterpart. The layer requires those services; provide a
 * platform implementation at the edge.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Effect, FileSystem, Layer, Path, Schema } from "effect";
import type { CanonicalJsonError, CanonicalJsonOptions } from "./CanonicalJson.ts";
import type { SchemaChange } from "./DocumentDiff.ts";
import { DocumentDiff } from "./DocumentDiff.ts";
import type { StoreDocument } from "./StoreDocument.ts";

const $I = $ScratchpadId.create("schemastore/SchemaFile");

// ── Errors ────────────────────────────────────────────────────────────────────

/**
 * Indicates that a schema file could not be read from the filesystem (a
 * filesystem error other than not-found).
 *
 * **Example** (Construct a read failure)
 *
 * ```ts
 * import { SchemaFileReadError } from "@beep/scratchpad/schemastore"
 *
 * const error = SchemaFileReadError.make({ path: "schemas/config.schema.json", cause: "EACCES" })
 *
 * console.log(error._tag)
 * // => "SchemaFileReadError"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SchemaFileReadError extends Schema.TaggedError<SchemaFileReadError>($I`SchemaFileReadError`)(
	"SchemaFileReadError",
	{
		/** The path that could not be read. */
		path: Schema.String,
		/** The underlying filesystem failure, preserved structurally. */
		cause: Schema.Defect(),
	},
	$I.annote("SchemaFileReadError", {
		description: "Raised when a schema file cannot be read for a reason other than not-found.",
	}),
) {
	override get message(): string {
		return `Failed to read schema file from "${this.path}"`;
	}
}

/**
 * Indicates that no schema file exists at the expected path. Carries its
 * own tag for `catchTag` routing.
 *
 * **Example** (Construct a not-found failure)
 *
 * ```ts
 * import { SchemaFileNotFoundError } from "@beep/scratchpad/schemastore"
 *
 * const error = SchemaFileNotFoundError.make({ path: "schemas/missing.schema.json" })
 *
 * console.log(error._tag)
 * // => "SchemaFileNotFoundError"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SchemaFileNotFoundError extends Schema.TaggedError<SchemaFileNotFoundError>($I`SchemaFileNotFoundError`)(
	"SchemaFileNotFoundError",
	{
		/** The path where the schema file was expected. */
		path: Schema.String,
	},
	$I.annote("SchemaFileNotFoundError", {
		description: "Raised when no schema file exists at the expected path.",
	}),
) {
	override get message(): string {
		return `Schema file not found at "${this.path}"`;
	}
}

/**
 * Indicates that a schema file could not be written to the filesystem.
 * Narrowed to the filesystem failure only — a serialization failure
 * surfaces as its own `CanonicalJsonError`, never wrapped here.
 *
 * **Example** (Construct a write failure)
 *
 * ```ts
 * import { SchemaFileWriteError } from "@beep/scratchpad/schemastore"
 *
 * const error = SchemaFileWriteError.make({ path: "schemas/config.schema.json", cause: "ENOSPC" })
 *
 * console.log(error._tag)
 * // => "SchemaFileWriteError"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SchemaFileWriteError extends Schema.TaggedError<SchemaFileWriteError>($I`SchemaFileWriteError`)(
	"SchemaFileWriteError",
	{
		/** The path that could not be written. */
		path: Schema.String,
		/** The underlying filesystem failure, preserved structurally. */
		cause: Schema.Defect(),
	},
	$I.annote("SchemaFileWriteError", {
		description:
			"Raised when a schema file cannot be written; serialization failures stay CanonicalJsonError and are never wrapped here.",
	}),
) {
	override get message(): string {
		return `Failed to write schema file to "${this.path}"`;
	}
}

/**
 * What {@link SchemaFileShape.write} did to the filesystem: `"written"`
 * when it wrote, `"unchanged"` when it left the file alone — reported as a
 * value so the caller decides what to surface, never a log.
 *
 * @see {@link SchemaFileShape.write} for the operation that reports this outcome.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type WriteOutcome = "written" | "unchanged";

/**
 * How the document being written relates to what was already on disk:
 * {@link SchemaChange} plus `"created"` for a file that did not exist, so
 * there was nothing to compare against.
 *
 * @see {@link SchemaFileShape.write} for the operation that reports this classification.
 * @see {@link DocumentDiff.classify} for the content comparison behind `"none"` / `"annotations"` / `"contract"`.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type WriteChange = SchemaChange | "created";

/**
 * The result of {@link SchemaFileShape.write}: what happened to the file,
 * and what the difference MEANT.
 *
 * The two are independent on purpose. `change` answers the versioning
 * question — `"annotations"` means only prose and editor affordances moved,
 * so the document replaces its predecessor transparently and needs no new
 * {@link SchemaVersioning} version, while `"contract"` means an assertion
 * keyword moved and a consumer's document valid yesterday may be invalid
 * today. `outcome` answers only whether bytes were written, which under
 * `compare: "bytes"` can be `"written"` even when `change` is `"none"`.
 *
 * @see {@link SchemaFileShape.write} for the operation that returns this pair.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface WriteResult {
	/**
	 * Whether the file was written. **This is the authoritative answer to
	 * "did the filesystem get touched"** — always, under either `compare`
	 * mode. Do not infer it from `change`: under `compare: "bytes"` a
	 * `change` of `"none"` still writes.
	 */
	readonly outcome: WriteOutcome;
	/** What differs between the previous content and the new document. */
	readonly change: WriteChange;
}

/**
 * The result of {@link SchemaFileShape.check}: the same two answers
 * {@link WriteResult} carries, for a call that touched nothing.
 *
 * `wouldWrite` is `outcome`'s counterpart — it honors `compare`, so it
 * answers "would `write` do anything with these same options", which
 * `change` alone cannot under `compare: "bytes"`.
 *
 * @see {@link SchemaFileShape.check} for the operation that returns this pair.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface CheckResult {
	/** Whether a `write` with the same options would touch the file. */
	readonly wouldWrite: boolean;
	/** What differs between the on-disk content and the new document. */
	readonly change: WriteChange;
}

/**
 * Options for {@link SchemaFileShape.write} and
 * {@link SchemaFileShape.check}: the {@link CanonicalJsonOptions} the
 * document serializes under, plus how `write` decides whether to touch the
 * file.
 *
 * @see {@link SchemaFileShape.write} for the writer these options configure.
 * @see {@link SchemaFileShape.check} for the drift-check that honors the same options.
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface SchemaWriteOptions extends CanonicalJsonOptions {
	/**
	 * How `write` decides the file needs rewriting:
	 *
	 * - `"value"` (the default) — compare the parsed content. Immune to any
	 *   other tool that reformats the file, which is the common case: a repo
	 *   whose pre-commit hook runs Biome or Prettier over `*.json` would
	 *   otherwise see every run rewrite the file forever, because the
	 *   formatter's bytes never match `CanonicalJson`'s.
	 * - `"bytes"` — compare the exact text, so the file on disk is only ever
	 *   `CanonicalJson`'s own output. Choose this when the emitted bytes are
	 *   themselves the artifact and no other tool is allowed to touch them.
	 *
	 * `change` in the {@link WriteResult} is classified by content either
	 * way; this option decides only whether a byte-level difference is
	 * enough to rewrite.
	 */
	readonly compare?: "bytes" | "value";
}

/**
 * The shape of the {@link SchemaFile} service — the value produced by
 * {@link SchemaFile.make} and carried by its layer.
 *
 * @see {@link SchemaFile} for the service that carries this shape.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface SchemaFileShape {
	/**
	 * Read a schema file's exact text (the drift-test read side: compare it
	 * against `StoreDocument.serializeResult`). Fails with
	 * `SchemaFileNotFoundError` (ENOENT) or `SchemaFileReadError` (other
	 * filesystem errors).
	 */
	readonly read: (path: string) => Effect.Effect<string, SchemaFileReadError | SchemaFileNotFoundError>;
	/**
	 * Serialize a document to canonical JSON and write it **only if the
	 * on-disk content differs** (a missing file counts as different),
	 * creating parent directories as needed. Answers a {@link WriteResult}
	 * as a value: what happened to the file, and what the difference meant.
	 * Fails with a `CanonicalJsonError` (the document does not serialize),
	 * `SchemaFileReadError` (the existing content could not be read for
	 * comparison) or `SchemaFileWriteError` (the filesystem write failed).
	 */
	readonly write: (
		path: string,
		document: StoreDocument,
		options?: SchemaWriteOptions,
	) => Effect.Effect<WriteResult, CanonicalJsonError | SchemaFileReadError | SchemaFileWriteError>;
	/**
	 * The same comparison {@link SchemaFileShape.write} makes, **without
	 * touching the filesystem** — the drift-check half of the pair, for a
	 * CI job that must assert a committed schema is current rather than
	 * regenerate it.
	 *
	 * Answers both questions the writer answers: `change` classifies the
	 * content (immune to a formatter having reflowed the committed file),
	 * and `wouldWrite` honors `compare`, so it agrees with `write` under
	 * either mode. Checking drift is `change`; predicting the writer is
	 * `wouldWrite`.
	 */
	readonly check: (
		path: string,
		document: StoreDocument,
		options?: SchemaWriteOptions,
	) => Effect.Effect<CheckResult, CanonicalJsonError | SchemaFileReadError>;
}

/**
 * Reads and writes emitted schema documents over core `FileSystem` /
 * `Path` — the package's one IO surface. The layer requires those
 * services; provide `@effect/platform-node`'s `NodeFileSystem` / `NodePath`
 * (or a bun equivalent) at the application boundary.
 *
 * `write` is write-if-changed, and by default compares **content**: an
 * unchanged document never touches the file even if another tool has
 * reformatted it, so a generator committed to a repo whose pre-commit hook
 * formats JSON does not churn on every run. It also reports what the
 * difference meant — `"annotations"` (prose only, replaces its predecessor
 * transparently) versus `"contract"` (an assertion moved, so a new
 * `SchemaVersioning` version is warranted). `check` makes the same
 * comparison without writing, which is what a CI drift job wants.
 *
 * **Gotchas**
 *
 * `outcome` answers whether the filesystem was touched; `change` answers
 * what the difference meant. Under `compare: "bytes"` a `change` of
 * `"none"` can still `outcome: "written"`. Unparsable on-disk JSON
 * classifies as `"contract"` so write can repair it.
 * {@link SchemaFileWriteError} never wraps {@link CanonicalJsonError}.
 * There is no `exists` pre-check — a TOCTOU race would mis-tag NotFound
 * as a read error.
 *
 * **Example** (Write if content changed)
 *
 * ```ts
 * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
 * import { SchemaFile, StoreDocument } from "@beep/scratchpad/schemastore"
 * import { Effect, Layer, Path } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const files = yield* SchemaFile
 *   const document = yield* StoreDocument.fromSchema(S.Struct({ name: S.String }), {
 *     $id: "https://example.com/config.schema.json",
 *   })
 *   return yield* files.write("/schemas/config.schema.json", document)
 * }).pipe(
 *   Effect.provide(SchemaFile.layer),
 *   Effect.provide(Layer.mergeAll(MemoryFileSystem.layer, Path.layer)),
 * )
 *
 * Effect.runPromise(program).then((result) => console.log(result))
 * // => { outcome: "written", change: "created" }
 * ```
 *
 * @see {@link DocumentDiff.classify} for the content comparison behind `change`.
 * @see {@link SchemaFileShape.check} for the same comparison without writing.
 * @see {@link CanonicalJson} for the serializer whose bytes `write` may persist.
 * @public
 * @category services
 * @since 0.0.0
 */
export class SchemaFile extends Context.Service<SchemaFile, SchemaFileShape>()("@effected/schemastore/SchemaFile") {
	/** Build the service implementation from `FileSystem` / `Path` in context; use {@link SchemaFile.layer} to provide it. */
	static readonly make: Effect.Effect<SchemaFileShape, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
		function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;

			const read = Effect.fn("SchemaFile.read")(function* (target: string) {
				// Read directly — no `exists` pre-check (that TOCTOU race reports
				// a file deleted between the two calls as SchemaFileReadError).
				// The core FileSystem fails with `PlatformError`, a wrapper class
				// whose `reason` field ALWAYS exists and holds the underlying
				// `SystemError` (tagged "NotFound", "PermissionDenied", ...) or
				// `BadArgument` (tagged "BadArgument") — verified against the
				// installed beta. Route only "NotFound" to NotFound; every other
				// reason, BadArgument included, is a typed SchemaFileReadError.
				return yield* fs
					.readFileString(target)
					.pipe(
						Effect.mapError((cause) =>
							cause.reason._tag === "NotFound"
								? SchemaFileNotFoundError.make({ path: target })
								: SchemaFileReadError.make({ path: target, cause }),
						),
					);
			});

			// A missing file is simply "different" (proceed to write); any
			// other read failure — a BadArgument-reasoned PlatformError
			// included (`reason` is always present on the wrapper; its
			// "BadArgument" tag is not "NotFound") — is surfaced typed: if
			// the content cannot be compared, silently overwriting would
			// defeat the contract.
			const readForCompare = (target: string): Effect.Effect<string | undefined, SchemaFileReadError> =>
				fs
					.readFileString(target)
					.pipe(
						Effect.catch(
							(cause): Effect.Effect<string | undefined, SchemaFileReadError> =>
								cause.reason._tag === "NotFound"
									? Effect.succeed(undefined)
									: Effect.fail(SchemaFileReadError.make({ path: target, cause })),
						),
					);

			// Classify by content. Text already on disk that does not parse
			// is not a schema document at all, so there is nothing it can be
			// content-equal to: report the conservative `"contract"` and let
			// the write repair it. (Failing typed here would leave a
			// hand-corrupted generated file un-regenerable, which is worse.)
			const classify = (existing: string, text: string): SchemaChange => {
				try {
					return DocumentDiff.classify(JSON.parse(existing), JSON.parse(text));
				} catch {
					return "contract";
				}
			};

			// The one comparison both `write` and `check` answer from, so the
			// two can never disagree about the same file.
			const compare = (existing: string | undefined, text: string, options?: SchemaWriteOptions): CheckResult => {
				if (existing === undefined) {
					return { wouldWrite: true, change: "created" };
				}
				const change = classify(existing, text);
				// `"value"` (the default) keeps the write-if-changed promise
				// intact in a repo whose formatter also owns the file's text.
				const wouldWrite = options?.compare === "bytes" ? existing !== text : change !== "none";
				return { wouldWrite, change };
			};

			const write = Effect.fn("SchemaFile.write")(function* (
				target: string,
				document: StoreDocument,
				options?: SchemaWriteOptions,
			) {
				const text = yield* Effect.fromResult(document.serializeResult(options));
				const existing = yield* readForCompare(target);
				const { wouldWrite, change } = compare(existing, text, options);
				if (!wouldWrite) {
					return { outcome: "unchanged", change } as const satisfies WriteResult;
				}
				yield* fs
					.makeDirectory(path.dirname(target), { recursive: true })
					.pipe(Effect.mapError((cause) => SchemaFileWriteError.make({ path: target, cause })));
				yield* fs
					.writeFileString(target, text)
					.pipe(Effect.mapError((cause) => SchemaFileWriteError.make({ path: target, cause })));
				return { outcome: "written", change } as const satisfies WriteResult;
			});

			const check = Effect.fn("SchemaFile.check")(function* (
				target: string,
				document: StoreDocument,
				options?: SchemaWriteOptions,
			) {
				const text = yield* Effect.fromResult(document.serializeResult(options));
				const existing = yield* readForCompare(target);
				return compare(existing, text, options);
			});

			return { read, write, check };
		},
	);

	/**
	 * The live layer. Requires core `FileSystem` / `Path`, provided by the
	 * consumer's platform implementation at the edge.
	 */
	static readonly layer: Layer.Layer<SchemaFile, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
		SchemaFile,
		SchemaFile.make,
	);
}
