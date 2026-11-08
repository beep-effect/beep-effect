/**
 * Instrument declarations owned by `@beep/alchemy-postgres`: the
 * `AlchemyPostgresPlatform.send`, `AlchemyPostgres.Outbox.deliver` and
 * `AlchemyPostgres.Backfill.runJob` spans, the `beep.alchemy.*` attribute keys
 * they carry, and the `domain.*` keys of the kernel this driver hosts.
 *
 * **Details**
 *
 * The driver attaches technical keys only. Each value is a name the hosted
 * model declares (an aggregate, view, policy or projection name) or a fixed
 * target kind or job role, so every key is bounded and allowed at
 * `shape-only`. Aggregate instance ids, delivery keys and payloads never
 * become attributes.
 *
 * The hosted `@alchemy.run/domain` kernel names its own spans and sets the
 * `domain.*` keys whatever a declaration says. They are declared here, on the
 * kernel's behalf, so catalog enrichment keeps them: names, outcomes and
 * counts at `shape-only`, instance ids, keys, streams and correlation ids
 * only from `standard` up.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AlchemyPostgresId } from "@beep/identity/packages";
import {
  AttributeKey,
  AttributeKeyName,
  InstrumentDeclarations,
  PackageName,
  SignalKind,
  SpanInstrument,
  SpanName,
} from "@beep/observability/catalog";
import { LiteralKit } from "@beep/schema";
import * as O from "effect/Option";
import type * as A from "effect/Array";

const $I = $AlchemyPostgresId.create("AlchemyPostgres.instruments");

const owner = PackageName.make("@beep/alchemy-postgres");

/**
 * Kind of consumer an outbox delivery targets, the value of
 * `beep.alchemy.target_kind`.
 *
 * **Example** (Read a target kind)
 *
 * ```ts
 * import { DeliveryTargetKind } from "@beep/alchemy-postgres/AlchemyPostgres.instruments"
 *
 * console.log(DeliveryTargetKind.Enum.view) // "view"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeliveryTargetKind = LiteralKit(["view", "policy", "projection"]).pipe(
  $I.annoteSchema("DeliveryTargetKind", {
    description: "Kind of consumer an outbox delivery targets, as a span attribute value.",
  })
);

/**
 * Runtime type for {@link DeliveryTargetKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type DeliveryTargetKind = typeof DeliveryTargetKind.Type;

/**
 * Role of the backfill address a job runs for, the value of
 * `beep.alchemy.job_role`.
 *
 * **Example** (Read a job role)
 *
 * ```ts
 * import { BackfillJobRole } from "@beep/alchemy-postgres/AlchemyPostgres.instruments"
 *
 * console.log(BackfillJobRole.Enum.consumer) // "consumer"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BackfillJobRole = LiteralKit(["node", "run", "scanner", "source", "consumer"]).pipe(
  $I.annoteSchema("BackfillJobRole", {
    description: "Role of the backfill address a job runs for, as a span attribute value.",
  })
);

/**
 * Runtime type for {@link BackfillJobRole}.
 *
 * @category models
 * @since 0.0.0
 */
export type BackfillJobRole = typeof BackfillJobRole.Type;

