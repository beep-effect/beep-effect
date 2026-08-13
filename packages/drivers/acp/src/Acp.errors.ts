/**
 * Typed technical errors for the ACP driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as AcpSchema from "./_generated/schema.gen.ts";

const $I = $AcpId.create("errors");

/**
 * Failure raised when an ACP child process cannot be spawned.
 *
 * **Example** (Make spawn error)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AcpSpawnError } from "@beep/acp/errors"
 *
 * const error = AcpSpawnError.make({ command: O.some("acp-agent") })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AcpSpawnError extends S.TaggedError<AcpSpawnError>($I`AcpSpawnError`)(
  "AcpSpawnError",
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true }))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Original spawn failure cause, when one was available.",
      }),
    command: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "ACP command that failed to spawn, when available.",
    }),
  },
  $I.annote("AcpSpawnError", {
    description: "Failure raised when an ACP child process cannot be spawned.",
  })
) {
  override get message() {
    return O.match(this.command, {
      onNone: () => "Failed to spawn ACP process",
      onSome: (command) => `Failed to spawn ACP process for command: ${command}`,
    });
  }
}

/**
 * Failure raised when an ACP process exits before the protocol completes.
 *
 * **Example** (Make process exited error)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AcpProcessExitedError } from "@beep/acp/errors"
 *
 * const error = AcpProcessExitedError.make({ code: O.some(1) })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AcpProcessExitedError extends S.TaggedError<AcpProcessExitedError>($I`AcpProcessExitedError`)(
  "AcpProcessExitedError",
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true }))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Original process-exit cause, when one was available.",
      }),
    code: S.OptionFromOptionalKey(S.Int.check(S.isGreaterThanOrEqualTo(0)))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Non-negative ACP process exit code, when the process returned one.",
      }),
  },
  $I.annote("AcpProcessExitedError", {
    description: "Failure raised when an ACP process exits before the protocol completes.",
  })
) {
  override get message() {
    return O.match(this.code, {
      onNone: () => "ACP process exited",
      onSome: (code) => `ACP process exited with code ${code}`,
    });
  }
}

/**
 * Failure raised when ACP wire data cannot be encoded or decoded.
 *
 * **Example** (Make protocol parse error)
 *
 * ```ts
 * import { AcpProtocolParseError } from "@beep/acp/errors"
 *
 * const error = AcpProtocolParseError.make({ detail: "bad json" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AcpProtocolParseError extends S.TaggedError<AcpProtocolParseError>($I`AcpProtocolParseError`)(
  "AcpProtocolParseError",
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true }))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Original parse failure cause, when one was available.",
      }),
    detail: S.String.annotateKey({
      description: "Human-readable parse failure detail.",
    }),
  },
  $I.annote("AcpProtocolParseError", {
    description: "Failure raised when ACP wire data cannot be encoded or decoded.",
  })
) {
  override get message() {
    return `Failed to parse ACP protocol message: ${this.detail}`;
  }

  static readonly new: {
    (cause: unknown, detail: string): AcpProtocolParseError;
    (detail: string): (cause: unknown) => AcpProtocolParseError;
  } = dual(
    2,
    (cause: unknown, detail: string): AcpProtocolParseError =>
      AcpProtocolParseError.make({
        cause: O.some(cause),
        detail,
      })
  );
}

/**
 * Failure raised by the ACP transport boundary.
 *
 * **Example** (Make transport error)
 *
 * ```ts
 * import { AcpTransportError } from "@beep/acp/errors"
 *
 * const error = AcpTransportError.make({ detail: "stream closed" })
 * console.log(error.detail)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AcpTransportError extends S.TaggedError<AcpTransportError>($I`AcpTransportError`)(
  "AcpTransportError",
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true }))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Original transport failure cause, when one was available.",
      }),
    detail: S.String.annotateKey({
      description: "Human-readable transport failure detail.",
    }),
  },
  $I.annote("AcpTransportError", {
    description: "Failure raised by the ACP transport boundary.",
  })
) {}

/**
 * JSON-RPC request failure returned by an ACP peer.
 *
 * **Example** (Method not found error)
 *
 * ```ts
 * import { AcpRequestError } from "@beep/acp/errors"
 *
 * const error = AcpRequestError.methodNotFound("x/missing")
 * console.log(error.code)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AcpRequestError extends S.TaggedError<AcpRequestError>($I`AcpRequestError`)(
  "AcpRequestError",
  {
    code: AcpSchema.ErrorCode.annotateKey({
      description: "JSON-RPC error code returned by the ACP peer.",
    }),
    data: S.OptionFromOptionalKey(S.Json).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional JSON-RPC error data returned by the ACP peer; wire JSON only.",
    }),
    errorMessage: S.String.annotateKey({
      description: "JSON-RPC error message returned by the ACP peer.",
    }),
  },
  $I.annote("AcpRequestError", {
    description: "JSON-RPC request failure returned by an ACP peer.",
  })
) {
  static readonly is = S.is(AcpRequestError);

  override get message() {
    return this.errorMessage;
  }

  /**
   * Convert an ACP protocol error payload into a typed driver error.
   *
   * **Example** (From protocol error payload)
   *
   * ```ts
   * import { AcpRequestError } from "@beep/acp/errors"
   *
   * const error = AcpRequestError.fromProtocolError({
   *   code: -32601,
   *   message: "Method not found"
   * })
   * console.log(error.message)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static fromProtocolError(error: AcpSchema.Error) {
    return AcpRequestError.make({
      code: error.code,
      data: O.fromUndefinedOr(error.data),
      errorMessage: error.message,
    });
  }

  /**
   * Create a JSON-RPC parse error.
   *
   * **Example** (Create parse error)
   *
   * ```ts
   * import { AcpRequestError } from "@beep/acp/errors"
   *
   * const error = AcpRequestError.parseError()
   * console.log(error.code)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static parseError(message = "Parse error", data?: S.Json) {
    return AcpRequestError.make({
      code: -32700,
      errorMessage: message,
      data: O.fromUndefinedOr(data),
    });
  }

  /**
   * Create a JSON-RPC invalid request error.
   *
   * **Example** (Create invalid request error)
   *
   * ```ts
   * import { AcpRequestError } from "@beep/acp/errors"
   *
   * const error = AcpRequestError.invalidRequest()
   * console.log(error.code)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static invalidRequest(message = "Invalid request", data?: S.Json) {
    return AcpRequestError.make({
      code: -32600,
      errorMessage: message,
      data: O.fromUndefinedOr(data),
    });
  }

  /**
   * Create a JSON-RPC method-not-found error.
   *
   * **Example** (Create method not found)
   *
   * ```ts
   * import { AcpRequestError } from "@beep/acp/errors"
   *
   * const error = AcpRequestError.methodNotFound("x/test")
   * console.log(error.message)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static methodNotFound(method: string) {
    return AcpRequestError.make({
      code: -32601,
      errorMessage: `Method not found: ${method}`,
    });
  }

  /**
   * Create a JSON-RPC invalid params error.
   *
   * **Example** (Create invalid params error)
   *
   * ```ts
   * import { AcpRequestError } from "@beep/acp/errors"
   *
   * const error = AcpRequestError.invalidParams("Invalid payload")
   * console.log(error.code)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static invalidParams(message = "Invalid params", data?: S.Json) {
    return AcpRequestError.make({
      code: -32602,
      errorMessage: message,
      data: O.fromUndefinedOr(data),
    });
  }

  /**
   * Create a JSON-RPC internal error.
   *
   * **Example** (Create internal error)
   *
   * ```ts
   * import { AcpRequestError } from "@beep/acp/errors"
   *
   * const error = AcpRequestError.internalError()
   * console.log(error.code)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static internalError(message = "Internal error", data?: S.Json) {
    return AcpRequestError.make({
      code: -32603,
      errorMessage: message,
      data: O.fromUndefinedOr(data),
    });
  }

  /**
   * Create an ACP authentication-required request error.
   *
   * **Example** (Create auth required error)
   *
   * ```ts
   * import { AcpRequestError } from "@beep/acp/errors"
   *
   * const error = AcpRequestError.authRequired()
   * console.log(error.code)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static authRequired(message = "Authentication required", data?: S.Json) {
    return AcpRequestError.make({
      code: -32000,
      errorMessage: message,
      data: O.fromUndefinedOr(data),
    });
  }

  /**
   * Create an ACP resource-not-found request error.
   *
   * **Example** (Create resource not found)
   *
   * ```ts
   * import { AcpRequestError } from "@beep/acp/errors"
   *
   * const error = AcpRequestError.resourceNotFound()
   * console.log(error.code)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static resourceNotFound(message = "Resource not found", data?: S.Json) {
    return AcpRequestError.make({
      code: -32002,
      errorMessage: message,
      data: O.fromUndefinedOr(data),
    });
  }

  /**
   * Convert this driver error to the ACP protocol error payload.
   *
   * **Example** (Convert to protocol payload)
   *
   * ```ts
   * import { AcpRequestError } from "@beep/acp/errors"
   *
   * const payload = AcpRequestError.methodNotFound("x/test").toProtocolError()
   * console.log(payload.message)
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  toProtocolError() {
    return AcpSchema.Error.make({
      code: this.code,
      message: this.errorMessage,
      ...O.getSomesStruct({
        data: this.data,
      }),
    });
  }
}

/**
 * Union of typed technical failures emitted by the ACP driver.
 *
 * **Example** (Check AcpError membership)
 *
 * ```ts
 * import { AcpError, AcpRequestError } from "@beep/acp/errors"
 *
 * console.log(AcpError.is(AcpRequestError.methodNotFound("x/test")))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AcpError = S.Union([
  AcpRequestError,
  AcpSpawnError,
  AcpProcessExitedError,
  AcpProtocolParseError,
  AcpTransportError,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AcpError", {
    description: "Union of typed technical failures emitted by the ACP driver.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link AcpError}.
 *
 * **Example** (Inspect AcpError tag)
 *
 * ```ts
 * import type { AcpError } from "@beep/acp/errors"
 *
 * const inspect = (error: AcpError) => error._tag
 * console.log(inspect)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type AcpError = typeof AcpError.Type;
