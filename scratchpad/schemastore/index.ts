/**
 * Build, version and lint SchemaStore-shaped Draft-07 JSON Schema documents
 * from Effect Schema sources.
 *
 * The pipeline is core's: `Schema.toJsonSchemaDocument` (Draft 2020-12)
 * lowered with `JsonSchema.toDocumentDraft07`. This package owns what core
 * does not: the SchemaStore publication shape (`$schema` + `$id` + root +
 * `$defs`, with the `#/definitions` → `#/$defs` ref rewrite the lowering
 * makes necessary), the annotation carriers that re-graft the non-standard
 * language-server keyword families the lowering drops, the catalog-entry
 * vocabulary with both versioning modes, the structural and hygiene lints,
 * canonical JSON text, content-comparing write-if-changed file IO
 * (`SchemaFile`), change classification for the versioning decision
 * (`DocumentDiff`), real-engine validation over ajv (`SchemaValidator`,
 * which ships closed — no adapter to write), and the emit pipeline over all
 * of it (`SchemaPipeline`).
 *
 * @example
 * ```ts
 * import { CatalogEntry, DocumentLint, StoreDocument } from "@effected/schemastore";
 * import { Effect, Schema } from "effect";
 *
 * // The description carries no docs URL, so the lint's advisory fires.
 * const Config = Schema.Struct({ name: Schema.String }).annotate({
 *   description: "Build configuration",
 * });
 *
 * const program = Effect.gen(function* () {
 *   const document = yield* StoreDocument.fromSchema(Config, {
 *     $id: "https://example.com/config.schema.json",
 *   });
 *   const findings = DocumentLint.lint(document);
 *   const text = yield* Effect.fromResult(document.serializeResult());
 *   return [findings.length, text.endsWith("\n")] as const;
 * });
 *
 * console.log(Effect.runSync(program));
 * // => [1, true]
 * ```
 *
 * @see {@link https://www.schemastore.org | SchemaStore}
 * @see {@link https://effect.website | Effect}
 *
 * @packageDocumentation
 */

export { AnnotationCarriers, CarrierDepthExceededError } from "./AnnotationCarriers.ts";
export {
	CanonicalJson,
	type CanonicalJsonError,
	type CanonicalJsonOptions,
	JsonDepthExceededError,
	NonJsonValueError,
} from "./CanonicalJson.ts";
export { CatalogEntry, CatalogLintFinding } from "./CatalogEntry.ts";
export { DocumentDiff, type SchemaChange } from "./DocumentDiff.ts";
export { DocumentLint, DocumentLintFinding } from "./DocumentLint.ts";
export { KeywordFamilies } from "./KeywordFamilies.ts";
export {
	type CheckResult,
	SchemaFile,
	SchemaFileNotFoundError,
	SchemaFileReadError,
	type SchemaFileShape,
	SchemaFileWriteError,
	type SchemaWriteOptions,
	type WriteChange,
	type WriteOutcome,
	type WriteResult,
} from "./SchemaFile.ts";
export {
	type PipelineCheckResult,
	PipelineFinding,
	type PipelineResult,
	SchemaGateError,
	SchemaPipeline,
	type SchemaPipelineOptions,
} from "./SchemaPipeline.ts";
export { SchemaTarget } from "./SchemaTarget.ts";
export {
	SchemaValidator,
	SchemaValidatorError,
	type SchemaValidatorOptions,
	type SchemaValidatorShape,
	ValidationFinding,
} from "./SchemaValidator.ts";
export {
	type CatalogUrls,
	InvalidSchemaVersionError,
	SchemaVersion,
	SchemaVersioning,
} from "./SchemaVersioning.ts";
export {
	DRAFT_07_META_SCHEMA,
	SchemaConversionError,
	StoreDocument,
	type StoreDocumentOptions,
} from "./StoreDocument.ts";
