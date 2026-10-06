/**
 * Which GitHub identity the repo CLI's in-process GitHub client speaks as.
 *
 * **Details**
 *
 * GitHub GraphQL is a 5,000-point hourly budget per user, shared by every
 * session on the workstation account. A different identity has its own
 * budget: a personal token held in 1Password (`--token-ref op://…` or
 * `BEEP_GH_TOKEN_REF`), or a GitHub App installation token minted through
 * `@effected/github`'s `GitHubApp` (`BEEP_GH_APP_ID`,
 * `BEEP_GH_APP_INSTALLATION_ID`, `BEEP_GH_APP_KEY_REF`). Without either, the
 * client borrows the `gh` CLI login (`gh auth token`). Every token stays a
 * `Redacted` value inside this process; it is never printed or written.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { GitHubApp, GitHubClient, Repo, RepoRef } from "@effected/github";
import { Effect, Layer, pipe, Redacted, Runtime } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { configStringOption } from "../cli/EnvConfig.ts";
import { runRepoCommandCaptureRaw } from "../repo-run/RepoRun.executor.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";

const $I = $RepoCliId.create("internal/github/GithubIdentity");

/**
 * Environment variable naming a 1Password reference to an alternate GitHub token.
 *
 * @category constants
 * @since 0.0.0
 */
export const GITHUB_TOKEN_REF_ENV = "BEEP_GH_TOKEN_REF";

/**
 * Environment variables that together select a GitHub App installation identity.
 *
 * **Example** (Read the App variable names)
 *
 * ```ts
 * import { GITHUB_APP_ENV } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(GITHUB_APP_ENV.appId) // "BEEP_GH_APP_ID"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GITHUB_APP_ENV = {
  appId: "BEEP_GH_APP_ID",
  installationId: "BEEP_GH_APP_INSTALLATION_ID",
  privateKeyRef: "BEEP_GH_APP_KEY_REF",
} as const;

/**
 * The kinds of identity the client can speak as.
 *
 * **Example** (List the identity kinds)
 *
 * ```ts
 * import { GithubIdentityKind } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(GithubIdentityKind.literals) // ["gh-cli", "op-ref", "github-app"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubIdentityKind = LiteralKit(["gh-cli", "op-ref", "github-app"]).pipe(
  $I.annoteSchema("GithubIdentityKind", { description: "Which GitHub identity the in-process client uses." })
);

/**
 * Type of {@link GithubIdentityKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubIdentityKind = typeof GithubIdentityKind.Type;

/**
 * A selected GitHub identity, holding references only, never a token.
 *
 * **Details**
 *
 * `tokenRef` is set for `op-ref`; `appId`, `installationId`, and
 * `privateKeyRef` are set for `github-app`. The private key and the token are
 * resolved from 1Password only when the client layer is built.
 *
 * **Example** (The default identity)
 *
 * ```ts
 * import { GithubIdentity } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * const identity = GithubIdentity.make({
 *   kind: "gh-cli",
 *   tokenRef: O.none(),
 *   appId: O.none(),
 *   installationId: O.none(),
 *   privateKeyRef: O.none()
 * })
 * console.log(identity.kind) // "gh-cli"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubIdentity extends S.Class<GithubIdentity>($I`GithubIdentity`)(
  {
    kind: GithubIdentityKind,
    tokenRef: S.Option(S.String),
    appId: S.Option(S.String),
    installationId: S.Option(S.Int),
    privateKeyRef: S.Option(S.String),
  },
  $I.annote("GithubIdentity", { description: "A selected GitHub identity, as references only." })
) {
  /** A short, secret-free label for logs. */
  get label(): string {
    return this.kind === "github-app"
      ? `github-app ${O.getOrElse(this.appId, () => "?")}/${O.getOrElse(
          O.map(this.installationId, (id) => `${id}`),
          () => "?"
        )}`
      : this.kind;
  }
}

/**
 * Why a GitHub identity, token, or repository could not be resolved.
 *
 * @category errors
 * @since 0.0.0
 */
export const GithubIdentityErrorReason = LiteralKit([
  "token-unavailable",
  "op-read-failed",
  "app-config",
  "app-token-failed",
  "repo-unknown",
]).pipe($I.annoteSchema("GithubIdentityErrorReason", { description: "Why a GitHub identity did not resolve." }));

