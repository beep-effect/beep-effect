/**
 * EC2 contract of the runner fleet: launch, inventory, tag and terminate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { FleetLaunchRequest, FleetLaunchResult, TaggedInstance } from "./Ec2Fleet.models.ts";
import type { AwsApiError } from "./RunnerFleet.errors.ts";
import type { RunnerFilter, RunnerInstance } from "./RunnerInstance.models.ts";

const $I = $AlchemyGithubRunnersId.create("Ec2Fleet.service");

/**
 * EC2 operations the fleet Lambdas need.
 *
 * **Details**
 *
 * `createFleet` fails only when the call itself fails; per-capacity-pool
 * errors of a partial launch come back in the result. `listRunners` always
 * adds the `ghr:Application` filter and paginates. `describeInstances`
 * returns nothing for ids EC2 no longer knows.
 *
 * **Example** (Terminate one runner)
 *
 * ```ts
 * import { Ec2Fleet } from "@beep/alchemy-github-runners/Ec2Fleet.service"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const ec2 = yield* Ec2Fleet
 *   yield* ec2.terminate("i-0123456789abcdef0")
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Ec2Fleet extends Context.Service<
  Ec2Fleet,
  {
    readonly createFleet: (request: FleetLaunchRequest) => Effect.Effect<FleetLaunchResult, AwsApiError>;
    readonly listRunners: (filter: RunnerFilter) => Effect.Effect<ReadonlyArray<RunnerInstance>, AwsApiError>;
    readonly describeInstances: (
      instanceIds: ReadonlyArray<string>
    ) => Effect.Effect<ReadonlyArray<TaggedInstance>, AwsApiError>;
    readonly terminate: (instanceId: string) => Effect.Effect<void, AwsApiError>;
    readonly tag: (instanceId: string, tags: Readonly<Record<string, string>>) => Effect.Effect<void, AwsApiError>;
    readonly untag: (instanceId: string, keys: ReadonlyArray<string>) => Effect.Effect<void, AwsApiError>;
  }
>()($I`Ec2Fleet`) {}
