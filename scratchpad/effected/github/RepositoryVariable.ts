import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import type { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";
import type * as Rest from "./Rest.ts";

const $I = $ScratchpadId.create("effected/github/RepositoryVariable");

class UnstubbedError extends S.TaggedError<UnstubbedError>($I`UnstubbedError`)("UnstubbedError", {
	message: S.String,
}, $I.annote("UnstubbedError", { description: "An unconfigured test-double member was called." })) {}

/**
 * A variable's name and value, as listing returns it.
 *
 * **Details**
 *
 * Unlike a secret this carries its **value**: variables are readable, so a
 * consumer comparing desired against live can detect an *edited* variable and
 * not merely a deleted one. Discarding the value in a projection here would
 * throw that away silently.
 *
 * **Example** (Decode a readable variable)
 *
 * ```ts
 * import { VariableInfo } from "@beep/scratchpad/effected/github/RepositoryVariable";
 * import * as S from "effect/Schema";
 *
 * const variable = S.decodeUnknownSync(VariableInfo)({ name: "DEPLOY_REGION", value: "eu-west-1" });
 * console.log(variable.value) // eu-west-1
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const VariableInfo = S.Struct({
  name: S.String.annotateKey({ description: "The variable's name." }),
  value: S.String.annotateKey({ description: "The variable's current readable value." }),
}).pipe($I.annoteSchema("VariableInfo", { description: "A variable name and value returned by repository or environment listings." }));

/**
 * The plain-object variable listing fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type VariableInfo = typeof VariableInfo.Type;

/**
 * Create or update, list and delete Actions variables on a repository and on
 * its environments.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface RepositoryVariableShape {
  /**
   * Create or update one repository variable.
   *
   * **Details**
   *
   * GitHub has **no upsert** for variables: creating uses `POST` on the
   * collection and updating uses `PATCH` on the item, and each fails if used
   * for the other case. So this reads first and branches — one extra request
   * per write, and the reason it is not optional.
   *
   * The read is **by name**, not a listing: GitHub answers 404 for an absent
   * variable, so the check is constant cost rather than growing with a
   * repository that has nothing to do with the variable being written. Only
   * `notFound` is absorbed — a 403 from a mis-scoped token still fails, where
   * treating any error as absence would turn a permissions problem into a
   * spurious create.
   *
   * The 404-for-absent behaviour is GitHub's documented contract.
   *
   * Only `notFound` selects the create branch: a successful read selects the
   * update branch, and any other failure propagates rather than being guessed
   * at. So if GitHub answers something *other* than 404 for an absent
   * variable, the write does not silently take the wrong branch — it either
   * `PATCH`es a variable that is not there, or fails with the error GitHub
   * actually sent. Read either as evidence about this assumption rather than
   * about the caller.
   *
   * @since 0.0.0
   */
  readonly set: (name: string, value: string) => Effect.Effect<void, GitHubError, Repo>;
  /**
   * The repository's variables, with their values.
   *
   * @since 0.0.0
   */
  readonly list: Effect.Effect<ReadonlyArray<VariableInfo>, GitHubError, Repo>;
  /**
   * Remove one repository variable.
   *
   * @since 0.0.0
   */
  readonly delete: (name: string) => Effect.Effect<void, GitHubError, Repo>;

  /**
   * Create or update one environment variable, branching the same way.
   *
   * @since 0.0.0
   */
  readonly setForEnvironment: (
    environment: string,
    name: string,
    value: string,
  ) => Effect.Effect<void, GitHubError, Repo>;
  /**
   * One environment's variables, with their values.
   *
   * @since 0.0.0
   */
  readonly listForEnvironment: (environment: string) => Effect.Effect<ReadonlyArray<VariableInfo>, GitHubError, Repo>;
  /**
   * Remove one environment variable.
   *
   * @since 0.0.0
   */
  readonly deleteForEnvironment: (environment: string, name: string) => Effect.Effect<void, GitHubError, Repo>;
}

