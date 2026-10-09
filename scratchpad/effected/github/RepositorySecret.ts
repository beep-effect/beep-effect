import { Context, Effect, Layer, Redacted, Result } from "effect";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { encryptSecret } from "./internal/crypto.ts";
import { Repo } from "./Repo.ts";

/**
 * Which secret store an operation acts on.
 *
 * @remarks
 * Three separate stores on the same repository, each with **its own public
 * key** — which is why a key fetch cannot be cached across scopes.
 *
 * @public
 */
export type SecretScope = "actions" | "dependabot" | "codespaces";

/**
 * A secret, as listing returns it.
 *
 * @remarks
 * The name only. GitHub never returns a secret's value from any endpoint —
 * that is the point of a secret store — so there is nothing else to carry, and
 * a consumer comparing desired against live can detect a **deleted** secret but
 * never an **edited** one.
 *
 * @public
 */
export interface SecretInfo {
  /** The secret's name. */
  readonly name: string;
}

/**
 * Write, list and delete Actions, Dependabot and Codespaces secrets on a
 * repository, and Actions secrets on its environments.
 *
 * @public
 */
export interface RepositorySecretShape {
  /** Encrypt and write one repository secret in the given store. */
  readonly set: (
    name: string,
    value: Redacted.Redacted<string>,
    scope?: SecretScope,
  ) => Effect.Effect<void, GitHubError, Repo>;
  /** The names of the repository's secrets in the given store. */
  readonly list: (scope?: SecretScope) => Effect.Effect<ReadonlyArray<SecretInfo>, GitHubError, Repo>;
  /** Remove one repository secret from the given store. */
  readonly delete: (name: string, scope?: SecretScope) => Effect.Effect<void, GitHubError, Repo>;

  /** Encrypt and write one environment secret. */
  readonly setForEnvironment: (
    environment: string,
    name: string,
    value: Redacted.Redacted<string>,
  ) => Effect.Effect<void, GitHubError, Repo>;
  /** The names of one environment's secrets. */
  readonly listForEnvironment: (environment: string) => Effect.Effect<ReadonlyArray<SecretInfo>, GitHubError, Repo>;
  /** Remove one environment secret. */
  readonly deleteForEnvironment: (environment: string, name: string) => Effect.Effect<void, GitHubError, Repo>;
}

const ROUTES = {
  actions: {
    publicKey: "GET /repos/{owner}/{repo}/actions/secrets/public-key",
    put: "PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}",
    list: "GET /repos/{owner}/{repo}/actions/secrets",
    remove: "DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}",
  },
  dependabot: {
    publicKey: "GET /repos/{owner}/{repo}/dependabot/secrets/public-key",
    put: "PUT /repos/{owner}/{repo}/dependabot/secrets/{secret_name}",
    list: "GET /repos/{owner}/{repo}/dependabot/secrets",
    remove: "DELETE /repos/{owner}/{repo}/dependabot/secrets/{secret_name}",
  },
  codespaces: {
    publicKey: "GET /repos/{owner}/{repo}/codespaces/secrets/public-key",
    put: "PUT /repos/{owner}/{repo}/codespaces/secrets/{secret_name}",
    list: "GET /repos/{owner}/{repo}/codespaces/secrets",
    remove: "DELETE /repos/{owner}/{repo}/codespaces/secrets/{secret_name}",
  },
} as const;

/**
 * Write, list and delete repository and environment secrets, encrypted
 * client-side before they leave the process.
 *
 * @remarks
 * Every write is a **two-step**: fetch the store's public key, then `PUT` a
 * libsodium sealed box. The plaintext never crosses the wire, and the key fetch
 * cannot be cached across stores because each has its own key.
 *
 * ## The value is `Redacted`
 *
 * Not decoration. A plaintext secret in a `string` is one interpolation, one
 * `JSON.stringify` of a params object, or one logged error away from a
 * transcript — and the log line that leaks it usually looks like a diagnostic
 * someone added to debug an unrelated failure. `Redacted` closes those paths at
 * the type; this module performs the single `Redacted.value` unwrap, at the
 * moment of encryption, and the sealed box is what continues.
 *
 * Provide it with {@link RepositorySecret.layer}, which needs a `GitHubClient`;
 * each method also needs a `Repo` in `R`.
 *
 * @example
 * ```ts
 * import { RepositorySecret } from "./index.ts";
 * import { Effect, Redacted } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const secrets = yield* RepositorySecret;
 *   yield* secrets.set("NPM_TOKEN", Redacted.make("npm_example"), "actions");
 *   return yield* secrets.list("actions"); // names only; values are never returned
 * });
 * ```
 *
 * @public
 */
