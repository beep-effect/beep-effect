/**
 * The `InfraGithub` resources: the repository settings and the main ruleset,
 * adopted in place, plus the environments, variables and labels the
 * configuration owns. Every resource is retained on removal, so destroying a
 * stage or dropping a declaration never deletes a live object.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as GitHub from "@alchemy.run/github";
import { $InfraGithubId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { adopt } from "alchemy/AdoptPolicy";
import { protect, retain } from "alchemy/RemovalPolicy";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { requiredChecks } from "./Config.ts";
import type { EnvironmentSpec, LabelSpec, RequiredCheck, StackConfig, VariableSpec } from "./Config.ts";

const $I = $InfraGithubId.create("Stack");

/**
 * A logical id fragment for a GitHub object name: anything other than letters,
 * digits and `-` becomes `-` (`size/L` is `size-L`), so names with spaces or
 * slashes stay one path segment of the resource FQN.
 *
 * **Example** (Turn a label name into an id fragment)
 *
 * ```ts
 * import { idFragment } from "@beep/infra-github/Stack"
 *
 * console.log(idFragment("good first issue")) // "good-first-issue"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const idFragment = Str.replace(/[^A-Za-z0-9-]/gu, "-");

// The one derivation of every logical id the stack declares; the duplicate check and the declarations share it.
const environmentId = (name: string) => `Environment-${idFragment(name)}`;
const environmentVariableId = (environment: string, variable: string) =>
  `EnvironmentVariable-${idFragment(environment)}-${variable}`;
const variableId = (name: string) => `Variable-${name}`;
const labelId = (name: string) => `Label-${idFragment(name)}`;

/**
 * The kind of a declaration whose logical id is derived from a config name.
 *
 * **Example** (Narrow a declaration kind)
 *
 * ```ts
 * import { DeclarationKind } from "@beep/infra-github/Stack"
 *
 * console.log(DeclarationKind.is.label("label")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeclarationKind = LiteralKit(["environment", "environment variable", "variable", "label"]).pipe(
  $I.annoteSchema("DeclarationKind", { description: "A declaration whose logical id comes from a config name." })
);

/**
 * Decoded declaration kind.
 *
 * @category models
 * @since 0.0.0
 */
export type DeclarationKind = typeof DeclarationKind.Type;

/**
 * One declaration's derived logical id and the config name it came from.
 *
 * **Example** (Read a label's logical id)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 * import { declarations } from "@beep/infra-github/Stack"
 *
 * console.log(declarations(productionConfig).some((entry) => entry.logicalId === "Label-size-L")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Declaration extends S.Opaque<Declaration, { readonly brand: unique symbol }>()(
  S.Struct({ logicalId: S.String, kind: DeclarationKind, source: S.String }).pipe(
    $I.annoteSchema("Declaration", { description: "A declaration's derived logical id and its config name." })
  )
) {}

/**
 * Two declarations derive the same logical id, or ids that differ only in
 * case (GitHub matches label, variable and environment names
 * case-insensitively, so both would target one object). The second would
 * silently resolve to the first; the stack refuses before declaring anything.
 *
 * **Example** (Inspect a collision)
 *
 * ```ts
 * import { DuplicateLogicalId } from "@beep/infra-github/Stack"
 *
 * const error = DuplicateLogicalId.make({ kind: "label", logicalId: "Label-size-L", first: "size/L", second: "size-L" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DuplicateLogicalId extends S.TaggedError<DuplicateLogicalId, { readonly brand: unique symbol }>(
  $I`DuplicateLogicalId`
)(
  "DuplicateLogicalId",
  { kind: DeclarationKind, logicalId: S.String, first: S.String, second: S.String },
  $I.annote("DuplicateLogicalId", {
    description: "Two declarations derive one logical id (or ids equal up to case); nothing is declared.",
  })
) {
  /**
   * The collision as one line: the kind, the shared logical id and both
   * config names.
   *
   * @returns The rendered collision.
   * @since 0.0.0
   */
  override get message(): string {
    return `${this.kind} "${this.first}" and "${this.second}" both derive ${this.logicalId}; rename one.`;
  }
}

