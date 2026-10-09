import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { encryptSecret } from "./internal/crypto.ts";
import { Repo } from "./Repo.ts";

const $I = $ScratchpadId.create("effected/github/RepositorySecret");

class UnstubbedError extends S.TaggedError<UnstubbedError>($I`UnstubbedError`)("UnstubbedError", {
	message: S.String,
}, $I.annote("UnstubbedError", { description: "An unconfigured test-double member was called." })) {}

/**
 * Which secret store an operation acts on.
 *
 * **Details**
 *
 * Three separate stores on the same repository, each with **its own public
 * key** — which is why a key fetch cannot be cached across scopes.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type SecretScope = "actions" | "dependabot" | "codespaces";

/**
 * A secret, as listing returns it.
 *
 * **Details**
 *
 * The name only. GitHub never returns a secret's value from any endpoint —
 * that is the point of a secret store — so there is nothing else to carry, and
 * a consumer comparing desired against live can detect a **deleted** secret but
 * never an **edited** one.
 *
 * **Example** (Decode a secret listing entry)
 *
 * ```ts
 * import { SecretInfo } from "@beep/scratchpad/effected/github/RepositorySecret";
 * import * as S from "effect/Schema";
 *
 * const secret = S.decodeUnknownSync(SecretInfo)({ name: "NPM_TOKEN" });
 * console.log(secret.name) // NPM_TOKEN
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const SecretInfo = S.Struct({
  name: S.String.annotateKey({ description: "The secret's name; its value is never returned by GitHub." }),
}).pipe($I.annoteSchema("SecretInfo", { description: "A secret name returned by repository or environment listings." }));

/**
 * The plain-object secret listing fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SecretInfo = typeof SecretInfo.Type;

/**
 * Write, list and delete Actions, Dependabot and Codespaces secrets on a
 * repository, and Actions secrets on its environments.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface RepositorySecretShape {
  /**
   * Encrypt and write one repository secret in the given store.
   *
   * @since 0.0.0
   */
  readonly set: (
    name: string,
    value: Redacted.Redacted<string>,
    scope?: SecretScope,
  ) => Effect.Effect<void, GitHubError, Repo>;
  /**
   * The names of the repository's secrets in the given store.
   *
   * @since 0.0.0
   */
  readonly list: (scope?: SecretScope) => Effect.Effect<ReadonlyArray<SecretInfo>, GitHubError, Repo>;
  /**
   * Remove one repository secret from the given store.
   *
   * @since 0.0.0
   */
  readonly delete: (name: string, scope?: SecretScope) => Effect.Effect<void, GitHubError, Repo>;

  /**
   * Encrypt and write one environment secret.
   *
   * @since 0.0.0
   */
  readonly setForEnvironment: (
    environment: string,
    name: string,
    value: Redacted.Redacted<string>,
  ) => Effect.Effect<void, GitHubError, Repo>;
  /**
   * The names of one environment's secrets.
   *
   * @since 0.0.0
   */
  readonly listForEnvironment: (environment: string) => Effect.Effect<ReadonlyArray<SecretInfo>, GitHubError, Repo>;
  /**
   * Remove one environment secret.
   *
   * @since 0.0.0
   */
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
 * **Gotchas**
 *
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
 * **Example** (Set an encrypted Actions secret and list secret names)
 *
 * ```ts
 * import { RepositorySecret } from "@beep/scratchpad/effected/github/RepositorySecret";
 * import * as Effect from "effect/Effect";
 * import * as Redacted from "effect/Redacted";
 *
 * const program = Effect.gen(function* () {
 *   const secrets = yield* RepositorySecret;
 *   yield* secrets.set("NPM_TOKEN", Redacted.make("npm_example"), "actions");
 *   return yield* secrets.list("actions"); // names only; values are never returned
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class RepositorySecret extends Context.Service<RepositorySecret, RepositorySecretShape>()(
  $I`RepositorySecret`,
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
   * import { RepositorySecret } from "@beep/scratchpad/effected/github/RepositorySecret";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(RepositorySecret.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<RepositorySecret, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client)),
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Stub one service operation)
   *
   * ```ts
   * import { RepositorySecret } from "@beep/scratchpad/effected/github/RepositorySecret";
   * import * as Effect from "effect/Effect";
   *
   * const service = RepositorySecret.makeTest({ delete: () => Effect.void });
   * console.log(Effect.isEffect(service.delete("NPM_TOKEN"))) // true
   * ```
   *
   * @category testing
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<RepositorySecretShape> = {}): RepositorySecretShape => ({
    set: overrides.set ?? (() => unstubbed("set")),
    list: overrides.list ?? (() => unstubbed("list")),
    delete: overrides.delete ?? (() => unstubbed("delete")),
    setForEnvironment: overrides.setForEnvironment ?? (() => unstubbed("setForEnvironment")),
    listForEnvironment: overrides.listForEnvironment ?? (() => unstubbed("listForEnvironment")),
    deleteForEnvironment: overrides.deleteForEnvironment ?? (() => unstubbed("deleteForEnvironment")),
  });

  /**
   * {@link RepositorySecret.makeTest} behind a `Layer`.
   *
   * **Example** (Construct a test service layer)
   *
   * ```ts
   * import { RepositorySecret } from "@beep/scratchpad/effected/github/RepositorySecret";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(RepositorySecret.layerTest())) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<RepositorySecretShape> = {}): Layer.Layer<RepositorySecret> =>
    Layer.succeed(RepositorySecret, RepositorySecret.makeTest(overrides));
}

const unstubbed = (member: string): never => {
  throw UnstubbedError.make({ message: `RepositorySecret.makeTest: ${member}() was called but not stubbed — pass an override.` });
};

/**
 * Seal a value, turning a malformed public key into a typed failure.
 *
 * **Details**
 *
 * `encryptSecret` returns a `Result` because base64 decoding or key length validation can fail. A public
 * key GitHub cannot have produced is still *input*, and input failures are
 * typed rather than thrown — so this maps it onto the same `GitHubError` a
 * caller already handles, naming the route it came from.
 */
const seal = (route: string, publicKey: string, value: Redacted.Redacted<string>): Effect.Effect<string, GitHubError> =>
  Result.match(encryptSecret(publicKey, Redacted.value(value)), {
    onSuccess: Effect.succeed,
    onFailure: () => Effect.fail(GitHubError.decode(route, "the secrets public key was not valid base64 encoding of a 32-byte key")),
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

    yield* client.request(ROUTES[scope].remove, {
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

    yield* client.request("DELETE /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}", {
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
