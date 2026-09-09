/**
 * Shared utilities for Effect Schema adapters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaParser from "effect/SchemaParser";

/**
 * Assertion function compiled for a concrete schema.
 *
 * @typeParam Sch - Schema whose decoded type is added to the asserted input.
 * @category type-level
 * @since 0.0.0
 */
export type CompiledAssertion<Sch extends S.Constraint> = <I>(input: I) => asserts input is I & Sch["Type"];

const schemaIssueFromCause = (cause: Cause.Cause<SchemaIssue.Issue>): SchemaIssue.Issue | undefined => {
  let issue: SchemaIssue.Issue | undefined;
  for (const reason of cause.reasons) {
    if (!Cause.isFailReason(reason) || !SchemaIssue.isIssue(reason.error)) return undefined;
    issue ??= reason.error;
  }
  return issue;
};

/**
 * Compiles a reusable assertion against the decoded side of a schema.
 *
 * **Details**
 *
 * Compilation happens once when this function is called. Schema failures throw
 * `Error("Schema validation failed")` with the `SchemaIssue.Issue` as their
 * cause, matching `S.asserts`.
 *
 * **Gotchas**
 *
 * Defects, interruptions, asynchronous work, and mixed causes throw
 * `Error("Assertion adapter can only throw schema issues")` with the complete
 * `Cause` preserved.
 *
 * **Example** (Compile and apply a string assertion)
 *
 * ```ts
 * import { compileAssertion } from "@beep/utils/Schema"
 * import * as S from "effect/Schema"
 *
 * const assertString: <I>(input: I) => asserts input is I & string = compileAssertion(S.String)
 * const input: unknown = "beep"
 * assertString(input)
 * input.toUpperCase() // => "BEEP"
 * ```
 *
 * @throws `Error` when validation fails or the synchronous parser produces a non-schema cause.
 * @see {@link S.asserts} for the equivalent uncurried Effect Schema assertion.
 * @category assertions
 * @since 0.0.0
 */
export const compileAssertion = <Sch extends S.Constraint>(schema: Sch): CompiledAssertion<Sch> => {
  const decode = SchemaParser.decodeUnknownExit(S.toType(schema));
  return <I>(input: I): asserts input is I & Sch["Type"] => {
    const exit = decode(input);
    if (Exit.isSuccess(exit)) return;

    const issue = schemaIssueFromCause(exit.cause);
    if (issue === undefined) {
      throw new Error("Assertion adapter can only throw schema issues", { cause: exit.cause });
    }
    throw new Error("Schema validation failed", { cause: issue });
  };
};
