// The `PackageJsonFile` service — the only IO module. It reads and writes
// package.json over core `FileSystem` / `Path`, so the layer requires those
// services and the consumer provides a platform implementation
// (`@effect/platform-node`) at the edge. Resolution is not fused into `write`
// (compose `Package.resolve` explicitly).

import { $ScratchpadId } from "@beep/identity/packages";
import type { JsoncPath, JsoncStringifyError } from "../jsonc/index.ts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { PackageDecodeError, PackageFormatOptions } from "./Package.ts";
import { Package } from "./Package.ts";
import type { PackageJsonModifyError } from "./PackageJsonFormat.ts";
import { PackageJsonFormat } from "./PackageJsonFormat.ts";
import { PackageManifest } from "./PackageManifest.ts";

const $I = $ScratchpadId.create("effected/package-json/PackageJsonFile");

const Json = S.fromJsonString(S.Unknown);

// ── Errors ────────────────────────────────────────────────────────────────────

/**
 * Indicates that a package.json file could not be read from the filesystem
 * (a filesystem error other than not-found).
 *
 * @public
 */
export class PackageJsonReadError extends S.TaggedError<PackageJsonReadError>($I`PackageJsonReadError`)("PackageJsonReadError", {
	/** The path that could not be read. */
	path: S.String.annotateKey({ description: "The path that could not be read." }),
	/** The underlying failure, preserved structurally. */
	cause: S.Defect().annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("PackageJsonReadError", { description: "Indicates that a package.json file could not be read from the filesystem (a filesystem error other than not-found)." })) {
	override get message(): string {
		return `Failed to read package.json from "${this.path}"`;
	}
}

/**
 * Indicates that no package.json file exists at the expected path. Carries its
 * own tag for `catchTag` routing.
 *
 * @public
 */
export class PackageJsonNotFoundError extends S.TaggedError<PackageJsonNotFoundError>($I`PackageJsonNotFoundError`)(
	"PackageJsonNotFoundError",
	{
		/** The path where package.json was expected. */
		path: S.String.annotateKey({ description: "The path where package.json was expected." }),
	}, $I.annote("PackageJsonNotFoundError", { description: "Indicates that no package.json file exists at the expected path. Carries its own tag for `catchTag` routing." }),
) {
	override get message(): string {
		return `package.json not found at "${this.path}"`;
	}
}

/**
 * Indicates that a package.json file's contents are not valid JSON.
 *
 * @public
 */
export class PackageJsonParseError extends S.TaggedError<PackageJsonParseError>($I`PackageJsonParseError`)("PackageJsonParseError", {
	/** The path whose contents failed to parse as JSON. */
	path: S.String.annotateKey({ description: "The path whose contents failed to parse as JSON." }),
	/** The underlying `SyntaxError`, preserved structurally. */
	cause: S.Defect().annotateKey({ description: "The underlying `SyntaxError`, preserved structurally." }),
}, $I.annote("PackageJsonParseError", { description: "Indicates that a package.json file's contents are not valid JSON." })) {
	override get message(): string {
		return `Failed to parse package.json at "${this.path}"`;
	}
}

/**
 * Indicates that a package.json file could not be written to the filesystem.
 * Narrowed to the filesystem-write failure only — never a resolution or encode
 * error.
 *
 * @public
 */
export class PackageJsonWriteError extends S.TaggedError<PackageJsonWriteError>($I`PackageJsonWriteError`)("PackageJsonWriteError", {
	/** The path that could not be written. */
	path: S.String.annotateKey({ description: "The path that could not be written." }),
	/** The underlying filesystem failure, preserved structurally. Narrowed to the write failure only. */
	cause: S.Defect().annotateKey({ description: "The underlying filesystem failure, preserved structurally. Narrowed to the write failure only." }),
}, $I.annote("PackageJsonWriteError", { description: "Indicates that a package.json file could not be written to the filesystem. Narrowed to the filesystem-write failure only — never a resolution or encode error." })) {
	override get message(): string {
		return `Failed to write package.json to "${this.path}"`;
	}
}

/**
 * One surgical field edit for {@link PackageJsonFile}'s `modify`: set `value`
 * at `path`, or delete the key there when `value` is `undefined` (the
 * `@effected/jsonc` / `@effected/yaml` modify convention — deletion is spelled
 * with an explicit `value: undefined`, so it is always deliberate).
 *
 * @public
 */
export interface PackageFieldEdit {
	/** The field path, e.g. `["packageManager"]` or `["devEngines", "runtime", "version"]`. */
	readonly path: JsoncPath;
	/** The plain JSON value to write, or `undefined` to delete the target key. */
	readonly value: unknown;
}

/**
 * The shape of the {@link PackageJsonFile} service — the value produced by
 * {@link PackageJsonFile.make} and carried by its layer.
 *
 * @public
 */
export interface PackageJsonFileShape {
	/**
	 * Read and decode a package.json file. Fails with `PackageJsonNotFoundError`
	 * (ENOENT), `PackageJsonReadError` (other fs errors), `PackageJsonParseError`
	 * (invalid JSON) or `PackageDecodeError` (schema decode).
	 */
	readonly read: (
		path: string,
	) => Effect.Effect<
		Package,
		PackageJsonReadError | PackageJsonNotFoundError | PackageJsonParseError | PackageDecodeError
	>;
	/**
	 * Serialize and write a package.json file. Fails with
	 * `PackageJsonWriteError`. With `indent: "preserve"` and no explicit
	 * `sourceText`, the existing file at `path` (when readable) supplies the
	 * source text whose indentation is preserved.
	 */
	readonly write: (
		path: string,
		pkg: Package,
		options?: PackageFormatOptions,
	) => Effect.Effect<void, PackageJsonWriteError>;
	/**
	 * Read and decode a package.json file through the presence-lenient
	 * {@link PackageManifest} — the read that accepts the private
	 * workspace-root shape (`{ "private": true, "packageManager": ... }`)
	 * `read` rejects. Same error channel as `read`; a present field that does
	 * not satisfy its codec still fails as `PackageDecodeError`.
	 */
	readonly readManifest: (
		path: string,
	) => Effect.Effect<
		PackageManifest,
		PackageJsonReadError | PackageJsonNotFoundError | PackageJsonParseError | PackageDecodeError
	>;
	/**
	 * Serialize and write a {@link PackageManifest}. Fails with
	 * `PackageJsonWriteError`. Shares `write`'s `indent: "preserve"` behavior:
	 * with no explicit `sourceText`, the existing file at `path` (when
	 * readable) supplies the source text whose indentation is preserved.
	 */
	readonly writeManifest: (
		path: string,
		manifest: PackageManifest,
		options?: PackageFormatOptions,
	) => Effect.Effect<void, PackageJsonWriteError>;
	/**
	 * Apply surgical field edits to a package.json file **without decoding
	 * it**: one read, each {@link PackageFieldEdit} applied in order through
	 * `PackageJsonFormat.modifyToString`, one write — skipped when the result
	 * is byte-identical to what was read. Every byte outside the edited spans
	 * is preserved (key order, indentation, line endings, trailing newline),
	 * which is what keeps a one-field change reviewable in someone else's
	 * repository. Succeeds with the file's final text.
	 *
	 * Invalid JSON at `path` fails as `PackageJsonParseError` — the same tag
	 * `read` uses for it — and an unnavigable edit path as
	 * `PackageJsonModifyError`.
	 */
	readonly modify: (
		path: string,
		edits: ReadonlyArray<PackageFieldEdit>,
	) => Effect.Effect<
		string,
		| PackageJsonReadError
		| PackageJsonNotFoundError
		| PackageJsonParseError
		| PackageJsonModifyError
		| JsoncStringifyError
		| PackageJsonWriteError
	>;
}

/**
 * Reads, writes and surgically edits package.json files over core `FileSystem`
 * / `Path`. The layer requires those services; provide
 * `@effect/platform-node`'s `NodeFileSystem` / `NodePath` (or a bun equivalent)
 * at the application boundary.
 *
 * @example
 * ```ts
 * import { PackageJsonFile } from "./index.ts";
 * import { NodeFileSystem, NodePath } from "@effect/platform-node";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const files = yield* PackageJsonFile;
 *   const pkg = yield* files.read("./package.json");
 *   console.log(pkg.name);
 * }).pipe(Effect.provide(PackageJsonFile.layer), Effect.provide(NodeFileSystem.layer), Effect.provide(NodePath.layer));
 * ```
 *
 * @public
 */
export class PackageJsonFile extends Context.Service<PackageJsonFile, PackageJsonFileShape>()(
	$I`PackageJsonFile`,
) {
	/** Build the service implementation from `FileSystem` / `Path` in context; use {@link PackageJsonFile.layer} to provide it. */
	static readonly make: Effect.Effect<PackageJsonFileShape, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
		function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;

			// Read the file's text directly — no `exists` pre-check (that TOCTOU
			// race reports a file deleted between the two calls as
			// PackageJsonReadError). The core FileSystem fails with a
			// PlatformError whose `reason._tag` is "NotFound" for a missing file;
			// route only that to NotFound.
			const readText = (target: string) =>
				fs
					.readFileString(target)
					.pipe(
						Effect.mapError((cause) =>
							cause.reason._tag === "NotFound"
								? PackageJsonNotFoundError.make({ path: target })
								: PackageJsonReadError.make({ path: target, cause }),
						),
					);

			const readJson = Effect.fn("readJson")(function* (target: string) {
				const content = yield* readText(target);
				return yield* S.decodeEffect(Json)(content).pipe(
					Effect.mapError((cause) => {
						const parsed = PackageJsonFormat.formatToString(content);
						return PackageJsonParseError.make({
							path: target,
							cause: Result.isFailure(parsed) ? parsed.failure.cause : cause,
						});
					}),
				);
			});

			// `indent: "preserve"` with no source text in hand: detect the
			// indentation from the file being overwritten. Any read failure (most
			// commonly a fresh file) falls back to the default indent.
			const withPreservedSource = Effect.fn("withPreservedSource")(function* (target: string, options?: PackageFormatOptions) {
				if (options?.indent !== "preserve" || options.sourceText !== undefined) {
					return options;
				}
				const existing = yield* fs
					.readFileString(target)
					.pipe(Effect.orElseSucceed((): string | undefined => undefined));
				return existing === undefined ? options : { ...options, sourceText: existing };
			});

			const writeText = Effect.fn("writeText")(function* (target: string, json: string) {
				const directory = path.dirname(target);
				yield* fs.makeDirectory(directory, { recursive: true });
				yield* fs.writeFileString(target, json);
			}, (effect, target) => effect.pipe(Effect.mapError((cause) => PackageJsonWriteError.make({ path: target, cause }))));

			const read = Effect.fn("PackageJsonFile.read")(function* (target: string) {
				return yield* Package.decode(yield* readJson(target));
			});

			const write = Effect.fn("PackageJsonFile.write")(function* (
				target: string,
				pkg: Package,
				options?: PackageFormatOptions,
			) {
				const effective = yield* withPreservedSource(target, options);
				yield* writeText(target, pkg.toJsonString(effective));
			});

			const readManifest = Effect.fn("PackageJsonFile.readManifest")(function* (target: string) {
				return yield* PackageManifest.decode(yield* readJson(target));
			});

			const writeManifest = Effect.fn("PackageJsonFile.writeManifest")(function* (
				target: string,
				manifest: PackageManifest,
				options?: PackageFormatOptions,
			) {
				const effective = yield* withPreservedSource(target, options);
				yield* writeText(target, manifest.toJsonString(effective));
			});

			const modify = Effect.fn("PackageJsonFile.modify")(function* (
				target: string,
				edits: ReadonlyArray<PackageFieldEdit>,
			) {
				const source = yield* readText(target);
				let text = source;
				for (const edit of edits) {
					// Each edit re-navigates the current text, so a later edit may
					// target a key an earlier one inserted; overlap cannot arise.
					text = yield* PackageJsonFormat.modifyToString(text, edit.path, edit.value).pipe(
						// The service's invalid-JSON tag is PackageJsonParseError,
						// whichever entry point met it — normalize the text-level
						// syntax error at this boundary.
						Effect.catchTag("PackageJsonSyntaxError", (cause) => PackageJsonParseError.make({ path: target, cause })),
					);
				}
				// A no-op edit set leaves the bytes alone entirely — no write, no
				// mtime churn.
				if (text !== source) {
					yield* writeText(target, text);
				}
				return text;
			});

			return { read, write, readManifest, writeManifest, modify };
		},
	);

	/**
	 * The live layer. Requires core `FileSystem` / `Path`, provided by the
	 * consumer's platform implementation at the edge.
	 */
	static readonly layer: Layer.Layer<PackageJsonFile, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
		PackageJsonFile,
		PackageJsonFile.make,
	);
}
