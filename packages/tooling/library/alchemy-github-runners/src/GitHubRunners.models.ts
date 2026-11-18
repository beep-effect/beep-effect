/**
 * GitHub-side rows the runner services read and write: self-hosted runners,
 * installation tokens, JIT configurations and the runner owner.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { RunnerType } from "./RunnerPool.models.ts";

const $I = $AlchemyGithubRunnersId.create("GitHubRunners.models");

/**
 * Who a runner registers with: an org name (`Org`) or `owner/repo` (`Repo`).
 *
 * **Example** (An org owner)
 *
 * ```ts
 * import { RunnerOwner } from "@beep/alchemy-github-runners/GitHubRunners.models"
 *
 * const owner = RunnerOwner.make({ type: "Org", owner: "beep-effect" })
 * console.log(owner.owner)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerOwner extends S.Opaque<RunnerOwner, { readonly brand: unique symbol }>()(
  S.Struct({
    type: RunnerType,
    owner: S.String.annotateKey({ description: "Org name, or owner/repo for repository runners." }),
  }).pipe(
    $I.annoteSchema("RunnerOwner", {
      description: "Who a runner registers with: an org name or owner/repo.",
    })
  )
) {}

/**
 * A self-hosted runner as GitHub reports it.
 *
 * **Example** (An idle online runner)
 *
 * ```ts
 * import { SelfHostedRunner } from "@beep/alchemy-github-runners/GitHubRunners.models"
 *
 * const runner = SelfHostedRunner.make({ id: 17, name: "beep-ci-i-0abc", status: "online", busy: false })
 * console.log(runner.busy)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SelfHostedRunner extends S.Opaque<SelfHostedRunner, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Int,
    name: S.String,
    status: S.String.annotateKey({ description: "online or offline." }),
    busy: S.Boolean,
  }).pipe(
    $I.annoteSchema("SelfHostedRunner", {
      description: "A self-hosted runner as GitHub reports it.",
    })
  )
) {}

/**
 * An App installation access token.
 *
 * **Details**
 *
 * The token is redacted so it never reaches logs. Scale-up mints one per owner
 * per invocation; they live one hour.
 *
 * **Example** (Wrap a token)
 *
 * ```ts
 * import { InstallationToken } from "@beep/alchemy-github-runners/GitHubRunners.models"
 * import * as Redacted from "effect/Redacted"
 *
 * const token = InstallationToken.make({ installationId: 42, token: Redacted.make("ghs_x") })
 * console.log(token.installationId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InstallationToken extends S.Opaque<InstallationToken, { readonly brand: unique symbol }>()(
  S.Struct({
    installationId: S.Int,
    token: S.Redacted(S.String),
  }).pipe(
    $I.annoteSchema("InstallationToken", {
      description: "An App installation access token.",
    })
  )
) {}

/**
 * A just-in-time runner configuration: the runner id GitHub assigned and the
 * opaque, base64 configuration the runner starts with.
 *
 * **Example** (Wrap a JIT config)
 *
 * ```ts
 * import { JitRunnerConfig } from "@beep/alchemy-github-runners/GitHubRunners.models"
 * import * as Redacted from "effect/Redacted"
 *
 * const config = JitRunnerConfig.make({ runnerId: 17, encodedJitConfig: Redacted.make("eyJ") })
 * console.log(config.runnerId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JitRunnerConfig extends S.Opaque<JitRunnerConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    runnerId: S.Int,
    encodedJitConfig: S.Redacted(S.String),
  }).pipe(
    $I.annoteSchema("JitRunnerConfig", {
      description: "A just-in-time runner configuration.",
    })
  )
) {}

/**
 * A request for a JIT runner configuration.
 *
 * **Example** (Request one runner)
 *
 * ```ts
 * import { JitConfigRequest, RunnerOwner } from "@beep/alchemy-github-runners/GitHubRunners.models"
 *
 * const request = JitConfigRequest.make({
 *   owner: RunnerOwner.make({ type: "Org", owner: "beep-effect" }),
 *   name: "beep-ci-i-0abc",
 *   runnerGroupId: 3,
 *   labels: ["beep-ec2-heavy"],
 * })
 * console.log(request.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JitConfigRequest extends S.Opaque<JitConfigRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    owner: RunnerOwner,
    name: S.String,
    runnerGroupId: S.Int,
    labels: S.NonEmptyArray(S.String),
  }).pipe(
    $I.annoteSchema("JitConfigRequest", {
      description: "A request for a JIT runner configuration.",
    })
  )
) {}
