/**
 * Op capture: unit cases for every operation shape, the ambiguous cases of
 * decision op-capture-pairs-only-equal-count-runs, the refusals, the verified
 * capture and the apply helper.
 */
import {
  applyOperations,
  BaseExport,
  BaseFile,
  BaseNode,
  CaptureBaseRefusedError,
  CaptureEditRefusedError,
  captureBatch,
  captureBatchVerified,
  FileEdit,
  LogCursor,
  MemoryFilePath,
  MintedNodeIdCollisionError,
  NodeId,
  NodeOperation,
  OccurrenceAnchor,
  OperationApplyError,
  partition,
  StatusTransition,
  StatusValue,
  seededNodeIdMinter,
  sha256Hex,
  uuidV7NodeIdMinter,
} from "@beep/agent-memory-store";
import { alignFile } from "@beep/agent-memory-store/internal/OperationCapture.align";
import { TextAnchor } from "@beep/provenance";
import { describe, expect, it, layer } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  appliedAt,
  author,
  baseFileOfNodes,
  baseNodeOf,
  baseOf,
  revisionFor,
  roundTrip,
  seededBaseOf,
} from "./OperationCapture.support.ts";
import type { OperationCaptureError } from "@beep/agent-memory-store";

const path = "notes/decisions.md";
const isNodeId = S.is(NodeId);

const edited = (text: string, at = path) => FileEdit.cases.edited.make({ path: at, text });

const fileOf = (base: BaseExport, at = path): BaseFile =>
  O.getOrThrow(A.findFirst(base.files, (file) => file.path === at));

const nodeAt = (base: BaseExport, index: number, at = path) => A.getUnsafe(fileOf(base, at).nodes, index);

// The op tag of each operation, with the base node index it names (or -1).
const shapeOf = (base: BaseExport, operations: ReadonlyArray<NodeOperation>, at = path) => {
  const ids = A.map(fileOf(base, at).nodes, (node) => node.nodeId);
  return A.map(
    operations,
    (operation) =>
      [
        operation.op,
        O.getOrElse(
          A.findFirstIndex(ids, (id) => id === operation.nodeId),
          () => -1
        ),
      ] as const
  );
};

const failureOf = (result: Result.Result<unknown, OperationCaptureError>): OperationCaptureError =>
  Result.match(result, {
    onFailure: (error) => error,
    onSuccess: () => {
      throw new Error("expected a capture failure");
    },
  });

const assertRoundTrip = (base: BaseExport, text: string) => {
  const { operations, files } = roundTrip(base, [edited(text)]);
  const file = appliedAt(files, path);
  expect(file.text).toBe(text);
  deepStrictEqual(
    A.map(file.nodes, (node) => node.text),
    A.map(partition(text).nodes, (node) => node.text)
  );
  return operations;
};

