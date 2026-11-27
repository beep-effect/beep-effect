/**
 * The `PackageValidator` service: validate a `Package` against a set of
 * `ValidationRule`s, aggregating every failure into one
 * `PackageValidationError`. Ships `PackageValidator.layer` (the default rule
 * set) and the genuinely-parameterized `PackageValidator.layerRules` factory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PackageJsonId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Package } from "./Package.ts";

const $I = $PackageJsonId.create("PackageValidator");

/**
 * **Example** (Constructing a rule failure)
 *
 * ```ts
 * import { RuleFailure } from "@beep/package-json/PackageValidator";
 * import * as O from "effect/Option";
 * import * as S from "effect/Schema";
 *
 * const failure = RuleFailure.make({ message: "Missing license field", path: O.some("license") });
 * console.log(S.is(RuleFailure)(failure)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class RuleFailure extends S.Opaque<RuleFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    message: S.String.pipe(
      $I.annoteKey("RuleFailure.message", { description: "A human-readable description of the failure." })
    ),
    path: S.Option(S.String).pipe(
      $I.annoteKey("RuleFailure.path", {
        description: "The JSON path where the failure occurred, or None when not applicable.",
      })
    ),
  }).pipe(
    $I.annoteSchema("RuleFailure", {
      description: "A validation-rule failure with its message and optional JSON path.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RuleFailure {
  /**
   * The plain failure object a rule's check may fail with: a constructed
   * {@link RuleFailure} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RuleFailure.Encoded;
}

type RuleCheck = (pkg: Package) => Effect.Effect<void, RuleFailure.Encoded>;

const RuleCheck = S.declare((u: unknown): u is RuleCheck => P.isFunction(u)).pipe(
  $I.annoteSchema("ValidationRule.Check", {
    description: "A rule's check: succeeds, or fails with a RuleFailure.",
  })
);

/**
 * **Example** (Define a custom rule)
 *
 * ```ts
 * import { ValidationRule } from "@beep/package-json/PackageValidator";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 *
 * const hasKeywords = ValidationRule.make({
 *   name: "has-keywords",
 *   validate: (pkg) =>
 *     pkg.keywords !== undefined ? Effect.void : Effect.fail({ message: "Missing keywords", path: O.some("keywords") }),
 * });
 * console.log(hasKeywords.name) // has-keywords
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ValidationRule extends S.Opaque<ValidationRule, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.pipe(
      $I.annoteKey("ValidationRule.name", { description: "The rule identifier (e.g. `has-license`)." })
    ),
    validate: RuleCheck.pipe(
      $I.annoteKey("ValidationRule.validate", {
        description: "The check: succeeds, or fails with a RuleFailure.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ValidationRule", {
      description: "A single validation rule: a name and a check that fails with a RuleFailure.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ValidationRule {
  /**
   * The plain rule object the validator accepts: a constructed
   * {@link ValidationRule} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ValidationRule.Encoded;
}

/**
 * **Details**
 *
 * Raised by {@link PackageValidator}. Every rule failure is aggregated on
 * `failures`; the `message` getter renders a multi-line report.
 *
 * **Example** (Render an aggregated validation failure)
 *
 * ```ts
 * import { PackageValidationError } from "@beep/package-json/PackageValidator";
 * import * as O from "effect/Option";
 *
 * const error = PackageValidationError.make({
 *   failures: [{ rule: "has-license", message: "Missing license field", path: O.some("license") }]
 * });
 * console.log(error.message) // package.json validation failed:
 * //   - [has-license] (at license): Missing license field
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class PackageValidationError extends S.TaggedError<PackageValidationError, { readonly brand: unique symbol }>(
  $I`PackageValidationError`
)(
  "PackageValidationError",
  {
    /**
     * The aggregated rule failures.
     *
     * @category models
     * @since 0.0.0
     */
    failures: S.Array(
      S.Struct({
        rule: S.String,
        message: S.String,
        path: S.Option(S.String),
      })
    ).pipe($I.annoteKey("PackageValidationError.failures", { description: "The aggregated rule failures." })),
  },
  $I.annoteError<PackageValidationError>("PackageValidationError", {
    description: "Indicates that a Package failed one or more validation rules.",
  })
) {
  /**
   * Renders every rule failure with its identifier and optional JSON path.
   *
   * **Example** (Read a validation report)
   *
   * ```ts
   * import { PackageValidationError } from "@beep/package-json/PackageValidator";
   * import * as O from "effect/Option";
   *
   * const error = PackageValidationError.make({
   *   failures: [{ rule: "has-license", message: "Missing license field", path: O.some("license") }]
   * });
   * console.log(error.message) // package.json validation failed:
   * //   - [has-license] (at license): Missing license field
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const lines = A.map(this.failures, (failure) => {
      const path = O.match(failure.path, { onNone: () => "", onSome: (value) => ` (at ${value})` });
      return `  - [${failure.rule}]${path}: ${failure.message}`;
    });
    return `package.json validation failed:\n${A.join(lines, "\n")}`;
  }
}

const hasLicense: ValidationRule = ValidationRule.make({
  name: "has-license",
  validate: (pkg) =>
    pkg.license !== undefined
      ? Effect.void
      : Effect.fail({ message: "Missing license field", path: O.some("license") }),
});

const hasDescription: ValidationRule = ValidationRule.make({
  name: "has-description",
  validate: (pkg) =>
    pkg.description !== undefined
      ? Effect.void
      : Effect.fail({ message: "Missing description field", path: O.some("description") }),
});

const hasRepository: ValidationRule = ValidationRule.make({
  name: "has-repository",
  validate: (pkg) =>
    pkg.repository !== undefined
      ? Effect.void
      : Effect.fail({ message: "Missing repository field", path: O.some("repository") }),
});

const notPrivate: ValidationRule = ValidationRule.make({
  name: "not-private",
  validate: (pkg) =>
    pkg.isPrivate ? Effect.fail({ message: "Package is private", path: O.some("private") }) : Effect.void,
});

const anyDependencyMatches: {
  (pkg: Package, predicate: (specifier: string) => boolean): boolean;
  (predicate: (specifier: string) => boolean): (pkg: Package) => boolean;
} = dual(2, (pkg: Package, predicate: (specifier: string) => boolean): boolean =>
  A.some([pkg.dependencies, pkg.devDependencies, pkg.peerDependencies, pkg.optionalDependencies], (map) =>
    HashMap.some(map, predicate)
  )
);

/**
 * A rule that fails when any dependency uses an unresolved `workspace:` or
 * `catalog:` specifier.
 *
 * **Example** (Reject an unresolved dependency)
 *
 * ```ts
 * import { noUnresolvedDepsRule } from "@beep/package-json/PackageValidator";
 * import { Package } from "@beep/package-json/Package";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const pkg = yield* Package.decode({
 *     name: "my-pkg", version: "1.0.0", dependencies: { local: "workspace:*" }
 *   });
 *   return yield* Effect.result(noUnresolvedDepsRule.validate(pkg));
 * });
 * console.log(Effect.runSync(program)._tag) // Failure
 * ```
 *
 * @public
 * @category validation
 * @since 0.0.0
 */
export const noUnresolvedDepsRule: ValidationRule = ValidationRule.make({
  name: "no-unresolved-deps",
  validate: (pkg) =>
    anyDependencyMatches(
      pkg,
      (specifier) => Str.startsWith("workspace:")(specifier) || Str.startsWith("catalog:")(specifier)
    )
      ? Effect.fail({ message: "Unresolved workspace:/catalog: dependency", path: O.none() })
      : Effect.void,
});

/**
 * A rule that fails when any dependency uses a local `file:`, `link:` or
 * `portal:` specifier.
 *
 * **Example** (Reject a local dependency)
 *
 * ```ts
 * import { noLocalDepsRule } from "@beep/package-json/PackageValidator";
 * import { Package } from "@beep/package-json/Package";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const pkg = yield* Package.decode({
 *     name: "my-pkg", version: "1.0.0", dependencies: { local: "file:../local" }
 *   });
 *   return yield* Effect.result(noLocalDepsRule.validate(pkg));
 * });
 * console.log(Effect.runSync(program)._tag) // Failure
 * ```
 *
 * @public
 * @category validation
 * @since 0.0.0
 */
export const noLocalDepsRule: ValidationRule = ValidationRule.make({
  name: "no-local-deps",
  validate: (pkg) =>
    anyDependencyMatches(
      pkg,
      (specifier) =>
        Str.startsWith("file:")(specifier) || Str.startsWith("link:")(specifier) || Str.startsWith("portal:")(specifier)
    )
      ? Effect.fail({ message: "Local file:/link:/portal: dependency", path: O.none() })
      : Effect.void,
});

/**
 * The default validation rules: license, description, repository and
 * not-private.
 *
 * **Example** (Inspect the default rule order)
 *
 * ```ts
 * import { defaultRules } from "@beep/package-json/PackageValidator";
 * import * as A from "effect/Array";
 *
 * console.log(A.join(A.map(defaultRules, (rule) => rule.name), ", ")) // has-license, has-description, has-repository, not-private
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const defaultRules: ReadonlyArray<ValidationRule> = [hasLicense, hasDescription, hasRepository, notPrivate];

const runRules: {
  (pkg: Package, rules: ReadonlyArray<ValidationRule.Encoded>): Effect.Effect<void, PackageValidationError>;
  (rules: ReadonlyArray<ValidationRule.Encoded>): (pkg: Package) => Effect.Effect<void, PackageValidationError>;
} = dual(
  2,
  Effect.fn("PackageValidator.validate")(function* (pkg: Package, rules: ReadonlyArray<ValidationRule.Encoded>) {
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
  })
);

/**
 * Validates a {@link Package} against a set of {@link ValidationRule}s,
 * aggregating every failure into one {@link PackageValidationError}.
 *
 * **When to use**
 *
 * Use with `PackageValidator.layer` for {@link defaultRules} or
 * `PackageValidator.layerRules` for a custom rule set.
 *
 * **Details**
 *
 * The default rules require a license, a description and a repository,
 * and forbid `private: true`.
 *
 * **Example** (Reject a package missing default validation requirements)
 *
 * ```ts
 * import { Package } from "@beep/package-json/Package";
 * import { PackageValidator } from "@beep/package-json/PackageValidator";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const pkg = yield* Package.decode({ name: "my-pkg", version: "1.0.0" });
 *   const validator = yield* PackageValidator;
 *   return yield* Effect.result(validator.validate(pkg));
 * }).pipe(Effect.provide(PackageValidator.layer));
 * console.log(Effect.runSync(program)._tag) // Failure
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class PackageValidator extends Context.Service<
  PackageValidator,
  { readonly validate: (pkg: Package) => Effect.Effect<void, PackageValidationError> }
>()($I`PackageValidator`) {
  /**
   * The default layer, backed by {@link defaultRules}.
   *
   * **Example** (Provide the default validator)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import { PackageValidator } from "@beep/package-json/PackageValidator";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const pkg = yield* Package.decode({ name: "my-pkg", version: "1.0.0" });
   *   const validator = yield* PackageValidator;
   *   return yield* Effect.result(validator.validate(pkg));
   * }).pipe(Effect.provide(PackageValidator.layer));
   * console.log(Effect.runSync(program)._tag) // Failure
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<PackageValidator> = Layer.succeed(PackageValidator, {
    validate: Effect.fn("PackageValidator.validate")(runRules(defaultRules)),
  });

  /**
   * Build a layer from a custom set of rules (a genuinely-parameterized factory).
   *
   * **Example** (Replace the default rules with an empty rule set)
   *
   * ```ts
   * import { Package } from "@beep/package-json/Package";
   * import { PackageValidator } from "@beep/package-json/PackageValidator";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const pkg = yield* Package.decode({ name: "my-pkg", version: "1.0.0" });
   *   const validator = yield* PackageValidator;
   *   yield* validator.validate(pkg);
   *   return "accepted";
   * }).pipe(Effect.provide(PackageValidator.layerRules({ rules: [] })));
   * console.log(Effect.runSync(program)) // accepted
   * ```
   *
   * @param config - the rule set to validate against, replacing {@link defaultRules}
   * @returns a layer providing `PackageValidator` backed by `config.rules`
   * @category layers
   * @since 0.0.0
   */
  static layerRules(config: { readonly rules: ReadonlyArray<ValidationRule.Encoded> }): Layer.Layer<PackageValidator> {
    return Layer.succeed(PackageValidator, {
      validate: Effect.fn("PackageValidator.validate")(runRules(config.rules)),
    });
  }
}
