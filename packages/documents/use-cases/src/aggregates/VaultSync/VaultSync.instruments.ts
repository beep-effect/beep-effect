/**
 * Instrument declarations owned by `@beep/documents-use-cases` for vault sync:
 * the `documents.vault_sync.destination_id` key and the `VaultSyncRequests.start`
 * span that carries it.
 *
 * **Details**
 *
 * Domain attributes attach where the domain is known (standard 12), so the key
 * is declared here, the lowest package whose span needs it. `@beep/documents-server`
 * imports it for its boundary, pass and Session spans and declares the rest of
 * the `documents.vault_sync.*` keys. The key holds an opaque minted
 * `DestinationId`, never a name, and is allowed only from `standard` up.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  AttributeKey,
  AttributeKeyName,
  InstrumentDeclarations,
  PackageName,
  SignalKind,
  SpanInstrument,
  SpanName,
} from "@beep/observability/catalog";
import * as O from "effect/Option";

const owner = PackageName.make("@beep/documents-use-cases");

/**
 * Attribute key carrying the opaque `DestinationId` a vault-sync span concerns.
 *
 * **Example** (Read the destination key)
 *
 * ```ts
 * import { VaultSyncDestinationIdAttribute } from "@beep/documents-use-cases/aggregates/VaultSync"
 *
 * console.log(VaultSyncDestinationIdAttribute) // "documents.vault_sync.destination_id"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VaultSyncDestinationIdAttribute = AttributeKeyName.make("documents.vault_sync.destination_id");

/**
 * Use-case vault-sync declarations: the `documents.vault_sync.destination_id`
 * key and the `VaultSyncRequests.start` span.
 *
 * **Example** (List the declared keys)
 *
 * ```ts
 * import { VaultSyncUseCaseInstruments } from "@beep/documents-use-cases/aggregates/VaultSync"
 *
 * console.log(VaultSyncUseCaseInstruments.attributes.map((attribute) => attribute.key))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VaultSyncUseCaseInstruments = InstrumentDeclarations.make({
  attributes: [
    AttributeKey.make({
      key: VaultSyncDestinationIdAttribute,
      type: "string",
      signals: [SignalKind.Enum.span],
      cardinality: "unbounded",
      minTier: "standard",
      values: O.none(),
      owner,
      description: "Opaque minted DestinationId a vault-sync call targets; never a name.",
    }),
  ],
  instruments: [
    SpanInstrument.make({
      name: SpanName.make("VaultSyncRequests.start"),
      owner,
      family: "slice",
      attributes: [],
      minTier: "shape-only",
      description:
        "Starts the durable pass or probe workflow for a public request; from standard up it carries destination_id.",
      kind: "internal",
    }),
  ],
});