describe("captureBatch", () => {
  const base = baseOf([[path, "# Notes\n\n- one\n- two\n- three\n"]]);

  it("emits nothing for an unchanged file", () => {
    const captured = captureBatch(base, [edited("# Notes\n\n- one\n- two\n- three\n")], author, seededNodeIdMinter(1));
    captured.pipe(Result.getOrThrow, assertNone);
  });

  it("replaces a changed list item, naming its base revision", () => {
    const operations = assertRoundTrip(base, "# Notes\n\n- one\n- deux\n- three\n");
    const item = nodeAt(base, 4);
    deepStrictEqual(operations, [
      NodeOperation.cases.replace.make({ nodeId: item.nodeId, expectedRevision: item.revisionId, text: "- deux" }),
    ]);
  });

  it("inserts a middle node and its separator as a chain without revising later nodes", () => {
    const operations = assertRoundTrip(base, "# Notes\n\n- one\n- new\n- two\n- three\n");
    expect(A.map(operations, (operation) => operation.op)).toEqual(["insert", "insert"]);
    const [first, second] = operations;
    assertTrue(NodeOperation.guards.insert(first) && NodeOperation.guards.insert(second));
    if (NodeOperation.guards.insert(first) && NodeOperation.guards.insert(second)) {
      // The run "- new", "\n" follows the separator after "- one".
      assertSome(first.afterNodeId, nodeAt(base, 3).nodeId);
      assertSome(second.afterNodeId, first.nodeId);
      deepStrictEqual([first.kind, first.text, second.kind, second.text], ["listItem", "- new", "gap", "\n"]);
      expect(first.filePath).toBe(path);
    }
  });

  it("deletes a removed node and its separator", () => {
    const operations = assertRoundTrip(base, "# Notes\n\n- one\n- three\n");
    deepStrictEqual(shapeOf(base, operations), [
      ["delete", 4],
      ["delete", 5],
    ]);
  });

  it("treats a kind change at equal count as a delete and an insert", () => {
    const operations = assertRoundTrip(base, "# Notes\n\n- one\n## two\n- three\n");
    deepStrictEqual(shapeOf(base, operations), [
      ["delete", 4],
      ["insert", -1],
    ]);
  });

  it("treats a moved node as a delete and an insert", () => {
    const operations = assertRoundTrip(base, "# Notes\n\n- two\n- one\n- three\n");
    expect(A.every(operations, (operation) => operation.op !== "replace")).toBe(true);
    expect(A.some(operations, (operation) => operation.op === "delete")).toBe(true);
  });

  it("replaces an edited gap byte for byte", () => {
    const operations = assertRoundTrip(base, "# Notes\n\n\n- one\n- two\n- three\n");
    deepStrictEqual(shapeOf(base, operations), [["replace", 1]]);
  });

  it("captures an edit that changes how its neighbours parse as an unpaired run", () => {
    const paragraphs = baseOf([[path, "one\n\ntwo\n"]]);
    // Without the blank line the two paragraphs are one.
    const operations = assertRoundTrip(paragraphs, "one\ntwo\n");
    deepStrictEqual(shapeOf(paragraphs, operations), [
      ["delete", 0],
      ["delete", 1],
      ["delete", 2],
      ["insert", -1],
    ]);
    const [, , , insert] = operations;
    assertTrue(insert !== undefined && NodeOperation.guards.insert(insert) && O.isNone(insert.afterNodeId));
  });

  it("pairs an equal-count run by position", () => {
    const operations = assertRoundTrip(base, "# Notes\n\n- uno\n- dos\n- three\n");
    deepStrictEqual(shapeOf(base, operations), [
      ["replace", 2],
      ["replace", 4],
    ]);
  });

  it("round-trips CRLF, a byte order mark and a missing trailing newline", () => {
    const crlf = baseOf([[path, "﻿# Notes\r\n\r\n- one\r\n- two"]]);
    assertRoundTrip(crlf, "﻿# Notes\r\n\r\n- one\r\n- two\r\n- three");
    assertRoundTrip(crlf, "# Notes\r\n\r\n- one\r\n- two");
    assertRoundTrip(crlf, "﻿﻿# Notes\n- one\r\n- two\n");
  });

  it("retires every node of an emptied file, the same batch as a removed file", () => {
    const emptied = roundTrip(base, [edited("")]);
    const removed = roundTrip(base, [FileEdit.cases.removed.make({ path })]);
    deepStrictEqual(emptied.operations, removed.operations);
    expect(emptied.operations.length).toBe(fileOf(base).nodes.length);
    expect(appliedAt(removed.files, path).text).toBe("");
  });

  it("captures a created file as an insert chain that opens the file", () => {
    const created = "new.md";
    const { operations, files } = roundTrip(base, [
      FileEdit.cases.created.make({ path: created, text: "# New\n\n- a\n" }),
    ]);
    expect(appliedAt(files, created).text).toBe("# New\n\n- a\n");
    const [first, ...rest] = operations;
    assertTrue(first !== undefined && NodeOperation.guards.insert(first) && O.isNone(first.afterNodeId));
    assertTrue(A.every(rest, (operation) => NodeOperation.guards.insert(operation) && O.isSome(operation.afterNodeId)));
  });

  it("captures edits in path order, whatever order they come in", () => {
    const two = baseOf([
      ["a.md", "- one\n"],
      ["b.md", "- two\n"],
    ]);
    const edits = [edited("- uno\n", "a.md"), edited("- dos\n", "b.md")];
    const forward = captureBatch(two, edits, author, seededNodeIdMinter(3));
    const backward = captureBatch(two, A.reverse(edits), author, seededNodeIdMinter(3));
    deepStrictEqual(forward, backward);
  });

  it("is deterministic for a seeded minter and supports the data-last form", () => {
    const edits = [edited("# Notes\n\n- one\n- new\n- two\n- three\n")];
    deepStrictEqual(
      captureBatch(base, edits, author, seededNodeIdMinter(5)),
      captureBatch(edits, author, seededNodeIdMinter(5))(base)
    );
  });

  it("matches nodes by text alone when the base partition does not cut the base nodes", () => {
    const counter = { value: 0 };
    const mint = seededNodeIdMinter(11);
    // Two nodes where the partition cuts three, and three nodes the partition cuts differently.
    const fewer = BaseExport.make({
      folderDigest: base.folderDigest,
      files: [baseFileOfNodes({ path, texts: ["a\n", "\nb"], mint, counter })],
      cursor: LogCursor.make(0),
    });
    const operations = assertRoundTrip(fewer, "a\n\nc");
    expect(A.every(operations, (operation) => operation.op !== "replace")).toBe(true);
    const shifted = BaseExport.make({
      folderDigest: base.folderDigest,
      files: [baseFileOfNodes({ path, texts: ["a", "\n", "\nb"], mint, counter })],
      cursor: LogCursor.make(0),
    });
    const kept = assertRoundTrip(shifted, "a\n\nc");
    // Equal-count run, unknown kinds: each pair is a delete and an insert.
    deepStrictEqual(shapeOf(shifted, kept), [
      ["delete", 1],
      ["insert", -1],
      ["delete", 2],
      ["insert", -1],
    ]);
  });
});

