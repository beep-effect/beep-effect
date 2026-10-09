// The `PackageValidator` service: validate a `Package` against a set of
// `ValidationRule`s, aggregating every failure into one
// `PackageValidationError`. Ships `PackageValidator.layer` (the default rule
// set) and the genuinely-parameterized `PackageValidator.layerRules` factory.

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { Package } from "./Package.ts";

const $I = $ScratchpadId.create("effected/package-json/PackageValidator");

/**
 * A single validation-rule failure.
 *
 * **Example** (Constructing a rule failure)
 *
 * ```ts
 * import { RuleFailure } from "./index.ts";
 * import * as O from "effect/Option";
 * import * as S from "effect/Schema";
 *
 * const failure: RuleFailure = { message: "Missing license field", path: O.some("license") };
 * S.is(RuleFailure)(failure); // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 * @public
 */
export const RuleFailure = S.Struct({
	message: S.String.annotateKey({ description: "A human-readable description of the failure." }),
	path: S.Option(S.String).annotateKey({ description: "The JSON path where the failure occurred, or None when not applicable." }),
}).annotate($I.annote("RuleFailure", { description: "A validation-rule failure with its message and optional JSON path." }));

/** A plain-object validation failure described by {@link RuleFailure}. */
export type RuleFailure = typeof RuleFailure.Type;

/**
 * A single validation rule: a name and a check that fails with a
 * {@link RuleFailure}.
 *
 * @public
 */
export interface ValidationRule {
	/** The rule identifier (e.g. `has-license`). */
	readonly name: string;
	/** The check — succeeds or fails with a {@link RuleFailure}. */
	readonly validate: (pkg: Package) => Effect.Effect<void, RuleFailure>;
}

/**
 * Indicates that a {@link Package} failed one or more validation rules.
 *
 * Raised by {@link PackageValidator}. Every rule failure is aggregated on
 * `failures`; the `message` getter renders a multi-line report.
 *
 * @public
 */
export class PackageValidationError extends S.TaggedError<PackageValidationError>($I`PackageValidationError`)("PackageValidationError", {
	/** The aggregated rule failures. */
	failures: S.Array(
		S.Struct({
			rule: S.String,
			message: S.String,
			path: S.Option(S.String),
		}),
	).annotateKey({ description: "The aggregated rule failures." }),
}, $I.annote("PackageValidationError", { description: "Indicates that a Package failed one or more validation rules." })) {
	override get message(): string {
		const lines = A.map(this.failures, (failure) => {
			const path = O.match(failure.path, { onNone: () => "", onSome: (value) => ` (at ${value})` });
			return `  - [${failure.rule}]${path}: ${failure.message}`;
		});
		return `package.json validation failed:\n${A.join(lines, "\n")}`;
	}
}

// ── Default rules ─────────────────────────────────────────────────────────────

const hasLicense: ValidationRule = {
	name: "has-license",
	validate: (pkg) =>
		pkg.license !== undefined
			? Effect.void
			: Effect.fail({ message: "Missing license field", path: O.some("license") }),
};

const hasDescription: ValidationRule = {
	name: "has-description",
	validate: (pkg) =>
		pkg.description !== undefined
			? Effect.void
			: Effect.fail({ message: "Missing description field", path: O.some("description") }),
};

const hasRepository: ValidationRule = {
	name: "has-repository",
	// `repository` is a modeled field, so it is read directly rather than from `pkg.rest`.
	validate: (pkg) =>
		pkg.repository !== undefined
			? Effect.void
			: Effect.fail({ message: "Missing repository field", path: O.some("repository") }),
};

const notPrivate: ValidationRule = {
	name: "not-private",
	validate: (pkg) =>
		pkg.isPrivate ? Effect.fail({ message: "Package is private", path: O.some("private") }) : Effect.void,
};

