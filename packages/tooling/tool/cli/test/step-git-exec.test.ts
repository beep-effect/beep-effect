import {
  BoundedOutput,
  boundedChunkReducer,
  collectBoundedText,
  emptyBoundedOutput,
  formatCommandLine,
  OutputBound,
  qualityStepOutputBound,
  repoRunOutputBound,
} from "@beep/repo-cli/test/Process";
import {
  gitLinesFromOutput,
  gitPathListFromNulOutput,
  isSafeOriginBranch,
  originBranchFromBase,
  safeOriginBranchFromBase,
  sortedUniquePaths,
} from "@beep/repo-cli/test/RepoRun";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Stream } from "effect";
import * as O from "effect/Option";

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("StepExec bounded output fold", () => {
  const bound = OutputBound.make({ maxChars: 4, truncatedNotice: "!" });
  const reduce = boundedChunkReducer(bound);

  it("appends a chunk that fits within the bound", () => {
    expect(reduce(emptyBoundedOutput, "ab")).toEqual(BoundedOutput.make({ text: "ab", truncated: false }));
  });

  it("truncates a chunk that overflows the bound, slicing to the remaining budget", () => {
    expect(reduce(emptyBoundedOutput, "abcdef")).toEqual(BoundedOutput.make({ text: "abcd!", truncated: true }));
  });

  it("appends only the truncation notice when the text is already at the cap", () => {
    expect(reduce(BoundedOutput.make({ text: "abcd", truncated: false }), "e")).toEqual(
      BoundedOutput.make({ text: "abcd!", truncated: true })
    );
  });

  it("is idempotent once truncated", () => {
    const truncated = reduce(emptyBoundedOutput, "abcdef");
    expect(reduce(truncated, "ghi")).toBe(truncated);
  });

  it.effect("folds a byte stream into bounded text with the truncation notice", () =>
    Effect.gen(function* () {
      const result = yield* collectBoundedText(bound)(Stream.fromIterable([encode("ab"), encode("cdef")]));
      expect(result).toEqual(BoundedOutput.make({ text: "abcd!", truncated: true }));
    })
  );

  it.effect("folds a short byte stream without truncating", () =>
    Effect.gen(function* () {
      const result = yield* collectBoundedText(bound)(Stream.fromIterable([encode("hi")]));
      expect(result).toEqual(BoundedOutput.make({ text: "hi", truncated: false }));
    })
  );

  it("exposes the divergent repo-run and quality bounds", () => {
    expect(repoRunOutputBound.maxChars).toBe(512 * 1024);
    expect(qualityStepOutputBound.maxChars).toBe(256 * 1024);
    expect(repoRunOutputBound.truncatedNotice).toContain("[repo-run]");
    expect(qualityStepOutputBound.truncatedNotice).toContain("[beep-cli]");
  });

  it("formats a command line", () => {
    expect(formatCommandLine("git", ["status", "--short"])).toBe("git status --short");
  });
});

describe("GitExec path parsing", () => {
  it("parses NUL-delimited output into sorted unique paths", () => {
    expect(gitPathListFromNulOutput("src/z.ts\0src/a.ts\0src/a.ts\0")).toEqual(["src/a.ts", "src/z.ts"]);
  });

  it("sorts, dedupes, and drops empty path entries", () => {
    expect(sortedUniquePaths(["src/z.ts", "", "src/a.ts", "src/a.ts"])).toEqual(["src/a.ts", "src/z.ts"]);
  });

  it("splits captured output into trimmed non-empty lines", () => {
    expect(gitLinesFromOutput("a\n  b  \n\nc\n")).toEqual(["a", "b", "c"]);
  });
});

describe("GitExec origin-branch refname safety", () => {
  it("accepts safe plain branch names", () => {
    expect(isSafeOriginBranch("main")).toBe(true);
    expect(isSafeOriginBranch("feat/some-thing")).toBe(true);
  });

  it("rejects option-like, empty, and refname-metacharacter names", () => {
    expect(isSafeOriginBranch("")).toBe(false);
    expect(isSafeOriginBranch("--upload-pack=x")).toBe(false);
    expect(isSafeOriginBranch("a b")).toBe(false);
    expect(isSafeOriginBranch("a:b")).toBe(false);
    expect(isSafeOriginBranch("a~b")).toBe(false);
    expect(isSafeOriginBranch("a..b")).toBe(false);
    expect(isSafeOriginBranch("/leading")).toBe(false);
    expect(isSafeOriginBranch("trailing/")).toBe(false);
    expect(isSafeOriginBranch("locked.lock")).toBe(false);
  });

  it("extracts the branch from an origin base ref", () => {
    expect(originBranchFromBase("origin/main")).toEqual(O.some("main"));
    expect(originBranchFromBase("HEAD")).toEqual(O.none());
    expect(originBranchFromBase("origin/")).toEqual(O.none());
  });

  it("extracts only safe branches from an origin base ref", () => {
    expect(safeOriginBranchFromBase("origin/main")).toEqual(O.some("main"));
    expect(safeOriginBranchFromBase("origin/--upload-pack=x")).toEqual(O.none());
  });
});
