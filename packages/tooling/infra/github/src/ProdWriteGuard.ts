/**
 * The `prod` stage's create guard. On `prod` a planned `create` normally
 * means "converge by name": the repository, environment, variable and label
 * providers read the live object by name and update it in place. That holds
 * only for the logical ids on an explicit allow-list (`CreateAllowList` in
 * `./Config.ts`). Every GitHub provider on `prod` is wrapped:
 *
 * - at plan time (in `alchemy plan` and again inside `alchemy deploy`, before
 *   anything is written), a provider `read` that finds nothing for a logical
 *   id off the list, a `read` that must find a live object and does not
 *   (the repository), and any `diff` that answers `replace` all fail with
 *   {@link ProdChangeRefused};
 * - at write time, `reconcile` without a prior output (the create path) fails
 *   for a logical id off the list before any request, the repository's create
 *   path fails unless the repository exists (so it can never POST a new one),
 *   and `precreate` and `delete` always fail.
 *
 * The shipped `GitHub.Ruleset` create path POSTs a new ruleset, so the main
 * ruleset is not on the list: a plan that cannot find it live fails instead
 * of creating a second one.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as GitHub from "@alchemy.run/github";
import { $InfraGithubId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as ProviderModule from "alchemy/Provider";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { isCreateAllowed } from "./Config.ts";
import { guardedRulesetProvider } from "./RulesetWriteGuard.ts";
import type { ResourceClass, ResourceLike } from "alchemy/Resource";
import type { CreateAllowList } from "./Config.ts";
import type { LiveRuleset } from "./RulesetGuard.ts";

const $I = $InfraGithubId.create("ProdWriteGuard");

/**
 * A change the `prod` guard refuses: a `create` off the allow-list (or of a
 * repository that does not exist), a `replace`, or a `delete`.
 *
 * **Example** (Narrow a refused change)
 *
 * ```ts
 * import { RefusedChange } from "@beep/infra-github/ProdWriteGuard"
 *
 * console.log(RefusedChange.is.replace("replace")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RefusedChange = LiteralKit(["create", "replace", "delete"]).pipe(
  $I.annoteSchema("RefusedChange", { description: "A change the prod create guard refuses." })
);

/**
 * Decoded refused change.
 *
 * @category models
 * @since 0.0.0
 */
export type RefusedChange = typeof RefusedChange.Type;

/**
 * Raised by a guarded `prod` provider, before any request is sent, when a
 * plan or deploy would take a change the guard refuses.
 *
 * **Example** (Inspect a refusal)
 *
 * ```ts
 * import { ProdChangeRefused } from "@beep/infra-github/ProdWriteGuard"
 *
 * const refused = ProdChangeRefused.make({
 *   logicalId: "MainRuleset",
 *   resourceType: "GitHub.Ruleset",
 *   change: "create",
 *   reason: "not on the create allow-list",
 * })
 * console.log(refused.change) // "create"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProdChangeRefused extends S.TaggedError<ProdChangeRefused, { readonly brand: unique symbol }>(
  $I`ProdChangeRefused`
)(
  "ProdChangeRefused",
  { logicalId: S.String, resourceType: S.String, change: RefusedChange, reason: S.String },
  $I.annote("ProdChangeRefused", {
    description: "A prod plan or deploy would take a refused create, replace or delete; nothing was sent.",
  })
) {
  override get message(): string {
    return `prod refuses the ${this.change} of ${this.logicalId} (${this.resourceType}): ${this.reason}; nothing was sent.`;
  }
}

/** How a guarded provider checks that its create path converges on a live object. */
type MustExist = "none" | "lookup";

