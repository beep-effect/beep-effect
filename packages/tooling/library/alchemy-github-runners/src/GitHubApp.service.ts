/**
 * GitHub App authentication and the self-hosted-runner REST contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as O from "effect/Option";
import type * as Redacted from "effect/Redacted";
import type {
  InstallationToken,
  JitConfigRequest,
  JitRunnerConfig,
  RunnerOwner,
  SelfHostedRunner,
} from "./GitHubRunners.models.ts";
import type { GitHubApiError, GitHubAppAuthError } from "./RunnerFleet.errors.ts";

const $I = $AlchemyGithubRunnersId.create("GitHubApp.service");

/**
 * Authenticates as the fleet's GitHub App.
 *
 * **Details**
 *
 * The live layer reads the App id and base64 PEM key from SSM once, signs a
 * ten-minute RS256 JWT with WebCrypto, and exchanges it for installation
 * tokens. `installationFor` resolves the App's installation on an org (or a
 * repository for `Repo` owners).
 *
 * **Example** (Token for an org)
 *
 * ```ts
 * import { GitHubAppAuth } from "@beep/alchemy-github-runners/GitHubApp.service"
 * import { RunnerOwner } from "@beep/alchemy-github-runners/GitHubRunners.models"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const app = yield* GitHubAppAuth
 *   const installationId = yield* app.installationFor(RunnerOwner.make({ type: "Org", owner: "beep-effect" }))
 *   return yield* app.installationToken(installationId)
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GitHubAppAuth extends Context.Service<
  GitHubAppAuth,
  {
    readonly installationFor: (owner: RunnerOwner) => Effect.Effect<number, GitHubAppAuthError | GitHubApiError>;
    readonly installationToken: (
      installationId: number
    ) => Effect.Effect<InstallationToken, GitHubAppAuthError | GitHubApiError>;
  }
>()($I`GitHubAppAuth`) {}

/**
 * Self-hosted runner operations, each made with an installation token.
 *
 * **Details**
 *
 * `getRunner` returns `None` on 404. `deleteRunner` fails with a
 * `GitHubApiError` whose status is 422 when the runner is running a job.
 * `runnerGroupId` fails when the org has no group of that name.
 *
 * **Example** (List an org's runners)
 *
 * ```ts
 * import { GitHubRunners } from "@beep/alchemy-github-runners/GitHubApp.service"
 * import { InstallationToken, RunnerOwner } from "@beep/alchemy-github-runners/GitHubRunners.models"
 * import * as Effect from "effect/Effect"
 * import * as Redacted from "effect/Redacted"
 *
 * const token = InstallationToken.make({ installationId: 1, token: Redacted.make("ghs_x") })
 * const program = Effect.gen(function* () {
 *   const runners = yield* GitHubRunners
 *   return yield* runners.listRunners(token, RunnerOwner.make({ type: "Org", owner: "beep-effect" }))
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GitHubRunners extends Context.Service<
  GitHubRunners,
  {
    readonly isJobQueued: (
      token: InstallationToken,
      job: { readonly owner: string; readonly repo: string; readonly jobId: number }
    ) => Effect.Effect<boolean, GitHubApiError>;
    readonly runnerGroupId: (
      token: InstallationToken,
      org: string,
      groupName: string
    ) => Effect.Effect<number, GitHubApiError>;
    readonly generateJitConfig: (
      token: InstallationToken,
      request: JitConfigRequest
    ) => Effect.Effect<JitRunnerConfig, GitHubApiError>;
    readonly registrationToken: (
      token: InstallationToken,
      owner: RunnerOwner
    ) => Effect.Effect<Redacted.Redacted<string>, GitHubApiError>;
    readonly getRunner: (
      token: InstallationToken,
      owner: RunnerOwner,
      runnerId: number
    ) => Effect.Effect<O.Option<SelfHostedRunner>, GitHubApiError>;
    readonly listRunners: (
      token: InstallationToken,
      owner: RunnerOwner
    ) => Effect.Effect<ReadonlyArray<SelfHostedRunner>, GitHubApiError>;
    readonly deleteRunner: (
      token: InstallationToken,
      owner: RunnerOwner,
      runnerId: number
    ) => Effect.Effect<void, GitHubApiError>;
  }
>()($I`GitHubRunners`) {}