/**
 * Create or update, list and delete Actions variables on a repository and on
 * its environments.
 *
 * **Details**
 *
 * No encryption and no public key, unlike secrets — but also **no upsert**,
 * which is the asymmetry worth knowing: every write costs a read first, because
 * the create and update routes are different endpoints with different verbs and
 * neither tolerates the other's case.
 *
 * Provide it with {@link RepositoryVariable.layer}, which needs a
 * `GitHubClient`; each method also needs a `Repo` in `R`.
 *
 * **Example** (Set an Actions variable and list repository variables)
 *
 * ```ts
 * import { RepositoryVariable } from "@beep/scratchpad/effected/github/RepositoryVariable";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const variables = yield* RepositoryVariable;
 *   yield* variables.set("DEPLOY_REGION", "eu-west-1"); // creates or updates
 *   return yield* variables.list;
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class RepositoryVariable extends Context.Service<RepositoryVariable, RepositoryVariableShape>()(
  $I`RepositoryVariable`,
) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * **Gotchas**
   *
   * `(client) => make(client)` rather than `make`: a static initializer runs
   * while the module body is still evaluating, so naming a `const` declared
   * further down throws at import time with a clean typecheck.
   *
   * **Example** (Construct the live service layer)
   *
   * ```ts
   * import { RepositoryVariable } from "@beep/scratchpad/effected/github/RepositoryVariable";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(RepositoryVariable.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<RepositoryVariable, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client)),
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Stub one service operation)
   *
   * ```ts
   * import { RepositoryVariable } from "@beep/scratchpad/effected/github/RepositoryVariable";
   * import * as Effect from "effect/Effect";
   *
   * const service = RepositoryVariable.makeTest({ set: () => Effect.void });
   * console.log(Effect.isEffect(service.set("REGION", "eu-west-1"))) // true
   * ```
   *
   * @category testing
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<RepositoryVariableShape> = {}): RepositoryVariableShape => ({
    set: overrides.set ?? (() => unstubbed("set")),
    list: overrides.list ?? (Effect.suspend(() => unstubbed("list"))),
    delete: overrides.delete ?? (() => unstubbed("delete")),
    setForEnvironment: overrides.setForEnvironment ?? (() => unstubbed("setForEnvironment")),
    listForEnvironment: overrides.listForEnvironment ?? (() => unstubbed("listForEnvironment")),
    deleteForEnvironment: overrides.deleteForEnvironment ?? (() => unstubbed("deleteForEnvironment")),
  });

  /**
   * {@link RepositoryVariable.makeTest} behind a `Layer`.
   *
   * **Example** (Construct a test service layer)
   *
   * ```ts
   * import { RepositoryVariable } from "@beep/scratchpad/effected/github/RepositoryVariable";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(RepositoryVariable.layerTest())) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<RepositoryVariableShape> = {}): Layer.Layer<RepositoryVariable> =>
    Layer.succeed(RepositoryVariable, RepositoryVariable.makeTest(overrides));
}

const unstubbed = (member: string): never => {
  throw UnstubbedError.make({ message: `RepositoryVariable.makeTest: ${member}() was called but not stubbed — pass an override.` });
};

const make = (client: GitHubClient["Service"]): RepositoryVariableShape => {
  /**
   * Does this variable already exist? One by-name read, not a listing.
   *
   * **Details**
   *
   * GitHub answers 404 for an absent variable, which makes the pre-write check
   * constant cost — paginating the whole collection to answer one yes/no grows
   * with a repository that has nothing to do with the variable being written.
   * Only `notFound` is absorbed: a 403 from a mis-scoped token still fails,
   * which a blanket "treat any error as absent" would destroy, turning a
   * permissions problem into a spurious create.
   */
  const exists = (route: "GET /repos/{owner}/{repo}/actions/variables/{name}", params: Rest.Params<"GET /repos/{owner}/{repo}/actions/variables/{name}">) =>
    client.request(route, params).pipe(
      Effect.as(true),
      Effect.catchIf(
        (error) => error.kind === "notFound",
        () => Effect.succeed(false),
      ),
    );

  const set = Effect.fn("RepositoryVariable.set")(function* (name: string, value: string) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, variable: name });

    if (yield* exists("GET /repos/{owner}/{repo}/actions/variables/{name}", {
      owner,
      repo,
      name,
    })) {
      return yield* client.request("PATCH /repos/{owner}/{repo}/actions/variables/{name}", {
        owner,
        repo,
        name,
        value,
      }).pipe(Effect.asVoid);
    }

    yield* client.request("POST /repos/{owner}/{repo}/actions/variables", {
      owner,
      repo,
      name,
      value,
    });
  });

  const list = Effect.suspend(Effect.fn("RepositoryVariable.list")(function* () {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo });

    const variables = yield* client.paginate("GET /repos/{owner}/{repo}/actions/variables", {
      owner,
      repo,
    });
    return variables.map((variable): VariableInfo => ({
      name: variable.name,
      value: variable.value,
    }));
  }));

  const delete_ = Effect.fn("RepositoryVariable.delete")(function* (name: string) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, variable: name });

    yield* client.request("DELETE /repos/{owner}/{repo}/actions/variables/{name}", {
      owner,
      repo,
      name,
    });
  });

  const setForEnvironment = Effect.fn("RepositoryVariable.setForEnvironment")(function* (
    environment: string,
    name: string,
    value: string,
  ) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({
      owner,
      repo,
      environment,
      variable: name,
    });

    const present = yield* client
      .request("GET /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}", {
        owner,
        repo,
        environment_name: environment,
        name,
      })
      .pipe(
        Effect.as(true),
        // Same by-name check as `set`: constant cost, and only `notFound` is
        // absorbed so a permissions failure cannot masquerade as absence.
        Effect.catchIf(
          (error) => error.kind === "notFound",
          () => Effect.succeed(false),
        ),
      );

    if (present) {
      return yield* client.request("PATCH /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}", {
        owner,
        repo,
        environment_name: environment,
        name,
        value,
      }).pipe(Effect.asVoid);

    }

    yield* client.request("POST /repos/{owner}/{repo}/environments/{environment_name}/variables", {
      owner,
      repo,
      environment_name: environment,
      name,
      value,
    });
  });

  const listForEnvironment = Effect.fn("RepositoryVariable.listForEnvironment")(function* (environment: string) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, environment });

    const variables = yield* client.paginate("GET /repos/{owner}/{repo}/environments/{environment_name}/variables", {
      owner,
      repo,
      environment_name: environment,
    });
    return variables.map((variable): VariableInfo => ({
      name: variable.name,
      value: variable.value,
    }));
  });

  const deleteForEnvironment = Effect.fn("RepositoryVariable.deleteForEnvironment")(function* (
    environment: string,
    name: string,
  ) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({
      owner,
      repo,
      environment,
      variable: name,
    });

    yield* client.request("DELETE /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}", {
    owner,
    repo,
    environment_name: environment,
    name,
});
  });

  return {
    set,
    list,
    delete: delete_,
    setForEnvironment,
    listForEnvironment,
    deleteForEnvironment,
  };
};
