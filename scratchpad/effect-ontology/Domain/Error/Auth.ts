/**
 * Schema-backed authentication failures for ontology transports.
 *
 * @remarks
 * Ticket and API-key failures retain enough context for observability while
 * keeping credentials opaque. Authentication reasons form a closed literal
 * domain so recovery logic is exhaustive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { ErrorMessage, Milliseconds, makeOntologyErrorClass, OptionalErrorCause } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Auth");

/**
 * Closed reasons why authentication can be rejected.
 *
 * @example
 * ```ts
 * import { AuthenticationReason } from "@effect-ontology/Error/Auth.ts"
 *
 * console.log(AuthenticationReason.is.invalid("invalid")) // true
 * ```
 *
 * @invariant Every value is one of `missing`, `invalid`, `disabled`, or `expired`.
 * @category errors
 * @since 0.0.0
 */
export const AuthenticationReason = LiteralKit(["missing", "invalid", "disabled", "expired"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("missing", "invalid", "disabled", "expired"),
  })
  .pipe(
    $I.annoteSchema("AuthenticationReason", {
      description: "Closed reason code explaining an authentication rejection.",
    })
  );

/**
 * Runtime reason accepted by {@link AuthenticationReason}.
 *
 * @example
 * ```ts
 * import type { AuthenticationReason } from "@effect-ontology/Error/Auth.ts"
 *
 * const reason: AuthenticationReason = "disabled"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AuthenticationReason = typeof AuthenticationReason.Type;

/**
 * Indicates that a one-time authentication ticket is no longer valid.
 *
 * @remarks
 * The expired ticket is retained for correlation only; callers should avoid
 * writing it to user-facing logs.
 *
 * @example
 * ```ts
 * import { TicketExpiredError } from "@effect-ontology/Error/Auth.ts"
 *
 * const error = TicketExpiredError.fromUnknown({
 *   message: "Authentication ticket expired.",
 *   ticket: "ticket-id",
 *   expiredAt: 1_720_000_000_000
 * })
 * console.log(error._tag)
 * ```
 *
 * @invariant `ticket` and `message` are non-empty and `expiredAt` is non-negative.
 * @category errors
 * @since 0.0.0
 */
export const TicketExpiredError = makeOntologyErrorClass(
  $I`TicketExpiredError`,
  "TicketExpiredError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable ticket-expiration diagnostic.",
    }),
    ticket: S.NonEmptyString.annotateKey({
      description: "Opaque ticket identifier that expired.",
    }),
    expiredAt: Milliseconds.annotateKey({
      description: "Unix epoch timestamp in milliseconds when the ticket expired.",
    }),
  },
  $I.annote("TicketExpiredError", {
    description: "Authentication failure caused by an expired one-time ticket.",
  })
);

/**
 * Runtime value decoded by {@link TicketExpiredError}.
 *
 * @example
 * ```ts
 * import { TicketExpiredError, type TicketExpiredError as Expired } from "@effect-ontology/Error/Auth.ts"
 *
 * const error: Expired = TicketExpiredError.fromUnknown({
 *   message: "Expired.",
 *   ticket: "ticket-id",
 *   expiredAt: 10
 * })
 * console.log(error.ticket)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TicketExpiredError = typeof TicketExpiredError.Type;

/**
 * Indicates that a one-time ticket is unknown or has already been consumed.
 *
 * @example
 * ```ts
 * import { TicketNotFoundError } from "@effect-ontology/Error/Auth.ts"
 *
 * const error = TicketNotFoundError.make({
 *   message: "Authentication ticket was not found.",
 *   ticket: "ticket-id"
 * })
 * console.log(error._tag)
 * ```
 *
 * @invariant `ticket` and `message` are non-empty.
 * @category errors
 * @since 0.0.0
 */
export const TicketNotFoundError = makeOntologyErrorClass(
  $I`TicketNotFoundError`,
  "TicketNotFoundError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable missing-ticket diagnostic.",
    }),
    ticket: S.NonEmptyString.annotateKey({
      description: "Opaque ticket identifier that could not be resolved.",
    }),
  },
  $I.annote("TicketNotFoundError", {
    description: "Authentication failure for an unknown or previously consumed ticket.",
  })
);

