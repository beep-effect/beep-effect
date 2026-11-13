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
import { adopt } from "alchemy/AdoptPolicy";
import { protect, retain } from "alchemy/RemovalPolicy";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { requiredChecks } from "./Config.ts";
import type { EnvironmentSpec, LabelSpec, StackConfig, VariableSpec } from "./Config.ts";

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

const declareMainRuleset = (config: StackConfig) => {
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
      checks: A.map(requiredChecks(ruleset), ({ context, integrationId }) => ({ context, integrationId })),
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
  const environment = yield* GitHub.Environment(`Environment-${idFragment(spec.name)}`, {
    owner: config.owner,
    repository: config.repository,
    name: spec.name,
    deploymentBranchPolicy: { customBranchPolicies: A.copy(spec.branches) },
  });
  yield* Effect.forEach(spec.variables, (variable) =>
    declareVariable(config, `EnvironmentVariable-${idFragment(spec.name)}-${variable.name}`, variable, environment)
  );
  return environment;
});

const declareLabel = (config: StackConfig, spec: LabelSpec) =>
  GitHub.Label(`Label-${idFragment(spec.name)}`, {
    owner: config.owner,
    repository: config.repository,
    name: spec.name,
    color: spec.color,
    ...O.match(spec.description, { onNone: () => ({}), onSome: (description) => ({ description }) }),
  });

/**
 * Declares every resource of the configuration. The repository and the main
 * ruleset are adopted per object (`adopt(true)`, D20) and protected against
 * replacement and deletion; every resource is retained on removal.
 *
 * **Example** (Declare the production configuration inside a stack)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-github/Production"
 * import { declareStack } from "@beep/infra-github/Stack"
 *
 * const program = declareStack(productionConfig)
 * console.log(typeof program) // "object"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const declareStack = Effect.fn("InfraGithub.declareStack")(function* (config: StackConfig) {
  const repository = yield* declareRepository(config);
  const ruleset = yield* declareMainRuleset(config);
  yield* Effect.forEach(config.environments, (spec) => declareEnvironment(config, spec));
  yield* Effect.forEach(config.variables, (variable) => declareVariable(config, `Variable-${variable.name}`, variable));
  yield* Effect.forEach(config.labels, (spec) => declareLabel(config, spec));
  return {
    repository: repository.fullName,
    mainRulesetId: ruleset.rulesetId,
    reviewerCheck: config.mainRuleset.reviewerCheck,
  };
}, retain());
