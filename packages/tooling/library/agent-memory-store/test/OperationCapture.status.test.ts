/**
 * Status typing in op capture: a status token swap becomes `setStatus`, and
 * every other operation is left as captured. Labeller: the
 * agent-memory-store-p2 integration lane, which wrote every fixture text in
 * this file.
 */
import {
  captureBatch,
  FileEdit,
  MemoryFilePath,
  NodeId,
  NodeOperation,
  OperationBatch,
  StatusFields,
  StatusLifecycle,
  StatusTransition,
  StatusValue,
  seededNodeIdMinter,
  statusMoveBetween,
  typeStatusMoves,
} from "@beep/agent-memory-store";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { author, baseOf, revisionFor } from "./OperationCapture.support.ts";

const pending = StatusValue.make("pending");
const complete = StatusValue.make("complete");
const status = StatusLifecycle.make({ field: "status", order: [pending, StatusValue.make("in-progress"), complete] });
const review = StatusLifecycle.make({ field: "review", order: [pending, StatusValue.make("approved")] });
const fields = StatusFields.make({ lifecycles: [status] });

const row = "| P2 Admission | pending |";

const moveTo = (to: string) =>
  StatusTransition.make({ field: "status", from: O.some(pending), to: StatusValue.make(to) });

// The captured batch of one edit of a one-file base, typed with `statusFields`.
const typed = (baseText: string, editedText: string, statusFields: StatusFields) => {
  const base = baseOf([["notes.md", baseText]]);
  const captured = captureBatch(
    base,
    [FileEdit.cases.edited.make({ path: "notes.md", text: editedText })],
    author,
    seededNodeIdMinter(9)
  );
  const batch = captured.pipe(Result.getOrThrow, O.getOrThrow);
  return A.map(typeStatusMoves(batch, statusFields).operations, (operation) => operation.op);
};

describe("statusMoveBetween", () => {
  it("reads a whole-token swap as a move, inside or outside the lifecycle", () => {
    assertSome(statusMoveBetween(status, row, "| P2 Admission | complete |"), moveTo("complete"));
    assertSome(statusMoveBetween(status, row, "| P2 Admission | blocked |"), moveTo("blocked"));
    assertSome(statusMoveBetween(row, "| P2 Admission | in-progress |")(status), moveTo("in-progress"));
  });

  it("reads every other edit as no move", () => {
    // The base holds no value, or two.
    assertNone(statusMoveBetween(status, "| P2 Admission | open |", "| P2 Admission | complete |"));
    assertNone(statusMoveBetween(status, "| pending | pending |", "| pending | complete |"));
    // The edit is shorter than the bytes around the token.
    assertNone(statusMoveBetween(status, row, "| P2 Admission |"));
    // The bytes before or after the token changed too.
    assertNone(statusMoveBetween(status, row, "| P3 Admission | complete |"));
    assertNone(statusMoveBetween(status, row, "| P2 Admission | complete |\n"));
    // The token is unchanged, or the new text there is not one token.
    assertNone(statusMoveBetween(status, row, row));
    assertNone(statusMoveBetween(status, row, "| P2 Admission | not done |"));
  });

  it("reads a swap to a lifecycle value of several words as a move, so a backward move meets the guard", () => {
    const inReview = StatusValue.make("in review");
    const approved = StatusValue.make("approved");
    const spaced = StatusLifecycle.make({ field: "status", order: [inReview, approved] });
    assertSome(
      statusMoveBetween(spaced, "| P2 | approved |", "| P2 | in review |"),
      StatusTransition.make({ field: "status", from: O.some(approved), to: inReview })
    );
    assertSome(
      statusMoveBetween(spaced, "| P2 | in review |", "| P2 | approved |"),
      StatusTransition.make({ field: "status", from: O.some(inReview), to: approved })
    );
    // Several words that are no lifecycle value stay free text.
    assertNone(statusMoveBetween(spaced, "| P2 | approved |", "| P2 | not reviewed |"));
    const spacedFields = StatusFields.make({ lifecycles: [spaced] });
    expect(typed("| P2 | approved |\n", "| P2 | in review |\n", spacedFields)).toEqual(["setStatus"]);
  });
});

describe("typeStatusMoves", () => {
  it("submits a status cell edit as one setStatus on the replaced node", () => {
    expect(typed(`${row}\n`, "| P2 Admission | complete |\n", fields)).toEqual(["setStatus"]);
  });

  it("leaves a replace that changes more than the token, or that two lifecycles read, as a replace", () => {
    expect(typed(`${row}\n`, "| P2 Admission, revised | complete |\n", fields)).toEqual(["replace"]);
    const ambiguous = StatusFields.make({ lifecycles: [status, review] });
    expect(typed(`${row}\n`, "| P2 Admission | complete |\n", ambiguous)).toEqual(["replace"]);
  });

  it("leaves inserts, deletes, status moves and replaces of nodes outside the base unchanged", () => {
    const base = baseOf([["notes.md", `${row}\n`]]);
    const unknown = NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6eff");
    const operations: A.NonEmptyReadonlyArray<NodeOperation> = [
      NodeOperation.cases.replace.make({ nodeId: unknown, expectedRevision: revisionFor(1), text: "| x | complete |" }),
      NodeOperation.cases.insert.make({
        nodeId: unknown,
        afterNodeId: O.none(),
        filePath: MemoryFilePath.make("notes.md"),
        kind: "paragraph",
        text: "New.",
      }),
      NodeOperation.cases.delete.make({ nodeId: unknown, expectedRevision: revisionFor(1) }),
      NodeOperation.cases.setStatus.make({
        nodeId: unknown,
        expectedRevision: revisionFor(1),
        transition: moveTo("complete"),
      }),
    ];
    const batch = OperationBatch.make({ base, operations, author });
    expect(typeStatusMoves(fields)(batch).operations).toEqual(operations);
  });
});
