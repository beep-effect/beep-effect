/**
 * Live GitHub layers over `@distilled.cloud/github`: App authentication from
 * SSM-held credentials and the self-hosted runner operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import { actions, apps } from "@distilled.cloud/github";
import * as GitHubApp from "@distilled.cloud/github/App";
import { Credentials as GitHubCredentials } from "@distilled.cloud/github/Credentials";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { GitHubAppAuth, GitHubRunners } from "./GitHubApp.service.ts";
import { InstallationToken, JitRunnerConfig, SelfHostedRunner } from "./GitHubRunners.models.ts";
import { GitHubApiError, GitHubAppAuthError } from "./RunnerFleet.errors.ts";
import { AppParameterNames } from "./SsmParameters.models.ts";
import { SsmStore } from "./SsmStore.service.ts";
import type * as Context from "effect/Context";
import type * as HttpClient from "effect/http/HttpClient";
import type { RunnerOwner } from "./GitHubRunners.models.ts";

const $I = $AlchemyGithubRunnersId.create("GitHubApp.layer");

const statusByTag: Readonly<Record<string, number>> = {
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  Gone: 410,
  UnprocessableEntity: 422,
  Locked: 423,
  TooManyRequests: 429,
  InternalServerError: 500,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
};

const toGitHubApiError =
  (operation: string) =>
  (error: { readonly _tag: string; readonly message?: unknown }): GitHubApiError =>
    GitHubApiError.make({
      operation,
      status: O.fromUndefinedOr(statusByTag[error._tag]),
      message: P.isString(error.message) ? error.message : error._tag,
    });

/**
 * Options of the live GitHub layers.
 *
 * **Example** (github.com)
 *
 * ```ts
 * import { GitHubLiveOptions } from "@beep/alchemy-github-runners/GitHubApp.layer"
 * import { appParameterNames } from "@beep/alchemy-github-runners/SsmParameters.models"
 *
 * const options = GitHubLiveOptions.make({ app: appParameterNames("/beep-ci"), apiBaseUrl: "https://api.github.com", userAgent: "beep-runners" })
 * console.log(options.apiBaseUrl)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GitHubLiveOptions extends S.Opaque<GitHubLiveOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    app: AppParameterNames,
    apiBaseUrl: S.String,
    userAgent: S.String,
  }).pipe($I.annoteSchema("GitHubLiveOptions", { description: "Options of the live GitHub layers." }))
) {}

const splitRepo = (owner: RunnerOwner) => {
  const [repoOwner = "", repo = ""] = Str.split(owner.owner, "/");
  return { owner: repoOwner, repo };
};

const withGitHubToken =
  (options: GitHubLiveOptions, services: Context.Context<HttpClient.HttpClient>, operation: string) =>
  (token: Redacted.Redacted<string>) =>
  <A, E extends { readonly _tag: string; readonly message?: unknown }>(
    call: Effect.Effect<A, E, GitHubCredentials | HttpClient.HttpClient>
  ): Effect.Effect<A, GitHubApiError> =>
    call.pipe(
      Effect.provideService(
        GitHubCredentials,
        Effect.succeed({ token, apiBaseUrl: options.apiBaseUrl, userAgent: options.userAgent })
      ),
      Effect.provideContext(services),
      Effect.mapError(toGitHubApiError(operation))
    );

const toRunner = (runner: {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly busy: boolean;
}): SelfHostedRunner =>
  SelfHostedRunner.make({ id: runner.id, name: runner.name, status: runner.status, busy: runner.busy });

/**
 * Live {@link GitHubAppAuth}: reads the App id and base64 PEM key from SSM on
 * first use, signs a fresh JWT per call with distilled GitHub's `App.appJwt`
 * and exchanges it with distilled
 * GitHub's `apps` operations.
 *
 * **Example** (Build the layer)
 *
 * ```ts
 * import { GitHubLiveOptions, gitHubAppAuthLive } from "@beep/alchemy-github-runners/GitHubApp.layer"
 * import { appParameterNames } from "@beep/alchemy-github-runners/SsmParameters.models"
 *
 * const layer = gitHubAppAuthLive(
 *   GitHubLiveOptions.make({ app: appParameterNames("/beep-ci"), apiBaseUrl: "https://api.github.com", userAgent: "beep-runners" })
 * )
 * console.log(layer)
 * ```
 *
 * @param options - App parameter names, API base URL and user agent.
 * @returns A layer requiring `SsmStore` and an `HttpClient`.
 * @category layers
 * @since 0.0.0
 */
