/**
 * The reviewer's GitHub App identity: credentials from the environment or
 * 1Password, and a down-scoped installation client from `@beep/github`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Run } from "@beep/commands/Run";
import { assertPermissions, GitHubApp } from "@beep/github/GitHubApp";
import { GitHubClient } from "@beep/github/GitHubClient";
import { $RepoCliId } from "@beep/identity/packages";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { ReviewerError } from "./ReviewerErrors.ts";
import { ReviewerCredentials, reviewerWire } from "./ReviewerModels.ts";
import type { GitHubAppError, GitHubAppOptions, TokenRequest } from "@beep/github/GitHubApp";
import type { TokenPermissionError } from "@beep/github/TokenPermissions";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliId.create("commands/Reviewer/GitHubAppAuth.service");
const CredentialInput = S.Struct({
  appId: S.FiniteFromString,
  clientId: S.NonEmptyString,
  installationId: S.FiniteFromString,
  privateKey: S.Redacted(S.String),
});
const decodeCredentialInput = S.decodeUnknownEffect(CredentialInput);
const failure = (operation: string, message: string) => ReviewerError.make({ operation, message });
const isReviewerCredentials = S.is(ReviewerCredentials);

/**
 * The permissions every reviewer installation token is narrowed to, by GitHub's names.
 *
 * **Details**
 *
 * The same set is the request body of each mint and the floor
 * `assertPermissions` checks the first mint against, so a token GitHub granted
 * below it fails closed before any review is published.
 *
 * **Example** (Read the requested check permission)
 * ```ts
 * import { REVIEWER_TOKEN_PERMISSIONS } from "@beep/repo-cli/commands/Reviewer";
 * console.log(REVIEWER_TOKEN_PERMISSIONS.checks); // write
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const REVIEWER_TOKEN_PERMISSIONS = {
  checks: "write",
  pull_requests: "write",
  issues: "write",
  contents: "read",
  metadata: "read",
} as const;

/**
 * How long before expiry the reviewer client re-mints its installation token.
 *
 * **Example** (Read the refresh margin)
 * ```ts
 * import { REVIEWER_TOKEN_REFRESH_SKEW } from "@beep/repo-cli/commands/Reviewer";
 * import * as Duration from "effect/Duration";
 * console.log(Duration.toMinutes(REVIEWER_TOKEN_REFRESH_SKEW)); // 5
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const REVIEWER_TOKEN_REFRESH_SKEW = Duration.minutes(5);

/**
 * The down-scoped installation-token request for the reviewer credentials.
 *
 * **Details**
 *
 * The client id is the JWT issuer, as the hand-rolled signer used; GitHub
 * accepts it in place of the numeric app id. The token is narrowed to the
 * `beep-effect` repository and {@link REVIEWER_TOKEN_PERMISSIONS}.
 *
 * **Example** (Build the request without signing anything)
 * ```ts
 * import { ReviewerCredentials, reviewerTokenRequest } from "@beep/repo-cli/commands/Reviewer";
 * import * as Redacted from "effect/Redacted";
 * const credentials = ReviewerCredentials.make({
 *   appId: 42, clientId: "Iv.example", installationId: 7, privateKey: Redacted.make("example PEM"),
 * });
 * console.log(reviewerTokenRequest(credentials).repositories); // [ "beep-effect" ]
 * ```
 *
 * @param credentials - App signing credentials and installation identity.
 * @returns The `TokenRequest` every reviewer mint sends.
 * @category configuration
 * @since 0.0.0
 */
export const reviewerTokenRequest = (credentials: ReviewerCredentials): TokenRequest.Encoded => ({
  appId: credentials.clientId,
  privateKey: credentials.privateKey,
  installationId: credentials.installationId,
  permissions: REVIEWER_TOKEN_PERMISSIONS,
  repositories: ["beep-effect"],
});

const opReference = (field: string) => `op://BEEP_SECRETS/beep-reviewer GitHub App/${field}`;

// The local `op` shim, or `op` on the SSH host when BEEP_REVIEWER_OP_SSH names one.
const secretCommand = (field: string, host: O.Option<string>): ChildProcess.Command =>
  O.match(host, {
    onNone: () => ChildProcess.make("op", ["read", opReference(field)]),
    onSome: (name) => ChildProcess.make("ssh", ["-o", "BatchMode=yes", "--", name, `op read '${opReference(field)}'`]),
  });

