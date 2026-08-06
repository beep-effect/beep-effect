/**
 * Schema issue diagnostic formatting for laws tooling.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { pipe, SchemaIssue } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const standardSchemaFormatter = SchemaIssue.makeFormatterStandardSchemaV1();
const redactedSchemaFormatter = SchemaIssue.makeFormatterStandardSchemaV1({
  checkHook: () => "Invalid data <redacted>",
  leafHook: () => "Invalid data <redacted>",
});

type StandardPathSegment = PropertyKey | { readonly key: PropertyKey };

type StandardIssueDiagnostic = {
  readonly message: string;
  readonly path?: ReadonlyArray<StandardPathSegment> | undefined;
};

const schemaIssueFrom = (errorOrIssue: S.SchemaError | SchemaIssue.Issue): SchemaIssue.Issue =>
  errorOrIssue instanceof S.SchemaError ? errorOrIssue.issue : errorOrIssue;

const formatPathSegment = (segment: StandardPathSegment): string =>
  P.isObject(segment) && P.hasProperty(segment, "key") ? String(segment.key) : String(segment);

const formatPathLabel = (path: ReadonlyArray<StandardPathSegment> | undefined): string =>
  path === undefined || A.isReadonlyArrayEmpty(path) ? "<root>" : pipe(path, A.map(formatPathSegment), A.join("."));

const formatStandardIssue = (diagnostic: StandardIssueDiagnostic): string =>
  `${formatPathLabel(diagnostic.path)}: ${diagnostic.message}`;

/**
 * Format a schema issue or schema error as path-prefixed Standard Schema V1 diagnostics.
 *
 * **Details**
 *
 * Built-in formatters state the constraint that was violated; since Effect
 * 4.0.0-beta.103 they never echo the rejected value.
 *
 * **Example** (Formatting a failed decode)
 *
 * ```ts
 * import { formatSchemaDiagnostics } from "@beep/repo-cli/commands/Laws/SchemaDiagnostics"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownResult(S.Struct({ token: S.Literal("expected-token") }))({ token: "sk-test-secret" })
 * if (Result.isFailure(result)) {
 *   console.log(formatSchemaDiagnostics(result.failure).some((line) => line.includes("expected-token"))) // true
 * }
 * ```
 *
 * @param errorOrIssue - Schema error or issue to format.
 * @returns Path-prefixed Standard Schema V1 diagnostic messages.
 * @category utilities
 * @since 0.0.0
 */
export const formatSchemaDiagnostics = (errorOrIssue: S.SchemaError | SchemaIssue.Issue): ReadonlyArray<string> =>
  pipe(standardSchemaFormatter(schemaIssueFrom(errorOrIssue)).issues, A.map(formatStandardIssue));

/**
 * Format a schema issue or schema error with every message replaced by a redaction
 * marker, keeping only the path.
 *
 * **Details**
 *
 * Built-in formatters stopped interpolating rejected values in Effect
 * 4.0.0-beta.103, so this no longer exists to strip them. It still matters for
 * repo-authored messages, which may interpolate a value the caller supplied.
 *
 * **Example** (Redacting a failed decode)
 *
 * ```ts
 * import { formatRedactedSchemaDiagnostics } from "@beep/repo-cli/commands/Laws/SchemaDiagnostics"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownResult(S.Struct({ token: S.Literal("expected-token") }))({ token: "sk-test-secret" })
 * if (Result.isFailure(result)) {
 *   console.log(formatRedactedSchemaDiagnostics(result.failure).some((line) => line.includes("sk-test-secret"))) // false
 * }
 * ```
 *
 * @param errorOrIssue - Schema error or issue to format without message detail.
 * @returns Path-prefixed redacted Standard Schema V1 diagnostic messages.
 * @category utilities
 * @since 0.0.0
 */
export const formatRedactedSchemaDiagnostics = (
  errorOrIssue: S.SchemaError | SchemaIssue.Issue
): ReadonlyArray<string> =>
  pipe(redactedSchemaFormatter(schemaIssueFrom(errorOrIssue)).issues, A.map(formatStandardIssue));