/**
 * Every declaration whose logical id is derived from a config name: the
 * environments, their variables, the repository variables and the labels.
 *
 * **Example** (Count the label declarations)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 * import { declarations } from "@beep/infra-github/Stack"
 *
 * console.log(declarations(productionConfig).filter((entry) => entry.kind === "label").length) // 26
 * ```
 *
 * @param config - The stack configuration.
 * @returns The derived declarations, in declaration order.
 * @category utilities
 * @since 0.0.0
 */
export const declarations = (config: StackConfig): ReadonlyArray<Declaration> => [
  ...A.flatMap(config.environments, (environment) => [
    Declaration.make({ logicalId: environmentId(environment.name), kind: "environment", source: environment.name }),
    ...A.map(environment.variables, (variable) =>
      Declaration.make({
        logicalId: environmentVariableId(environment.name, variable.name),
        kind: "environment variable",
        source: `${environment.name}/${variable.name}`,
      })
    ),
  ]),
  ...A.map(config.variables, (variable) =>
    Declaration.make({ logicalId: variableId(variable.name), kind: "variable", source: variable.name })
  ),
  ...A.map(config.labels, (label) =>
    Declaration.make({ logicalId: labelId(label.name), kind: "label", source: label.name })
  ),
];

/**
 * The first pair of declarations whose logical ids are equal up to case, if
 * any. Ids are compared case-insensitively because GitHub resolves the names
 * behind them case-insensitively.
 *
 * **Example** (Find no collision in production)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 * import { findDuplicateLogicalId } from "@beep/infra-github/Stack"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(findDuplicateLogicalId(productionConfig))) // true
 * ```
 *
 * @param config - The stack configuration.
 * @returns The first collision, or `None`.
 * @category validation
 * @since 0.0.0
 */
export const findDuplicateLogicalId = (config: StackConfig): O.Option<DuplicateLogicalId> => {
  const seen = MutableHashMap.empty<string, Declaration>();
  return A.findFirst(declarations(config), (entry) => {
    const key = Str.toLowerCase(entry.logicalId);
    const earlier = MutableHashMap.get(seen, key);
    MutableHashMap.set(
      seen,
      key,
      O.getOrElse(earlier, () => entry)
    );
    return O.map(earlier, (first) =>
      DuplicateLogicalId.make({
        kind: entry.kind,
        logicalId: entry.logicalId,
        first: first.source,
        second: entry.source,
      })
    );
  });
};

const declareRepository = (config: StackConfig) =>
  GitHub.Repository("Repository", {
    owner: config.owner,
    name: config.repository,
    homepage: config.settings.homepage,
    defaultBranch: config.settings.defaultBranch,
    hasIssues: config.settings.hasIssues,
    hasProjects: config.settings.hasProjects,
    hasWiki: config.settings.hasWiki,
    hasDiscussions: config.settings.hasDiscussions,
    isTemplate: config.settings.isTemplate,
    allowSquashMerge: config.settings.allowSquashMerge,
    allowMergeCommit: config.settings.allowMergeCommit,
    allowRebaseMerge: config.settings.allowRebaseMerge,
    allowAutoMerge: config.settings.allowAutoMerge,
    deleteBranchOnMerge: config.settings.deleteBranchOnMerge,
    topics: A.copy(config.settings.topics),
  }).pipe(adopt(true), protect());