/**
 * Attribute key naming the aggregate a send commits to.
 *
 * **Example** (Read the aggregate key)
 *
 * ```ts
 * import { AggregateAttribute } from "@beep/alchemy-postgres/AlchemyPostgres.instruments"
 *
 * console.log(AggregateAttribute) // "beep.alchemy.aggregate"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AggregateAttribute = AttributeKeyName.make("beep.alchemy.aggregate");

/**
 * Attribute key carrying the kind of consumer an outbox delivery targets.
 *
 * **Example** (Read the target kind key)
 *
 * ```ts
 * import { TargetKindAttribute } from "@beep/alchemy-postgres/AlchemyPostgres.instruments"
 *
 * console.log(TargetKindAttribute) // "beep.alchemy.target_kind"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TargetKindAttribute = AttributeKeyName.make("beep.alchemy.target_kind");

/**
 * Attribute key naming the view, policy or projection an outbox delivery
 * targets.
 *
 * **Example** (Read the target name key)
 *
 * ```ts
 * import { TargetNameAttribute } from "@beep/alchemy-postgres/AlchemyPostgres.instruments"
 *
 * console.log(TargetNameAttribute) // "beep.alchemy.target_name"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TargetNameAttribute = AttributeKeyName.make("beep.alchemy.target_name");

/**
 * Attribute key carrying the role of the backfill address a job runs for,
 * never the address's key.
 *
 * **Example** (Read the job role key)
 *
 * ```ts
 * import { JobRoleAttribute } from "@beep/alchemy-postgres/AlchemyPostgres.instruments"
 *
 * console.log(JobRoleAttribute) // "beep.alchemy.job_role"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JobRoleAttribute = AttributeKeyName.make("beep.alchemy.job_role");

/**
 * The `AlchemyPostgresPlatform.send` span: one command committed to an
 * aggregate, labelled by aggregate name only.
 *
 * **Example** (Read the span name)
 *
 * ```ts
 * import { PlatformSendSpan } from "@beep/alchemy-postgres/AlchemyPostgres.instruments"
 *
 * console.log(PlatformSendSpan.name) // "AlchemyPostgresPlatform.send"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PlatformSendSpan = SpanInstrument.make({
  name: SpanName.make("AlchemyPostgresPlatform.send"),
  owner,
  family: "driver",
  attributes: [AggregateAttribute],
  minTier: "shape-only",
  description: "Commits one command to an aggregate instance in Postgres.",
  kind: "internal",
});

/**
 * The `AlchemyPostgres.Outbox.deliver` span: one outbox row handed to its
 * consumer, parented to the trace stored with the commit that produced it.
 *
 * **Example** (Read the span name)
 *
 * ```ts
 * import { OutboxDeliverSpan } from "@beep/alchemy-postgres/AlchemyPostgres.instruments"
 *
 * console.log(OutboxDeliverSpan.name) // "AlchemyPostgres.Outbox.deliver"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OutboxDeliverSpan = SpanInstrument.make({
  name: SpanName.make("AlchemyPostgres.Outbox.deliver"),
  owner,
  family: "driver",
  attributes: [TargetKindAttribute, TargetNameAttribute],
  minTier: "shape-only",
  description: "Delivers one outbox row to its view, policy or projection.",
  kind: "consumer",
});

/**
 * The `AlchemyPostgres.Backfill.runJob` span: one claimed backfill job run,
 * labelled by the role of its address only.
 *
 * **Example** (Read the span name)
 *
 * ```ts
 * import { BackfillRunJobSpan } from "@beep/alchemy-postgres/AlchemyPostgres.instruments"
 *
 * console.log(BackfillRunJobSpan.name) // "AlchemyPostgres.Backfill.runJob"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BackfillRunJobSpan = SpanInstrument.make({
  name: SpanName.make("AlchemyPostgres.Backfill.runJob"),
  owner,
  family: "driver",
  attributes: [JobRoleAttribute],
  minTier: "shape-only",
  description: "Runs one claimed backfill job for a view, projection or catch-up role.",
  kind: "internal",
});

const spanOnly: A.NonEmptyReadonlyArray<SignalKind> = [SignalKind.Enum.span];
const spanAndMetric: A.NonEmptyReadonlyArray<SignalKind> = [SignalKind.Enum.span, SignalKind.Enum.metric];

/** A kernel `domain.*` key set from a model-declared name or a fixed literal. */
const kernelName = (key: string, description: string, signals: A.NonEmptyReadonlyArray<SignalKind> = spanOnly) =>
  AttributeKey.make({
    key: AttributeKeyName.make(key),
    type: "string",
    signals,
    cardinality: "bounded",
    minTier: "shape-only",
    values: O.none(),
    owner,
    description,
  });

/** A kernel `domain.*` count. */
const kernelCount = (key: string, description: string) =>
  AttributeKey.make({
    key: AttributeKeyName.make(key),
    type: "int",
    signals: spanOnly,
    cardinality: "unbounded",
    minTier: "shape-only",
    values: O.none(),
    owner,
    description,
  });

/** A kernel `domain.*` instance identifier: kept only from `standard` up. */
const kernelIdentifier = (key: string, description: string) =>
  AttributeKey.make({
    key: AttributeKeyName.make(key),
    type: "string",
    signals: spanOnly,
    cardinality: "unbounded",
    minTier: "standard",
    values: O.none(),
    owner,
    description,
  });

