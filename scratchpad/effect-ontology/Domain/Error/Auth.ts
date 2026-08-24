/**
 * Schema-backed authentication failures for ontology transports.
 *
 * **Details**
 *
 * * Ticket and API-key failures retain enough context for observability while
 * keeping credentials opaque. Authentication reasons form a closed literal
 * domain so recovery logic is exhaustive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { ErrorMessage, Milliseconds, OptionalErrorCause } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Auth");

/**
 * Closed reasons why authentication can be rejected.
 *
 * **Example** (Use AuthenticationReason)
 * ```ts
 * import { AuthenticationReason } from "@effect-ontology/Error/Auth"
 *
 * console.log(AuthenticationReason.is.invalid("invalid")) // true
 * ```
 *
 * @invariant Every value is one of `missing`, `invalid`, `disabled`, or `expired`.
 * @category errors
 * @since 0.0.0
 */
export const AuthenticationReason = LiteralKit(["missing", "invalid", "disabled", "expired"]).pipe(
  $I.annoteSchema("AuthenticationReason", {
    toArbitrary: () => (fc) => fc.constantFrom("missing", "invalid", "disabled", "expired"),
    description: "Closed reason code explaining an authentication rejection.",
  })
);

/**
 * Runtime reason accepted by {@link AuthenticationReason}.
 *
 * **Example** (Use AuthenticationReason)
 * ```ts
 * import type { AuthenticationReason } from "@effect-ontology/Error/Auth"
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
 * **Details**
 *
 * * The expired ticket is retained for correlation only; callers should avoid
 * writing it to user-facing logs.
 *
 * **Example** (Use TicketExpiredError)
 * ```ts
 * import { TicketExpiredError } from "@effect-ontology/Error/Auth"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(TicketExpiredError)({
 *   _tag: "TicketExpiredError",
 *   message: "Authentication ticket expired.",
 *   ticket: "ticket-id",
 *   expiredAt: 1_720_000_000_000
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @invariant `ticket` and `message` are non-empty and `expiredAt` is non-negative.
 * @category errors
 * @since 0.0.0
 */
export class TicketExpiredError extends S.TaggedError<TicketExpiredError>($I`TicketExpiredError`)(
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
) {}

/**
 * Indicates that a one-time ticket is unknown or has already been consumed.
 *
 * **Example** (Use TicketNotFoundError)
 * ```ts
 * import { TicketNotFoundError } from "@effect-ontology/Error/Auth"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(TicketNotFoundError)({
 *   _tag: "TicketNotFoundError",
 *   message: "Authentication ticket was not found.",
 *   ticket: "ticket-id"
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @invariant `ticket` and `message` are non-empty.
 * @category errors
 * @since 0.0.0
 */
export class TicketNotFoundError extends S.TaggedError<TicketNotFoundError>($I`TicketNotFoundError`)(
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
) {}

/**
 * General authentication rejection with a machine-readable reason.
 *
 * **Example** (Use AuthenticationError)
 * ```ts
 * import { AuthenticationError } from "@effect-ontology/Error/Auth"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(AuthenticationError)({
 *   _tag: "AuthenticationError",
 *   message: "Authentication is disabled.",
 *   reason: "disabled"
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AuthenticationError extends S.TaggedError<AuthenticationError>($I`AuthenticationError`)(
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
) {}

/**
 * Indicates that API-key verification failed.
 *
 * **Details**
 *
 * * The key itself is intentionally absent. Only the diagnostic and optional
 * underlying defect cross this domain boundary.
 *
 * **Example** (Use InvalidApiKeyError)
 * ```ts
 * import { InvalidApiKeyError } from "@effect-ontology/Error/Auth"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(InvalidApiKeyError)({
 *   _tag: "InvalidApiKeyError", message: "API key is invalid." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class InvalidApiKeyError extends S.TaggedError<InvalidApiKeyError>($I`InvalidApiKeyError`)(
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
) {}

const AuthErrorDefinition = S.Union([
  TicketExpiredError,
  TicketNotFoundError,
  AuthenticationError,
  InvalidApiKeyError,
]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of transport authentication failures.
 *
 * **Example** (Use AuthError)
 * ```ts
 * import { AuthError, AuthenticationError } from "@effect-ontology/Error/Auth"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(AuthenticationError)({
 *   _tag: "AuthenticationError", message: "Missing.", reason: "missing" })
 * console.log(AuthError.guards.AuthenticationError(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AuthError = AuthErrorDefinition.pipe(
  $I.annoteSchema("AuthError", {
    description: "Exhaustive tagged union of ontology transport authentication failures.",
    toArbitrary: () => S.toArbitrary(AuthErrorDefinition),
  })
);

/**
 * Runtime failure decoded by {@link AuthError}.
 *
 * **Example** (Use AuthError)
 * ```ts
 * import { TicketNotFoundError, type AuthError } from "@effect-ontology/Error/Auth"
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
