/**
 * Frozen pre-W3 body for `ops/reviewer-ci-github-differential-w3.ts`: the capture-backed gh/op secret reads and origin lookup, verbatim from
 * main 12ececd3b7 except for import paths, the identity namespace and nothing else.
 */
import { GitHubApp } from "@beep/github/GitHubApp";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo, RepoRef } from "@beep/github/Repo";
import { $RepoCliId } from "@beep/identity/packages";
import { configStringOption } from "@beep/repo-cli-kit/cli/EnvConfig";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCaptureRaw } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliId.create("goals/repo-cli-gh-git-consolidation/ops/frozen-w3/GithubIdentity.old");

export const GITHUB_TOKEN_REF_ENV = "BEEP_GH_TOKEN_REF";

export const GITHUB_APP_ENV = {
  appId: "BEEP_GH_APP_ID",
  installationId: "BEEP_GH_APP_INSTALLATION_ID",
  privateKeyRef: "BEEP_GH_APP_KEY_REF",
} as const;

export const GithubIdentityKind = LiteralKit(["gh-cli", "op-ref", "github-app"]).pipe(
  $I.annoteSchema("GithubIdentityKind", { description: "Which GitHub identity the in-process client uses." })
);

export type GithubIdentityKind = typeof GithubIdentityKind.Type;

export class GithubIdentity extends S.Opaque<GithubIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: GithubIdentityKind,
    tokenRef: S.Option(S.String),
    appId: S.Option(S.String),
    installationId: S.Option(S.Int),
    privateKeyRef: S.Option(S.String),
  }).pipe($I.annoteSchema("GithubIdentity", { description: "A selected GitHub identity, as references only." }))
) {}

export const GithubIdentityErrorReason = LiteralKit([
  "token-unavailable",
  "op-read-failed",
  "app-config",
  "app-token-failed",
  "repo-unknown",
]).pipe($I.annoteSchema("GithubIdentityErrorReason", { description: "Why a GitHub identity did not resolve." }));

export class GithubIdentityError extends S.TaggedError<GithubIdentityError, { readonly brand: unique symbol }>(
  $I`GithubIdentityError`
)(
  "GithubIdentityError",
  { reason: GithubIdentityErrorReason, message: S.String },
  $I.annoteError<GithubIdentityError>("GithubIdentityError", {
    description: "A GitHub identity, token, or repository failed to resolve.",
  })
) {
  override readonly [Runtime.errorExitCode] = 1;
}

const identityError = (reason: typeof GithubIdentityErrorReason.Type, message: string) =>
  GithubIdentityError.make({ reason, message });

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

export class GithubClientRequest extends S.Opaque<GithubClientRequest, { readonly brand: unique symbol }>()(
  S.Struct({ identity: GithubIdentity, cwd: S.String }).pipe(
    $I.annoteSchema("GithubClientRequest", {
      description: "An identity and the working directory to resolve its token in.",
    })
  )
) {}

export const layerGithubClientFor = ({
  identity,
  cwd,
}: GithubClientRequest): Layer.Layer<
  GitHubClient,
  GithubIdentityError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
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

export const repoSlugFromRemote = (remote: string): O.Option<string> =>
  pipe(
    Str.match(remotePattern)(Str.trim(remote)),
    O.flatMap((parts) =>
      O.zipWith(O.fromNullishOr(parts[1]), O.fromNullishOr(parts[2]), (owner, name) => `${owner}/${name}`)
    )
  );

export const layerGithubRepoFor = (
  cwd: string
): Layer.Layer<Repo, GithubIdentityError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const override = yield* configStringOption("GH_REPO");
      const slug = O.isSome(override)
        ? override
        : yield* runRepoCommandCaptureRaw("git", ["remote", "get-url", "origin"], cwd).pipe(
            Effect.map((result) => (result.exitCode === 0 ? repoSlugFromRemote(result.output) : O.none())),
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