const anyDependencyMatches = (pkg: Package, predicate: (specifier: string) => boolean): boolean =>
	A.some([pkg.dependencies, pkg.devDependencies, pkg.peerDependencies, pkg.optionalDependencies], (map) =>
		map.pipe(HashMap.values, A.fromIterable, A.some(predicate)),
	);

/**
 * A rule that fails when any dependency uses an unresolved `workspace:` or
 * `catalog:` specifier.
 *
 * @public
 */
export const noUnresolvedDepsRule: ValidationRule = {
	name: "no-unresolved-deps",
	validate: (pkg) =>
		anyDependencyMatches(pkg, (specifier) => specifier.startsWith("workspace:") || specifier.startsWith("catalog:"))
			? Effect.fail({ message: "Unresolved workspace:/catalog: dependency", path: O.none() })
			: Effect.void,
};

/**
 * A rule that fails when any dependency uses a local `file:`, `link:` or
 * `portal:` specifier.
 *
 * @public
 */
export const noLocalDepsRule: ValidationRule = {
	name: "no-local-deps",
	validate: (pkg) =>
		anyDependencyMatches(
			pkg,
			(specifier) => specifier.startsWith("file:") || specifier.startsWith("link:") || specifier.startsWith("portal:"),
		)
			? Effect.fail({ message: "Local file:/link:/portal: dependency", path: O.none() })
			: Effect.void,
};

/**
 * The default validation rules: license, description, repository and
 * not-private.
 *
 * @public
 */
export const defaultRules: ReadonlyArray<ValidationRule> = [hasLicense, hasDescription, hasRepository, notPrivate];

const runRules = Effect.fn("PackageValidator.validate")(function* (pkg: Package, rules: ReadonlyArray<ValidationRule>) {
	const failures: Array<{ readonly rule: string; readonly message: string; readonly path: O.Option<string> }> = [];
	for (const rule of rules) {
		const result = yield* Effect.result(rule.validate(pkg));
		if (Result.isFailure(result)) {
			failures.push({ rule: rule.name, message: result.failure.message, path: result.failure.path });
		}
	}
	if (failures.length > 0) {
		return yield* PackageValidationError.make({ failures });
	}
});

/**
 * Validates a {@link Package} against a set of {@link ValidationRule}s,
 * aggregating every failure into one {@link PackageValidationError}. Use
 * `PackageValidator.layer` for {@link defaultRules} or `PackageValidator.layerRules`
 * for a custom rule set.
 *
 * **Example** (Reject a package missing default validation requirements)
 *
 * ```ts
 * import { Package, PackageValidator } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const pkg = yield* Package.decode({ name: "my-pkg", version: "1.0.0" });
 *   const validator = yield* PackageValidator;
 *   yield* validator.validate(pkg);
 * }).pipe(Effect.provide(PackageValidator.layer));
 * // fails with PackageValidationError: the default rules require a license,
 * // a description and a repository, and forbid `private: true`
 * ```
 *
 * @public
 */
export class PackageValidator extends Context.Service<
	PackageValidator,
	{ readonly validate: (pkg: Package) => Effect.Effect<void, PackageValidationError> }
>()($I`PackageValidator`) {
	/** The default layer, backed by {@link defaultRules}. */
	static readonly layer: Layer.Layer<PackageValidator> = Layer.succeed(PackageValidator, {
		validate: Effect.fn("PackageValidator.validate")((pkg) => runRules(pkg, defaultRules)),
	});

	/**
	 * Build a layer from a custom set of rules (a genuinely-parameterized factory).
	 *
	 * @param config - the rule set to validate against, replacing {@link defaultRules}
	 * @returns a layer providing `PackageValidator` backed by `config.rules`
	 */
	static layerRules(config: { readonly rules: ReadonlyArray<ValidationRule> }): Layer.Layer<PackageValidator> {
		return Layer.succeed(PackageValidator, {
			validate: Effect.fn("PackageValidator.validate")((pkg) => runRules(pkg, config.rules)),
		});
	}
}
