/**
 * Closed ajv validation for SchemaStore documents; findings are values.
 *
 * Document rejection is a {@link ValidationFinding} list. The error channel
 * is reserved for the engine failing as a mechanism.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import type { ErrorObject } from "ajv";
import { Ajv } from "ajv";
import { Context, Effect, Layer, Schema } from "effect";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { KeywordFamilies } from "./KeywordFamilies.ts";

const $I = $ScratchpadId.create("schemastore/SchemaValidator");

/**
 * Indicates that the validation engine behind the {@link SchemaValidator}
 * contract failed as a *mechanism* — it could not run at all.
 *
 * By convention the error channel is reserved for exactly that: a document
 * that fails the engine's gate is a {@link ValidationFinding} list (a
 * value), never an error. Raised by implementations of
 * {@link SchemaValidatorShape.validate}.
 *
 * **Example** (Construct a mechanism failure)
 *
 * ```ts
 * import { SchemaValidatorError } from "@beep/scratchpad/schemastore"
 *
 * const error = SchemaValidatorError.make({ cause: "ajv failed to start" })
 *
 * console.log(error._tag)
 * // => "SchemaValidatorError"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SchemaValidatorError extends Schema.TaggedError<SchemaValidatorError>($I`SchemaValidatorError`)(
	"SchemaValidatorError",
	{
		/** The underlying engine failure, preserved structurally. */
		cause: Schema.Defect(),
	},
	$I.annote("SchemaValidatorError", {
		description:
			"Raised when the JSON Schema validation engine fails as a mechanism and cannot produce findings.",
	}),
) {
	override get message(): string {
		return "Schema validation engine failed";
	}
}

/**
 * One problem a validation engine found with a document: a value in a
 * report, never an error channel — the consumer decides what a finding
 * gates.
 *
 * **Example** (Construct a validator finding)
 *
 * ```ts
 * import { ValidationFinding } from "@beep/scratchpad/schemastore"
 *
 * const finding = ValidationFinding.make({
 *   path: "/type",
 *   message: "must be object",
 *   keyword: "type",
 * })
 *
 * console.log(finding.keyword)
 * // => "type"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ValidationFinding extends Schema.Class<ValidationFinding>($I`ValidationFinding`)(
	{
		/** JSON pointer into the flat document (`""` is the root schema). */
		path: Schema.String,
		/** Human-readable explanation from the engine. */
		message: Schema.String,
		/** The JSON Schema keyword the finding is about, when the engine names one. */
		keyword: Schema.optionalKey(Schema.String),
	},
	$I.annote("ValidationFinding", {
		description:
			"One problem a JSON Schema engine found with a document: a report value, never an error channel.",
	}),
) {}

/**
 * Options for {@link SchemaValidatorShape.validate}.
 *
 * @see {@link SchemaValidatorShape.validate} for the operation these options configure.
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface SchemaValidatorOptions {
	/**
	 * Whether the engine runs its strictest mode (ajv `strict: true` — the
	 * SchemaStore default gate). Defaults to `true`; implementations treat
	 * an omitted value as strict.
	 */
	readonly strict?: boolean;
}

/**
 * The shape of the {@link SchemaValidator} service — what an implementation
 * provides.
 *
 * @see {@link SchemaValidator} for the service that carries this shape.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface SchemaValidatorShape {
	/**
	 * Validates a flat schema document (each `ValidationFinding.path`
	 * pointer addresses `StoreDocument.toJson()`'s shape) with a real JSON
	 * Schema engine. An empty array is a clean pass; a document the engine
	 * rejects — including an ajv strict-mode compile failure — answers
	 * findings as values. The error channel is reserved for the engine
	 * failing as a mechanism ({@link SchemaValidatorError}).
	 */
	readonly validate: (
		document: Record<string, unknown>,
		options?: SchemaValidatorOptions,
	) => Effect.Effect<ReadonlyArray<ValidationFinding>, SchemaValidatorError>;
}

// ajv strict mode rejects any keyword it does not know, which would fail
// every document carrying a declared language-server family — exactly the
// keywords `DocumentLint` deliberately allows. Registering them keeps the
// engine's verdict consistent with the owned lint's, through the same
// `KeywordFamilies` predicate, so the two cannot drift.
const collectDeclaredKeywords = (node: unknown, into: Set<string>, depth: number): void => {
	if (depth >= MAX_NESTING_DEPTH || typeof node !== "object" || node === null) {
		return;
	}
	if (Array.isArray(node)) {
		for (const element of node) {
			collectDeclaredKeywords(element, into, depth + 1);
		}
		return;
	}
	for (const [key, value] of Object.entries(node)) {
		if (KeywordFamilies.isDeclared(key)) {
			into.add(key);
		}
		collectDeclaredKeywords(value, into, depth + 1);
	}
};

const findingFromAjvError = (error: ErrorObject): ValidationFinding =>
	ValidationFinding.make({
		// ajv's `instancePath` is already a JSON pointer into the value it
		// validated — here, the flat document itself.
		path: error.instancePath,
		message: error.message ?? "schema is not valid",
		keyword: error.keyword,
	});

/** The default for an unstubbed {@link SchemaValidator.makeTest} member. */
const notStubbed = (method: string) => () =>
	Effect.die(
		new Error(
			`SchemaValidator.makeTest: ${method}() was called but not stubbed — no honest default exists for a test double; pass a \`${method}\` override.`,
		),
	);

