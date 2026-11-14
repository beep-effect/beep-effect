# @beep/infra-cost-controls

The `CostControls` Alchemy stack: the AWS account's cost controls, replacing
the Pulumi `AccountCostControls` component of `beep-ci-runners/production`
(`goals/infra-alchemy-rebuild`, phase P3). It never stops or resizes a
workload; it only budgets, alerts, tags and enrolls.

## Design

Order: schema, then the stack's typed configuration, then the resources.

### Schema and configuration (`src/Config.ts`)

`CostControlsConfig` is one `S.Opaque` struct per stage:

| Field | Schema | `prod` | Personal stages |
| --- | --- | --- | --- |
| `expectedAccountId` | twelve digits | `832907639880` | same |
| `region` | `LiteralKit(["us-east-1"])` | `us-east-1` | same |
| `monthlyBudgetUsd` | finite, positive | `200` | same |
| `anomalyImpactUsd` | finite, positive | `10` | same |
| `notifications` | `LiteralKit(["silent", "live"])` | `silent` until the Pulumi cutover | always `silent` |

The stage inputs are tracked source, decoded through `resolveStageConfig`
when the program starts; a bad value stops the stack with a `ConfigError`
before any AWS read. Recipient addresses are personal data and never tracked:
`NotificationRecipients` decodes the comma-separated environment variable
`COST_CONTROLS_NOTIFICATION_EMAILS` into normalized, deduplicated addresses,
and the stack reads it only in the `live` phase. In CI it is a secret on the
`cost-controls-prod` GitHub environment, set at bootstrap from the encrypted
Pulumi config key without printing it; personal stages are always silent and
never need it.

### Guards (`src/Guards.ts`)

- `requireCiForProduction`: `prod` plans and deploys only with `CI=true`.
- `requireExpectedAccount`: every stage compares the resolved AWS account and
  region with the configuration and refuses anything else with a
  `ConfigError`, before any resource is read.

### Providers (`src/Providers.ts`)

Only the five providers the stack declares, with the region pinned by
`AWS.Region.of("us-east-1")`: Budgets and Cost Explorer are global services
served from `us-east-1`, and Cost Optimization Hub answers only there.

### Resources (`src/CostControls.ts`)

| Logical id | Resource | `prod` physical object | Kind |
| --- | --- | --- | --- |
| `MonthlyBudget` | `AWS.Budgets.Budget` | `beep-account-monthly-cost` (personal: `-<stage>` suffix) | new, pinned name, retained in `prod` |
| `AnomalyAlerts` | `AWS.CostExplorer.AnomalySubscription` | `beep-account-anomaly-alerts`, `prod` `live` phase only | new, pinned name |
| `AccountServicesMonitor` | `AWS.CostExplorer.AnomalyMonitor` | `beep-account-services`, `prod` only | adopted singleton (`adopt(true)`, retained) |
| `AppTag` … `ProjectTag` (6) | `BeepAWS.CostExplorer.CostAllocationTag` | tag keys `App`, `beep-ci`, `DataClass`, `ghr:environment`, `ManagedBy`, `Project` | adopted singletons (silent, retained) |
| `ComputeOptimizer` | `BeepAWS.ComputeOptimizer.Enrollment` | account enrollment | adopted singleton (silent, retained) |
| `CostOptimizationHub` | `BeepAWS.CostOptimizationHub.Enrollment` | account enrollment | adopted singleton (silent, retained) |

The budget and subscription names differ from the Pulumi-owned
`Monthly Budget` and `beep-account-daily-anomalies`, so both sets run side by
side until the cutover. The services monitor is not recreated: AWS allows one
`DIMENSIONAL`/`SERVICE` monitor per account, so `prod` adopts the live one by
name. In the `silent` phase the budget has no notifications and no
subscription exists, so nobody is mailed twice; the phase flips to `live`
after the Pulumi budget and subscription are destroyed.

The stack output names the budget, its ARN, the phase, the monitor and
subscription ARNs, the tag keys and both enrollment statuses. It never
contains a recipient.

## Running it

`alchemy.run.ts` declares the shared S3 state store and the stack. A
personal-stage plan from the package directory:

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
export AWS_REGION=us-east-1
bunx alchemy plan --stage "dev_$USER" --env-file /dev/null
```

`prod` deploys only from `.github/workflows/deploy-cost-controls.yml`. Deploy
role, cutover from Pulumi and rollback: `docs/runbooks/alchemy-infra.md`,
section "Cost controls".

## Tests

`bun run test` is hermetic. `test/support/FakeAws.ts` serves an in-memory
account (Budgets, Cost Explorer, Compute Optimizer, Cost Optimization Hub)
behind an effect `HttpClient`, so every distilled call signs, serializes and
parses for real with no credentials and no network. The suites cover the
personal and `prod` resource graphs, the monitor adoption, both notification
phases, the CI, account and region guards, configuration decoding and
rejection, and that removing the singletons from the stack deletes nothing.

## License

MIT