export class RepositorySecret extends Context.Service<RepositorySecret, RepositorySecretShape>()(
  "@beep/scratchpad/effected/github/RepositorySecret",
) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * @remarks
   * `(client) => make(client)` rather than `make`: a static initializer runs
   * while the module body is still evaluating, so naming a `const` declared
   * further down throws at import time with a clean typecheck.
   */
  static readonly layer: Layer.Layer<RepositorySecret, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client)),
  );

  /** An in-memory double; unstubbed members die naming themselves. */
  static readonly makeTest = (overrides: Partial<RepositorySecretShape> = {}): RepositorySecretShape => ({
    set: overrides.set ?? (() => unstubbed("set")),
    list: overrides.list ?? (() => unstubbed("list")),
    delete: overrides.delete ?? (() => unstubbed("delete")),
    setForEnvironment: overrides.setForEnvironment ?? (() => unstubbed("setForEnvironment")),
    listForEnvironment: overrides.listForEnvironment ?? (() => unstubbed("listForEnvironment")),
    deleteForEnvironment: overrides.deleteForEnvironment ?? (() => unstubbed("deleteForEnvironment")),
  });

  /** {@link RepositorySecret.makeTest} behind a `Layer`. */
  static readonly layerTest = (overrides: Partial<RepositorySecretShape> = {}): Layer.Layer<RepositorySecret> =>
    Layer.succeed(RepositorySecret, RepositorySecret.makeTest(overrides));
}

const unstubbed = (member: string): never => {
  throw new Error(`RepositorySecret.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

/**
 * Seal a value, turning a malformed public key into a typed failure.
 *
 * @remarks
 * `encryptSecret` returns a `Result` because a base64 decode can fail. A public
 * key GitHub cannot have produced is still *input*, and input failures are
 * typed rather than thrown — so this maps it onto the same `GitHubError` a
 * caller already handles, naming the route it came from.
 */
const seal = (route: string, publicKey: string, value: Redacted.Redacted<string>): Effect.Effect<string, GitHubError> =>
  Result.match(encryptSecret(publicKey, Redacted.value(value)), {
    onSuccess: (sealed) => Effect.succeed(sealed),
    onFailure: () => Effect.fail(GitHubError.decode(route, "the secrets public key was not valid base64")),
  });

const make = (client: GitHubClient["Service"]): RepositorySecretShape => {
  const set = Effect.fn("RepositorySecret.set")(function* (
    name: string,
    value: Redacted.Redacted<string>,
    scope: SecretScope = "actions",
  ) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, scope, secret: name });

    const routes = ROUTES[scope];
    const publicKey = yield* client.request(routes.publicKey, { owner, repo });

    yield* client.request(routes.put, {
      owner,
      repo,
      secret_name: name,
      // The single unwrap, at the moment of encryption. What continues from
      // here is the sealed box.
      encrypted_value: yield* seal(routes.publicKey, publicKey.key, value),
      key_id: publicKey.key_id,
    });
  });

  const list = Effect.fn("RepositorySecret.list")(function* (scope: SecretScope = "actions") {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, scope });

    // Paginated: the array on one page is a page, not the count. A repository
    // with more secrets than a page holds would otherwise report a truncated
    // list that looks complete.
    const secrets = yield* client.paginate(ROUTES[scope].list, { owner, repo });
    return secrets.map((secret): SecretInfo => ({ name: secret.name }));
  });

  const delete_ = Effect.fn("RepositorySecret.delete")(function* (name: string, scope: SecretScope = "actions") {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, scope, secret: name });

    return yield* client.request(ROUTES[scope].remove, {
      owner,
      repo,
      secret_name: name,
    });
  });

  const setForEnvironment = Effect.fn("RepositorySecret.setForEnvironment")(function* (
    environment: string,
    name: string,
    value: Redacted.Redacted<string>,
  ) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({
      owner,
      repo,
      environment,
      secret: name,
    });

    const publicKey = yield* client.request(
      "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key",
      { owner, repo, environment_name: environment },
    );

    yield* client.request("PUT /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}", {
      owner,
      repo,
      environment_name: environment,
      secret_name: name,
      encrypted_value: yield* seal(
        "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key",
        publicKey.key,
        value,
      ),
      key_id: publicKey.key_id,
    });
  });

  const listForEnvironment = Effect.fn("RepositorySecret.listForEnvironment")(function* (environment: string) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, environment });

    const secrets = yield* client.paginate("GET /repos/{owner}/{repo}/environments/{environment_name}/secrets", {
      owner,
      repo,
      environment_name: environment,
    });
    return secrets.map((secret): SecretInfo => ({ name: secret.name }));
  });

  const deleteForEnvironment = Effect.fn("RepositorySecret.deleteForEnvironment")(function* (
    environment: string,
    name: string,
  ) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({
      owner,
      repo,
      environment,
      secret: name,
    });

    return yield* client.request("DELETE /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}", {
      owner,
      repo,
      environment_name: environment,
      secret_name: name,
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