/**
 * Real-engine JSON Schema document validation, closed by default over ajv —
 * the engine SchemaStore's own gate is defined in terms of.
 *
 * {@link SchemaValidator.layer} is the shipped implementation: provide it and
 * validation works, with no adapter to write. The service stays an interface
 * so a test can swap it ({@link SchemaValidator.layerTest}) or skip it
 * ({@link SchemaValidator.noop}), and so a consumer standardized on a
 * different engine can substitute one — but writing an adapter is no longer
 * the price of admission. `DocumentLint` remains the owned, engine-free
 * structural half of the validation story, and answers questions ajv does
 * not (SchemaStore's own hygiene conventions).
 *
 * The shipped layer registers every declared {@link KeywordFamilies} keyword
 * present in the document before compiling, so ajv strict mode does not
 * reject the language-server families `DocumentLint` deliberately allows —
 * one predicate governs both verdicts.
 *
 * **Gotchas**
 *
 * A document the engine rejects is a {@link ValidationFinding} list, not
 * {@link SchemaValidatorError}. {@link SchemaValidator.makeTest} **dies** if
 * `validate` is unstubbed — there is no honest default; use
 * {@link SchemaValidator.noop} for an always-clean layer. The shipped layer
 * registers {@link KeywordFamilies} keywords present in the document before
 * compile so ajv strict mode does not reject language-server keys.
 *
 * **Example** (Validate a trivial object schema)
 *
 * ```ts
 * import { SchemaValidator } from "@beep/scratchpad/schemastore"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const validator = yield* SchemaValidator
 *   return yield* validator.validate({ type: "object" })
 * })
 *
 * Effect.runPromise(Effect.provide(program, SchemaValidator.layer)).then((result) => console.log(result))
 * // => []
 * ```
 *
 * @see {@link SchemaValidator.noop} for the always-clean layer that skips the engine.
 * @see {@link SchemaValidator.layerTest} for the die-unless-stubbed test double.
 * @see {@link DocumentLint} for the engine-free structural half of validation.
 * @see {@link KeywordFamilies} for the declared keywords registered before ajv compile.
 * @public
 * @category services
 * @since 0.0.0
 */
export class SchemaValidator extends Context.Service<SchemaValidator, SchemaValidatorShape>()(
	"@effected/schemastore/SchemaValidator",
) {
	/**
	 * The shipped ajv implementation — the default a consumer provides.
	 *
	 * `validate` checks the document against the Draft-07 meta-schema and
	 * then compiles it, reporting BOTH as {@link ValidationFinding} values:
	 * meta-schema failures keep ajv's structured `instancePath` and
	 * `keyword`, while a strict-mode rejection (which ajv raises by throwing
	 * at compile time) becomes a root-pathed finding. The error channel
	 * stays reserved for the engine failing as a mechanism.
	 *
	 * `strict` defaults to `true` — SchemaStore's gate. Each call builds its
	 * own ajv instance, so documents sharing an `$id` never collide.
	 */
	static readonly layer: Layer.Layer<SchemaValidator> = Layer.succeed(SchemaValidator, {
		validate: (document, options) =>
			Effect.try({
				try: () => {
					const ajv = new Ajv({ strict: options?.strict ?? true, allErrors: true });
					const declared = new Set<string>();
					collectDeclaredKeywords(document, declared, 0);
					for (const keyword of declared) {
						ajv.addKeyword({ keyword });
					}
					if (ajv.validateSchema(document) === false) {
						return (ajv.errors ?? []).map(findingFromAjvError);
					}
					try {
						ajv.compile(document);
					} catch (cause) {
						// Strict mode reports by throwing; the message is all
						// the structure ajv gives us on this path.
						return [
							ValidationFinding.make({
								path: "",
								message: cause instanceof Error ? cause.message : String(cause),
							}),
						];
					}
					return [];
				},
				catch: (cause) => SchemaValidatorError.make({ cause }),
			}),
	});

	/**
	 * No-op: `validate` always succeeds with no findings, never consulting an
	 * engine. A pure `Layer.succeed`, bound to a const so the layer memoizes
	 * by reference. Use it to switch validation off deliberately — for the
	 * real engine, provide {@link SchemaValidator.layer}.
	 */
	static readonly noop: Layer.Layer<SchemaValidator> = Layer.succeed(SchemaValidator, {
		validate: () => Effect.succeed([]),
	});

	/**
	 * An in-memory double: stub only the members the test exercises; every
	 * other member **dies** with a defect naming itself. No member has an
	 * honest default — a fabricated clean pass would leak into consumer
	 * logic as fact (use {@link SchemaValidator.noop} when a test genuinely
	 * wants an always-clean validator).
	 */
	static readonly makeTest = (overrides: Partial<SchemaValidatorShape> = {}): SchemaValidatorShape => ({
		validate: notStubbed("validate"),
		...overrides,
	});

	/** {@link SchemaValidator.makeTest} behind `Layer.succeed`. */
	static readonly layerTest = (overrides: Partial<SchemaValidatorShape> = {}): Layer.Layer<SchemaValidator> =>
		Layer.succeed(SchemaValidator, SchemaValidator.makeTest(overrides));
}
