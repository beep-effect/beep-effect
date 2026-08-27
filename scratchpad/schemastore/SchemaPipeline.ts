// The verb `SchemaTarget` was defined for: generate each target's document,
// lint it, validate it with the real engine, gate on the findings, and write
// it. Orchestration only — every step belongs to a module this package
// already owns, and no JSON Schema capability is added here.
//
// A plain function rather than a `Context.Service`: it needs `SchemaFile`
// and `SchemaValidator`, which compose through `R` for free. A service would
// add a layer to wire for no capability the consumer does not already have.

import { Effect, Schema } from "effect";
import type { CanonicalJsonError } from "./CanonicalJson.ts";
import { DocumentLint } from "./DocumentLint.ts";
import type {
	SchemaFileReadError,
	SchemaFileWriteError,
	SchemaWriteOptions,
	WriteChange,
	WriteOutcome,
} from "./SchemaFile.ts";
import { SchemaFile } from "./SchemaFile.ts";
import type { SchemaTarget } from "./SchemaTarget.ts";
import type { SchemaValidatorError, SchemaValidatorOptions } from "./SchemaValidator.ts";
import { SchemaValidator } from "./SchemaValidator.ts";
import type { SchemaConversionError } from "./StoreDocument.ts";
import { StoreDocument } from "./StoreDocument.ts";

/**
 * One problem found while emitting a target, from either gate, normalized
 * so a single policy predicate can judge both.
 *
 * `DocumentLint` findings keep their own severity; engine findings are
 * `"warning"` — a document the engine rejects is not advisory.
 *
 * @public
 */
export class PipelineFinding extends Schema.Class<PipelineFinding>("PipelineFinding")({
	/** Which gate produced it. */
	source: Schema.Literals(["lint", "validator"]),
	/** `"warning"` blocks under the default policy; `"advisory"` does not. */
	severity: Schema.Literals(["warning", "advisory"]),
	/** The lint check's name, or the engine keyword, when one is named. */
	check: Schema.optionalKey(Schema.String),
	/** JSON pointer into the flat document (`""` is the root). */
	path: Schema.String,
	/** Human-readable explanation. */
	message: Schema.String,
}) {
	/**
	 * What to call this finding when rendering it: the check name when the
	 * gate named one, the gate itself otherwise.
	 *
	 * Engine findings do not always carry a keyword, so without this every
	 * consumer that logs findings writes the same `finding.check ?? …`
	 * fallback.
	 */
	get label(): string {
		return this.check ?? this.source;
	}
}

/**
 * Indicates that at least one target's findings blocked under the active
 * gating policy. Carries every blocking finding, so a caller renders one
 * report instead of discovering problems one run at a time.
 *
 * @public
 */
export class SchemaGateError extends Schema.TaggedError<SchemaGateError>()("SchemaGateError", {
	/** The `$id` of the target that failed the gate. */
	$id: Schema.String,
	/** Every finding that blocked, in discovery order. */
	findings: Schema.Array(PipelineFinding),
}) {
	override get message(): string {
		return `Schema "${this.$id}" failed its gate with ${this.findings.length} blocking finding(s)`;
	}
}

/**
 * What the pipeline did with one target.
 *
 * @public
 */
export interface PipelineResult {
	/** The target's `$id`. */
	readonly $id: string;
	/** The path the document was written to (or compared against). */
	readonly path: string;
	/** Whether the file was written. Absent from {@link SchemaPipeline.check}'s results. */
	readonly outcome: WriteOutcome;
	/** What differs between the previous content and the new document. */
	readonly change: WriteChange;
	/**
	 * Every finding, blocking or not — returned as a value, never logged.
	 * The package does not choose your log wording; a run that reached a
	 * result had no blocking findings under the active policy.
	 */
	readonly findings: ReadonlyArray<PipelineFinding>;
}

/**
 * What {@link SchemaPipeline.check} found for one target — the same report
 * without the write.
 *
 * @public
 */
export interface PipelineCheckResult {
	/** The target's `$id`. */
	readonly $id: string;
	/** The path compared against. */
	readonly path: string;
	/** Whether a run would touch this file. */
	readonly wouldWrite: boolean;
	/**
	 * Whether this target's findings would block a {@link SchemaPipeline.run}
	 * under the active policy — so a document that could never be written is
	 * never mistaken for clean drift.
	 */
	readonly blocked: boolean;
	/** What differs between the on-disk content and the new document. */
	readonly change: WriteChange;
	/** Every finding, blocking or not. */
	readonly findings: ReadonlyArray<PipelineFinding>;
}

