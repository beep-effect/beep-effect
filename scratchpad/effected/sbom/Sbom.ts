// The emitter facade.
//
// `generate` and `toJson` are plain total functions: the model is owned, so
// there is no third-party serializer whose failure they would need to surface.
// Only `write` has an error channel, and it is the filesystem's.

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { BOM_FORMAT, Component, SPEC_VERSION, SbomDocument, SbomMetadata, documentJson } from "./SbomDocument.ts";

const $I = $ScratchpadId.create("effected/sbom/Sbom");

/**
 * Input to {@link Sbom.generate}.
 *
 * @public
 */
export const SbomInput = S.Struct({
	/** The component the BOM is about. */
	root: Component.annotateKey({ description: "The component the BOM is about." }),
	/** Its dependencies, in any order — the document sorts them. */
	components: S.Array(Component).annotateKey({ description: "Its dependencies, in any order — the document sorts them." }),
	/** Document metadata. `root` is threaded onto it automatically. */
	metadata: S.optional(SbomMetadata).annotateKey({ description: "Document metadata. `root` is threaded onto it automatically." }),
}).pipe($I.annoteSchema("SbomInput", { description: "Input to Sbom.generate." }));

export type SbomInput = typeof SbomInput.Type;

/**
 * Options for {@link Sbom.toJson}.
 *
 * @public
 */
export const SbomJsonOptions = S.Struct({
	/** `JSON.stringify` indentation. Defaults to `2`; `0` emits one line. */
	space: S.optional(S.Finite).annotateKey({ description: "JSON.stringify indentation. Defaults to 2; 0 emits one line." }),
}).pipe($I.annoteSchema("SbomJsonOptions", { description: "Options for Sbom.toJson." }));

export type SbomJsonOptions = typeof SbomJsonOptions.Type;

/**
 * Raised when a BOM cannot be written to disk.
 *
 * @remarks
 * The package's **only** error, and it is the filesystem's rather than the
 * emitter's — assembling and serializing a document cannot fail.
 *
 * @public
 */
export class SbomWriteError extends S.TaggedError<SbomWriteError>($I`SbomWriteError`)("SbomWriteError", {
	/** The path that could not be written. */
	path: S.String.annotateKey({ description: "The path that could not be written." }),
	/** The underlying failure, preserved structurally. */
	cause: S.Defect().annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("SbomWriteError", { description: "Raised when a BOM cannot be written to disk." })) {
	override get message(): string {
		return `Failed to write the SBOM to ${this.path}`;
	}
}

// Implementation of Sbom.generate; the public contract lives on the static.
const generate = (input: SbomInput): SbomDocument =>
	SbomDocument.make({
		bomFormat: BOM_FORMAT,
		specVersion: SPEC_VERSION,
		version: 1,
		metadata: metadataWithRoot(input),
		components: A.sort(
			input.components,
			Order.mapInput(Order.make<string>((a, b) => Str.localeCompare(b)(a)), (component: Component) => component.name),
		),
	});

/**
 * Thread the root component onto the caller's metadata, or synthesize metadata
 * carrying it.
 *
 * Rebuilt through `SbomMetadata.make` rather than spread into a plain object:
 * a spread of a `Schema.Class` instance loses its prototype, and a plain object
 * standing in for a class field is the kind of lie that works until something
 * asks whether it is an instance. The conditional spreads are required by
 * `exactOptionalPropertyTypes` — an explicit `undefined` does not satisfy an
 * `optionalKey` field.
 */
const metadataWithRoot = (input: SbomInput): SbomMetadata =>
	SbomMetadata.make({
		component: input.root,
		...(input.metadata?.timestamp !== undefined && { timestamp: input.metadata.timestamp }),
		...(input.metadata?.authors !== undefined && { authors: input.metadata.authors }),
		...(input.metadata?.supplier !== undefined && { supplier: input.metadata.supplier }),
	});

// Implementation of Sbom.toJson; the public contract lives on the static.
const toJson = (document: SbomDocument, options?: SbomJsonOptions): string =>
	Result.getOrThrowWith(
		S.encodeResult(S.fromJsonString(S.Unknown, { space: options?.space ?? 2 }))(documentJson(document)),
		identity,
	);

// Implementation of Sbom.write; the public contract lives on the static.
const write = Effect.fn("Sbom.write")(function* (document: SbomDocument, path: string, options?: SbomJsonOptions) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs
		.writeFileString(path, toJson(document, options))
		.pipe(Effect.mapError((cause) => SbomWriteError.make({ path, cause })));
});

/**
 * The SBOM emitter: assemble, serialize, write.
 *
 * @example
 * ```ts
 * import { Component, Sbom } from "./index.ts";
 *
 * const root = Component.make({ type: "application", name: "app", version: "1.0.0" });
 * const document = Sbom.generate({ root, components: [] });
 * const json = Sbom.toJson(document); // CycloneDX 1.6 JSON text
 * ```
 *
 * @public
 */
export class Sbom {
	private constructor() {}

	/**
	 * Assemble a CycloneDX 1.6 document.
	 *
	 * @remarks
	 * **Total** — no error channel, because there is nothing here that can fail.
	 * Components are sorted by name so two runs over the same inputs produce the
	 * same bytes: an SBOM's digest becomes an attestation subject, and a document
	 * that reordered itself between runs would change that digest for no reason.
	 */
	static readonly generate = generate;

	/**
	 * Serialize a document to canonical CycloneDX 1.6 JSON.
	 *
	 * @remarks
	 * **Total.** Absent optional fields are omitted rather than emitted as `null`,
	 * and `bomRef` becomes the specification's hyphenated `bom-ref`.
	 */
	static readonly toJson = toJson;

	/**
	 * Write a document to `path` as canonical JSON.
	 *
	 * @remarks
	 * The one fallible member; it fails with {@link SbomWriteError} and requires
	 * `FileSystem` in `R`. It does not create parent directories — a caller
	 * that wants one creates it, so the failure mode stays "the path you gave me
	 * is not writable" rather than "something was created somewhere".
	 */
	static readonly write = write;
}