describe("captureBatch refusals", () => {
  const base = baseOf([[path, "- one\n"]]);
  const capture = (edits: ReadonlyArray<FileEdit>, on: BaseExport = base) =>
    failureOf(captureBatch(on, edits, author, seededNodeIdMinter(1)));

  it("refuses paths outside the memory file rule", () => {
    for (const bad of ["../escape.md", ".git/notes.md", "notes.txt", "/abs.md"]) {
      deepStrictEqual(
        capture([edited("x", bad)]),
        CaptureEditRefusedError.make({ path: bad, reason: "pathOutsideMemoryFiles" })
      );
    }
  });

  it("refuses unknown, existing and duplicate files", () => {
    deepStrictEqual(
      capture([edited("x", "other.md")]),
      CaptureEditRefusedError.make({ path: "other.md", reason: "unknownBaseFile" })
    );
    deepStrictEqual(
      capture([FileEdit.cases.removed.make({ path: "other.md" })]),
      CaptureEditRefusedError.make({ path: "other.md", reason: "unknownBaseFile" })
    );
    deepStrictEqual(
      capture([FileEdit.cases.created.make({ path, text: "x" })]),
      CaptureEditRefusedError.make({ path, reason: "baseFileExists" })
    );
    deepStrictEqual(
      capture([edited("x"), edited("y")]),
      CaptureEditRefusedError.make({ path, reason: "duplicateEdit" })
    );
  });

  it("refuses a created file with an empty text, which holds no node to record", () => {
    deepStrictEqual(
      capture([FileEdit.cases.created.make({ path: "empty.md", text: "" })]),
      CaptureEditRefusedError.make({ path: "empty.md", reason: "emptyCreatedFile" })
    );
  });

  it("refuses a base with a repeated file, a repeated node id or anchors out of sequence", () => {
    const [file] = base.files;
    const node = nodeAt(base, 0);
    const withFiles = (files: ReadonlyArray<BaseFile>) =>
      BaseExport.make({ folderDigest: base.folderDigest, files, cursor: LogCursor.make(0) }, { disableChecks: true });
    const withNodes = (nodes: BaseFile["nodes"]) =>
      withFiles([BaseFile.make({ ...fileOf(base), nodes }, { disableChecks: true })]);
    const refusal = (reason: CaptureBaseRefusedError["reason"]) =>
      CaptureBaseRefusedError.make({ path: MemoryFilePath.make(path), reason });
    assertTrue(file !== undefined);
    deepStrictEqual(capture([edited("x")], withFiles([fileOf(base), fileOf(base)])), refusal("duplicateFile"));
    deepStrictEqual(
      capture(
        [edited("x")],
        withNodes([node, baseNodeOf({ path, nodeId: node.nodeId, revisionId: revisionFor(9), offset: 5, text: "x" })])
      ),
      refusal("duplicateNodeId")
    );
    deepStrictEqual(
      capture(
        [edited("x")],
        withNodes([baseNodeOf({ path, nodeId: node.nodeId, revisionId: node.revisionId, offset: 1, text: "- one" })])
      ),
      refusal("anchorOutOfSequence")
    );
    // An anchor wider than its quote, which only an unchecked construction can build.
    const wide = baseNodeOf({ path, nodeId: node.nodeId, revisionId: node.revisionId, offset: 0, text: "- one" });
    const unchecked = BaseNode.make(
      {
        ...wide,
        anchor: OccurrenceAnchor.make(
          {
            ...wide.anchor,
            anchor: TextAnchor.make({ startChar: 0, endChar: 9, quote: "- one" }, { disableChecks: true }),
          },
          { disableChecks: true }
        ),
      },
      { disableChecks: true }
    );
    deepStrictEqual(capture([edited("x")], withNodes([unchecked])), refusal("anchorOutOfSequence"));
  });

  it("refuses a minted id the base or the batch already holds", () => {
    const taken = nodeAt(base, 0).nodeId;
    deepStrictEqual(
      failureOf(captureBatch(base, [edited("- one\n- two\n")], author, () => taken)),
      MintedNodeIdCollisionError.make({ nodeId: taken })
    );
    const fixed = NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f");
    deepStrictEqual(
      failureOf(captureBatch(base, [edited("- one\n- two\n- three\n")], author, () => fixed)),
      MintedNodeIdCollisionError.make({ nodeId: fixed })
    );
  });

  it("describes every refusal in its message", () => {
    expect(CaptureEditRefusedError.make({ path, reason: "duplicateEdit" }).message).toContain("duplicateEdit");
    expect(
      CaptureBaseRefusedError.make({ path: MemoryFilePath.make(path), reason: "duplicateFile" }).message
    ).toContain(path);
    expect(MintedNodeIdCollisionError.make({ nodeId: nodeAt(base, 0).nodeId }).message).toContain(
      nodeAt(base, 0).nodeId
    );
    expect(OperationApplyError.make({ nodeId: nodeAt(base, 0).nodeId, reason: "unknownNode" }).message).toContain(
      "unknownNode"
    );
  });
});

