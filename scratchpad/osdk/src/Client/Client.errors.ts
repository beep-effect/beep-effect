/**
 * The ways a call to the platform can fail, as typed errors.
 *
 * **Details**
 *
 * OSDK reports every failure as a thrown `PalantirApiError` or `UnknownError`,
 * or folds it into a `Result` whose error is the untyped global `Error`. Here
 * each way of failing is its own tagged error, so a caller handles the cases it
 * can recover from by tag and the compiler lists the ones it has not handled.
 *
 * Three errors come from the transport: the platform answered with an error
 * ({@link ApiError}), the request never produced an answer
 * ({@link TransportError}), or a value did not match its schema on the way in
 * or out ({@link DecodeError}). Two more belong to reads that promise exactly
 * one object ({@link ObjectNotFound}, {@link MultipleObjectsFound}), and one
 * to a typed application of an action that the platform reports invalid
 * ({@link ActionRejected}).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ActionValidation } from "../Action/Action.model.ts";
import { ActionTypeApiName, ErrorName, ObjectTypeApiName } from "../Identifier/Identifier.model.ts";
import { ObjectLocator } from "../Object/Object.model.ts";

const $I = $ScratchpadId.create("osdk/Client/Client.errors");

// -----------------------------------------------------------------------------
// The platform's error body
// -----------------------------------------------------------------------------

/**
 * Status code of an HTTP response.
 *
 * **Example** (Recognise a status code)
 *
 * ```ts import.meta.vitest name="Recognise a status code"
 * import * as S from "effect/Schema"
 * import { HttpStatus } from "@beep/scratchpad/osdk/src/Client/index"
 *
 * const isStatus = S.is(HttpStatus)
 * const verdicts = [isStatus(404), isStatus(99), isStatus(200.5)]
 * verdicts // => [true, false, false]
 * ```
 *
 * @invariant A status code is an integer from 100 to 599.
 * @category models
 * @since 0.0.0
 */
export const HttpStatus = S.Int.check(
  S.isBetween(
    { minimum: 100, maximum: 599 },
    $I.annote("HttpStatusCheck", {
      title: "HTTP Status",
      description: "An HTTP status code in the inclusive range 100 through 599.",
      message: "Expected an HTTP status code between 100 and 599",
    })
  )
).pipe($I.annoteSchema("HttpStatus", { description: "Status code of an HTTP response." }));

