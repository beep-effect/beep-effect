import {
  FileEdit,
  isWellFormedText,
  LineageId,
  NodeKind,
  RevisionPreimage,
  revisionPreimage,
  StatusValue,
  toMarkdownRange,
} from "@beep/agent-memory-store";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { anchor, contentHash, nodeId, revisionA, revisionB, revisionC } from "./fixtures.ts";

const decodePreimage = S.decodeUnknownEffect(S.fromJsonString(RevisionPreimage));
const decodeNodeKind = S.decodeUnknownEffect(NodeKind);

const isText = S.is(S.String.check(isWellFormedText));
const isLineage = S.is(LineageId);
const isStatusValue = S.is(StatusValue);
const isFileEdit = S.is(FileEdit);

describe("NodeIdentity", () => {
  it("refuses a lone surrogate in every string the log stores, which UTF-8 cannot carry", () => {
    expect(isText("Plain text, \u{1F600} included.")).toBe(true);
    expect(isText("\uD800")).toBe(false);
    expect(isText("trailing \uDC00")).toBe(false);
    expect(isLineage("session-\uD800")).toBe(false);
    expect(isStatusValue("done\uDFFF")).toBe(false);
    expect(isFileEdit({ edit: "edited", path: "notes.md", text: "half a pair \uD83D" })).toBe(false);
    expect(isFileEdit({ edit: "created", path: "notes.md", text: "\uDE00 the other half" })).toBe(false);
    expect(isFileEdit({ edit: "edited", path: "notes.md", text: "a whole pair \u{1F600}" })).toBe(true);
  });

  it.effect(
    "builds a deterministic, parent-order independent revision preimage",
    Effect.fnUntraced(function* () {
      const forward = revisionPreimage(nodeId, [revisionA, revisionB, revisionC], contentHash);
      const shuffled = revisionPreimage(nodeId, [revisionC, revisionA, revisionB], contentHash);
      const piped = revisionPreimage([revisionB, revisionC, revisionA], contentHash)(nodeId);

      expect(shuffled).toBe(forward);
      expect(piped).toBe(forward);
      expect(revisionPreimage(nodeId, [revisionA, revisionB, revisionC], contentHash)).toBe(forward);

      const decoded = yield* decodePreimage(forward);
      expect(decoded.parents).toEqual([revisionA, revisionB, revisionC]);
      expect(decoded.nodeId).toBe(nodeId);
      expect(decoded.contentHash).toBe(contentHash);
    })
  );

  it.effect(
    "changes the preimage when the parents or content change",
    Effect.fnUntraced(function* () {
      const base = revisionPreimage(nodeId, [revisionA], contentHash);
      expect(revisionPreimage(nodeId, [revisionB], contentHash)).not.toBe(base);
      expect(revisionPreimage(nodeId, [], contentHash)).not.toBe(base);
    })
  );

  it.effect(
    "ignores a repeated parent in the revision preimage",
    Effect.fnUntraced(function* () {
      const distinct = revisionPreimage(nodeId, [revisionA, revisionB], contentHash);
      expect(revisionPreimage(nodeId, [revisionB, revisionA, revisionB, revisionA], contentHash)).toBe(distinct);

      const decoded = yield* decodePreimage(distinct);
      expect(decoded.parents).toEqual([revisionA, revisionB]);
    })
  );

  it.effect(
    "decodes every node kind literal and rejects others",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.forEach(NodeKind.literals, (literal) => decodeNodeKind(literal));
      expect(decoded).toEqual([...NodeKind.literals]);
      expect(decoded).toHaveLength(9);
      expect(NodeKind.is.gap("gap")).toBe(true);

      const error = yield* Effect.flip(decodeNodeKind("table"));
      assertInstanceOf(error, S.SchemaError);
    })
  );

  it.effect(
    "projects an occurrence anchor onto a Markdown range",
    Effect.fnUntraced(function* () {
      const range = toMarkdownRange(anchor);
      expect(range.offset).toBe(6);
      expect(range.length).toBe(4);
    })
  );
});