layer(Digest.layerWebCrypto)("captureBatchVerified", (it) => {
  const withDigest = Effect.fnUntraced(function* (base: BaseExport) {
    const files: Array<BaseFile> = [];
    for (const file of base.files) {
      const text = A.join(
        A.map(file.nodes, (node) => node.anchor.anchor.quote),
        ""
      );
      const fileDigest = yield* sha256Hex(new TextEncoder().encode(text));
      files.push(BaseFile.make({ ...file, fileDigest }));
    }
    return BaseExport.make({ ...base, files });
  });

  it.effect(
    "captures against a base whose named files hash to their digests",
    Effect.fnUntraced(function* () {
      // `other.md` keeps a wrong digest; no edit names it, so it is not checked.
      const verified = yield* withDigest(baseOf([[path, "- one\n"]]));
      const base = BaseExport.make({
        ...verified,
        files: [...verified.files, fileOf(seededBaseOf(2)([["other.md", "x\n"]]), "other.md")],
      });
      const batch = yield* captureBatchVerified(base, [edited("- uno\n")], author, seededNodeIdMinter(1));
      expect(operationsOfBatch(batch)).toEqual(["replace"]);
    })
  );

  it.effect(
    "refuses a named file whose node texts do not hash to its digest",
    Effect.fnUntraced(function* () {
      const base = baseOf([[path, "- one\n"]]);
      const error = yield* Effect.flip(captureBatchVerified(base, [edited("- uno\n")], author, seededNodeIdMinter(1)));
      deepStrictEqual(
        error,
        CaptureBaseRefusedError.make({ path: MemoryFilePath.make(path), reason: "digestMismatch" })
      );
    })
  );
});