// The doctor's report goes to the operator's terminal; its stderr stays out of it.
const doctorCommand = (host: O.Option<string>): ChildProcess.Command =>
  O.match(host, {
    onNone: () => ChildProcess.make("op-doctor", [], { stdout: "inherit", stderr: "ignore" }),
    onSome: (name) =>
      ChildProcess.make("ssh", ["-o", "BatchMode=yes", "--", name, "op-doctor"], {
        stdout: "inherit",
        stderr: "ignore",
      }),
  });

// The secret is the read's own output, so no value is known in advance for
// `RunOptions.redact`; every failure is replaced by a fixed message instead, so
// neither the captured streams nor the platform error reach a log.
const secretRead = Effect.fn("Reviewer.secretRead")(function* (field: string, host: O.Option<string>) {
  const value = yield* Run.text(secretCommand(field, host)).pipe(Effect.option);
  if (O.isSome(value)) return Redacted.make(value.value);
  yield* Run.exitCode(doctorCommand(host)).pipe(Effect.ignore);
  return yield* failure(
    "credentials",
    `${O.isSome(host) ? "ssh" : "op"} op read field ${field} failed; op-doctor ran once. Secret path stopped.`
  );
});

/**
 * Resolves each credential from its environment variable, then the selected 1Password lane.
 *
 * **Details**
 * Set BEEP_REVIEWER_OP_SSH=dankstation to use the Tailscale SSH fallback. No key file is created.
 * The `op read` (or `ssh ... op read`) and `op-doctor` children run through `@beep/commands` `Run`.
 *
 * **Example** (Compose credential loading)
 * ```ts
 * import { loadReviewerCredentials } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
 * console.log(Effect.isEffect(loadReviewerCredentials));
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const loadReviewerCredentials: Effect.Effect<
  ReviewerCredentials,
  ReviewerError,
  ChildProcessSpawner.ChildProcessSpawner
> = Effect.gen(function* () {
  const host = yield* Config.option(Config.String("BEEP_REVIEWER_OP_SSH"));
  const resolve = Effect.fn("Reviewer.resolveCredential")(function* (env: string, field: string) {
    const value = yield* Config.option(Config.Redacted(env));
    return O.isSome(value) ? value.value : yield* secretRead(field, host);
  });
  const appId = yield* resolve("BEEP_REVIEWER_APP_ID", "app_id");
  const clientId = yield* resolve("BEEP_REVIEWER_CLIENT_ID", "client_id");
  const installationId = yield* resolve("BEEP_REVIEWER_INSTALLATION_ID", "installation_id");
  const privateKey = yield* resolve("BEEP_REVIEWER_PRIVATE_KEY", "private_key");
  const input = yield* decodeCredentialInput({
    appId: Redacted.value(appId),
    clientId: Redacted.value(clientId),
    installationId: Redacted.value(installationId),
    privateKey,
  });
  return yield* reviewerWire.credentials(input);
}).pipe(
  Effect.mapError((error) =>
    error._tag === "ReviewerError"
      ? error
      : failure("credentials", "Reviewer credentials could not be resolved or validated.")
  )
);

interface GitHubAppAuthShape {
  readonly appId: number;
}

/**
 * The reviewer App's numeric id, the identity every ownership check compares against.
 *
 * **Details**
 *
 * Publishing goes through the `GitHubClient` {@link makeGitHubAppAuth} builds
 * alongside this service; the service itself holds no token.
 *
 * **Example** (Read the App id)
 * ```ts
 * import { GitHubAppAuth } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
 * const program = GitHubAppAuth.use((auth) => Effect.succeed(auth.appId));
 * console.log(Effect.isEffect(program));
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GitHubAppAuth extends Context.Service<GitHubAppAuth, GitHubAppAuthShape>()($I`GitHubAppAuth`) {}

// Every failure keeps the one user-facing message the hand-rolled exchange
// reported; the operation records whether signing or the exchange failed.
const tokenFailure = (error: GitHubAppError | TokenPermissionError) =>
  failure(
    error._tag === "GitHubAppError" && error.kind === "jwt" ? "jwt" : "token",
    "Reviewer installation token exchange failed."
  );

/**
 * Mints one down-scoped installation token and fails closed on what GitHub granted.
 *
 * **Details**
 *
 * The token request is {@link reviewerTokenRequest}; the grant must hold every
 * {@link REVIEWER_TOKEN_PERMISSIONS} entry (`assertPermissions`), and a refused
 * grant's token is revoked at once. An accepted token is neither cached nor
 * revoked: the `reviewer token` command prints it for a pipe, and
 * {@link makeGitHubAppAuth} revokes its own check token itself.
 *
 * **Example** (Compose a one-shot mint)
 * ```ts
 * import { mintReviewerToken, ReviewerCredentials } from "@beep/repo-cli/commands/Reviewer";
 * import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
 * import * as Redacted from "effect/Redacted";
 * const credentials = ReviewerCredentials.make({
 *   appId: 42, clientId: "Iv.example", installationId: 7, privateKey: Redacted.make("example PEM"),
 * });
 * console.log(Effect.isEffect(mintReviewerToken(credentials)));
 * ```
 *
 * @param credentials - App signing credentials and installation identity.
 * @returns The minted token, after the permission check; needs the `GitHubApp` transport.
 * @category use-cases
 * @since 0.0.0
 */
