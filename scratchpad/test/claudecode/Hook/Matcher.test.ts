/**
 * Tests for the matcher helpers used by hooks that dispatch internally
 * on tool name.
 *
 * @since 0.1.0
 */
import { describe, expect, test } from "@effect/vitest";

import { matchFileName, matchTool, testTool } from "../../../claudecode/Hook/Matcher.ts";

describe("Hook.matchTool", () => {
  test("plain matcher values are exact matches", () => {
    const isBash = matchTool("Bash");
    expect(isBash("Bash")).toBe(true);
    expect(isBash("Bash(git)")).toBe(false);
    expect(isBash("xBash")).toBe(false);
  });

  test("pipe-separated plain matcher values are exact lists", () => {
    const isEditOrWrite = matchTool("Edit|Write");
    expect(isEditOrWrite("Edit")).toBe(true);
    expect(isEditOrWrite("Write")).toBe(true);
    expect(isEditOrWrite("Read")).toBe(false);
    expect(isEditOrWrite("WriteFile")).toBe(false);
  });

  test("star and empty string match all values", () => {
    expect(matchTool("*")("Bash")).toBe(true);
    expect(matchTool("*")("mcp__memory__create")).toBe(true);
    expect(matchTool("")("Read")).toBe(true);
  });

  test("patterns with other characters are JavaScript regexes", () => {
    const isMcp = matchTool("mcp__.*");
    expect(isMcp("mcp__memory__create")).toBe(true);
    expect(isMcp("notmcp")).toBe(false);

    const startsWithNotebook = matchTool("^Notebook");
    expect(startsWithNotebook("NotebookEdit")).toBe(true);
    expect(startsWithNotebook("ReadNotebook")).toBe(false);
  });

  test("accepts a RegExp literal", () => {
    const isBashStrict = matchTool(/^Bash$/);
    expect(isBashStrict("Bash")).toBe(true);
    expect(isBashStrict("Bash(git)")).toBe(false);
  });

  test("testTool is a one-shot form", () => {
    expect(testTool("Bash", "Bash")).toBe(true);
    expect(testTool("Bash", "Read")).toBe(false);
  });
});

describe("Hook.matchFileName", () => {
  test("treats pipe-separated filenames as literal basenames", () => {
    const matches = matchFileName(".envrc|.env");
    expect(matches(".envrc")).toBe(true);
    expect(matches(".env")).toBe(true);
    expect(matches("xenvrc")).toBe(false);
  });

  test("does not interpret string filename segments as regexes", () => {
    const matches = matchFileName("config.*|[secret].env");
    expect(matches("config.*")).toBe(true);
    expect(matches("[secret].env")).toBe(true);
    expect(matches("config.json")).toBe(false);
    expect(matches("s.env")).toBe(false);
  });

  test("star and empty string still match every basename", () => {
    expect(matchFileName("*")("anything.ts")).toBe(true);
    expect(matchFileName("")(".env")).toBe(true);
  });
});
