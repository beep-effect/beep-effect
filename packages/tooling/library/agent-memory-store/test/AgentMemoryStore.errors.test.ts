import {
  AdmissionError,
  HoldNotOpenError,
  MemoryIndexError,
  MemoryLogError,
  ObservationError,
  ProjectionError,
  RecallError,
  StaleParentsError,
  SymbolResolutionError,
  UnimportedFolderError,
} from "@beep/agent-memory-store";
import { PosixPath } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { folderDigest, holdId, nodeId, revisionA, revisionB } from "./fixtures.ts";

const constructors = [
  ["MemoryLogError", MemoryLogError.fromUnknown],
  ["AdmissionError", AdmissionError.fromUnknown],
  ["ProjectionError", ProjectionError.fromUnknown],
  ["RecallError", RecallError.fromUnknown],
  ["MemoryIndexError", MemoryIndexError.fromUnknown],
  ["ObservationError", ObservationError.fromUnknown],
  ["SymbolResolutionError", SymbolResolutionError.fromUnknown],
] as const;

describe("AgentMemoryStore errors", () => {
  it("keeps the cause and message of an Error", () => {
    A.forEach(constructors, ([tag, fromUnknown]) => {
      const cause = new Error("x");
      const error = fromUnknown("append", cause);

      expect(error._tag).toBe(tag);
      expect(error.operation).toBe("append");
      assertSome(error.message, "x");
      assertSome(error.cause, cause);
    });
  });

  it("reports no cause or message when none was supplied", () => {
    A.forEach(constructors, ([tag, fromUnknown]) => {
      const error = fromUnknown("entries");

      expect(error._tag).toBe(tag);
      assertNone(error.cause);
      assertNone(error.message);
    });
  });

  it("leaves the optional context fields empty by default", () => {
    assertNone(AdmissionError.fromUnknown("admit").nodeId);
    assertNone(ProjectionError.fromUnknown("exportFolder").path);
    assertNone(SymbolResolutionError.fromUnknown("resolve").symbol);
  });

  it("refuses an unimported folder with its root and digest, or with neither when no folder was named", () => {
    const error = UnimportedFolderError.make({
      root: O.some(PosixPath.make("memory")),
      folderDigest: O.some(folderDigest),
    });

    expect(error._tag).toBe("UnimportedFolderError");
    assertSome(error.root, PosixPath.make("memory"));
    assertSome(error.folderDigest, folderDigest);
    const unnamed = UnimportedFolderError.make({});
    assertNone(unnamed.root);
    assertNone(unnamed.folderDigest);
  });

  it("refuses a stale node event with the parents it named and the heads the log held", () => {
    const error = StaleParentsError.make({ nodeId, parents: [revisionA], heads: [revisionB] });

    expect(error._tag).toBe("StaleParentsError");
    expect(error.nodeId).toBe(nodeId);
    expect(error.parents).toEqual([revisionA]);
    expect(error.heads).toEqual([revisionB]);
  });

  it("refuses to resolve a hold the log does not hold open", () => {
    const error = HoldNotOpenError.make({ holdId });

    expect(error._tag).toBe("HoldNotOpenError");
    expect(error.holdId).toBe(holdId);
  });
});
