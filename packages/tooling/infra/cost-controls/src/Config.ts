/**
 * Typed configuration of the `CostControls` stack: the guarded account,
 * the spend thresholds, the notification phase and the recipient list.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { $InfraCostControlsId } from "@beep/identity/packages";
import { EmailString, LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";

const $I = $InfraCostControlsId.create("Config");

/**
 * Twelve-digit AWS account id.
 *
 * **Example** (Decode an account id)
 *
 * ```ts
 * import { AccountId } from "@beep/infra-cost-controls/Config"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(AccountId)("123456789012")) // "123456789012"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AccountId = S.String.check(
  S.isPattern(
    /^\d{12}$/u,
    $I.annote("AccountIdFormat", {
      title: "AWS Account ID",
      description: "A twelve-digit AWS account id.",
      message: "Expected a twelve-digit AWS account ID",
    })
  )
).pipe($I.annoteSchema("AccountId", { description: "The AWS account the cost controls belong to." }));

/**
 * A finite positive amount in US dollars.
 *
 * **Example** (Decode a dollar threshold)
 *
 * ```ts
 * import { PositiveUsd } from "@beep/infra-cost-controls/Config"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(PositiveUsd)(200)) // 200
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PositiveUsd = S.Finite.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("PositiveUsd", { description: "A finite positive amount in US dollars." })
);

/**
 * The only region the stack deploys to. Budgets and Cost Explorer are global
 * services served from `us-east-1`, and Cost Optimization Hub answers only
 * there.
 *
 * **Example** (Read the pinned region)
 *
 * ```ts
 * import { CostControlsRegion } from "@beep/infra-cost-controls/Config"
 *
 * console.log(CostControlsRegion.Enum["us-east-1"]) // "us-east-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CostControlsRegion = LiteralKit(["us-east-1"]).pipe(
  $I.annoteSchema("CostControlsRegion", { description: "The region every cost-control API call targets." })
);

/**
 * Decoded region.
 *
 * @category models
 * @since 0.0.0
 */
export type CostControlsRegion = typeof CostControlsRegion.Type;

/**
 * Whether the stack's budget and anomaly subscription mail anyone.
 *
 * **Details**
 *
 * `silent` declares the budget without notifications and declares no anomaly
 * subscription: the state the stack runs in beside the Pulumi-owned budget
 * and subscription, so recipients are not mailed twice. `live` adds the
 * budget notifications and the anomaly subscription and needs the
 * recipient list. The prod phase flips to `live` in the PR that follows the
 * Pulumi cutover.
 *
 * **Example** (Read the phases)
 *
 * ```ts
 * import { NotificationPhase } from "@beep/infra-cost-controls/Config"
 *
 * console.log(NotificationPhase.Enum.silent) // "silent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NotificationPhase = LiteralKit(["silent", "live"]).pipe(
  $I.annoteSchema("NotificationPhase", {
    description: "Whether the budget and anomaly subscription notify recipients.",
  })
);

/**
 * Decoded notification phase.
 *
 * @category models
 * @since 0.0.0
 */
export type NotificationPhase = typeof NotificationPhase.Type;

/**
 * Cost allocation tag keys the account activates. The six keys billing had
 * ingested on 2026-09-09; each is an account singleton.
 *
 * **Example** (List the tag keys)
 *
 * ```ts
 * import { CostAllocationTagKey } from "@beep/infra-cost-controls/Config"
 *
 * console.log(CostAllocationTagKey.literals.length) // 6
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CostAllocationTagKey = LiteralKit([
  "App",
  "beep-ci",
  "DataClass",
  "ghr:environment",
  "ManagedBy",
  "Project",
]).pipe($I.annoteSchema("CostAllocationTagKey", { description: "A cost allocation tag key the account activates." }));

/**
 * Decoded cost allocation tag key.
 *
 * @category models
 * @since 0.0.0
 */
export type CostAllocationTagKey = typeof CostAllocationTagKey.Type;

/**
 * Configuration of one stage of the `CostControls` stack.
 *
 * **Details**
 *
 * Every field is tracked source: the account id is already public in the
 * repository and the thresholds are policy. Recipient addresses are personal
 * data and never live here; see {@link NotificationRecipients}.
 *
 * **Example** (Decode a stage configuration)
 *
 * ```ts
 * import { CostControlsConfig } from "@beep/infra-cost-controls/Config"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(CostControlsConfig)({
 *   expectedAccountId: "123456789012",
 *   region: "us-east-1",
 *   monthlyBudgetUsd: 200,
 *   anomalyImpactUsd: 10,
 *   notifications: "silent",
 * })
 * console.log(config.monthlyBudgetUsd) // 200
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class CostControlsConfig extends S.Opaque<CostControlsConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    expectedAccountId: AccountId,
    region: CostControlsRegion,
    monthlyBudgetUsd: PositiveUsd,
    anomalyImpactUsd: PositiveUsd,
    notifications: NotificationPhase,
  }).pipe(
    $I.annoteSchema("CostControlsConfig", {
      description: "Account guard, spend thresholds and notification phase of one stack stage.",
    })
  )
) {}

/**
 * Companion types for {@link CostControlsConfig}.
 *
 * @category configuration
 * @since 0.0.0
 */
export declare namespace CostControlsConfig {
  /**
   * The plain shape a stage configuration is written in.
   *
   * @category configuration
   * @since 0.0.0
   */
  export type Encoded = typeof CostControlsConfig.Encoded;
}

