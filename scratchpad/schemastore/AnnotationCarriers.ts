import { Effect, Result, Schema } from "effect";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { KeywordFamilies } from "./KeywordFamilies.ts";

/**
 * Indicates that the carrier re-graft walk nested past the package's
 * hardening cap (256 levels), which also intercepts cyclic inputs before
 * they can recurse forever.
 *
 * Raised by {@link AnnotationCarriers.carry}.
 *
 * @public
 */
export class CarrierDepthExceededError extends Schema.TaggedError<CarrierDepthExceededError>()(
	"CarrierDepthExceededError",
	{
		/** JSON pointer (in the lowered document's coordinates) where the cap was hit. */
		path: Schema.String,
		/** The nesting cap that was exceeded. */
		maxDepth: Schema.Number,
	},
) {
	override get message(): string {
		return `Carrier re-graft nesting exceeds ${this.maxDepth} levels at "${this.path}"`;
	}
}

// Internal throw carrier so the recursive walk can surface the typed error
// from arbitrary depth without threading Results through every frame.
class CarryFailure {
  readonly error: CarrierDepthExceededError;
	constructor(error: CarrierDepthExceededError) {
    this.error = error;
  }
}

const escapePointerSegment = (segment: string): string => segment.replace(/~/g, "~0").replace(/\//g, "~1");

const isSchemaObject = (node: unknown): node is Record<string, unknown> =>
	typeof node === "object" && node !== null && !Array.isArray(node);

// Grafts one schema-map member (`properties` / `patternProperties`): every
// member the source and target share is grafted; members only one side has
// pass through untouched.
const graftMap = (source: unknown, target: unknown, path: string, depth: number): unknown => {
	if (!isSchemaObject(source) || !isSchemaObject(target)) {
		return target;
	}
	const out: Record<string, unknown> = { ...target };
	for (const [name, subschema] of Object.entries(source)) {
		if (Object.hasOwn(target, name)) {
			out[name] = graft(subschema, target[name], `${path}/${escapePointerSegment(name)}`, depth + 1);
		}
	}
	return out;
};

// Grafts parallel schema arrays (`allOf` / `anyOf` / `oneOf`, and the
// tuple `prefixItems` → `items` pairing) element-wise by index.
const graftArray = (source: unknown, target: unknown, path: string, depth: number): unknown => {
	if (!Array.isArray(source) || !Array.isArray(target)) {
		return target;
	}
	return target.map((element, index) =>
		index < source.length ? graft(source[index], element, `${path}/${index}`, depth + 1) : element,
	);
};

// The parallel walk. Mirrors core's `toSchemaDraft07` keyword walk exactly:
// it descends only where the lowering descends, and maps the one position
// the lowering moves — Draft 2020-12 `prefixItems` becomes the Draft-07
// `items` array (with a trailing `items` schema becoming `additionalItems`).
// Positions the lowering drops entirely are never visited, so a carrier on
// such a node is not carried (core's generator does not emit those
// positions, so this is unreachable from the real pipeline).
const graft = (source: unknown, target: unknown, path: string, depth: number): unknown => {
	if (depth >= MAX_NESTING_DEPTH) {
		throw new CarryFailure(CarrierDepthExceededError.make({ path, maxDepth: MAX_NESTING_DEPTH }));
	}
	if (!isSchemaObject(source) || !isSchemaObject(target)) {
		return target;
	}
	const out: Record<string, unknown> = { ...target };
	for (const [key, value] of Object.entries(source)) {
		if (KeywordFamilies.isDeclared(key)) {
			out[key] = value;
			continue;
		}
		const keyPath = `${path}/${escapePointerSegment(key)}`;
		switch (key) {
			case "properties":
			case "patternProperties":
				if (Object.hasOwn(out, key)) {
					out[key] = graftMap(value, out[key], keyPath, depth);
				}
				break;
			case "additionalProperties":
			case "propertyNames":
				if (Object.hasOwn(out, key)) {
					out[key] = graft(value, out[key], keyPath, depth + 1);
				}
				break;
			case "allOf":
			case "anyOf":
			case "oneOf":
				if (Object.hasOwn(out, key)) {
					out[key] = graftArray(value, out[key], keyPath, depth);
				}
				break;
			case "prefixItems":
				// The lowering rewrites 2020-12 tuples: an array `prefixItems`
				// becomes the Draft-07 `items` array; a (non-standard) single
				// schema becomes a single `items` schema.
				if (Object.hasOwn(out, "items")) {
					out.items = Array.isArray(value)
						? graftArray(value, out.items, `${path}/items`, depth)
						: graft(value, out.items, `${path}/items`, depth + 1);
				}
				break;
			case "items":
				// With `prefixItems` present the trailing `items` schema became
				// Draft-07 `additionalItems`; otherwise `items` stayed `items`.
				if (Object.hasOwn(source, "prefixItems")) {
					if (Object.hasOwn(out, "additionalItems")) {
						out.additionalItems = graft(value, out.additionalItems, `${path}/additionalItems`, depth + 1);
					}
				} else if (Object.hasOwn(out, "items")) {
					out.items = graft(value, out.items, keyPath, depth + 1);
				}
				break;
			default:
				// Copied-through leaves (`type`, `enum`, `pattern`, ...) carry
				// no subschemas, and everything else the lowering drops.
				break;
		}
	}
	return out;
};

/**
 * Re-grafts the declared non-standard keyword families
 * ({@link KeywordFamilies}) from a Draft 2020-12 schema node onto its
 * lowered Draft-07 counterpart.
 *
 * Why this exists: annotation keys admitted into the Draft 2020-12 document
 * (core's `includeAnnotationKey`) are **dropped by core's Draft-07 lowering**,
 * whose keyword walk copies a fixed subset — verified against the installed
 * beta. Carrying `x-taplo`, `x-tombi-*`, `x-intellij-*` or the vscode set
 * into an emitted SchemaStore document therefore requires this post-lowering
 * step; it cannot ride `ToJsonSchemaOptions` alone.
 *
 * The walk mirrors the lowering's own structural rules, so every carrier
 * lands on the node the annotation was attached to — including the one
 * coordinate move the lowering makes (2020-12 `prefixItems[i]` → Draft-07
 * `items[i]`, trailing `items` → `additionalItems`). Only declared-family
 * keys are copied; nothing else about the target changes.
 *
 * `StoreDocument.fromSchema` applies this automatically to the root schema
 * and every `$defs` pool entry — annotate a schema node
 * (`Schema.String.annotate({ "x-taplo": { hidden: true } })`) and the key
 * appears in the built document. Call this directly only when driving core's
 * pipeline yourself.
 *
 * Know the boundary (core behavior, probed at the installed beta): an
 * annotation must sit on the schema **definition** node. Annotating a
 * hoisted (identifier-carrying) schema at its *usage* site — e.g.
 * `Person.annotate({...})` inside a struct field — reaches neither the
 * `$ref` node nor the pool entry, even in the 2020-12 document, so there is
 * nothing to carry.
 *
 * @public
 */
export class AnnotationCarriers {
	private constructor() {}

	/**
	 * Grafts declared-family keys from `source` (a Draft 2020-12 schema
	 * node) onto `target` (its lowered Draft-07 counterpart), returning a
	 * new node. Pure and synchronous — the primitive form;
	 * {@link AnnotationCarriers.carry} is the same walk behind a span.
	 */
	static carryResult(source: unknown, target: unknown): Result.Result<unknown, CarrierDepthExceededError> {
		try {
			return Result.succeed(graft(source, target, "", 0));
		} catch (cause) {
			if (cause instanceof CarryFailure) {
				return Result.fail(cause.error);
			}
			throw cause;
		}
	}

	/**
	 * Effect form of {@link AnnotationCarriers.carryResult}, adding only the
	 * `AnnotationCarriers.carry` span. Defined in terms of the `Result`
	 * primitive — synchronous callers can use that variant directly.
	 */
	static readonly carry = Effect.fn("AnnotationCarriers.carry")(
		(source: unknown, target: unknown): Effect.Effect<unknown, CarrierDepthExceededError> =>
			Effect.fromResult(AnnotationCarriers.carryResult(source, target)),
	);
}
