import { GlobSet } from "../glob/index.ts";
import { DependencyField } from "../npm/index.ts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ALL_DEPENDENCY_FIELDS } from "./internal/dependencyFields.ts";

const JsonValue = S.fromJsonString(S.Unknown);

const REQUIRED_EDGE = /^\S+ -> \S+$/u;

/** `input` without `keys`, when it is a plain object; anything else passes through for the schema to reject. */
const withoutKeys = (input: unknown, keys: ReadonlyArray<string>): unknown => {
	if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
	return Object.fromEntries(Object.entries(input).filter(([key]) => !keys.includes(key)));
};

/**
 * Raised when a layer policy cannot be read, parsed or decoded.
 *
 * @public
 */
export class LayerPolicyError extends S.TaggedError<LayerPolicyError>()("LayerPolicyError", {
	/** `read`: the file could not be read. `json`: it is not JSON. `decode`: it is not a `LayerPolicy`. */
	reason: S.Literals(["read", "json", "decode"]),
	/** The file, when the policy came from one. */
	path: S.optionalKey(S.String),
	/** The originating failure. */
	cause: S.Defect(),
}) {
	/** Renders the failure kind and the file into one line. */
	override get message(): string {
		const at = this.path === undefined ? "" : ` at ${this.path}`;
		switch (this.reason) {
			case "read":
				return `Could not read the layer policy${at}`;
			case "json":
				return `The layer policy${at} is not valid JSON`;
			default: {
				// The schema issue names every offending key and field; a bare "wrong shape" sends the reader hunting.
				const detail = this.cause instanceof Error && this.cause.message !== "" ? `: ${this.cause.message}` : "";
				return `The layer policy${at} does not match the LayerPolicy shape${detail}`;
			}
		}
	}
}

/**
 * A committed dependency-layering policy (`layers.json`).
 *
 * @remarks
 * `layers` is top-down: an edge may only point from a layer to one BELOW it
 * (a higher index), or into `tooling`. `tooling` packages may depend on each
 * other but never reach a layer. `unconstrained` holds globs (through
 * `@effected/glob`) for packages whose own edges are not checked (a test
 * harness, the private root). `fields` narrows which dependency maps count,
 * defaulting to all four. `requiredEdges` (`"a -> b"`) are edges that must
 * exist in a checked field: the non-vacuity guard against a discovery that
 * quietly drops real edges.
 *
 * Every entry matches a package's `name`, never its `relativePath`: `layers`
 * and `tooling` list exact names, and `unconstrained` globs match names. A
 * private root named `my-monorepo` at `relativePath` `"."` is classified as
 * `"my-monorepo"`; an entry of `"."` or `"packages/*"` classifies nothing.
 *
 * Decoding is strict: a key the policy does not model fails `decode`, and the
 * message names every such key. A typo on an optional key would otherwise be
 * silently dropped: `requiredEdge` would remove the non-vacuity guard and
 * leave the report green. `$schema` is always accepted. A file that carries
 * keys of its own, such as a `harness` block, passes them in `allowKeys`.
 *
 * @example
 * ```ts
 * import { NodeServices } from "@effect/platform-node";
 * import { LayerPolicy } from "./testing.ts";
 * import { Effect } from "effect";
 *
 * const policy = LayerPolicy.load("/repo/layers.json").pipe(Effect.provide(NodeServices.layer));
 * ```
 *
 * @public
 */
export class LayerPolicy extends S.Class<LayerPolicy>("LayerPolicy")({
	/** Exact package names (never relative paths) per layer, top layer first. */
	layers: S.String.pipe(S.Array, S.Array),
	/** Exact package names (never relative paths) any layer may depend on that never depend on a layer. */
	tooling: S.Array(S.String),
	/** Globs matched against package names (never relative paths) for packages whose own edges are not checked. */
	unconstrained: S.Array(S.String).check(
		S.makeFilter((patterns) => Result.isSuccess(GlobSet.compileResult(patterns)), {
			title: "compilable glob patterns",
		}),
	),
	/** The dependency maps to check. Absent means all four. */
	fields: DependencyField.pipe(S.Array, S.optionalKey),
	/** Edges that must exist, written `"a -> b"`. */
	requiredEdges: S.String.check(S.isPattern(REQUIRED_EDGE)).pipe(S.Array, S.optionalKey),
}) {
	/** The dependency maps a check reads: `fields`, or all four. */
	get effectiveFields(): ReadonlyArray<DependencyField> {
		return this.fields ?? ALL_DEPENDENCY_FIELDS;
	}

	/**
	 * Decode a policy from a parsed JSON value.
	 *
	 * @remarks
	 * Every key the policy does not model fails, except `$schema` and the
	 * keys named in `options.allowKeys`, which are dropped before decoding.
	 * `options.path` names the file in the error.
	 */
	static readonly decode = Effect.fn("LayerPolicy.decode")(
		(
			input: unknown,
			options?: { readonly path?: string | undefined; readonly allowKeys?: ReadonlyArray<string> | undefined },
		): Effect.Effect<LayerPolicy, LayerPolicyError> => {
			const path = options?.path;
			return S.decodeUnknownEffect(LayerPolicy)(withoutKeys(input, ["$schema", ...(options?.allowKeys ?? [])]), {
				onExcessProperty: "error",
				errors: "all",
			}).pipe(
				Effect.mapError(
					(cause) => LayerPolicyError.make({ reason: "decode", cause, ...(path === undefined ? {} : { path }) }),
				),
			);
		},
	);

	/** Read, parse and decode the policy file at `path`; `options.allowKeys` is passed to `decode`. */
	static readonly load = Effect.fn("LayerPolicy.load")(function* (
		path: string,
		options?: { readonly allowKeys?: ReadonlyArray<string> | undefined },
	) {
		const fs = yield* FileSystem.FileSystem;
		const text = yield* fs
			.readFileString(path)
			.pipe(Effect.mapError((cause) => LayerPolicyError.make({ reason: "read", path, cause })));
		const json = yield* S.decodeEffect(JsonValue)(text).pipe(Effect.mapError((cause) => LayerPolicyError.make({ reason: "json", path, cause })));
		return yield* LayerPolicy.decode(json, { path, allowKeys: options?.allowKeys });
	});
}