export const gitHubAppAuthLive = (
  options: GitHubLiveOptions
): Layer.Layer<GitHubAppAuth, never, SsmStore | HttpClient.HttpClient> =>
  Layer.effect(
    GitHubAppAuth,
    Effect.gen(function* () {
      const ssm = yield* SsmStore;
      const services = yield* Effect.context<HttpClient.HttpClient>();
      const readParameter = Effect.fn("GitHubAppAuth.readParameter")(function* (name: string) {
        const value = yield* ssm.get(name).pipe(
          Effect.flatMap(Effect.fromOption),
          Effect.mapError(() => GitHubAppAuthError.make({ message: `App parameter ${name} is unavailable` }))
        );
        return value.pipe(Redacted.value, Str.trim);
      });
      const appCredentials = yield* Effect.cached(
        Effect.gen(function* () {
          const appId = yield* readParameter(options.app.id);
          const keyBase64 = yield* readParameter(options.app.keyBase64);
          const privateKeyPem = yield* Effect.fromResult(Base64.decodeString(keyBase64)).pipe(
            Effect.mapError(() => GitHubAppAuthError.make({ message: "App key parameter is not base64" }))
          );
          return { appId, privateKeyPem };
        })
      );
      const appJwt = Effect.gen(function* () {
        const credentials = yield* appCredentials;
        return yield* GitHubApp.appJwt({
          appId: credentials.appId,
          privateKey: Redacted.make(credentials.privateKeyPem),
        }).pipe(Effect.mapError((error) => GitHubAppAuthError.make({ message: error.message })));
      });
      return GitHubAppAuth.of({
        installationFor: Effect.fn("GitHubAppAuth.installationFor")(function* (owner: RunnerOwner) {
          const jwt = yield* appJwt;
          const call = withGitHubToken(options, services, "getInstallation")(jwt);
          const installation = yield* owner.type === "Org"
            ? call(apps.getOrgInstallation({ org: owner.owner }))
            : call(apps.getRepoInstallation(splitRepo(owner)));
          return installation.id;
        }),
        installationToken: Effect.fn("GitHubAppAuth.installationToken")(function* (installationId: number) {
          const jwt = yield* appJwt;
          const response = yield* withGitHubToken(options, services, "createInstallationAccessToken")(jwt)(
            apps.createInstallationAccessToken({ installation_id: installationId })
          );
          return InstallationToken.make({ installationId, token: Redacted.make(response.token) });
        }),
      });
    })
  );

/**
 * Live {@link GitHubRunners} over distilled GitHub's `actions` operations.
 *
 * **Example** (Build the layer)
 *
 * ```ts
 * import { GitHubLiveOptions, gitHubRunnersLive } from "@beep/alchemy-github-runners/GitHubApp.layer"
 * import { appParameterNames } from "@beep/alchemy-github-runners/SsmParameters.models"
 *
 * const layer = gitHubRunnersLive(
 *   GitHubLiveOptions.make({ app: appParameterNames("/beep-ci"), apiBaseUrl: "https://api.github.com", userAgent: "beep-runners" })
 * )
 * console.log(layer)
 * ```
 *
 * @param options - API base URL and user agent.
 * @returns A layer requiring an `HttpClient`.
 * @category layers
 * @since 0.0.0
 */
