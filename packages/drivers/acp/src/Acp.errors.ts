/**
 * Typed technical errors for the ACP driver boundary.
 *
 * **Details**
 *
 * A failure `cause` and schema payload values never become part of `message`:
 * schema decode failures are summarized by path and issue kind, without values.
 * Some messages do carry text that the ACP peer controls, so treat `message` as
 * untrusted before logging or displaying it:
 *
 * - `AcpProcessExitedError` appends the trimmed `stderr` excerpt of the peer
 *   process.
 * - `AcpRequestError.fromProtocolError` keeps the peer's JSON-RPC error message
 *   verbatim as `errorMessage`, which is the error's `message`.
 * - Method names that the peer sends appear in `AcpRequestError` messages
 *   (such as `methodNotFound`) and in `AcpProtocolParseError` messages. A
 *   schema issue summary can also name identifier-like object keys taken from
 *   the payload.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import { constant, dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import * as AcpSchema from "./_generated/schema.gen.ts";
import type * as SchemaIssue from "effect/SchemaIssue";

const $I = $AcpId.create("errors");

const MAX_SUMMARY_ISSUES = 3;
const MAX_SUMMARY_PATH_SEGMENTS = 8;
const SUMMARY_IDENTIFIER_SEGMENT = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const TRAILING_PERIOD = /\.$/;

/**
 * **Example** (Check request ids)
 *
 * ```ts
 * import { AcpRequestId } from "@beep/acp/errors"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AcpRequestId)(7), S.is(AcpRequestId)("req-1"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AcpRequestId = S.Union([S.String, S.Finite]).pipe(
  $I.annoteSchema("AcpRequestId", {
    description: "JSON-RPC request id as it appears on the ACP wire: a string or a finite number.",
  })
);

/**
 * **Example** (Type a request id)
 *
 * ```ts
 * import type { AcpRequestId } from "@beep/acp/errors"
 *
 * const id: AcpRequestId = 1
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AcpRequestId = typeof AcpRequestId.Type;

const AcpRequestOperationBase = LiteralKit([
  "decode-extension-request-payload",
  "encode-extension-response",
  "handle-request",
  "handle-extension-request",
  "receive-response",
  "receive-streaming-response",
]);

/**
 * **Example** (Check a request operation)
 *
 * ```ts
 * import { AcpRequestOperation } from "@beep/acp/errors"
 *
 * console.log(AcpRequestOperation.is["receive-response"]("receive-response"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AcpRequestOperation = AcpRequestOperationBase.pipe(
  $I.annoteSchema("AcpRequestOperation", {
    description: "Request-processing step at which an ACP request error was produced.",
  }),
  SchemaUtils.withLiteralKitStatics(AcpRequestOperationBase)
);

/**
 * **Example** (Type a request operation)
 *
 * ```ts
 * import type { AcpRequestOperation } from "@beep/acp/errors"
 *
 * const operation: AcpRequestOperation = "handle-request"
 * console.log(operation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AcpRequestOperation = typeof AcpRequestOperation.Type;

const AcpProtocolParseOperationBase = LiteralKit([
  "encode-message",
  "decode-wire-message",
  "decode-notification-payload",
]);

/**
 * **Example** (Check a parse operation)
 *
 * ```ts
 * import { AcpProtocolParseOperation } from "@beep/acp/errors"
 *
 * console.log(AcpProtocolParseOperation.is["decode-wire-message"]("decode-wire-message"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AcpProtocolParseOperation = AcpProtocolParseOperationBase.pipe(
  $I.annoteSchema("AcpProtocolParseOperation", {
    description: "Wire step at which an ACP protocol parse error was produced.",
  }),
  SchemaUtils.withLiteralKitStatics(AcpProtocolParseOperationBase)
);

/**
 * **Example** (Type a parse operation)
 *
 * ```ts
 * import type { AcpProtocolParseOperation } from "@beep/acp/errors"
 *
 * const operation: AcpProtocolParseOperation = "encode-message"
 * console.log(operation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AcpProtocolParseOperation = typeof AcpProtocolParseOperation.Type;

const AcpTransportOperationBase = LiteralKit(["call-rpc", "read-input-stream", "read-process-exit-status"]);

/**
 * **Example** (Check a transport operation)
 *
 * ```ts
 * import { AcpTransportOperation } from "@beep/acp/errors"
 *
 * console.log(AcpTransportOperation.is["call-rpc"]("call-rpc"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AcpTransportOperation = AcpTransportOperationBase.pipe(
  $I.annoteSchema("AcpTransportOperation", {
    description: "Transport step at which an ACP transport error was produced.",
  }),
  SchemaUtils.withLiteralKitStatics(AcpTransportOperationBase)
);

/**
 * **Example** (Type a transport operation)
 *
 * ```ts
 * import type { AcpTransportOperation } from "@beep/acp/errors"
 *
 * const operation: AcpTransportOperation = "read-input-stream"
 * console.log(operation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AcpTransportOperation = typeof AcpTransportOperation.Type;

const AcpSchemaIssueKindBase = LiteralKit([
  "Filter",
  "Encoding",
  "Pointer",
  "Composite",
  "AnyOf",
  "InvalidType",
  "InvalidValue",
  "MissingKey",
  "UnexpectedKey",
  "Forbidden",
  "OneOf",
]);

/**
 * **Example** (Check an issue kind)
 *
 * ```ts
 * import { AcpSchemaIssueKind } from "@beep/acp/errors"
 *
 * console.log(AcpSchemaIssueKind.is.MissingKey("MissingKey"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AcpSchemaIssueKind = AcpSchemaIssueKindBase.pipe(
  $I.annoteSchema("AcpSchemaIssueKind", {
    description: "Kind of an Effect schema issue node, recorded in value-free ACP error diagnostics.",
  }),
  SchemaUtils.withLiteralKitStatics(AcpSchemaIssueKindBase)
);

/**
 * **Example** (Type an issue kind)
 *
 * ```ts
 * import type { AcpSchemaIssueKind } from "@beep/acp/errors"
 *
 * const kind: AcpSchemaIssueKind = "Pointer"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AcpSchemaIssueKind = typeof AcpSchemaIssueKind.Type;

const NonNegativeInt = S.Int.check(S.isGreaterThanOrEqualTo(0));

/**
 * **Details**
 *
 * Diagnostics stay in-process: {@link AcpRequestError.toProtocolError} never
 * puts them on the wire.
 *
 * **Example** (Make request diagnostics)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AcpRequestDiagnostics, AcpRequestError } from "@beep/acp/errors"
 *
 * const diagnostics = AcpRequestDiagnostics.make({
 *   method: O.some("x/test"),
 *   operation: O.some("handle-request")
 * })
 * console.log(AcpRequestError.internalError("Internal error", undefined, diagnostics).method)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AcpRequestDiagnostics extends S.Opaque<AcpRequestDiagnostics, { readonly brand: unique symbol }>()(
  S.Struct({
    cause: S.OptionFromOptionalKey(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
    )
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Original failure cause, kept in-process and never sent to the peer.",
      }),
    issueCount: S.OptionFromOptionalKey(NonNegativeInt).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Number of schema issue nodes behind the failure, when it came from a schema.",
    }),
    issueKinds: S.OptionFromOptionalKey(AcpSchemaIssueKind.pipe(S.Array))
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Distinct schema issue kinds behind the failure, in first-seen order.",
      }),
    maximumPathDepth: S.OptionFromOptionalKey(NonNegativeInt)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Deepest schema issue path behind the failure, when it came from a schema.",
      }),
    method: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "ACP method the failed request was for, when known.",
    }),
    operation: S.OptionFromOptionalKey(AcpRequestOperation)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Request-processing step that produced the failure, when known.",
      }),
    requestId: S.OptionFromOptionalKey(AcpRequestId).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "JSON-RPC id of the failed request, when known.",
    }),
  }).pipe(
    $I.annoteSchema("AcpRequestDiagnostics", {
      description: "Optional request-correlation diagnostics attached to an ACP request error.",
    })
  )
) {}

const summaryPathSegment = (segment: PropertyKey): string =>
  P.isNumber(segment) || (P.isString(segment) && SUMMARY_IDENTIFIER_SEGMENT.test(segment)) ? `${segment}` : "*";

const summaryPath = (path: ReadonlyArray<PropertyKey>): string =>
  A.match(path, {
    onEmpty: () => "payload",
    onNonEmpty: (segments) => {
      const shown = pipe(segments, A.take(MAX_SUMMARY_PATH_SEGMENTS), A.map(summaryPathSegment), A.join("."));
      return A.length(segments) > MAX_SUMMARY_PATH_SEGMENTS ? `${shown}…` : shown;
    },
  });

const summaryReason: (issue: SchemaIssue.Issue) => string = Match.type<SchemaIssue.Issue>().pipe(
  Match.tag("MissingKey", () => "missing"),
  Match.tag("UnexpectedKey", () => "unexpected"),
  Match.tag("InvalidType", () => "wrong type"),
  Match.orElse(() => "invalid")
);

// ACP unions end in a member titled "other" that admits custom and future variants. It fails only
// because the discriminator names a known variant, so the known variant's issues are reported.
const isCatchAllMember = (issue: SchemaIssue.Issue): boolean =>
  P.hasProperty(issue, "ast") && SchemaAST.isAST(issue.ast) && SchemaAST.resolveTitle(issue.ast) === "other";

const summaryLeaf = (issue: SchemaIssue.Issue, path: ReadonlyArray<PropertyKey>): ReadonlyArray<string> => [
  `${summaryPath(path)} ${summaryReason(issue)}`,
];

const summaryEntries = (issue: SchemaIssue.Issue, path: ReadonlyArray<PropertyKey>): ReadonlyArray<string> =>
  Match.value(issue).pipe(
    Match.tag("Filter", "Encoding", (nested) => summaryEntries(nested.issue, path)),
    Match.tag("Pointer", (pointer) => summaryEntries(pointer.issue, A.appendAll(path, pointer.path))),
    Match.tag("Composite", "AnyOf", (group) => {
      const known = A.filter(group.issues, P.not(isCatchAllMember));
      const children = A.isReadonlyArrayNonEmpty(known) ? known : group.issues;
      return A.match(children, {
        onEmpty: () => summaryLeaf(group, path),
        onNonEmpty: A.flatMap((child) => summaryEntries(child, path)),
      });
    }),
    Match.orElse((leaf) => summaryLeaf(leaf, path))
  );

const schemaIssueSummary = (root: SchemaIssue.Issue): string => {
  const entries = A.dedupe(summaryEntries(root, A.empty()));
  const shown = A.join(A.take(entries, MAX_SUMMARY_ISSUES), ", ");
  const hidden = A.length(entries) - MAX_SUMMARY_ISSUES;
  return hidden > 0 ? `${shown} (+${hidden} more)` : shown;
};

const NO_ISSUE_NODES: ReadonlyArray<readonly [AcpSchemaIssueKind, number]> = A.empty();

const issueNodeDepths = (
  issue: SchemaIssue.Issue,
  depth: number
): ReadonlyArray<readonly [AcpSchemaIssueKind, number]> =>
  A.prepend(
    Match.value(issue).pipe(
      Match.tag("Filter", "Encoding", (nested) => issueNodeDepths(nested.issue, depth)),
      Match.tag("Pointer", (pointer) => issueNodeDepths(pointer.issue, depth + A.length(pointer.path))),
      Match.tag("Composite", "AnyOf", (group) => A.flatMap(group.issues, (child) => issueNodeDepths(child, depth))),
      Match.orElse(constant(NO_ISSUE_NODES))
    ),
    Tuple.make(issue._tag, depth)
  );

const schemaIssueDiagnostics = (root: SchemaIssue.Issue) => {
  const nodes = issueNodeDepths(root, 0);
  return {
    issueCount: A.length(nodes),
    issueKinds: A.dedupe(A.map(nodes, ([kind]) => kind)),
    maximumPathDepth: A.reduce(nodes, 0, (deepest, [, depth]) => Num.max(deepest, depth)),
  };
};

const nonEmptyText = (value: O.Option<string>): O.Option<string> => O.filter(value, Str.isNonEmpty);

/**
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
export class AcpSpawnError extends S.TaggedError<AcpSpawnError, { readonly brand: unique symbol }>($I`AcpSpawnError`)(
  "AcpSpawnError",
  {
    cause: S.OptionFromOptionalKey(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
    )
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Original spawn failure cause, when one was available.",
      }),
    command: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "ACP command that failed to spawn, when available.",
    }),
  },
  $I.annoteError<AcpSpawnError>("AcpSpawnError", {
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
 * **Details**
 *
 * The message names the exit signal or code and appends the trimmed `stderr`
 * excerpt when one was captured.
 *
 * **Example** (Make process exited error)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AcpProcessExitedError } from "@beep/acp/errors"
 *
 * const error = AcpProcessExitedError.make({ code: O.some(1), pid: O.some(4242) })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AcpProcessExitedError extends S.TaggedError<AcpProcessExitedError, { readonly brand: unique symbol }>(
  $I`AcpProcessExitedError`
)(
  "AcpProcessExitedError",
  {
    cause: S.OptionFromOptionalKey(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
    )
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Original process-exit cause, when one was available.",
      }),
    code: S.OptionFromOptionalKey(NonNegativeInt).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Non-negative ACP process exit code, when the process returned one.",
    }),
    pid: S.OptionFromOptionalKey(S.Int).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Operating-system process id of the exited ACP process, when known.",
    }),
    signal: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Signal that terminated the ACP process (for example SIGTERM), when it was killed.",
    }),
    stderr: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Captured standard-error excerpt of the exited ACP process, when available.",
    }),
  },
  $I.annoteError<AcpProcessExitedError>("AcpProcessExitedError", {
    description: "Failure raised when an ACP process exits before the protocol completes.",
  })
) {
  override get message() {
    const base = pipe(
      O.map(this.signal, (signal) => `ACP process exited after signal ${signal}`),
      O.orElse(() => O.map(this.code, (code) => `ACP process exited with code ${code}`)),
      O.getOrElse(() => "ACP process exited")
    );
    return O.match(nonEmptyText(O.map(this.stderr, Str.trim)), {
      onNone: () => base,
      onSome: (excerpt) => `${base}\n${excerpt}`,
    });
  }
}

/**
 * **Details**
 *
 * Schema failures carry value-free diagnostics: issue count, issue kinds,
 * maximum path depth and an `issueSummary` that names paths and reasons only.
 * The exact schema error stays in `cause`.
 *
 * **Example** (Make protocol parse error)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AcpProtocolParseError } from "@beep/acp/errors"
 *
 * const error = AcpProtocolParseError.make({
 *   operation: "decode-wire-message",
 *   method: O.some("session/update")
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AcpProtocolParseError extends S.TaggedError<AcpProtocolParseError, { readonly brand: unique symbol }>(
  $I`AcpProtocolParseError`
)(
  "AcpProtocolParseError",
  {
    cause: S.OptionFromOptionalKey(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
    )
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Original parse failure cause, when one was available.",
      }),
    issueCount: S.OptionFromOptionalKey(NonNegativeInt).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Number of schema issue nodes behind the failure, when it came from a schema.",
    }),
    issueKinds: S.OptionFromOptionalKey(AcpSchemaIssueKind.pipe(S.Array))
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Distinct schema issue kinds behind the failure, in first-seen order.",
      }),
    issueSummary: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Value-free summary of the first schema issues as `path reason` entries.",
    }),
    maximumPathDepth: S.OptionFromOptionalKey(NonNegativeInt)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Deepest schema issue path behind the failure, when it came from a schema.",
      }),
    method: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "ACP method whose message failed to encode or decode, when known.",
    }),
    operation: AcpProtocolParseOperation.annotateKey({
      description: "Wire step that failed.",
    }),
    requestId: S.OptionFromOptionalKey(AcpRequestId).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "JSON-RPC id of the message that failed, when known.",
    }),
  },
  $I.annoteError<AcpProtocolParseError>("AcpProtocolParseError", {
    description: "Failure raised when ACP wire data cannot be encoded or decoded.",
  })
) {
  override get message() {
    const method = O.match(this.method, {
      onNone: () => "",
      onSome: (name) => ` for method '${name}'`,
    });
    const summary = O.match(this.issueSummary, {
      onNone: () => "",
      onSome: (text) => `: ${text}`,
    });
    return `ACP protocol operation '${this.operation}' failed${method}${summary}.`;
  }

  /**
   * Build a parse error from a schema failure, keeping only value-free diagnostics
   * next to the exact schema error in `cause`.
   *
   * **Example** (From a schema failure)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import * as S from "effect/Schema"
   * import { AcpProtocolParseError } from "@beep/acp/errors"
   *
   * const program = S.decodeUnknownEffect(S.Struct({ used: S.Number }))({}).pipe(
   *   Effect.mapError((cause) =>
   *     AcpProtocolParseError.fromSchemaError("decode-notification-payload", "session/update", cause)
   *   )
   * )
   * console.log(program)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static fromSchemaError(
    operation: AcpProtocolParseOperation,
    method: string,
    cause: S.SchemaError
  ): AcpProtocolParseError {
    const diagnostics = schemaIssueDiagnostics(cause.issue);
    return AcpProtocolParseError.make({
      cause: O.some(cause),
      issueCount: O.some(diagnostics.issueCount),
      issueKinds: O.some(diagnostics.issueKinds),
      issueSummary: O.some(schemaIssueSummary(cause.issue)),
      maximumPathDepth: O.some(diagnostics.maximumPathDepth),
      method: O.some(method),
      operation,
    });
  }

  /**
   * Build an `encode-message` parse error for an outgoing message.
   *
   * **Example** (From an encoding failure)
   *
   * ```ts
   * import { AcpProtocolParseError } from "@beep/acp/errors"
   *
   * const error = AcpProtocolParseError.fromEncodingError("session/prompt", 3, "not serializable")
   * console.log(error.message)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static fromEncodingError(
    method: string | undefined,
    requestId: AcpRequestId | undefined,
    cause: unknown
  ): AcpProtocolParseError {
    return AcpProtocolParseError.make({
      cause: O.some(cause),
      method: O.fromUndefinedOr(method),
      operation: "encode-message",
      requestId: O.fromUndefinedOr(requestId),
    });
  }
}

/**
 * **Details**
 *
 * The message names the operation, method and authored `detail`; it never
 * includes the `cause`.
 *
 * **Example** (Make transport error)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AcpTransportError } from "@beep/acp/errors"
 *
 * const error = AcpTransportError.make({
 *   operation: O.some("call-rpc"),
 *   method: O.some("session/new")
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AcpTransportError extends S.TaggedError<AcpTransportError, { readonly brand: unique symbol }>(
  $I`AcpTransportError`
)(
  "AcpTransportError",
  {
    cause: S.OptionFromOptionalKey(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
    )
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Original transport failure cause, when one was available.",
      }),
    detail: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Authored human-readable transport failure detail, when one was given.",
    }),
    method: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "ACP method the failed transport operation was for, when known.",
    }),
    operation: S.OptionFromOptionalKey(AcpTransportOperation)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Transport step that failed, when known.",
      }),
    pid: S.OptionFromOptionalKey(S.Int).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Operating-system process id of the ACP peer process, when known.",
    }),
  },
  $I.annoteError<AcpTransportError>("AcpTransportError", {
    description: "Failure raised by the ACP transport boundary.",
  })
) {
  override get message() {
    const operation = O.match(this.operation, {
      onNone: () => "",
      onSome: (step) => ` ${step}`,
    });
    const method = O.match(nonEmptyText(this.method), {
      onNone: () => "",
      onSome: (name) => ` for method ${name}`,
    });
    const detail = O.match(nonEmptyText(this.detail), {
      onNone: () => "",
      onSome: (text) => `: ${Str.replace(TRAILING_PERIOD, "")(text)}`,
    });
    return `ACP transport operation${operation} failed${method}${detail}.`;
  }
}

/**
 * **Example** (Make input stream ended error)
 *
 * ```ts
 * import { AcpInputStreamEndedError } from "@beep/acp/errors"
 *
 * console.log(AcpInputStreamEndedError.make({}).message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AcpInputStreamEndedError extends S.TaggedError<
  AcpInputStreamEndedError,
  { readonly brand: unique symbol }
>($I`AcpInputStreamEndedError`)(
  "AcpInputStreamEndedError",
  {},
  $I.annoteError<AcpInputStreamEndedError>("AcpInputStreamEndedError", {
    description: "Failure raised when the ACP peer's input stream ends without a more specific termination error.",
  })
) {
  override get message() {
    return "ACP input stream ended.";
  }
}

const handlerFailure =
  (handler: string, operation: AcpRequestOperation) =>
  (error: AcpError, method: string): AcpRequestError =>
    AcpRequestError.is(error)
      ? error
      : AcpRequestError.internalError(
          `ACP ${handler} failed for method '${method}'`,
          undefined,
          AcpRequestDiagnostics.make({
            cause: O.some(error),
            method: O.some(method),
            operation: O.some(operation),
          })
        );

/**
 * **Details**
 *
 * Only `code`, `errorMessage` and `data` reach the wire through
 * {@link AcpRequestError.toProtocolError}; the correlation diagnostics and the
 * `cause` stay in-process.
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
export class AcpRequestError extends S.TaggedError<AcpRequestError, { readonly brand: unique symbol }>(
  $I`AcpRequestError`
)(
  "AcpRequestError",
  {
    cause: S.OptionFromOptionalKey(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
    )
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Original failure cause, kept in-process and never sent to the peer.",
      }),
    code: AcpSchema.ErrorCode.annotateKey({
      description: "JSON-RPC error code returned by the ACP peer.",
    }),
    data: S.OptionFromOptionalKey(S.Json).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Optional JSON-RPC error data returned by the ACP peer; wire JSON only.",
    }),
    errorMessage: S.String.annotateKey({
      description: "JSON-RPC error message returned by the ACP peer.",
    }),
    issueCount: S.OptionFromOptionalKey(NonNegativeInt).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Number of schema issue nodes behind the failure, when it came from a schema.",
    }),
    issueKinds: S.OptionFromOptionalKey(AcpSchemaIssueKind.pipe(S.Array))
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Distinct schema issue kinds behind the failure, in first-seen order.",
      }),
    maximumPathDepth: S.OptionFromOptionalKey(NonNegativeInt)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Deepest schema issue path behind the failure, when it came from a schema.",
      }),
    method: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "ACP method the failed request was for, when known.",
    }),
    operation: S.OptionFromOptionalKey(AcpRequestOperation)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Request-processing step that produced the failure, when known.",
      }),
    requestId: S.OptionFromOptionalKey(AcpRequestId).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "JSON-RPC id of the failed request, when known.",
    }),
  },
  $I.annoteError<AcpRequestError>("AcpRequestError", {
    description: "JSON-RPC request failure returned by, or sent to, an ACP peer.",
  })
) {
  static readonly is = S.is(AcpRequestError);

  override get message() {
    return this.errorMessage;
  }

  /**
   * Convert an ACP protocol error payload received for a request into a typed
   * driver error, tagged with operation `receive-response`.
   *
   * The optional diagnostics correlate the failure with its request; the
   * `cause` defaults to the payload itself.
   *
   * **Example** (From protocol error payload)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { AcpRequestDiagnostics, AcpRequestError } from "@beep/acp/errors"
   *
   * const error = AcpRequestError.fromProtocolError(
   *   { code: -32601, message: "Method not found" },
   *   AcpRequestDiagnostics.make({ method: O.some("session/new") })
   * )
   * console.log(error.message)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static fromProtocolError(error: AcpSchema.Error, context?: AcpRequestDiagnostics): AcpRequestError {
    const diagnostics = O.getOrElse(O.fromUndefinedOr(context), () => AcpRequestDiagnostics.make({}));
    return AcpRequestError.make({
      cause: O.orElse(diagnostics.cause, () => O.some(error)),
      code: error.code,
      data: O.fromUndefinedOr(error.data),
      errorMessage: error.message,
      method: diagnostics.method,
      operation: O.some("receive-response"),
      requestId: diagnostics.requestId,
    });
  }

  /**
   * Internal error for an outgoing extension request that failed without a
   * protocol error payload.
   *
   * **Example** (Extension response failure)
   *
   * ```ts
   * import { AcpRequestError } from "@beep/acp/errors"
   *
   * const error = AcpRequestError.fromExtensionResponseFailure("x/test", 1, "peer closed")
   * console.log(error.code, error.message)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static fromExtensionResponseFailure(method: string, requestId: AcpRequestId, cause: unknown): AcpRequestError {
    return AcpRequestError.internalError(
      "Extension request failed",
      undefined,
      AcpRequestDiagnostics.make({
        cause: O.some(cause),
        method: O.some(method),
        operation: O.some("receive-response"),
        requestId: O.some(requestId),
      })
    );
  }

  /**
   * Internal error for an extension response that could not be encoded.
   *
   * **Example** (Extension response encoding failure)
   *
   * ```ts
   * import { AcpProtocolParseError, AcpRequestError } from "@beep/acp/errors"
   *
   * const cause = AcpProtocolParseError.fromEncodingError("x/test", 1, "not serializable")
   * const error = AcpRequestError.fromExtensionResponseEncodingError("x/test", 1, cause)
   * console.log(error.message)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static fromExtensionResponseEncodingError(
    method: string,
    requestId: AcpRequestId,
    cause: AcpProtocolParseError
  ): AcpRequestError {
    return AcpRequestError.internalError(
      "Internal error",
      undefined,
      AcpRequestDiagnostics.make({
        cause: O.some(cause),
        method: O.some(method),
        operation: O.some("encode-extension-response"),
        requestId: O.some(requestId),
      })
    );
  }

  /**
   * Internal error for a streaming response to an extension request, which ACP
   * does not support.
   *
   * **Example** (Unsupported streaming response)
   *
   * ```ts
   * import { AcpRequestError } from "@beep/acp/errors"
   *
   * console.log(AcpRequestError.unsupportedStreamingResponse("x/test", 1).message)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static unsupportedStreamingResponse(method: string, requestId: AcpRequestId): AcpRequestError {
    return AcpRequestError.internalError(
      "Streaming extension responses are not supported",
      undefined,
      AcpRequestDiagnostics.make({
        method: O.some(method),
        operation: O.some("receive-streaming-response"),
        requestId: O.some(requestId),
      })
    );
  }

  /**
   * Map a core request handler failure to a request error for the peer.
   *
   * An `AcpRequestError` passes through unchanged. Any other failure becomes a
   * stable `-32603` whose message names only the method; the failure stays in
   * `cause`.
   *
   * **Example** (Core handler failure)
   *
   * ```ts
   * import { AcpRequestError, AcpTransportError } from "@beep/acp/errors"
   *
   * const error = AcpRequestError.fromCoreHandlerError(AcpTransportError.make({}), "session/new")
   * console.log(error.message)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromCoreHandlerError: {
    (error: AcpError, method: string): AcpRequestError;
    (method: string): (error: AcpError) => AcpRequestError;
  } = dual(2, handlerFailure("request handler", "handle-request"));

  /**
   * Map an extension request handler failure to a request error for the peer.
   *
   * An `AcpRequestError` passes through unchanged. Any other failure becomes a
   * stable `-32603` whose message names only the method; the failure stays in
   * `cause`.
   *
   * **Example** (Extension handler failure)
   *
   * ```ts
   * import { AcpRequestError, AcpTransportError } from "@beep/acp/errors"
   *
   * const error = AcpRequestError.fromExtensionHandlerError(AcpTransportError.make({}), "x/test")
   * console.log(error.message)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromExtensionHandlerError: {
    (error: AcpError, method: string): AcpRequestError;
    (method: string): (error: AcpError) => AcpRequestError;
  } = dual(2, handlerFailure("extension request handler", "handle-extension-request"));

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
  static parseError(message = "Parse error", data?: S.Json): AcpRequestError {
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
  static invalidRequest(message = "Invalid request", data?: S.Json): AcpRequestError {
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
  static methodNotFound(method: string): AcpRequestError {
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
  static invalidParams(message = "Invalid params", data?: S.Json): AcpRequestError {
    return AcpRequestError.make({
      code: -32602,
      errorMessage: message,
      data: O.fromUndefinedOr(data),
    });
  }

  /**
   * Create a `-32602` error for an extension request payload that failed to
   * decode.
   *
   * The message names only the method. `data` carries the value-free
   * diagnostics (`issueCount`, `issueKinds`, `maximumPathDepth`); the exact
   * schema error, which may hold payload values, stays in `cause`.
   *
   * **Example** (Invalid extension payload)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import * as S from "effect/Schema"
   * import { AcpRequestError } from "@beep/acp/errors"
   *
   * const program = S.decodeUnknownEffect(S.Struct({ token: S.Number }))({ token: "x" }).pipe(
   *   Effect.mapError((cause) => AcpRequestError.invalidExtensionPayload("x/test", cause))
   * )
   * console.log(program)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static invalidExtensionPayload(method: string, cause: S.SchemaError): AcpRequestError {
    const diagnostics = schemaIssueDiagnostics(cause.issue);
    return AcpRequestError.make({
      cause: O.some(cause),
      code: -32602,
      data: O.some(diagnostics),
      errorMessage: `Invalid payload for ACP extension method '${method}'.`,
      issueCount: O.some(diagnostics.issueCount),
      issueKinds: O.some(diagnostics.issueKinds),
      maximumPathDepth: O.some(diagnostics.maximumPathDepth),
      method: O.some(method),
      operation: O.some("decode-extension-request-payload"),
    });
  }

  /**
   * Create a JSON-RPC internal error, optionally correlated with its request.
   *
   * **Example** (Create internal error)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { AcpRequestDiagnostics, AcpRequestError } from "@beep/acp/errors"
   *
   * const error = AcpRequestError.internalError(
   *   "Internal error",
   *   undefined,
   *   AcpRequestDiagnostics.make({ method: O.some("session/prompt") })
   * )
   * console.log(error.code)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static internalError(
    message = "Internal error",
    data?: S.Json,
    diagnostics?: AcpRequestDiagnostics
  ): AcpRequestError {
    const context = O.getOrElse(O.fromUndefinedOr(diagnostics), () => AcpRequestDiagnostics.make({}));
    return AcpRequestError.make({
      cause: context.cause,
      code: -32603,
      data: O.fromUndefinedOr(data),
      errorMessage: message,
      issueCount: context.issueCount,
      issueKinds: context.issueKinds,
      maximumPathDepth: context.maximumPathDepth,
      method: context.method,
      operation: context.operation,
      requestId: context.requestId,
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
  static authRequired(message = "Authentication required", data?: S.Json): AcpRequestError {
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
  static resourceNotFound(message = "Resource not found", data?: S.Json): AcpRequestError {
    return AcpRequestError.make({
      code: -32002,
      errorMessage: message,
      data: O.fromUndefinedOr(data),
    });
  }

  /**
   * Convert this driver error to the ACP protocol error payload. Only `code`,
   * `message` and `data` are sent; diagnostics and `cause` stay in-process.
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
 * **Example** (Check AcpError membership)
 *
 * ```ts
 * import { AcpError, AcpRequestError } from "@beep/acp/errors"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AcpError)(AcpRequestError.methodNotFound("x/test")))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AcpError = pipe(
  S.Union([
    AcpRequestError,
    AcpSpawnError,
    AcpProcessExitedError,
    AcpProtocolParseError,
    AcpTransportError,
    AcpInputStreamEndedError,
  ]),
  $I.annoteSchema("AcpError", {
    description: "Union of typed technical failures emitted by the ACP driver.",
  }),
  S.toTaggedUnion("_tag")
);

/**
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
