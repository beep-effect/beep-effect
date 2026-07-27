/**
 * Ticket-based authentication contracts for the effect-ontology experiment.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { PosInt } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/Auth");

const TicketTokenDefinition = S.NonEmptyString.pipe(S.Redacted);

const TicketToken = TicketTokenDefinition.annotate({
  toArbitrary: () => () => S.toArbitrary(TicketTokenDefinition),
}).pipe(
  $I.annoteSchema("TicketToken", {
    description: "Non-empty, redacted bearer credential used once to authenticate a WebSocket connection.",
  })
);

const ApiKeyDefinition = S.NonEmptyString.pipe(S.Redacted);

const ApiKey = ApiKeyDefinition.annotate({
  toArbitrary: () => () => S.toArbitrary(ApiKeyDefinition),
}).pipe(
  $I.annoteSchema("ApiKey", {
    description: "Non-empty API credential retained in redacted form inside a ticket record.",
  })
);

/**
 * Request for a single-use WebSocket authentication ticket.
 *
 * @remarks
 * The ontology identifier is required and non-empty so ticket scope cannot
 * silently widen to an application default.
 *
 * @example
 * ```ts
 * import { TicketRequest } from "@effect-ontology/Schema/Auth.ts"
 *
 * const request = TicketRequest.make({ ontologyId: "seattle" })
 * console.log(request.ontologyId) // "seattle"
 * ```
 *
 * @invariant `ontologyId` is non-empty.
 * @category requests
 * @since 0.0.0
 */
export class TicketRequest extends S.Class<TicketRequest>($I`TicketRequest`)(
  {
    ontologyId: S.NonEmptyString.annotateKey({
      description: "Ontology registry identifier to which the ticket grants access.",
    }),
  },
  $I.annote("TicketRequest", {
    description: "Request for a single-use WebSocket ticket scoped to one ontology.",
  })
) {}

/**
 * Issued single-use WebSocket authentication ticket.
 *
 * @remarks
 * Both the ticket and any API key held by the server are represented as
 * `Redacted` values after decoding, preventing accidental logging by ordinary
 * formatting operations.
 *
 * @example
 * ```ts
 * import { TicketResponse } from "@effect-ontology/Schema/Auth.ts"
 *
 * const response = TicketResponse.fromUnknown({
 *   ticket: "single-use-ticket",
 *   expiresAt: 1_900_000_000_000,
 *   ttlSeconds: 60
 * })
 * console.log(response.ttlSeconds) // 60
 * ```
 *
 * @invariant Expiration is expressed as finite epoch milliseconds and TTL is a
 * positive integer number of seconds.
 * @category responses
 * @since 0.0.0
 */
export class TicketResponse extends S.Class<TicketResponse>($I`TicketResponse`)(
  {
    ticket: TicketToken.annotateKey({
      description: "Single-use bearer ticket, decoded into a redacted value.",
    }),
    expiresAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "UTC expiration instant encoded as Unix epoch milliseconds.",
    }),
    ttlSeconds: PosInt.annotateKey({
      description: "Positive ticket lifetime in whole seconds.",
    }),
  },
  $I.annote("TicketResponse", {
    description: "Issued redacted WebSocket ticket with its absolute expiration and positive TTL.",
  })
) {
  static readonly is = S.is(TicketResponse);
  static readonly fromUnknown = S.decodeUnknownSync(TicketResponse);
}

/**
 * Internal persistence record for an issued authentication ticket.
 *
 * @remarks
 * Credential-bearing fields remain redacted in memory. The record keeps both
 * creation and expiration instants so stores can enforce one-time use and
 * expiry without reconstructing timing from a TTL.
 *
 * @example
 * ```ts
 * import { TicketRecord } from "@effect-ontology/Schema/Auth.ts"
 *
 * const record = TicketRecord.fromUnknown({
 *   ticket: "single-use-ticket",
 *   ontologyId: "seattle",
 *   apiKey: "api-key",
 *   createdAt: 1_800_000_000_000,
 *   expiresAt: 1_800_000_060_000
 * })
 * console.log(record.ontologyId) // "seattle"
 * ```
 *
 * @invariant Credentials are non-empty and redacted; ontology scope is
 * non-empty; timestamps are valid UTC epoch-millisecond instants.
 * @category persistence
 * @since 0.0.0
 */
export class TicketRecord extends S.Class<TicketRecord>($I`TicketRecord`)(
  {
    ticket: TicketToken.annotateKey({
      description: "Single-use bearer ticket retained in redacted form.",
    }),
    ontologyId: S.NonEmptyString.annotateKey({
      description: "Ontology registry identifier to which the ticket grants access.",
    }),
    apiKey: ApiKey.annotateKey({
      description: "API credential that authorized ticket issuance, retained in redacted form.",
    }),
    createdAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "UTC creation instant encoded as Unix epoch milliseconds.",
    }),
    expiresAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "UTC expiration instant encoded as Unix epoch milliseconds.",
    }),
  },
  $I.annote("TicketRecord", {
    description: "Credential-safe persistence record for one scoped, single-use authentication ticket.",
  })
) {
  static readonly is = S.is(TicketRecord);
  static readonly fromUnknown = S.decodeUnknownSync(TicketRecord);
  static readonly decodeOption = S.decodeUnknownOption(TicketRecord);
}
