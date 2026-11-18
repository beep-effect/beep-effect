/**
 * Runner-binaries contract: the latest `actions/runner` release and its S3 mirror.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";
import type * as O from "effect/Option";
import type { AwsApiError, GitHubApiError } from "./RunnerFleet.errors.ts";

const $I = $AlchemyGithubRunnersId.create("RunnerBinaries.service");

/**
 * A downloadable `actions/runner` release asset.
 *
 * **Example** (A Linux x64 asset)
 *
 * ```ts
 * import { ReleaseAsset } from "@beep/alchemy-github-runners/RunnerBinaries.service"
 *
 * const asset = ReleaseAsset.make({
 *   name: "actions-runner-linux-x64-2.330.0.tar.gz",
 *   downloadUrl: "https://github.com/actions/runner/releases/download/v2.330.0/actions-runner-linux-x64-2.330.0.tar.gz",
 * })
 * console.log(asset.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReleaseAsset extends S.Opaque<ReleaseAsset, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    downloadUrl: S.String,
  }).pipe(
    $I.annoteSchema("ReleaseAsset", {
      description: "A downloadable actions/runner release asset.",
    })
  )
) {}

/**
 * Release lookup and S3 mirror operations for the syncer.
 *
 * **Details**
 *
 * `latestAsset` returns `None` when the latest release has no asset for the
 * OS and architecture. `cachedName` reads the `name` tag the last upload set,
 * `None` when the object or tag is missing. `mirror` streams the asset into
 * the object and tags it with the asset name.
 *
 * **Example** (Check the mirrored version)
 *
 * ```ts
 * import { RunnerBinaries } from "@beep/alchemy-github-runners/RunnerBinaries.service"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const binaries = yield* RunnerBinaries
 *   return yield* binaries.cachedName({ bucket: "b", key: "actions-runner-linux.tar.gz" })
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RunnerBinaries extends Context.Service<
  RunnerBinaries,
  {
    readonly latestAsset: (target: {
      readonly os: string;
      readonly architecture: string;
    }) => Effect.Effect<O.Option<ReleaseAsset>, GitHubApiError>;
    readonly cachedName: (object: {
      readonly bucket: string;
      readonly key: string;
    }) => Effect.Effect<O.Option<string>, AwsApiError>;
    readonly mirror: (input: {
      readonly bucket: string;
      readonly key: string;
      readonly asset: ReleaseAsset;
    }) => Effect.Effect<void, AwsApiError | GitHubApiError>;
  }
>()($I`RunnerBinaries`) {}