/**
 * A GitHub identity, token, or repository failed to resolve. The message never
 * carries a token value.
 *
 * **Example** (Build an identity error)
 *
 * ```ts
 * import { GithubIdentityError } from "@beep/repo-cli/test/SharedInternals"
 *
 * const error = GithubIdentityError.make({ reason: "repo-unknown", message: "no origin remote" })
 * console.log(error.reason) // "repo-unknown"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GithubIdentityError extends S.TaggedError<GithubIdentityError>($I`GithubIdentityError`)(
  "GithubIdentityError",
  { reason: GithubIdentityErrorReason, message: S.String },
  $I.annoteError<GithubIdentityError>("GithubIdentityError", {
    description: "A GitHub identity, token, or repository failed to resolve.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;
}

const identityError = (reason: typeof GithubIdentityErrorReason.Type, message: string) =>
  GithubIdentityError.make({ reason, message });

/**
 * Choose the identity: an explicit token reference wins, then
 * `BEEP_GH_TOKEN_REF`, then a complete `BEEP_GH_APP_*` triple, then the `gh`
 * CLI login. A partial App triple is a configuration error, never a silent
 * fallback.
 *
 * **Example** (Select from an explicit reference)
 *
 * ```ts
 * import { selectGithubIdentity } from "@beep/repo-cli/test/SharedInternals"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(selectGithubIdentity(O.some("op://vault/item/token")))) // true
 * ```
 *
 * @param explicitTokenRef - The `--token-ref` flag value, if given.
 * @returns The selected identity.
 * @category constructors
 * @since 0.0.0
 */
export const selectGithubIdentity = Effect.fn("GithubIdentity.select")(function* (explicitTokenRef: O.Option<string>) {
  const envTokenRef = yield* configStringOption(GITHUB_TOKEN_REF_ENV);
  const tokenRef = pipe(
    explicitTokenRef,
    O.orElse(() => envTokenRef),
    O.map(Str.trim),
    O.filter(Str.isNonEmpty)
  );
  if (O.isSome(tokenRef)) {
    return GithubIdentity.make({
      kind: "op-ref",
      tokenRef,
      appId: O.none(),
      installationId: O.none(),
      privateKeyRef: O.none(),
    });
  }
  const appId = yield* configStringOption(GITHUB_APP_ENV.appId);
  const installationRaw = yield* configStringOption(GITHUB_APP_ENV.installationId);
  const privateKeyRef = yield* configStringOption(GITHUB_APP_ENV.privateKeyRef);
  const present = [appId, installationRaw, privateKeyRef].filter(O.isSome).length;
  if (present === 0) {
    return GithubIdentity.make({
      kind: "gh-cli",
      tokenRef: O.none(),
      appId: O.none(),
      installationId: O.none(),
      privateKeyRef: O.none(),
    });
  }
  const installationId = O.flatMap(installationRaw, (raw) => {
    const parsed = Number(Str.trim(raw));
    return Number.isSafeInteger(parsed) && parsed > 0 ? O.some(parsed) : O.none();
  });
  if (present < 3 || O.isNone(installationId)) {
    return yield* identityError(
      "app-config",
      `a GitHub App identity needs ${GITHUB_APP_ENV.appId}, a numeric ${GITHUB_APP_ENV.installationId}, and ${GITHUB_APP_ENV.privateKeyRef} (an op:// reference to the PEM key)`
    );
  }
  return GithubIdentity.make({ kind: "github-app", tokenRef: O.none(), appId, installationId, privateKeyRef });
});

const readSecretOutput = Effect.fn("GithubIdentity.readSecretOutput")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  reason: typeof GithubIdentityErrorReason.Type,
  what: string
) {
  // stdout only: stderr would mix diagnostics into the secret. The failure
  // message names the command, never its output, because the output is the secret.
  const result = yield* runRepoCommandCaptureRaw(command, args, cwd).pipe(
    Effect.mapError(() => identityError(reason, `could not run ${command} to read ${what}`))
  );
  const value = Str.trim(result.output);
  if (result.exitCode !== 0 || result.truncated || Str.isEmpty(value)) {
    return yield* identityError(reason, `${command} did not return ${what} (exit ${result.exitCode})`);
  }
  return Redacted.make(value);
});

const readOpReference = (reference: string, cwd: string, what: string) =>
  readSecretOutput("op", ["read", "--no-newline", reference], cwd, "op-read-failed", what);

/**
 * The identity to speak as and the working directory for its `gh`/`op` child processes.
 *
 * @category models
 * @since 0.0.0
 */
export class GithubClientRequest extends S.Class<GithubClientRequest>($I`GithubClientRequest`)(
  { identity: GithubIdentity, cwd: S.String },
  $I.annote("GithubClientRequest", { description: "An identity and the working directory to resolve its token in." })
) {}