/**
 * Runtime value decoded by {@link TicketNotFoundError}.
 *
 * @example
 * ```ts
 * import { TicketNotFoundError, type TicketNotFoundError as Missing } from "@effect-ontology/Error/Auth.ts"
 *
 * const error: Missing = TicketNotFoundError.make({
 *   message: "Missing.",
 *   ticket: "ticket-id"
 * })
 * console.log(error.ticket)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TicketNotFoundError = typeof TicketNotFoundError.Type;

/**
 * General authentication rejection with a machine-readable reason.
 *
 * @example
 * ```ts
 * import { AuthenticationError } from "@effect-ontology/Error/Auth.ts"
 *
 * const error = AuthenticationError.make({
 *   message: "Authentication is disabled.",
 *   reason: "disabled"
 * })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AuthenticationError = makeOntologyErrorClass(
  $I`AuthenticationError`,
  "AuthenticationError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable authentication diagnostic.",
    }),
    reason: AuthenticationReason.annotateKey({
      description: "Stable reason code for programmatic recovery.",
    }),
  },
  $I.annote("AuthenticationError", {
    description: "General authentication rejection with a closed reason code.",
  })
);

/**
 * Runtime value decoded by {@link AuthenticationError}.
 *
 * @example
 * ```ts
 * import { AuthenticationError, type AuthenticationError as AuthFailure } from "@effect-ontology/Error/Auth.ts"
 *
 * const error: AuthFailure = AuthenticationError.make({
 *   message: "Credentials are invalid.",
 *   reason: "invalid"
 * })
 * console.log(error.reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AuthenticationError = typeof AuthenticationError.Type;

/**
 * Indicates that API-key verification failed.
 *
 * @remarks
 * The key itself is intentionally absent. Only the diagnostic and optional
 * underlying defect cross this domain boundary.
 *
 * @example
 * ```ts
 * import { InvalidApiKeyError } from "@effect-ontology/Error/Auth.ts"
 *
 * const error = InvalidApiKeyError.make({ message: "API key is invalid." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const InvalidApiKeyError = makeOntologyErrorClass(
  $I`InvalidApiKeyError`,
  "InvalidApiKeyError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable API-key validation diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional verifier defect, normalized to Option.",
    }),
  },
  $I.annote("InvalidApiKeyError", {
    description: "API-key verification failure that never carries the secret key.",
  })
);

/**
 * Runtime value decoded by {@link InvalidApiKeyError}.
 *
 * @example
 * ```ts
 * import { InvalidApiKeyError, type InvalidApiKeyError as InvalidKey } from "@effect-ontology/Error/Auth.ts"
 *
 * const error: InvalidKey = InvalidApiKeyError.make({ message: "Rejected." })
 * console.log(error.message)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type InvalidApiKeyError = typeof InvalidApiKeyError.Type;

const AuthErrorDefinition = S.Union([
  TicketExpiredError,
  TicketNotFoundError,
  AuthenticationError,
  InvalidApiKeyError,
]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of transport authentication failures.
 *
 * @example
 * ```ts
 * import { AuthError, AuthenticationError } from "@effect-ontology/Error/Auth.ts"
 *
 * const error = AuthenticationError.make({ message: "Missing.", reason: "missing" })
 * console.log(AuthError.guards.AuthenticationError(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AuthError = AuthErrorDefinition.pipe(
  $I.annoteSchema("AuthError", {
    description: "Exhaustive tagged union of ontology transport authentication failures.",
    toArbitrary: () => (fc) => S.toArbitrary(AuthErrorDefinition)(fc),
  })
);

/**
 * Runtime failure decoded by {@link AuthError}.
 *
 * @example
 * ```ts
 * import { TicketNotFoundError, type AuthError } from "@effect-ontology/Error/Auth.ts"
 *
 * const error: AuthError = TicketNotFoundError.make({
 *   message: "Missing.",
 *   ticket: "ticket-id"
 * })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AuthError = typeof AuthError.Type;