const operationsOfBatch = (batch: O.Option<{ readonly operations: ReadonlyArray<NodeOperation> }>) =>
  O.match(batch, {
    onNone: (): ReadonlyArray<string> => [],
    onSome: (value) => A.map(value.operations, (op) => op.op),
  });

describe("node id minters", () => {
  it("mint well-formed ids, reproducibly for a seed", () => {
    const first = seededNodeIdMinter(7);
    const second = seededNodeIdMinter(7);
    const ids = A.makeBy(20, () => first());
    deepStrictEqual(
      ids,
      A.makeBy(20, () => second())
    );
    expect(A.dedupe(ids).length).toBe(20);
    assertTrue(A.every(ids, isNodeId));
    assertTrue(isNodeId(uuidV7NodeIdMinter()));
  });
});

describe("applyOperations", () => {
  const base = baseOf([
    [path, "- one\n- two\n"],
    ["other.md", "x\n"],
  ]);
  const one = nodeAt(base, 0);
  const fresh = NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f");
  const refusal = (operations: ReadonlyArray<NodeOperation>) =>
    Result.match(applyOperations(base, operations), {
      onFailure: (error) => [error.nodeId, error.reason] as const,
      onSuccess: () => ["", "applied"] as const,
    });
  const insert = (afterNodeId: O.Option<NodeId>, filePath = path, nodeId = fresh) =>
    NodeOperation.cases.insert.make({
      nodeId,
      afterNodeId,
      filePath: MemoryFilePath.make(filePath),
      kind: "paragraph",
      text: "new",
    });

  it("places an insert at the top of an existing file and supports the data-last form", () => {
    const files = Result.getOrThrow(applyOperations([insert(O.none())])(base));
    expect(appliedAt(files, path).text).toBe("new- one\n- two\n");
    expect(A.map(files, (file) => file.path)).toEqual([path, "other.md"]);
  });

  it("refuses operations that do not fit the working state", () => {
    const replace = NodeOperation.cases.replace.make({
      nodeId: one.nodeId,
      expectedRevision: one.revisionId,
      text: "- uno",
    });
    const remove = NodeOperation.cases.delete.make({ nodeId: one.nodeId, expectedRevision: one.revisionId });
    const otherNode = nodeAt(base, 0, "other.md");
    deepStrictEqual(refusal([remove, remove]), [one.nodeId, "unknownNode"]);
    deepStrictEqual(refusal([replace, replace]), [one.nodeId, "staleRevision"]);
    deepStrictEqual(
      refusal([NodeOperation.cases.delete.make({ nodeId: one.nodeId, expectedRevision: revisionFor(0) })]),
      [one.nodeId, "staleRevision"]
    );
    deepStrictEqual(refusal([insert(O.none(), path, one.nodeId)]), [one.nodeId, "nodeIdAlreadyExists"]);
    deepStrictEqual(refusal([remove, insert(O.none(), path, one.nodeId)]), [one.nodeId, "nodeIdAlreadyExists"]);
    deepStrictEqual(refusal([remove, insert(O.some(one.nodeId))]), [fresh, "predecessorMissing"]);
    deepStrictEqual(refusal([insert(O.some(otherNode.nodeId))]), [fresh, "predecessorInOtherFile"]);
    deepStrictEqual(
      refusal([
        NodeOperation.cases.setStatus.make({
          nodeId: one.nodeId,
          expectedRevision: one.revisionId,
          transition: StatusTransition.make({ field: "status", from: O.none(), to: StatusValue.make("active") }),
        }),
      ]),
      [one.nodeId, "unsupportedOperation"]
    );
  });
});

describe("alignFile", () => {
  it("supports the data-last form", () => {
    const base = baseOf([[path, "- one\n"]]);
    deepStrictEqual(alignFile("- uno\n")(fileOf(base).nodes), alignFile(fileOf(base).nodes, "- uno\n"));
  });
});
