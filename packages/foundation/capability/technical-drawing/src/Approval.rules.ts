/**
 * Pure verification of a confirmation artifact against a sheet set.
 *
 * **Details**
 *
 * The match is whole-line and verbatim: the check never interprets prose, so a
 * rejection, a question, or any sentence that merely contains the hash is not
 * an approval. Only text above the first reply or forward boundary counts;
 * Graph `uniqueBody` already drops most quoted history, and the boundary scan
 * covers forwards and clients that inline the thread.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O } from "@beep/utils";
import { pipe, Result } from "effect";
import { approvalStatement } from "./Approval.schemas.ts";
import type { ApprovalRefusalReason, Confirmation, EmailAddress } from "./Approval.schemas.ts";
import type { Sha256Hex } from "./Manifest.schemas.ts";

const BOUNDARY_PATTERNS: ReadonlyArray<RegExp> = [
  /^-{2,}\s*original message\s*-{2,}$/i,
  /^-{2,}\s*forwarded message\s*-{2,}$/i,
  /^begin forwarded message:?$/i,
  /^_{8,}$/,
  /^from:\s+\S/i,
  /^on .+ wrote:$/i,
  /^>/,
];

const isBoundary = (line: string): boolean => A.some(BOUNDARY_PATTERNS, (pattern) => pattern.test(line));

/**
 * Split text into lines, dropping only trailing whitespace and carriage
 * returns, never leading characters.
 *
 * **Example** (CRLF and trailing spaces)
 *
 * ```ts
 * import { textLines } from "@beep/technical-drawing"
 *
 * console.log(textLines("a  \r\n  b\n")) // ["a", "  b", ""]
 * ```
 *
 * @category approval
 * @since 0.0.0
 */
export const textLines = (text: string): ReadonlyArray<string> =>
  A.map(text.split("\n"), (line) => line.replace(/[\s\r]+$/, ""));

/**
 * The lines above the first reply/forward boundary.
 *
 * **Example** (Drop a quoted thread)
 *
 * ```ts
 * import { authoredLines } from "@beep/technical-drawing"
 *
 * console.log(authoredLines("Approved.\n\nOn Mon, A wrote:\n> request"))
 * ```
 *
 * @category approval
 * @since 0.0.0
 */
export const authoredLines = (text: string): ReadonlyArray<string> =>
  A.takeWhile(textLines(text), (line) => !isBoundary(line.trim()));

/**
 * The outcome of verifying a confirmation.
 *
 * @category approval
 * @since 0.0.0
 */
export type ConfirmationCheck = Result.Result<
  { readonly matchedAddress: EmailAddress; readonly matchedText: string },
  ApprovalRefusalReason
>;

const statementCheck = (text: string, statement: string, scoped: boolean): O.Option<ApprovalRefusalReason> => {
  const lines = scoped ? authoredLines(text) : textLines(text);
  if (A.contains(lines, statement)) {
    return O.none();
  }
  // Classification only: quote markers are stripped to recognise a quoted
  // copy, never to approve one.
  const unquoted = A.map(textLines(text), (line) => line.replace(/^(\s*>\s?)+/, ""));
  return A.contains(unquoted, statement) ? O.some("statement-only-quoted") : O.some("statement-missing");
};

/**
 * Verify a confirmation artifact against a sheet set and approver.
 *
 * **Details**
 *
 * - Email: `from` and `sender` both equal the approver, and the statement is a
 *   whole line of the authored text above any reply/forward boundary.
 * - PDF: the operator-attested deliverer equals the approver, and the
 *   statement is a whole line of the initialed page's text.
 *
 * **Example** (A matching reply)
 *
 * ```ts
 * import { approvalStatement, EmailAddress, EmailConfirmation, Sha256Hex, verifyConfirmation } from "@beep/technical-drawing"
 *
 * const hash = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * const reply = EmailConfirmation.make({
 *   internetMessageId: "<a@b>", from: EmailAddress.make("a@b.co"), sender: EmailAddress.make("a@b.co"), receivedAt: "t",
 *   authoredText: `${approvalStatement(hash)}\n`
 * })
 * console.log(verifyConfirmation({ sheetSetSha256: hash, approver: EmailAddress.make("a@b.co"), confirmation: reply }))
 * ```
 *
 * @category approval
 * @since 0.0.0
 */
export const verifyConfirmation = (input: {
  readonly sheetSetSha256: Sha256Hex;
  readonly approver: EmailAddress;
  readonly confirmation: Confirmation;
}): ConfirmationCheck => {
  const statement = approvalStatement(input.sheetSetSha256);
  const { confirmation, approver } = input;
  if (confirmation.kind === "email") {
    if (confirmation.from !== approver || confirmation.sender !== approver) {
      return Result.fail("sender-mismatch");
    }
    return pipe(
      statementCheck(confirmation.authoredText, statement, true),
      O.match({
        onNone: () => Result.succeed({ matchedAddress: approver, matchedText: confirmation.authoredText }),
        onSome: Result.fail,
      })
    );
  }
  if (confirmation.deliveredBy !== approver) {
    return Result.fail("delivery-mismatch");
  }
  return pipe(
    statementCheck(confirmation.pageText, statement, false),
    O.match({
      onNone: () => Result.succeed({ matchedAddress: approver, matchedText: confirmation.pageText }),
      onSome: Result.fail,
    })
  );
};