/**
 * Runtime type of {@link HttpStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type HttpStatus = typeof HttpStatus.Type;

// The keys of the JSON body the platform sends with a failed request. `ApiError` carries the same
// keys beside the status, so both are built from this one record.
const errorBodyFields = {
  errorCode: S.String.annotateKey({
    description: "Broad class of the failure, such as INVALID_ARGUMENT, NOT_FOUND or PERMISSION_DENIED.",
  }),
  errorName: ErrorName.annotateKey({ description: "Specific name of the failure, such as ObjectTypeNotFound." }),
  errorInstanceId: S.String.annotateKey({ description: "Identifier of this occurrence, for support requests." }),
  errorDescription: S.OptionFromOptionalKey(S.String).pipe(
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description: "Human-readable account of the failure, when the platform sends one." })
  ),
  parameters: S.Record(S.String, S.Json).pipe(
    S.withConstructorDefault(Effect.succeed(R.empty<string, S.Json>())),
    S.withDecodingDefaultKey(Effect.succeed(R.empty<string, S.Json>())),
    S.annotateKey({ description: "Named details of the failure, verbatim." })
  ),
};

/**
 * The JSON body the platform sends when it refuses or fails a request.
 *
 * **Details**
 *
 * Every HTTP endpoint of the platform answers a failure with this record.
 * `errorCode` is the broad class and `errorName` the specific failure;
 * `parameters` holds whatever the failure wants to say about its inputs, with
 * no fixed shape. A transport decodes the body with this schema and pairs it
 * with the response's status to make an {@link ApiError}.
 *
 * **Example** (Decode the body of a refused request)
 *
 * ```ts import.meta.vitest name="Decode the body of a refused request"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ApiErrorBody } from "@beep/scratchpad/osdk/src/Client/index"
 *
 * const body = await Effect.runPromise(
 *   S.decodeUnknownEffect(ApiErrorBody)({
 *     errorCode: "NOT_FOUND",
 *     errorName: "ObjectTypeNotFound",
 *     errorInstanceId: "b2ae7b3e-2c89-42f5-a762-68957a9c039d",
 *     parameters: { objectType: "Employe" },
 *   })
 * )
 * const facts = [body.errorName, body.parameters]
 * facts // => ["ObjectTypeNotFound", { objectType: "Employe" }]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiErrorBody extends S.Opaque<ApiErrorBody, { readonly brand: unique symbol }>()(
  S.Struct(errorBodyFields).pipe(
    $I.annoteSchema("ApiErrorBody", {
      description: "The JSON body the platform sends when it refuses or fails a request.",
    })
  )
) {}

// -----------------------------------------------------------------------------
// Failures of the transport
// -----------------------------------------------------------------------------

/**
 * The platform answered a request with an error.
 *
 * **Details**
 *
 * The error carries the platform's error body key for key, plus the HTTP
 * status of the response. Branch on `errorName` for a specific failure and on
 * `errorCode` or `status` for a class of failures.
 *
 * **Example** (Pair an error body with its status)
 *
 * ```ts import.meta.vitest name="Pair an error body with its status"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ApiError, ApiErrorBody } from "@beep/scratchpad/osdk/src/Client/index"
 *
 * const body = await Effect.runPromise(
 *   S.decodeUnknownEffect(ApiErrorBody)({
 *     errorCode: "NOT_FOUND",
 *     errorName: "ObjectTypeNotFound",
 *     errorInstanceId: "b2ae7b3e-2c89-42f5-a762-68957a9c039d",
 *     parameters: {},
 *   })
 * )
 * const error = ApiError.fromBody(404, body)
 * const facts = [error._tag, error.status, error.message]
 * facts // => ["ApiError", 404, "ObjectTypeNotFound (NOT_FOUND, HTTP 404, instance b2ae7b3e-2c89-42f5-a762-68957a9c039d)"]
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ApiError extends S.TaggedError<ApiError, { readonly brand: unique symbol }>($I`ApiError`)(
  "ApiError",
  {
    status: HttpStatus.annotateKey({ description: "HTTP status of the response that carried the error." }),
    ...errorBodyFields,
  },
  $I.annoteError<ApiError>("ApiError", { description: "The platform answered a request with an error." })
) {
  /**
   * Pairs the decoded error body of a response with the response's status.
   *
   * @param status - HTTP status of the response.
   * @param body - The decoded error body.
   */
  static fromBody(status: HttpStatus, body: ApiErrorBody): ApiError {
    return ApiError.make({ ...body, status });
  }

  override get message(): string {
    return `${this.errorName} (${this.errorCode}, HTTP ${this.status}, instance ${this.errorInstanceId})`;
  }
}

