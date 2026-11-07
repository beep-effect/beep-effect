/**
 * Instrument declarations owned by `@beep/alchemy-postgres`: the
 * `AlchemyPostgresPlatform.send` and `AlchemyPostgres.Outbox.deliver` spans
 * and the `beep.alchemy.*` attribute keys they carry.
 *
 * **Details**
 *
 * The driver attaches technical keys only. Each value is a name the hosted
 * model declares (an aggregate, view, policy or projection name) or a fixed
 * target kind, so every key is bounded and allowed at `shape-only`. Aggregate
 * instance ids, delivery keys and payloads never become attributes.
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
 * Driver declarations: the `beep.alchemy.aggregate`,
 * `beep.alchemy.target_kind` and `beep.alchemy.target_name` keys, plus the
 * `AlchemyPostgresPlatform.send` and `AlchemyPostgres.Outbox.deliver` spans.
 *
 * **Example** (List the driver declarations)
 *
 * ```ts
 * import { AlchemyPostgresInstruments } from "@beep/alchemy-postgres/AlchemyPostgres.instruments"
 *
 * console.log(AlchemyPostgresInstruments.attributes.length) // 3
 * console.log(AlchemyPostgresInstruments.instruments.length) // 2
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
  ],
  instruments: [PlatformSendSpan, OutboxDeliverSpan],
});
