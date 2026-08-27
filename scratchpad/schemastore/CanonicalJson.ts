import { Effect, Result, Schema } from "effect";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";

/**
 * Indicates that a value reachable from the serialization input is not a
 * JSON value: `undefined`, a function, a symbol, a `bigint`, a non-finite
 * number, or an object that is neither an array nor a plain object.
 *
 * Raised by {@link CanonicalJson.serialize}. Unlike `JSON.stringify` — which
 * silently drops `undefined` members and rewrites `NaN`/`Infinity` to
 * `null` — canonical serialization refuses to alter the document, so every
 * non-JSON value is a typed failure carrying the path to fix.
 *
 * @public
 */
export class NonJsonValueError extends Schema.TaggedError<NonJsonValueError>()("NonJsonValueError", {
	/** JSON pointer to the offending value (`""` is the document root). */
	path: Schema.String,
	/** The `typeof`/structural description of the rejected value. */
	found: Schema.String,
}) {
	override get message(): string {
		return `Non-JSON value (${this.found}) at "${this.path}"`;
	}
}

/**
 * Indicates that the serialization input nests deeper than the package's
 * hardening cap (256 levels), which also intercepts cyclic values before
 * they can recurse forever.
 *
 * Raised by {@link CanonicalJson.serialize}.
 *
 * @public
 */
export class JsonDepthExceededError extends Schema.TaggedError<JsonDepthExceededError>()("JsonDepthExceededError", {
	/** JSON pointer to the node where the cap was hit. */
	path: Schema.String,
	/** The nesting cap that was exceeded. */
	maxDepth: Schema.Number,
}) {
	override get message(): string {
		return `JSON nesting exceeds ${this.maxDepth} levels at "${this.path}"`;
	}
}

/**
 * Union of the failures {@link CanonicalJson.serialize} can raise.
 *
 * @public
 */
export type CanonicalJsonError = NonJsonValueError | JsonDepthExceededError;

/**
 * Options for {@link CanonicalJson.serialize}.
 *
 * @public
 */
export interface CanonicalJsonOptions {
	/**
	 * Indentation unit: `"tab"` (the default, matching the repo formatter
	 * convention the extraction source committed its files under) or a
	 * space count — a non-negative integer (`0` emits multi-line output
	 * with no leading indentation). Counts above 10 are honored as given,
	 * deliberately diverging from `JSON.stringify`'s silent clamp to 10.
	 * A negative or fractional count is a wiring mistake and throws (the
	 * serializer alters nothing silently — not even its own options).
	 */
	readonly indent?: "tab" | number;
}

// Internal throw carrier so the single recursive emitter can surface either
// typed error from arbitrary depth without threading Results through the walk.
class SerializeFailure {
  readonly error: CanonicalJsonError
	constructor(error: CanonicalJsonError) {
    this.error = error;
  }
}

const escapePointerSegment = (segment: string): string => segment.replace(/~/g, "~0").replace(/\//g, "~1");

/**
 * Deterministic, canonical JSON text: the package's owned serializer, so a
 * consumer never shells out to an external formatter to produce a stable
 * committed schema file.
 *
 * The canonical form is fully specified: object keys in insertion order
 * (document assembly owns meaningful ordering — keys are never sorted),
 * every array element and object member on its own line, the configured
 * indent (tab by default), `"` string escaping exactly as `JSON.stringify`
 * produces it, LF line endings and a single trailing newline. Equal inputs
 * serialize to equal bytes.
 *
 * Values that are not JSON fail typed rather than being silently rewritten
 * (see {@link NonJsonValueError}); nesting past the hardening cap — which
 * includes cyclic values — fails with {@link JsonDepthExceededError}.
 *
 * @public
 */
export class CanonicalJson {
	private constructor() {}

	/**
	 * Serializes `value` to canonical JSON text. Pure and synchronous — the
	 * primitive form; {@link CanonicalJson.serialize} is the same engine
	 * behind a span.
	 */
	static serializeResult(value: unknown, options?: CanonicalJsonOptions): Result.Result<string, CanonicalJsonError> {
		const unit = options?.indent === undefined || options.indent === "tab" ? "\t" : indentUnit(options.indent);
		try {
			return Result.succeed(`${emit(value, "", 0, unit)}\n`);
		} catch (cause) {
			if (cause instanceof SerializeFailure) {
				return Result.fail(cause.error);
			}
			throw cause;
		}
	}

	/**
	 * Effect form of {@link CanonicalJson.serializeResult}, adding only the
	 * `CanonicalJson.serialize` span. Defined in terms of the `Result`
	 * primitive — synchronous callers can use that variant directly.
	 */
	static readonly serialize = Effect.fn("CanonicalJson.serialize")(
		(value: unknown, options?: CanonicalJsonOptions): Effect.Effect<string, CanonicalJsonError> =>
			Effect.fromResult(CanonicalJson.serializeResult(value, options)),
	);
}

// A numeric indent must be a non-negative integer: `" ".repeat` throws a
// bare RangeError on negatives and silently floors fractions — both are
// wiring mistakes (an option, not document data), so they throw with a
// message naming the contract rather than failing typed or being rewritten.
const indentUnit = (indent: number): string => {
	if (!Number.isInteger(indent) || indent < 0) {
		throw new Error(`indent must be "tab" or a non-negative integer space count, got ${indent}`);
	}
	return " ".repeat(indent);
};

const emit = (value: unknown, path: string, depth: number, unit: string): string => {
	if (value === null) {
		return "null";
	}
	switch (typeof value) {
		case "boolean":
			return value ? "true" : "false";
		case "number": {
			if (!Number.isFinite(value)) {
				throw new SerializeFailure(NonJsonValueError.make({ path, found: String(value) }));
			}
			return JSON.stringify(value);
		}
		case "string":
			return JSON.stringify(value);
		case "object":
			break;
		default:
			throw new SerializeFailure(NonJsonValueError.make({ path, found: typeof value }));
	}
	if (depth >= MAX_NESTING_DEPTH) {
		throw new SerializeFailure(JsonDepthExceededError.make({ path, maxDepth: MAX_NESTING_DEPTH }));
	}
	const indent = unit.repeat(depth + 1);
	const closing = unit.repeat(depth);
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return "[]";
		}
		const items = value.map((item, index) => `${indent}${emit(item, `${path}/${index}`, depth + 1, unit)}`);
		return `[\n${items.join(",\n")}\n${closing}]`;
	}
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) {
		throw new SerializeFailure(NonJsonValueError.make({ path, found: "non-plain object" }));
	}
	const entries = Object.entries(value as Record<string, unknown>);
	if (entries.length === 0) {
		return "{}";
	}
	const members = entries.map(
		([key, member]) =>
			`${indent}${JSON.stringify(key)}: ${emit(member, `${path}/${escapePointerSegment(key)}`, depth + 1, unit)}`,
	);
	return `{\n${members.join(",\n")}\n${closing}}`;
};