export const gitHubRunnersLive = (
  options: GitHubLiveOptions
): Layer.Layer<GitHubRunners, never, HttpClient.HttpClient> =>
  Layer.effect(
    GitHubRunners,
    Effect.gen(function* () {
      const services = yield* Effect.context<HttpClient.HttpClient>();
      const call = (token: InstallationToken, operation: string) =>
        withGitHubToken(options, services, operation)(token.token);
      return GitHubRunners.of({
        isJobQueued: Effect.fn("GitHubRunners.isJobQueued")(function* (token, job) {
          const response = yield* call(
            token,
            "getJobForWorkflowRun"
          )(actions.getJobForWorkflowRun({ owner: job.owner, repo: job.repo, job_id: job.jobId }));
          return response.status === "queued";
        }),
        runnerGroupId: Effect.fn("GitHubRunners.runnerGroupId")(function* (token, org, groupName) {
          const response = yield* call(
            token,
            "listSelfHostedRunnerGroupsForOrg"
          )(actions.listSelfHostedRunnerGroupsForOrg({ org, per_page: 100 }));
          const group = yield* Effect.fromOption(
            A.findFirst(response.runner_groups, (candidate) => candidate.name === groupName)
          ).pipe(
            Effect.mapError(() =>
              GitHubApiError.make({ operation: "runnerGroupId", message: `Runner group ${groupName} does not exist` })
            )
          );
          return group.id;
        }),
        generateJitConfig: Effect.fn("GitHubRunners.generateJitConfig")(function* (token, request) {
          const labels = A.copy(request.labels);
          const response = yield* request.owner.type === "Org"
            ? call(
                token,
                "generateRunnerJitconfigForOrg"
              )(
                actions.generateRunnerJitconfigForOrg({
                  org: request.owner.owner,
                  name: request.name,
                  runner_group_id: request.runnerGroupId,
                  labels,
                })
              )
            : call(
                token,
                "generateRunnerJitconfigForRepo"
              )(
                actions.generateRunnerJitconfigForRepo({
                  ...splitRepo(request.owner),
                  name: request.name,
                  runner_group_id: request.runnerGroupId,
                  labels,
                })
              );
          return JitRunnerConfig.make({
            runnerId: response.runner.id,
            encodedJitConfig: Redacted.make(response.encoded_jit_config),
          });
        }),
        registrationToken: Effect.fn("GitHubRunners.registrationToken")(function* (token, owner) {
          const response = yield* owner.type === "Org"
            ? call(token, "createRegistrationTokenForOrg")(actions.createRegistrationTokenForOrg({ org: owner.owner }))
            : call(token, "createRegistrationTokenForRepo")(actions.createRegistrationTokenForRepo(splitRepo(owner)));
          return Redacted.make(response.token);
        }),
        getRunner: Effect.fn("GitHubRunners.getRunner")(function* (token, owner, runnerId) {
          const lookup =
            owner.type === "Org"
              ? call(
                  token,
                  "getSelfHostedRunnerForOrg"
                )(actions.getSelfHostedRunnerForOrg({ org: owner.owner, runner_id: runnerId }))
              : call(
                  token,
                  "getSelfHostedRunnerForRepo"
                )(actions.getSelfHostedRunnerForRepo({ ...splitRepo(owner), runner_id: runnerId }));
          return yield* lookup.pipe(
            Effect.map((runner) => O.some(toRunner(runner))),
            Effect.catchIf(
              (error) => O.contains(error.status, 404),
              () => Effect.succeedNone
            )
          );
        }),
        listRunners: Effect.fn("GitHubRunners.listRunners")(function* (token, owner) {
          const items =
            owner.type === "Org"
              ? actions.listSelfHostedRunnersForOrg.items({ org: owner.owner, per_page: 100 })
              : actions.listSelfHostedRunnersForRepo.items({ ...splitRepo(owner), per_page: 100 });
          const runners = yield* call(token, "listSelfHostedRunners")(items.pipe(Stream.runCollect));
          return A.map(A.fromIterable(runners), toRunner);
        }),
        deleteRunner: Effect.fn("GitHubRunners.deleteRunner")(function* (token, owner, runnerId) {
          yield* owner.type === "Org"
            ? call(
                token,
                "deleteSelfHostedRunnerFromOrg"
              )(actions.deleteSelfHostedRunnerFromOrg({ org: owner.owner, runner_id: runnerId }))
            : call(
                token,
                "deleteSelfHostedRunnerFromRepo"
              )(actions.deleteSelfHostedRunnerFromRepo({ ...splitRepo(owner), runner_id: runnerId }));
        }),
      });
    })
  );