/**
 * Options for {@link SchemaPipeline.run} and {@link SchemaPipeline.check}.
 *
 * @public
 */
export interface SchemaPipelineOptions {
	/**
	 * Which findings block. Defaults to
	 * `(finding) => finding.severity === "warning"`.
	 *
	 * The default is a policy call, not a mechanism: `UnresolvedRef`,
	 * `UnknownKeyword` and `DepthExceeded` each describe a document that is
	 * broken for the editors it exists to serve, and `UnknownKeyword` is by
	 * construction the ajv-strict rejection set — tolerating it means
	 * shipping something the engine gate rejects. A consumer who disagrees
	 * replaces this predicate rather than re-implementing the loop.
	 *
	 * **Which findings can actually reach you here.** A `SchemaTarget`
	 * carries a `Schema`, so the pipeline's documents come from
	 * `StoreDocument.fromSchema` — and the Draft-07 lowering drops every
	 * keyword outside its copy-list, so an undeclared keyword never
	 * survives to be linted. Through this entry point `UnknownKeyword` is
	 * therefore effectively unreachable, and **the engine gate is what
	 * blocks in practice**. The lint's warning checks earn their keep on
	 * documents this pipeline did not build — a hand-assembled
	 * `StoreDocument.draft07`, or one read back off disk — and on depth,
	 * which a schema can genuinely exceed.
	 */
	readonly blocking?: (finding: PipelineFinding) => boolean;
	/** Passed through to `SchemaValidator.validate`. */
	readonly validator?: SchemaValidatorOptions;
	/** Passed through to `SchemaFile.write` / `SchemaFile.check`. */
	readonly write?: SchemaWriteOptions;
}

const defaultBlocking = (finding: PipelineFinding): boolean => finding.severity === "warning";

// Collect both gates' findings for one target, normalized.
const gather = (
	document: StoreDocument,
	options?: SchemaPipelineOptions,
): Effect.Effect<ReadonlyArray<PipelineFinding>, SchemaValidatorError, SchemaValidator> =>
	Effect.gen(function* () {
		const validator = yield* SchemaValidator;
		const lint = DocumentLint.lint(document).map((finding) =>
			PipelineFinding.make({
				source: "lint",
				severity: finding.severity === "warning" ? "warning" : "advisory",
				check: finding.check,
				path: finding.path,
				message: finding.message,
			}),
		);
		const validation = (yield* validator.validate(document.toJson(), options?.validator)).map((finding) =>
			PipelineFinding.make({
				source: "validator",
				severity: "warning",
				path: finding.path,
				message: finding.message,
				...(finding.keyword !== undefined ? { check: finding.keyword } : {}),
			}),
		);
		return [...lint, ...validation];
	});

const blockingFindings = (
	findings: ReadonlyArray<PipelineFinding>,
	options?: SchemaPipelineOptions,
): ReadonlyArray<PipelineFinding> => findings.filter(options?.blocking ?? defaultBlocking);

const gate = (
	target: SchemaTarget,
	findings: ReadonlyArray<PipelineFinding>,
	options?: SchemaPipelineOptions,
): Effect.Effect<void, SchemaGateError> => {
	const blocking = blockingFindings(findings, options);
	return blocking.length > 0 ? Effect.fail(SchemaGateError.make({ $id: target.$id, findings: blocking })) : Effect.void;
};

/**
 * The emit pipeline over a target manifest: generate, lint, validate, gate,
 * write — the loop every consumer of this package was writing by hand.
 *
 * Requires `SchemaFile` and `SchemaValidator` in `R`; provide
 * `SchemaFile.layer` and `SchemaValidator.layer` (plus a platform
 * `FileSystem` / `Path`) at the edge. Findings come back as **values**, so
 * the package never chooses your log wording — but the gating decision,
 * which is the part that must not silently differ between consumers, has
 * one default and one override point.
 *
 * @example
 * ```ts
 * import { SchemaFile, SchemaPipeline, SchemaTarget, SchemaValidator } from "@effected/schemastore";
 * import { NodeServices } from "@effect/platform-node";
 * import { Effect, Layer, Schema } from "effect";
 *
 * const targets = [
 *   SchemaTarget.make({
 *     schema: Schema.Struct({ name: Schema.String }),
 *     $id: "https://example.com/config.schema.json",
 *     path: "schemas/config.schema.json",
 *   }),
 * ];
 *
 * const program = SchemaPipeline.run(targets).pipe(
 *   Effect.provide(Layer.mergeAll(SchemaFile.layer, SchemaValidator.layer)),
 *   Effect.provide(NodeServices.layer),
 * );
 * ```
 *
 * @public
 */
