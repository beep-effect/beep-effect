/**
 * Which GitHub identity the repo CLI's in-process GitHub client speaks as.
 *
 * **Details**
 *
 * GitHub GraphQL is a 5,000-point hourly budget per user, shared by every
 * session on the workstation account. A different identity has its own
 * budget: a personal token held in 1Password (`--token-ref op://…` or
 * `BEEP_GH_TOKEN_REF`), or a GitHub App installation token minted through
 * `@beep/github`'s `GitHubApp` (`BEEP_GH_APP_ID`,
 * `BEEP_GH_APP_INSTALLATION_ID`, `BEEP_GH_APP_KEY_REF`). Without either, the
 * client borrows the `gh` CLI login (`gh auth token`). Every token stays a
 * `Redacted` value inside this process; it is never printed or written.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { Run } from "@beep/commands/Run";
import { Git } from "@beep/git/Git";
import { GitHubApp } from "@beep/github/GitHubApp";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo, RepoRef } from "@beep/github/Repo";
import { credentialFingerprint } from "@beep/github/Resilience";
import { $RepoCliId } from "@beep/identity/packages";
import { configStringOption } from "@beep/repo-cli-kit/cli/EnvConfig";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Redacted from "effect/Redacted";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubAppId, GithubInstallationId, GithubPrivateKeyRef, GithubTokenRef } from "./GithubIdentity.fields.ts";
import { resolveGithubIdentityLabel } from "./GithubIdentityLabel.ts";
import { ConfiguredGithubIdentity } from "./GithubLedger.schemas.ts";
import type { CommandFailedError, CommandOutputError } from "@beep/commands/Run";
import type { GitHubClientOptions } from "@beep/github/GitHubClient";
import type { CredentialFingerprint } from "@beep/github/Resilience";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GithubIdentityLabel } from "./GithubLedger.schemas.ts";

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
export class GithubIdentity extends S.Opaque<GithubIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: GithubIdentityKind,
    tokenRef: S.Option(GithubTokenRef),
    appId: S.Option(GithubAppId),
    installationId: S.Option(GithubInstallationId),
    privateKeyRef: S.Option(GithubPrivateKeyRef),
  }).pipe($I.annoteSchema("GithubIdentity", { description: "A selected GitHub identity, as references only." }))
) {}

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
export class GithubIdentityError extends S.TaggedError<GithubIdentityError, { readonly brand: unique symbol }>(
  $I`GithubIdentityError`
)(
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
 * import * as Effect from "effect/Effect";
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
    if (!S.is(GithubTokenRef)(tokenRef.value)) {
      return yield* identityError(
        "op-read-failed",
        `the GitHub token reference (--token-ref or ${GITHUB_TOKEN_REF_ENV}) must be an op://vault/item/[section/]field reference; a name with characters other than letters, digits, -, _, . and spaces goes by its 1Password ID`
      );
    }
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
  const present = A.filter([appId, installationRaw, privateKeyRef], O.isSome).length;
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
  const validKeyRef = O.exists(privateKeyRef, S.is(GithubPrivateKeyRef));
  const validAppId = O.exists(appId, S.is(GithubAppId));
  if (present < 3 || O.isNone(installationId) || !validKeyRef || !validAppId) {
    return yield* identityError(
      "app-config",
      `a GitHub App identity needs ${GITHUB_APP_ENV.appId}, a numeric ${GITHUB_APP_ENV.installationId}, and ${GITHUB_APP_ENV.privateKeyRef} (an op:// reference to the PEM key)`
    );
  }
  return GithubIdentity.make({ kind: "github-app", tokenRef: O.none(), appId, installationId, privateKeyRef });
});

// What a failed secret read reports: the command and how it ended, never its output.
const secretReadFailure = (command: string, what: string, error: CommandFailedError | CommandOutputError): string =>
  error._tag === "CommandFailedError" && error.kind === "spawn"
    ? `could not run ${command} to read ${what}`
    : `${command} did not return ${what} (exit ${error.exitCode ?? "none"})`;

const readSecretOutput = Effect.fn("GithubIdentity.readSecretOutput")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  reason: typeof GithubIdentityErrorReason.Type,
  what: string
) {
  // `Run.text` returns trimmed stdout only, so stderr diagnostics never mix
  // into the secret. The secret is the output, so no value is known before
  // the read for `RunOptions.redact` to scrub; instead the failure message
  // names the command and its exit, never the captured streams.
  const value = yield* Run.text(ChildProcess.make(command, args, { cwd })).pipe(
    Effect.mapError((error) => identityError(reason, secretReadFailure(command, what, error)))
  );
  if (Str.isEmpty(value)) {
    return yield* identityError(reason, `${command} did not return ${what} (exit 0)`);
  }
  return Redacted.make(value);
});

const readOpReference = (reference: string, cwd: string, what: string) =>
  readSecretOutput("op", ["read", "--no-newline", reference], cwd, "op-read-failed", what);

/**
 * The `fetch` every client {@link layerGithubClientFor} builds sends its requests through.
 *
 * **Details**
 *
 * `Option.none()` (the default) leaves the `@beep/github` transport on the
 * global `fetch`. A suite that drives a command end to end provides a recording
 * fake here instead of patching the global; an explicit `options.fetch` passed
 * to {@link layerGithubClientFor} still wins.
 *
 * **Example** (Read the default transport)
 *
 * ```ts
 * import { GithubTransportFetch } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(Effect.runSync(Effect.service(GithubTransportFetch)))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const GithubTransportFetch: Context.Reference<O.Option<typeof globalThis.fetch>> = Context.Reference(
  $I`GithubTransportFetch`,
  { defaultValue: O.none<typeof globalThis.fetch> }
);

/**
 * The budget label of the client {@link layerGithubClientFor} built, when a
 * GitHub budget ledger was present to label it.
 *
 * **Details**
 *
 * A reference, so the client layer's output stays `GitHubClient` and no caller
 * signature changes. `GraphqlBudget` and the rate-limit sampler read it to find
 * the bucket the client draws on.
 *
 * **Example** (Read the default)
 *
 * ```ts
 * import { GithubBudgetIdentity } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(Effect.runSync(Effect.service(GithubBudgetIdentity)))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const GithubBudgetIdentity: Context.Reference<O.Option<GithubIdentityLabel>> = Context.Reference(
  $I`GithubBudgetIdentity`,
  { defaultValue: O.none<GithubIdentityLabel> }
);

/**
 * Physical token fingerprint carried alongside the client's canonical identity.
 *
 * **Example** (Read the default)
 *
 * ```ts
 * import { GithubBudgetCredential } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(GithubBudgetCredential)._tag) // "None"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const GithubBudgetCredential = Context.Reference<O.Option<CredentialFingerprint>>($I`GithubBudgetCredential`, {
  defaultValue: O.none,
});

/**
 * The identity to speak as and the working directory for its `gh`/`op` child processes.
 *
 * @category models
 * @since 0.0.0
 */
