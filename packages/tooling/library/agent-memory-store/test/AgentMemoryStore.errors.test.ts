import {
  AdmissionError,
  MemoryIndexError,
  MemoryLogError,
  ObservationError,
  ProjectionError,
  RecallError,
  SymbolResolutionError,
  UnimportedFolderError,
} from "@beep/agent-memory-store";
import { PosixPath } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import { folderDigest } from "./fixtures.ts";

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

  it("refuses an unimported folder with its root and digest", () => {
    const error = UnimportedFolderError.make({ root: PosixPath.make("memory"), folderDigest });

    expect(error._tag).toBe("UnimportedFolderError");
    expect(error.root).toBe("memory");
    expect(error.folderDigest).toBe(folderDigest);
  });
});
