import { NodeKind, RevisionPreimage, revisionPreimage, toMarkdownRange } from "@beep/agent-memory-store";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { anchor, contentHash, nodeId, revisionA, revisionB, revisionC } from "./fixtures.ts";

const decodePreimage = S.decodeUnknownEffect(S.fromJsonString(RevisionPreimage));
const decodeNodeKind = S.decodeUnknownEffect(NodeKind);

describe("NodeIdentity", () => {
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