export const mintReviewerToken = Effect.fn("Reviewer.mintToken")(function* (credentials: ReviewerCredentials) {
  const app = yield* GitHubApp;
  const minted = yield* app.token(reviewerTokenRequest(credentials));
  // A grant below the floor is refused and its token handed straight back.
  return yield* assertPermissions(minted, REVIEWER_TOKEN_PERMISSIONS).pipe(
    Effect.tapError(() => Effect.ignore(app.revoke(minted.token)))
  );
}, Effect.mapError(tokenFailure));

/**
 * Builds the reviewer's installation client and App identity around supplied credentials.
 *
 * **Details**
 *
 * Building the layer first mints one token through {@link mintReviewerToken},
 * so a grant below {@link REVIEWER_TOKEN_PERMISSIONS} fails closed before any
 * review is published; that check token is revoked once read. The
 * `GitHubClient` is `GitHubApp.clientLayer` over the same down-scoped request,
 * re-minting {@link REVIEWER_TOKEN_REFRESH_SKEW} before expiry, serializing
 * concurrent refreshes, and revoking its last token when the layer is released.
 *
 * **Example** (Inspect the layer factory)
 * ```ts
 * import { makeGitHubAppAuth } from "@beep/repo-cli/commands/Reviewer";
 * console.log(typeof makeGitHubAppAuth);
 * ```
 *
 * @param credentials - App signing credentials and repository identity used to acquire installation tokens.
 * @param options - Transport settings for the App's calls (a replacement `fetch` in tests).
 * @returns A layer providing the App identity and an installation `GitHubClient`.
 * @category layers
 * @since 0.0.0
 */
export const makeGitHubAppAuth: {
  (
    credentials: ReviewerCredentials,
    options?: Omit<GitHubAppOptions.Encoded, "refreshSkew">
  ): Layer.Layer<GitHubAppAuth | GitHubClient, ReviewerError>;
  (
    options?: Omit<GitHubAppOptions.Encoded, "refreshSkew">
  ): (credentials: ReviewerCredentials) => Layer.Layer<GitHubAppAuth | GitHubClient, ReviewerError>;
} = dual(
  (args) => isReviewerCredentials(args[0]),
  (
    credentials: ReviewerCredentials,
    options: Omit<GitHubAppOptions.Encoded, "refreshSkew"> = {}
  ): Layer.Layer<GitHubAppAuth | GitHubClient, ReviewerError> => {
    const auth = Layer.effect(
      GitHubAppAuth,
      Effect.gen(function* () {
        // Fail closed on the first mint, then hand the check token back.
        const checked = yield* mintReviewerToken(credentials);
        yield* GitHubApp.use((app) => app.revoke(checked.token)).pipe(Effect.ignore);
        return GitHubAppAuth.of({ appId: credentials.appId });
      })
    ).pipe(Layer.provide(GitHubApp.layerWith(options)));
    const client = GitHubApp.clientLayer(reviewerTokenRequest(credentials), {
      ...options,
      refreshSkew: REVIEWER_TOKEN_REFRESH_SKEW,
    }).pipe(
      Layer.catchTag("GitHubAppError", (error) => Layer.effect(GitHubClient, error.pipe(tokenFailure, Effect.fail)))
    );
    return client.pipe(Layer.provideMerge(auth));
  }
);

/**
 * Resolves credentials once and creates the reviewer's App identity and installation client.
 *
 * **Example** (Inspect the live layer)
 * ```ts
 * import { GitHubAppAuthLive } from "@beep/repo-cli/commands/Reviewer";
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(GitHubAppAuthLive));
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GitHubAppAuthLive: Layer.Layer<
  GitHubAppAuth | GitHubClient,
  ReviewerError,
  ChildProcessSpawner.ChildProcessSpawner
> = Layer.unwrap(Effect.map(loadReviewerCredentials, (credentials) => makeGitHubAppAuth(credentials)));
