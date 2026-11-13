# @beep/alchemy-aws-extras

Alchemy resources for the AWS settings that `@alchemy.run/aws` does not cover,
written to Alchemy's provider conventions so they can go upstream (decision D14
in `explorations/pulumi-to-alchemy/DECISIONS.md`).

| Resource | Type | AWS API | Removal default |
| --- | --- | --- | --- |
| `CostAllocationTag` | `BeepAWS.CostExplorer.CostAllocationTag` | Cost Explorer `UpdateCostAllocationTagsStatus` / `ListCostAllocationTags` | `retain` |
| `ComputeOptimizerEnrollment` | `BeepAWS.ComputeOptimizer.Enrollment` | Compute Optimizer `GetEnrollmentStatus` / `UpdateEnrollmentStatus` | `retain` |
| `CostOptimizationHubEnrollment` | `BeepAWS.CostOptimizationHub.Enrollment` | Cost Optimization Hub `ListEnrollmentStatuses` / `UpdateEnrollmentStatus` | `retain` |
| `RunnerLaunchTemplate` | `BeepAWS.EC2.RunnerLaunchTemplate` | EC2 launch templates | `destroy` |

The three account singletons report their live setting from `read`, so an
existing setting adopts without `--adopt`. Under the `retain` default a stack
destroy leaves the setting alone. `RunnerLaunchTemplate` adds the props that
`AWS.AutoScaling.LaunchTemplate` lacks: block device mappings (gp3, encryption,
IOPS, throughput), `ebsOptimized`, Spot `instanceMarketOptions` and launch
`tagSpecifications`. It also takes IMDS options, an instance profile, security
groups, user data and an SSM-resolved AMI (`resolveSsmImageId`). It owns
templates by Alchemy's internal tags, so a same-name template created elsewhere
needs `adopt(true)`.

## Usage

```ts
import * as AWS from "@alchemy.run/aws"
import * as AwsExtras from "@beep/alchemy-aws-extras"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export const providers = Layer.mergeAll(AWS.providers(), AwsExtras.providers)

export const program = Effect.gen(function* () {
  const tag = yield* AwsExtras.CostAllocationTag.CostAllocationTag("ProjectTag", { tagKey: "Project" })
  return { tagKey: tag.tagKey }
})
```

`AwsExtras.providers` resolves the AWS environment the same way
`AWS.providers()` does: a provided `AWSEnvironment` wins, then the profile, CI
credentials or ambient environment.

## Tests

`bun run test` is hermetic. `test/fixtures/FakeAws.ts` serves an in-memory
account behind an effect `HttpClient`, so every distilled operation signs,
serializes and parses for real with no credentials and no network. Each test
case takes its own `FakeAws.harness()` because test cases run concurrently.

`vitest.config.ts` inlines `alchemy` and `@alchemy.run/*`. Without that,
vitest loads the engine natively and this package's source through Vite. That
gives two copies of `alchemy/AdoptPolicy`, and the engine cannot see the
`Unowned` brand that `read` sets, so an unowned launch template is adopted
silently instead of refused.

`test/integration/LiveRead.test.ts` is an opt-in, read-only check of the live
account singletons. It calls `read` only. Hosted CI never runs it.

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
BEEP_ALCHEMY_AWS_EXTRAS_LIVE=1 AWS_REGION=us-east-1 bun run test:integration
```

## License

MIT
