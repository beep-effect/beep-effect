/**
 * Read-only GitHub providers for every stage other than `prod`. Every stage
 * targets the live repository (its objects are singletons), so a preview
 * stage must not be able to write. These layers wrap the shipped providers for
 * each resource type the stack declares: `read`, `diff` and the other
 * read-side methods are unchanged, so a plan works; `precreate`, `reconcile`
 * and `delete` fail with a typed error before any HTTP call, so a deploy or
 * destroy of a preview stage fails closed whatever token is in the environment.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as GitHub from "@alchemy.run/github";
import { $InfraGithubId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as ProviderModule from "alchemy/Provider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import type { ResourceClass, ResourceLike } from "alchemy/Resource";

const $I = $InfraGithubId.create("ReadOnlyProviders");

/**
 * A lifecycle operation that writes to GitHub.
 *
 * **Example** (Narrow a mutating operation)
 *
 * ```ts
 * import { MutatingOperation } from "@beep/infra-github/ReadOnlyProviders"
 *
 * console.log(MutatingOperation.is.reconcile("reconcile")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MutatingOperation = LiteralKit(["precreate", "reconcile", "delete"]).pipe(
  $I.annoteSchema("MutatingOperation", { description: "A provider lifecycle operation that writes to GitHub." })
);

/**
 * Runtime type for {@link MutatingOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type MutatingOperation = typeof MutatingOperation.Type;

/**
 * Raised when a preview stage reaches a mutating provider operation; no request was sent.
 *
 * **Example** (Inspect a refusal)
 *
 * ```ts
 * import { PreviewStageIsReadOnly } from "@beep/infra-github/ReadOnlyProviders"
 *
 * const refused = PreviewStageIsReadOnly.make({ stage: "dev_x", resourceType: "GitHub.Label", operation: "reconcile" })
 * console.log(refused._tag) // "PreviewStageIsReadOnly"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PreviewStageIsReadOnly extends S.TaggedError<PreviewStageIsReadOnly, { readonly brand: unique symbol }>(
  $I`PreviewStageIsReadOnly`
)(
  "PreviewStageIsReadOnly",
  { stage: S.String, resourceType: S.String, operation: MutatingOperation },
  $I.annote("PreviewStageIsReadOnly", {
    description: "A stage other than prod tried to write to GitHub; it is plan-only and nothing was sent.",
  })
) {}

const readOnly = <R extends ResourceLike, E, RIn>(
  resource: ResourceClass<R>,
  shipped: Layer.Layer<ProviderModule.Provider<R>, E, RIn>,
  stage: string
) =>
  ProviderModule.effect(
    resource,
    Effect.gen(function* () {
      const base = yield* ProviderModule.Provider<R>(resource.Type);
      const refuse = (operation: MutatingOperation) => () =>
        Effect.fail(PreviewStageIsReadOnly.make({ stage, resourceType: resource.Type, operation }));
      return {
        ...base,
        ...(base.precreate === undefined ? {} : { precreate: refuse("precreate") }),
        reconcile: refuse("reconcile"),
        delete: refuse("delete"),
      };
    })
  ).pipe(Layer.provide(shipped));

/**
 * The read-only providers for every resource type the stack declares
 * (`Repository`, `Ruleset`, `Environment`, `Variable`, `Label`). Registered
 * for each type directly, they take precedence over the same types in the
 * `GitHub.providers()` collection, so layering them over the collection is enough.
 *
 * **Example** (Build the preview providers)
 *
 * ```ts
 * import { readOnlyGitHubProviders } from "@beep/infra-github/ReadOnlyProviders"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(readOnlyGitHubProviders("dev_x")))
 * ```
 *
 * @param stage - The preview stage, named in every refusal.
 * @returns A layer providing read-only providers for the declared resource types.
 * @category layers
 * @since 0.0.0
 */
export const readOnlyGitHubProviders = (stage: string) =>
  Layer.mergeAll(
    readOnly(GitHub.Repository, GitHub.RepositoryProvider(), stage),
    readOnly(GitHub.Ruleset, GitHub.RulesetProvider(), stage),
    readOnly(GitHub.Environment, GitHub.EnvironmentProvider(), stage),
    readOnly(GitHub.Variable, GitHub.VariableProvider(), stage),
    readOnly(GitHub.Label, GitHub.LabelProvider(), stage)
  );