const guarded = <R extends ResourceLike, E, RIn>(
  resource: ResourceClass<R>,
  shipped: Layer.Layer<ProviderModule.Provider<R>, E, RIn>,
  allow: CreateAllowList,
  mustExist: MustExist
) =>
  ProviderModule.effect(
    resource,
    Effect.gen(function* () {
      const base = yield* ProviderModule.Provider<R>(resource.Type);
      const refuse = (logicalId: string, change: RefusedChange, reason: string) =>
        Effect.fail(ProdChangeRefused.make({ logicalId, resourceType: resource.Type, change, reason }));
      const offList = (logicalId: string) => !isCreateAllowed(allow, logicalId);
      const notOnList = "the create path is not on the prod allow-list";
      // The create path of an allow-listed id must still converge on something: the repository's would POST one.
      const guardCreate = Effect.fn("InfraGithub.prodGuardCreate")(function* (logicalId: string, props: unknown) {
        if (offList(logicalId)) return yield* refuse(logicalId, "create", notOnList);
        if (mustExist === "lookup") {
          // Every provider given "lookup" ships one; a missing one dies, which fails the plan closed.
          const found = yield* base.lookup!(props as Parameters<NonNullable<typeof base.lookup>>[0]);
          if (found === undefined) {
            return yield* refuse(logicalId, "create", "no live object to converge on; the create path would make one");
          }
        }
      });
      return {
        ...base,
        // `read` stays absent where the shipped provider has none: its presence changes how the plan adopts.
        ...(base.read === undefined
          ? {}
          : {
              read: Effect.fn("InfraGithub.prodGuardedRead")(function* (input: Parameters<typeof base.read>[0]) {
                const found = yield* base.read!(input);
                if (found === undefined && input.output === undefined) yield* guardCreate(input.id, input.olds);
                return found;
              }),
            }),
        diff: Effect.fn("InfraGithub.prodGuardedDiff")(function* (input: Parameters<NonNullable<typeof base.diff>>[0]) {
          // Every shipped GitHub provider has a diff; a missing one dies, which fails the plan closed.
          const diff = yield* base.diff!(input);
          if (diff?.action === "replace") {
            return yield* refuse(input.id, "replace", "a replace deletes and recreates a live object");
          }
          return diff;
        }),
        // Apply calls precreate only inside a dependency cycle, to write a placeholder; the stack has none.
        precreate: (input: Parameters<NonNullable<typeof base.precreate>>[0]) =>
          refuse(input.id, "create", "precreate writes a placeholder; the prod stack has no dependency cycle"),
        reconcile: Effect.fn("InfraGithub.prodGuardedReconcile")(function* (
          input: Parameters<typeof base.reconcile>[0]
        ) {
          if (input.output === undefined) yield* guardCreate(input.id, input.news);
          return yield* base.reconcile(input);
        }),
        delete: (input: Parameters<typeof base.delete>[0]) =>
          refuse(input.id, "delete", "the prod stage never deletes a live object"),
      };
    })
  ).pipe(Layer.provide(shipped));

const makeProdGitHubProviders = (allow: CreateAllowList, capture: LiveRuleset) =>
  Layer.mergeAll(
    guarded(GitHub.Repository, GitHub.RepositoryProvider(), allow, "lookup"),
    guarded(GitHub.Ruleset, guardedRulesetProvider(capture), allow, "none"),
    guarded(GitHub.Environment, GitHub.EnvironmentProvider(), allow, "none"),
    guarded(GitHub.Variable, GitHub.VariableProvider(), allow, "none"),
    guarded(GitHub.Label, GitHub.LabelProvider(), allow, "none")
  );

/**
 * The GitHub providers for the `prod` stage: the shipped providers for each
 * resource type the stack declares, the ruleset one with its write guard
 * ({@link guardedRulesetProvider}), each wrapped in the create guard. Layer
 * it over the `GitHub.providers()` collection, whose credentials it uses.
 *
 * **Example** (Build the prod providers)
 *
 * ```ts
 * import { CreateAllowList } from "@beep/infra-github/Config"
 * import { prodGitHubProviders } from "@beep/infra-github/ProdWriteGuard"
 * import { decodeLiveRuleset } from "@beep/infra-github/RulesetGuard"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const capture = Effect.runSync(decodeLiveRuleset({
 *   id: 10240248, name: "main", target: "branch", enforcement: "active",
 *   conditions: { ref_name: { include: [], exclude: [] } }, bypass_actors: [], rules: [],
 * }))
 * const allow = CreateAllowList.make({ logicalIds: ["Repository"] })
 * console.log(Layer.isLayer(prodGitHubProviders(allow, capture)))
 * ```
 *
 * @param allow - The logical ids that may take the create path.
 * @param capture - The strictly decoded ruleset capture the plan is built from.
 * @returns A layer providing the guarded prod providers.
 * @category layers
 * @since 0.0.0
 */
export const prodGitHubProviders: {
  (capture: LiveRuleset): (allow: CreateAllowList) => ReturnType<typeof makeProdGitHubProviders>;
  (allow: CreateAllowList, capture: LiveRuleset): ReturnType<typeof makeProdGitHubProviders>;
} = dual(2, makeProdGitHubProviders);