/**
 * A request produced no answer from the platform: the connection failed, timed out or was cut.
 *
 * **Details**
 *
 * `cause` is whatever the underlying transport raised. It is kept for
 * diagnosis and is not part of the error's meaning: two transport errors with
 * the same message describe the same failure to a caller.
 *
 * **Example** (Report a connection that was refused)
 *
 * ```ts import.meta.vitest name="Report a connection that was refused"
 * import { TransportError } from "@beep/scratchpad/osdk/src/Client/index"
 *
 * const error = TransportError.make({ message: "Connection refused", cause: "ECONNREFUSED" })
 * const facts = [error._tag, error.message]
 * facts // => ["TransportError", "Connection refused"]
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TransportError extends S.TaggedError<TransportError, { readonly brand: unique symbol }>(
  $I`TransportError`
)(
  "TransportError",
  {
    message: S.String.annotateKey({ description: "What was being attempted when the transport failed." }),
    cause: S.Defect({ includeStack: true }).annotateKey({ description: "What the underlying transport raised." }),
  },
  $I.annoteError<TransportError>("TransportError", {
    description: "A request produced no answer from the platform.",
  })
) {}

/**
 * A value did not match its schema where the client meets the platform.
 *
 * **Details**
 *
 * Most often an answer of the platform could not be read: a body that is not
 * the documented record, or a row whose properties do not fit the model it was
 * read with. The same error reports a request the client refused to send
 * because it breaks a rule of its own schema. When the value is one object of
 * a page, `index` is its position in the page and `locator` says which object
 * it is, so one bad row can be found without replaying the read.
 *
 * **Example** (Say which object of a page could not be read)
 *
 * ```ts import.meta.vitest name="Say which object of a page could not be read"
 * import * as O from "effect/Option"
 * import { DecodeError } from "@beep/scratchpad/osdk/src/Client/index"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 * import { ObjectLocator } from "@beep/scratchpad/osdk/src/Object/index"
 *
 * const error = DecodeError.make({
 *   message: "Expected a number at employeeId",
 *   cause: "employeeId",
 *   index: O.some(3),
 *   locator: O.some(ObjectLocator.make({ objectType: ObjectTypeApiName.make("Employee"), primaryKey: 50033 })),
 * })
 * const facts = [error._tag, error.index, O.map(error.locator, (locator) => locator.primaryKey)]
 * facts // => ["DecodeError", O.some(3), O.some(50033)]
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DecodeError extends S.TaggedError<DecodeError, { readonly brand: unique symbol }>($I`DecodeError`)(
  "DecodeError",
  {
    message: S.String.annotateKey({ description: "What did not match, as the schema reports it." }),
    cause: S.Defect({ includeStack: true }).annotateKey({
      description: "The schema failure, or the value that could not be read.",
    }),
    index: S.OptionFromOptionalKey(S.Int.check(S.isGreaterThanOrEqualTo(0))).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Position of the object within its page, when the value is one object of a page." })
    ),
    locator: S.OptionFromOptionalKey(ObjectLocator).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Which object could not be read, when the platform identified it." })
    ),
  },
  $I.annoteError<DecodeError>("DecodeError", {
    description: "A value did not match its schema where the client meets the platform.",
  })
) {}

// -----------------------------------------------------------------------------
// Failures of a read that promises exactly one object
// -----------------------------------------------------------------------------

// The words a single-object read uses for what it looked for: the object type when the read was typed by one.
const sought = O.match({
  onNone: () => "object",
  onSome: (objectType: ObjectTypeApiName) => `${objectType} object`,
});

/**
 * A read that promises exactly one object found none.
 *
 * **Details**
 *
 * `objectType` is the object type of the model the read was typed by. A read
 * of an untyped set has no model, so it names none.
 *
 * **Example** (Report a missing object)
 *
 * ```ts import.meta.vitest name="Report a missing object"
 * import * as O from "effect/Option"
 * import { ObjectNotFound } from "@beep/scratchpad/osdk/src/Client/index"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const typed = ObjectNotFound.make({ objectType: O.some(ObjectTypeApiName.make("Employee")) })
 * const untyped = ObjectNotFound.make({})
 * const facts = [typed._tag, typed.message, untyped.message]
 * const expected = [
 *   "ObjectNotFound",
 *   "Expected exactly one Employee object but the object set holds none",
 *   "Expected exactly one object but the object set holds none",
 * ]
 * facts // => expected
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ObjectNotFound extends S.TaggedError<ObjectNotFound, { readonly brand: unique symbol }>(
  $I`ObjectNotFound`
)(
  "ObjectNotFound",
  {
    objectType: S.OptionFromOptionalKey(ObjectTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Object type the read was typed by; none for a read of an untyped set." })
    ),
  },
  $I.annoteError<ObjectNotFound>("ObjectNotFound", {
    description: "A read that promises exactly one object found none.",
  })
) {
  override get message(): string {
    return `Expected exactly one ${sought(this.objectType)} but the object set holds none`;
  }
}

/**
 * A read that promises exactly one object found more than one.
 *
 * **Details**
 *
 * OSDK reports this case and the empty case with one message
 * (`Expected a single result but got <n> instead`). They are separate errors
 * here because a caller usually recovers from a missing object and never from
 * an ambiguous one. As in `ObjectNotFound`, `objectType` is none for a read of
 * an untyped set.
 *
 * **Example** (Report an ambiguous read)
 *
 * ```ts import.meta.vitest name="Report an ambiguous read"
 * import * as O from "effect/Option"
 * import { MultipleObjectsFound } from "@beep/scratchpad/osdk/src/Client/index"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const error = MultipleObjectsFound.make({ objectType: O.some(ObjectTypeApiName.make("Employee")) })
 * const facts = [error._tag, error.message]
 * facts // => ["MultipleObjectsFound", "Expected exactly one Employee object but the object set holds several"]
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MultipleObjectsFound extends S.TaggedError<MultipleObjectsFound, { readonly brand: unique symbol }>(
  $I`MultipleObjectsFound`
)(
  "MultipleObjectsFound",
  {
    objectType: S.OptionFromOptionalKey(ObjectTypeApiName).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Object type the read was typed by; none for a read of an untyped set." })
    ),
  },
  $I.annoteError<MultipleObjectsFound>("MultipleObjectsFound", {
    description: "A read that promises exactly one object found more than one.",
  })
) {
  override get message(): string {
    return `Expected exactly one ${sought(this.objectType)} but the object set holds several`;
  }
}

// -----------------------------------------------------------------------------
// Failure of a typed application of an action
// -----------------------------------------------------------------------------

/**
 * The platform answered a request to apply an action by reporting the action invalid, so nothing was executed.
 *
 * **Details**
 *
 * The platform reports this case with a successful answer whose validation
 * verdict is `invalid`. A typed application promises that the action ran, so
 * here it is a failure that carries the full validation report: which
 * parameters and which submission criteria did not hold. OSDK throws
 * `ActionValidationError` in the same place.
 *
 * **Example** (Report an action that was not applied)
 *
 * ```ts import.meta.vitest name="Report an action that was not applied"
 * import { ActionValidation } from "@beep/scratchpad/osdk/src/Action/index"
 * import { ActionRejected } from "@beep/scratchpad/osdk/src/Client/index"
 * import { ActionTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const error = ActionRejected.make({
 *   action: ActionTypeApiName.make("promoteEmployee"),
 *   validation: ActionValidation.make({ result: "invalid", submissionCriteria: [], parameters: {} }),
 * })
 * const facts = [error._tag, error.message]
 * facts // => ["ActionRejected", "The platform did not apply promoteEmployee: it reports the action invalid"]
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ActionRejected extends S.TaggedError<ActionRejected, { readonly brand: unique symbol }>(
  $I`ActionRejected`
)(
  "ActionRejected",
  {
    action: ActionTypeApiName.annotateKey({ description: "The action that was not applied." }),
    // The validation report the platform answered with.
    // (Bare: annotating the key of a class would type the field as its un-branded record.)
    validation: ActionValidation,
  },
  $I.annoteError<ActionRejected>("ActionRejected", {
    description: "The platform answered a request to apply an action by reporting the action invalid.",
  })
) {
  override get message(): string {
    return `The platform did not apply ${this.action}: it reports the action invalid`;
  }
}

// -----------------------------------------------------------------------------
// Unions
// -----------------------------------------------------------------------------

/**
 * Every way a call through the transport can fail: an error answer, no answer, or an unreadable value.
 *
 * **Details**
 *
 * This is the error channel of every member of `OntologyTransport`. It is
 * narrower than {@link ClientError} on purpose: a transport moves requests and
 * answers, and has no opinion on how many objects a read should find or on
 * whether an answered action counts as applied.
 *
 * **Example** (Decide whether a transport failure is worth retrying)
 *
 * ```ts import.meta.vitest name="Decide whether a transport failure is worth retrying"
 * import { TransportError, TransportFailure } from "@beep/scratchpad/osdk/src/Client/index"
 *
 * const retryable = TransportFailure.match({
 *   ApiError: ({ status }) => status >= 500,
 *   TransportError: () => true,
 *   DecodeError: () => false,
 * })
 * retryable(TransportError.make({ message: "Connection reset", cause: "ECONNRESET" })) // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const TransportFailure = S.Union([ApiError, TransportError, DecodeError]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("TransportFailure", {
    description: "Every way a call through the transport can fail: an error answer, no answer, or an unreadable value.",
  })
);

/**
 * Runtime type of {@link TransportFailure}.
 *
 * @category errors
 * @since 0.0.0
 */