/** The keys the hosted kernel sets on its spans and metric series (`@alchemy.run/domain` `Telemetry`). */
const kernelAttributes = [
  kernelName("domain.aggregate", "Aggregate a kernel span or series concerns, as the model names it.", spanAndMetric),
  kernelName("domain.command", "Command a kernel decide span or series handles.", spanAndMetric),
  kernelName("domain.event", "Event a kernel reaction span or series concerns.", spanAndMetric),
  kernelName("domain.view", "View a kernel view span updates."),
  kernelName("domain.read", "Live read a kernel read span serves."),
  kernelName("domain.saga", "Saga a kernel saga span runs."),
  kernelName("domain.policy", "Policy a kernel policy span runs."),
  kernelName("domain.projection", "Projection a kernel projection span runs."),
  kernelName("domain.consumer", "View, policy, projection or saga a kernel series counts.", spanAndMetric),
  kernelName("domain.system", "External system a kernel external span calls.", spanAndMetric),
  kernelName("domain.operation", "External system operation a kernel external span calls.", spanAndMetric),
  kernelName("domain.outcome", "Outcome tag of a kernel span or series: ok or a failure tag.", spanAndMetric),
  kernelName("domain.kind", "Kind of kernel reaction: view, policy, projection or saga.", spanAndMetric),
  kernelCount("domain.events", "Events one kernel decide committed."),
  kernelCount("domain.version", "Aggregate version after one kernel decide."),
  kernelCount("domain.seq", "Sequence number of the event a kernel span concerns."),
  kernelCount("domain.batch", "Deliveries in one kernel view or projection batch."),
  kernelIdentifier("domain.id", "Aggregate instance id a kernel span concerns."),
  kernelIdentifier("domain.key", "View, read or saga key a kernel span concerns."),
  kernelIdentifier("domain.stream", "Event stream a kernel decide appended to."),
  kernelIdentifier("domain.source", "Source stream of the delivery a kernel reaction span handles."),
  kernelIdentifier("domain.command_id", "Command id of a kernel send or decide."),
  kernelIdentifier("domain.correlation_id", "Correlation id a kernel span carries from its cause."),
];

/**
 * Driver declarations: the `beep.alchemy.*` keys and the `domain.*` keys of
 * the hosted kernel, plus the `AlchemyPostgresPlatform.send`,
 * `AlchemyPostgres.Outbox.deliver` and `AlchemyPostgres.Backfill.runJob`
 * spans.
 *
 * **Example** (List the driver declarations)
 *
 * ```ts
 * import { AlchemyPostgresInstruments } from "@beep/alchemy-postgres/AlchemyPostgres.instruments"
 *
 * console.log(AlchemyPostgresInstruments.instruments.length) // 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AlchemyPostgresInstruments = InstrumentDeclarations.make({
  attributes: [
    AttributeKey.make({
      key: AggregateAttribute,
      type: "string",
      signals: [SignalKind.Enum.span],
      cardinality: "bounded",
      minTier: "shape-only",
      values: O.none(),
      owner,
      description: "Aggregate a send commits to, as the model names it.",
    }),
    AttributeKey.make({
      key: TargetKindAttribute,
      type: "string",
      signals: [SignalKind.Enum.span],
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(DeliveryTargetKind.literals),
      owner,
      description: "Kind of consumer an outbox delivery targets.",
    }),
    AttributeKey.make({
      key: TargetNameAttribute,
      type: "string",
      signals: [SignalKind.Enum.span],
      cardinality: "bounded",
      minTier: "shape-only",
      values: O.none(),
      owner,
      description: "View, policy or projection an outbox delivery targets, as the model names it.",
    }),
    AttributeKey.make({
      key: JobRoleAttribute,
      type: "string",
      signals: [SignalKind.Enum.span],
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(BackfillJobRole.literals),
      owner,
      description: "Role of the backfill address a job runs for.",
    }),
    ...kernelAttributes,
  ],
  instruments: [PlatformSendSpan, OutboxDeliverSpan, BackfillRunJobSpan],
});