/**
 * Build the `@effected/github` client layer for an identity.
 *
 * **Details**
 *
 * `gh-cli` reads `gh auth token`; `op-ref` reads the reference through the
 * PATH `op` shim; `github-app` reads the PEM key through `op` and mints an
 * installation token with `GitHubApp.clientLayer`, so the client carries the
 * App's own rate-limit budget.
 *
 * **Example** (Build the default client layer)
 *
 * ```ts
 * import { GithubClientRequest, GithubIdentity, layerGithubClientFor } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * const identity = GithubIdentity.make({
 *   kind: "gh-cli",
 *   tokenRef: O.none(),
 *   appId: O.none(),
 *   installationId: O.none(),
 *   privateKeyRef: O.none()
 * })
 * console.log(typeof layerGithubClientFor(GithubClientRequest.make({ identity, cwd: process.cwd() }))) // "object"
 * ```
 *
 * @param options - The selected identity and the working directory for the `gh`/`op` child processes.
 * @returns A layer providing `GitHubClient`.
 * @category layers
 * @since 0.0.0
 */
export const layerGithubClientFor = ({
  identity,
  cwd,
}: GithubClientRequest): Layer.Layer<
  GitHubClient,
  GithubIdentityError,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> =>
  Layer.unwrap(
    Effect.gen(function* () {
      if (identity.kind === "github-app") {
        const appId = yield* Effect.fromOption(identity.appId, () => identityError("app-config", "missing app id"));
        const installationId = yield* Effect.fromOption(identity.installationId, () =>
          identityError("app-config", "missing installation id")
        );
        const keyRef = yield* Effect.fromOption(identity.privateKeyRef, () =>
          identityError("app-config", "missing private key reference")
        );
        const privateKey = yield* readOpReference(keyRef, cwd, "the GitHub App private key");
        return GitHubApp.clientLayer({ appId, privateKey, installationId }).pipe(
          Layer.catchTag("GitHubAppError", (error) =>
            Layer.effect(
              GitHubClient,
              Effect.fail(
                identityError("app-token-failed", `could not mint a GitHub App installation token: ${error.message}`)
              )
            )
          )
        );
      }
      const token =
        identity.kind === "op-ref"
          ? yield* readOpReference(
              O.getOrElse(identity.tokenRef, () => ""),
              cwd,
              "the GitHub token"
            )
          : yield* readSecretOutput("gh", ["auth", "token"], cwd, "token-unavailable", "a gh login token");
      return GitHubClient.layerFromToken({ token });
    })
  );

const remotePattern =
  /^(?:[^@/\s]+@[^:/\s]+:|ssh:\/\/[^/]+\/|https?:\/\/[^/]+\/)([^/?#\s]+)\/([^/?#\s]+?)(?:\.git)?\/?$/;

/**
 * Parse an `owner/repo` slug from a git remote URL.
 *
 * **Example** (Parse SSH and HTTPS remotes)
 *
 * ```ts
 * import { repoSlugFromRemote } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrElse(repoSlugFromRemote("https://github.com/beep-effect/beep-effect.git"), () => "")) // "beep-effect/beep-effect"
 * ```
 *
 * @param remote - The remote URL.
 * @returns The slug, or none for an unrecognised URL.
 * @category parsing
 * @since 0.0.0
 */
export const repoSlugFromRemote = (remote: string): O.Option<string> =>
  pipe(
    O.fromNullishOr(Str.trim(remote).match(remotePattern)),
    O.flatMap((parts) =>
      O.zipWith(O.fromNullishOr(parts[1]), O.fromNullishOr(parts[2]), (owner, name) => `${owner}/${name}`)
    )
  );

/**
 * Resolve the repository the client acts on: `GH_REPO` when set, else the
 * `origin` remote of the checkout.
 *
 * **Example** (Build the repository layer)
 *
 * ```ts
 * import { layerGithubRepoFor } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(typeof layerGithubRepoFor(process.cwd())) // "object"
 * ```
 *
 * @param cwd - The checkout to read the remote from.
 * @returns A layer providing `@effected/github`'s `Repo`.
 * @category layers
 * @since 0.0.0
 */
export const layerGithubRepoFor = (
  cwd: string
): Layer.Layer<Repo, GithubIdentityError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const override = yield* configStringOption("GH_REPO");
      const slug = O.isSome(override)
        ? override
        : yield* runRepoCommandCaptureRaw("git", ["remote", "get-url", "origin"], cwd).pipe(
            Effect.map((result) => (result.exitCode === 0 ? repoSlugFromRemote(result.output) : O.none())),
            Effect.orElseSucceed(() => O.none<string>())
          );
      const value = yield* Effect.fromOption(slug, () =>
        identityError("repo-unknown", "could not resolve the GitHub repository (set GH_REPO or an origin remote)")
      );
      const ref = yield* RepoRef.parse(value).pipe(
        Effect.mapError(() => identityError("repo-unknown", `"${value}" is not an owner/repo slug`))
      );
      return Repo.layer(ref);
    })
  );