export type TransportFailure = typeof TransportFailure.Type;

/**
 * Every way a call of the client can fail.
 *
 * **Example** (Name each failure)
 *
 * ```ts import.meta.vitest name="Name each failure"
 * import * as O from "effect/Option"
 * import { ClientError, ObjectNotFound } from "@beep/scratchpad/osdk/src/Client/index"
 * import { ObjectTypeApiName } from "@beep/scratchpad/osdk/src/Identifier/index"
 *
 * const named = O.getOrElse(() => "object")
 * const describe = ClientError.match({
 *   ApiError: ({ errorName }) => `the platform refused: ${errorName}`,
 *   TransportError: () => "the platform did not answer",
 *   DecodeError: () => "a value could not be read",
 *   ObjectNotFound: ({ objectType }) => `no ${named(objectType)}`,
 *   MultipleObjectsFound: ({ objectType }) => `several ${named(objectType)}`,
 *   ActionRejected: ({ action }) => `${action} was not applied`,
 * })
 * describe(ObjectNotFound.make({ objectType: O.some(ObjectTypeApiName.make("Employee")) })) // => "no Employee"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ClientError = S.Union([
  ApiError,
  TransportError,
  DecodeError,
  ObjectNotFound,
  MultipleObjectsFound,
  ActionRejected,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ClientError", { description: "Every way a call of the client can fail." })
);

/**
 * Runtime type of {@link ClientError}.
 *
 * @category errors
 * @since 0.0.0
 */
export type ClientError = typeof ClientError.Type;