/**
 * The stage that owns the account's live cost controls.
 *
 * **Example** (Read the production stage)
 *
 * ```ts
 * import { productionStage } from "@beep/infra-cost-controls/Config"
 *
 * console.log(productionStage) // "prod"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const productionStage = "prod";

/**
 * Configuration input of the `prod` stage: the account the Pulumi component
 * guards (`accountCostControls:expectedAccountId`), its $200 monthly budget
 * and $10 anomaly impact threshold. The phase stays `silent` until the
 * Pulumi budget and subscription are destroyed (cutover in
 * `docs/runbooks/alchemy-infra.md`).
 *
 * **Example** (Read the production budget)
 *
 * ```ts
 * import { productionConfig } from "@beep/infra-cost-controls/Config"
 *
 * console.log(productionConfig.monthlyBudgetUsd) // 200
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const productionConfig: CostControlsConfig.Encoded = {
  expectedAccountId: "832907639880",
  region: "us-east-1",
  monthlyBudgetUsd: 200,
  anomalyImpactUsd: 10,
  notifications: "silent",
};

/**
 * Configuration input of every personal stage (`dev_$USER`, `live_$USER`):
 * the same account and thresholds, always silent, so a personal stage never
 * mails the account recipients.
 *
 * **Example** (Read the personal phase)
 *
 * ```ts
 * import { personalConfig } from "@beep/infra-cost-controls/Config"
 *
 * console.log(personalConfig.notifications) // "silent"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const personalConfig: CostControlsConfig.Encoded = { ...productionConfig, notifications: "silent" };

const splitRecipients = flow(Str.split(","), A.map(Str.trim), A.filter(Str.isNonEmpty));

/**
 * Notification recipients as one comma-separated string, decoded to a
 * non-empty list of normalized addresses.
 *
 * **Details**
 *
 * The addresses are personal data in a public repository, so they reach the
 * stack only through the environment variable
 * {@link notificationRecipientsVariable}: a GitHub environment secret in CI,
 * set from the encrypted Pulumi config without printing it. Personal stages
 * are always silent and never need it.
 *
 * **Example** (Decode a recipient list)
 *
 * ```ts
 * import { NotificationRecipients } from "@beep/infra-cost-controls/Config"
 * import * as S from "effect/Schema"
 *
 * const recipients = S.decodeUnknownSync(NotificationRecipients)("ops@example.com, Billing@Example.com")
 * console.log(recipients) // ["ops@example.com", "billing@example.com"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const NotificationRecipients = S.String.pipe(
  S.decodeTo(
    S.Array(EmailString).check(S.isMinLength(1)),
    SchemaTransformation.transform<ReadonlyArray<string>, string>({ decode: splitRecipients, encode: A.join(",") })
  ),
  $I.annoteSchema("NotificationRecipients", {
    description: "Comma-separated email recipients of budget and anomaly notifications.",
  })
);

/**
 * Decoded recipient list.
 *
 * @category configuration
 * @since 0.0.0
 */
export type NotificationRecipients = typeof NotificationRecipients.Type;

/**
 * Environment variable that carries the recipient list.
 *
 * **Example** (Read the variable name)
 *
 * ```ts
 * import { notificationRecipientsVariable } from "@beep/infra-cost-controls/Config"
 *
 * console.log(notificationRecipientsVariable) // "COST_CONTROLS_NOTIFICATION_EMAILS"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const notificationRecipientsVariable = "COST_CONTROLS_NOTIFICATION_EMAILS";

/**
 * Read the recipient list from the environment, deduplicated. Read only in
 * the `live` phase, so a silent stage needs no addresses at all.
 *
 * **Example** (Read the recipients)
 *
 * ```ts
 * import { notificationRecipients } from "@beep/infra-cost-controls/Config"
 *
 * console.log(typeof notificationRecipients) // "object"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const notificationRecipients = Config.schema(NotificationRecipients, notificationRecipientsVariable).pipe(
  Config.map(A.dedupe)
);

/**
 * Decode a stage configuration from unknown input, failing with a
 * `SchemaError`.
 *
 * **Example** (Reject a negative budget)
 *
 * ```ts
 * import { decodeCostControlsConfig } from "@beep/infra-cost-controls/Config"
 * import * as Effect from "effect/Effect"
 *
 * const exit = Effect.runSyncExit(decodeCostControlsConfig({ monthlyBudgetUsd: -1 }))
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @param input - Untrusted stage configuration.
 * @returns The decoded configuration, or a `SchemaError`.
 * @category configuration
 * @since 0.0.0
 */
export const decodeCostControlsConfig = (input: unknown): Effect.Effect<CostControlsConfig, S.SchemaError> =>
  S.decodeUnknownEffect(CostControlsConfig)(input);

/**
 * Decode the configuration of a stage: `prod` gets {@link productionConfig},
 * every other stage {@link personalConfig}. A configuration that fails its
 * schema stops the stack with a `ConfigError` before any resource is read.
 *
 * **Example** (Resolve a personal stage)
 *
 * ```ts
 * import { resolveStageConfig } from "@beep/infra-cost-controls/Config"
 * import * as Effect from "effect/Effect"
 *
 * const config = Effect.runSync(resolveStageConfig("dev_alice"))
 * console.log(config.notifications) // "silent"
 * ```
 *
 * @param stage - The Alchemy stage being planned or deployed.
 * @returns The stage's validated configuration, or a `ConfigError`.
 * @category configuration
 * @since 0.0.0
 */
export const resolveStageConfig = Effect.fn("CostControls.resolveStageConfig")(function* (stage: string) {
  return yield* decodeCostControlsConfig(stage === productionStage ? productionConfig : personalConfig).pipe(
    Effect.mapError((error) => new Config.ConfigError(error))
  );
});
