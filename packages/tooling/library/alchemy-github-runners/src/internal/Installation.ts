/**
 * Owner and installation-token resolution shared by the GitHub-facing programs.
 *
 * Ported from github-aws-runners/terraform-aws-github-runner v7.10.1 (MIT); see
 * the package README for the license notice.
 *
 * @internal
 */

import * as Effect from "effect/Effect";
import { GitHubAppAuth } from "../GitHubApp.service.ts";
import { RunnerOwner } from "../GitHubRunners.models.ts";
import type { ActionRequestMessage } from "../RunnerMessages.models.ts";
import type { RunnerType } from "../RunnerPool.models.ts";

/**
 * The owner a message's runner registers with.
 *
 * @internal
 */
export const ownerOf = ({
  runnerType,
  message,
}: {
  readonly runnerType: RunnerType;
  readonly message: ActionRequestMessage;
}): RunnerOwner =>
  RunnerOwner.make({
    type: runnerType,
    owner: runnerType === "Org" ? message.repositoryOwner : `${message.repositoryOwner}/${message.repositoryName}`,
  });

/**
 * An installation token for an owner, preferring the delivery's installation
 * id and re-resolving it when that id no longer works.
 *
 * @internal
 */
export const installationTokenFor = Effect.fn("ScaleUp.installationTokenFor")(function* (
  owner: RunnerOwner,
  installationId: number
) {
  const app = yield* GitHubAppAuth;
  if (installationId === 0) {
    return yield* app.installationFor(owner).pipe(Effect.flatMap(app.installationToken));
  }
  return yield* app
    .installationToken(installationId)
    .pipe(Effect.catch(() => app.installationFor(owner).pipe(Effect.flatMap(app.installationToken))));
});