export class SchemaPipeline {
	private constructor() {}

	/**
	 * Run every target: build its document, gather both gates' findings,
	 * fail with a {@link SchemaGateError} if any block, and write otherwise.
	 *
	 * Targets are processed in order and the run stops at the first gate
	 * failure — a document that fails its gate is not written, and neither
	 * are the targets after it.
	 */
	static run(
		targets: ReadonlyArray<SchemaTarget>,
		options?: SchemaPipelineOptions,
	): Effect.Effect<
		ReadonlyArray<PipelineResult>,
		| SchemaGateError
		| SchemaConversionError
		| SchemaValidatorError
		| CanonicalJsonError
		| SchemaFileReadError
		| SchemaFileWriteError,
		SchemaFile | SchemaValidator
	> {
		return Effect.gen(function* () {
			const files = yield* SchemaFile;
			const results: Array<PipelineResult> = [];
			for (const target of targets) {
				const document = yield* StoreDocument.fromSchema(target.schema, { $id: target.$id });
				const findings = yield* gather(document, options);
				yield* gate(target, findings, options);
				const { outcome, change } = yield* files.write(target.path, document, options?.write);
				results.push({ $id: target.$id, path: target.path, outcome, change, findings });
			}
			return results;
		});
	}

	/**
	 * The same walk with **no writes** — the drift-check counterpart, for a
	 * CI job asserting the committed schemas are current.
	 *
	 * Unlike {@link SchemaPipeline.run} this is **total over the targets**:
	 * it never stops at a failing gate, and reports `blocked` per target
	 * instead of failing. Reporting is the job here, and a repo with three
	 * broken documents should learn that in one run rather than fixing them
	 * one run at a time. A blocked target is still never mistaken for clean
	 * drift — `blocked` says so explicitly.
	 *
	 * The error channel is left to the mechanisms that genuinely cannot
	 * produce a report (generation, serialization, the engine, the read).
	 */
	static check(
		targets: ReadonlyArray<SchemaTarget>,
		options?: SchemaPipelineOptions,
	): Effect.Effect<
		ReadonlyArray<PipelineCheckResult>,
		SchemaConversionError | SchemaValidatorError | CanonicalJsonError | SchemaFileReadError,
		SchemaFile | SchemaValidator
	> {
		return Effect.gen(function* () {
			const files = yield* SchemaFile;
			const results: Array<PipelineCheckResult> = [];
			for (const target of targets) {
				const document = yield* StoreDocument.fromSchema(target.schema, { $id: target.$id });
				const findings = yield* gather(document, options);
				const { wouldWrite, change } = yield* files.check(target.path, document, options?.write);
				results.push({
					$id: target.$id,
					path: target.path,
					wouldWrite,
					blocked: blockingFindings(findings, options).length > 0,
					change,
					findings,
				});
			}
			return results;
		});
	}

	/**
	 * {@link SchemaPipeline.run} for a single target, answering its one
	 * result directly — so a caller with one target does not index into an
	 * array and prove to the type system that element zero exists.
	 */
	static runOne(
		target: SchemaTarget,
		options?: SchemaPipelineOptions,
	): Effect.Effect<
		PipelineResult,
		| SchemaGateError
		| SchemaConversionError
		| SchemaValidatorError
		| CanonicalJsonError
		| SchemaFileReadError
		| SchemaFileWriteError,
		SchemaFile | SchemaValidator
	> {
		return SchemaPipeline.run([target], options).pipe(Effect.map((results) => results[0] as PipelineResult));
	}

	/**
	 * {@link SchemaPipeline.check} for a single target, answering its one
	 * result directly.
	 */
	static checkOne(
		target: SchemaTarget,
		options?: SchemaPipelineOptions,
	): Effect.Effect<
		PipelineCheckResult,
		SchemaConversionError | SchemaValidatorError | CanonicalJsonError | SchemaFileReadError,
		SchemaFile | SchemaValidator
	> {
		return SchemaPipeline.check([target], options).pipe(Effect.map((results) => results[0] as PipelineCheckResult));
	}
}