const declareMainRuleset = (config: StackConfig, liveReviewer: O.Option<RequiredCheck>) => {
  const ruleset = config.mainRuleset;
  return GitHub.Ruleset("MainRuleset", {
    owner: config.owner,
    repository: config.repository,
    name: ruleset.name,
    enforcement: ruleset.enforcement,
    target: "branch",
    conditions: { include: A.copy(ruleset.include), exclude: A.copy(ruleset.exclude) },
    bypassActors: A.map(ruleset.bypassActors, ({ actorType, actorId, bypassMode }) => ({
      actorType,
      actorId,
      bypassMode,
    })),
    deletion: ruleset.deletion,
    nonFastForward: ruleset.nonFastForward,
    pullRequest: { ...ruleset.pullRequest, allowedMergeMethods: A.copy(ruleset.pullRequest.allowedMergeMethods) },
    requiredStatusChecks: {
      checks: A.map(requiredChecks(ruleset, liveReviewer), ({ context, integrationId }) => ({
        context,
        integrationId,
      })),
      strictRequiredStatusChecksPolicy: ruleset.strictRequiredStatusChecksPolicy,
    },
  }).pipe(adopt(true), protect());
};

const declareVariable = (config: StackConfig, id: string, variable: VariableSpec, environment?: GitHub.Environment) =>
  GitHub.Variable(id, {
    owner: config.owner,
    repository: config.repository,
    name: variable.name,
    value: variable.value,
    ...(environment === undefined ? {} : { environment }),
  });

const declareEnvironment = Effect.fnUntraced(function* (config: StackConfig, spec: EnvironmentSpec) {
  const environment = yield* GitHub.Environment(environmentId(spec.name), {
    owner: config.owner,
    repository: config.repository,
    name: spec.name,
    deploymentBranchPolicy: { customBranchPolicies: A.copy(spec.branches) },
  });
  yield* Effect.forEach(spec.variables, (variable) =>
    declareVariable(config, environmentVariableId(spec.name, variable.name), variable, environment)
  );
  return environment;
});

const declareLabel = (config: StackConfig, spec: LabelSpec) =>
  GitHub.Label(labelId(spec.name), {
    owner: config.owner,
    repository: config.repository,
    name: spec.name,
    color: spec.color,
    // `None` sends GitHub's clearing value: an omitted description is dropped from the PATCH and keeps the old text.
    description: O.getOrElse(spec.description, () => ""),
  });

/**
 * Declares every resource of the configuration. The repository and the main
 * ruleset are adopted per object (`adopt(true)`, D20) and protected against
 * replacement and deletion; every resource is retained on removal. The main
 * ruleset carries `liveReviewer`, the live `beep-reviewer` check, through
 * unchanged (see `RulesetGuard`). Dies with {@link DuplicateLogicalId},
 * declaring nothing, when two config names derive the same logical id.
 *
 * **Example** (Declare the production configuration inside a stack)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 * import { declareStack } from "@beep/infra-github/Stack"
 *
 * import * as O from "effect/Option"
 *
 * const program = declareStack(productionConfig, O.none())
 * console.log(typeof program) // "object"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const declareStack = Effect.fn("InfraGithub.declareStack")(function* (
  config: StackConfig,
  liveReviewer: O.Option<RequiredCheck>
) {
  // A silent collision would drop a declaration; refuse before anything is declared. `retain()` wraps an
  // effect that cannot fail, so the refusal is a defect: the plan or deploy stops with it.
  const duplicate = findDuplicateLogicalId(config);
  if (O.isSome(duplicate)) return yield* Effect.die(duplicate.value);
  const repository = yield* declareRepository(config);
  const ruleset = yield* declareMainRuleset(config, liveReviewer);
  yield* Effect.forEach(config.environments, (spec) => declareEnvironment(config, spec));
  yield* Effect.forEach(config.variables, (variable) => declareVariable(config, variableId(variable.name), variable));
  yield* Effect.forEach(config.labels, (spec) => declareLabel(config, spec));
  return {
    repository: repository.fullName,
    mainRulesetId: ruleset.rulesetId,
    reviewerCarried: O.isSome(liveReviewer),
  };
}, retain());