export class GithubClientRequest extends S.Opaque<GithubClientRequest, { readonly brand: unique symbol }>()(
  S.Struct({ identity: GithubIdentity, cwd: S.String }).pipe(
    $I.annoteSchema("GithubClientRequest", {
      description: "An identity and the working directory to resolve its token in.",
    })
  )
) {}

/**
 * Build the `@beep/github` client layer for an identity.
 *
 * **Details**
 *
 * `gh-cli` reads `gh auth token`; `op-ref` reads the reference through the
 * PATH `op` shim; `github-app` reads the PEM key through `op` and mints an
 * installation token with `GitHubApp.clientLayer`, so the client carries the
 * App's own rate-limit budget. The `gh` and `op` reads run through
 * `@beep/commands` `Run.text`; a failure names the command and its exit code,
 * never the captured output.
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
 * @param request - The selected identity and the working directory for the `gh`/`op` child processes.
 * @param options - Transport settings for the client (retry policy, base URL, `fetch`); the token comes from the identity.
 * @returns A layer providing `GitHubClient`.
 * @category layers
 * @since 0.0.0
 */
export const layerGithubClientFor: {
  (
    request: GithubClientRequest,
    options?: Omit<GitHubClientOptions.Encoded, "token">
  ): Layer.Layer<GitHubClient, GithubIdentityError, ChildProcessSpawner.ChildProcessSpawner>;
  (
    options?: Omit<GitHubClientOptions.Encoded, "token">
  ): (
    request: GithubClientRequest
  ) => Layer.Layer<GitHubClient, GithubIdentityError, ChildProcessSpawner.ChildProcessSpawner>;
} = dual(
  (args) => P.hasProperty(args[0], "identity"),
  (
    { identity, cwd }: GithubClientRequest,
    options: Omit<GitHubClientOptions.Encoded, "token"> = {}
  ): Layer.Layer<GitHubClient, GithubIdentityError, ChildProcessSpawner.ChildProcessSpawner> =>
    Layer.unwrap(
      Effect.gen(function* () {
        const GithubTransportFetch1 = yield* GithubTransportFetch;
        const base = O.match(GithubTransportFetch1, {
          onNone: () => options,
          onSome: (fetch) => ({ fetch, ...options }),
        });
        // With a ledger in context, the client carries its bucket owner's label; without one nothing is resolved.
        const labelled = (label: O.Option<GithubIdentityLabel>, credential: O.Option<CredentialFingerprint>) => ({
          transport: O.match(label, { onNone: () => base, onSome: (budgetLabel) => ({ ...base, budgetLabel }) }),
          identityLayer: Layer.merge(
            Layer.succeed(GithubBudgetIdentity, label),
            Layer.succeed(GithubBudgetCredential, credential)
          ),
        });
        const labelInput = {
          kind: identity.kind,
          tokenRef: identity.tokenRef,
          appId: identity.appId,
          installationId: identity.installationId,
          cwd,
          transport: base,
        };
        if (identity.kind === "github-app") {
          const appId = yield* Effect.fromOption(identity.appId, () => identityError("app-config", "missing app id"));
          const installationId = yield* Effect.fromOption(identity.installationId, () =>
            identityError("app-config", "missing installation id")
          );
          const keyRef = yield* Effect.fromOption(identity.privateKeyRef, () =>
            identityError("app-config", "missing private key reference")
          );
          const privateKey = yield* readOpReference(keyRef, cwd, "the GitHub App private key");
          const appLabel = yield* resolveGithubIdentityLabel({ ...labelInput, token: O.none() });
          const { transport, identityLayer } = labelled(appLabel, O.none());
          return GitHubApp.clientLayer({ appId, privateKey, installationId }, transport).pipe(
            Layer.catchTag("GitHubAppError", (error) =>
              Layer.effect(
                GitHubClient,
                Effect.fail(
                  identityError("app-token-failed", `could not mint a GitHub App installation token: ${error.message}`)
                )
              )
            ),
            Layer.merge(identityLayer)
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
        const tokenLabel = yield* resolveGithubIdentityLabel({ ...labelInput, token: O.some(token) });
        const fingerprint = yield* credentialFingerprint(token);
        const { transport, identityLayer } = labelled(tokenLabel, O.some(fingerprint));
        return GitHubClient.layerFromToken({ ...transport, token }).pipe(Layer.merge(identityLayer));
      })
    ).pipe(Layer.provide(Digest.layerWebCrypto))
);

/**
 * Convert a configured identity to the selected-identity shape the client seam takes.
 *
 * **Example** (Convert a gh entry)
 *
 * ```ts
 * import { ConfiguredGithubIdentity, toGithubIdentity } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(toGithubIdentity(ConfiguredGithubIdentity.cases.GhCli.make({})).kind) // "gh-cli"
 * ```
 *
 * @param entry - A configured identity.
 * @returns The equivalent selected identity.
 * @category constructors
 * @since 0.0.0
 */
export const toGithubIdentity = (entry: ConfiguredGithubIdentity): GithubIdentity =>
  ConfiguredGithubIdentity.match(entry, {
    GhCli: () =>
      GithubIdentity.make({
        kind: "gh-cli",
        tokenRef: O.none(),
        appId: O.none(),
        installationId: O.none(),
        privateKeyRef: O.none(),
      }),
    OpRef: ({ tokenRef }) =>
      GithubIdentity.make({
        kind: "op-ref",
        tokenRef: O.some(tokenRef),
        appId: O.none(),
        installationId: O.none(),
        privateKeyRef: O.none(),
      }),
    GithubApp: ({ appId, installationId, privateKeyRef }) =>
      GithubIdentity.make({
        kind: "github-app",
        tokenRef: O.none(),
        appId: O.some(appId),
        installationId: O.some(installationId),
        privateKeyRef: O.some(privateKeyRef),
      }),
  });

/**
 * Convert a selected identity to its configured form. An `op-ref` needs a
 * login, which a selected identity does not carry, so it converts only when
 * one is given; an incomplete App converts to none.
 *
 * **Example** (Convert the gh identity)
 *
 * ```ts
 * import { GithubIdentity, fromGithubIdentity } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * const identity = GithubIdentity.make({ kind: "gh-cli", tokenRef: O.none(), appId: O.none(), installationId: O.none(), privateKeyRef: O.none() })
 * console.log(O.map(fromGithubIdentity(identity, O.none()), (entry) => entry._tag)) // { _id: "Option", _tag: "Some", value: "GhCli" }
 * ```
 *
 * @param identity - A selected identity.
 * @param login - The login an `op-ref` token belongs to, when known.
 * @returns The configured form, or none.
 * @category constructors
 * @since 0.0.0
 */
export const fromGithubIdentity: {
  (login: O.Option<string>): (identity: GithubIdentity) => O.Option<ConfiguredGithubIdentity>;
  (identity: GithubIdentity, login: O.Option<string>): O.Option<ConfiguredGithubIdentity>;
} = dual(
  2,
  (identity: GithubIdentity, login: O.Option<string>): O.Option<ConfiguredGithubIdentity> =>
    GithubIdentityKind.match(identity.kind, {
      "gh-cli": () => O.some(ConfiguredGithubIdentity.cases.GhCli.make({})),
      "op-ref": () =>
        O.flatMap(O.all({ tokenRef: identity.tokenRef, login }), (fields) =>
          ConfiguredGithubIdentity.cases.OpRef.makeOption(fields)
        ),
      "github-app": () =>
        O.flatMap(
          O.all({
            appId: identity.appId,
            installationId: identity.installationId,
            privateKeyRef: identity.privateKeyRef,
          }),
          (fields) => ConfiguredGithubIdentity.cases.GithubApp.makeOption(fields)
        ),
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
    Str.match(remotePattern)(Str.trim(remote)),
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
 * @returns A layer providing `@beep/github`'s `Repo`.
 * @category layers
 * @since 0.0.0
 */
export const layerGithubRepoFor = (
  cwd: string
): Layer.Layer<Repo, GithubIdentityError, ChildProcessSpawner.ChildProcessSpawner> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const override = yield* configStringOption("GH_REPO");
      // Any git failure (no origin, not a repository, spawn failure) reads as
      // "no remote", the same answer the old capture's non-zero exit gave. The
      // leaf `Git.make` keeps `Git` out of the Yeet GitHub layer unions (W4 lifts them).
      const slug = O.isSome(override)
        ? override
        : yield* Git.use((git) => git.remoteUrl(cwd)).pipe(
            Effect.provideServiceEffect(Git, Git.make),
            Effect.map(O.flatMap(repoSlugFromRemote)),
            Effect.orElseSucceed(O.none<string>)
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
