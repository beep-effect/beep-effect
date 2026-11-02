import * as Facade from "@beep/git/Git";
import * as Errors from "@beep/git/Git.errors";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const cases = A.make(
  { name: "GitCommandError", facade: Facade.GitCommandError, owner: Errors.GitCommandError },
  { name: "NotARepositoryError", facade: Facade.NotARepositoryError, owner: Errors.NotARepositoryError },
  { name: "UnknownRefError", facade: Facade.UnknownRefError, owner: Errors.UnknownRefError },
  { name: "NonFastForwardError", facade: Facade.NonFastForwardError, owner: Errors.NonFastForwardError },
  { name: "MergeConflictError", facade: Facade.MergeConflictError, owner: Errors.MergeConflictError },
  { name: "DirtyWorktreeError", facade: Facade.DirtyWorktreeError, owner: Errors.DirtyWorktreeError },
  { name: "NotStubbedError", facade: Facade.NotStubbedError, owner: Errors.NotStubbedError }
);

describe("GitCommandError.kind", () => {
  it("admits the three kinds and renders a truncated detail verbatim", () => {
    const isKind = S.is(Facade.GitCommandError.fields.kind);
    expect(A.map(["refused", "failed", "truncated", "tooLarge"], isKind)).toEqual([true, true, true, false]);
    const truncated = Facade.GitCommandError.make({
      kind: "truncated",
      args: ["show", "HEAD:big.txt"],
      cwd: "/repo",
      stderr: "",
      detail: "stdout exceeded the 65536 byte output limit (maxOutputBytes)",
    });
    expect(truncated.kind).toBe("truncated");
    expect(truncated.exitCode).toBeUndefined();
    expect(truncated.message).toBe(
      "git show HEAD:big.txt in /repo: stdout exceeded the 65536 byte output limit (maxOutputBytes)"
    );
  });
});

describe.each(cases)("$name import compatibility", ({ name, facade, owner }) => {
  it("retains one constructor and its original Git identity", () => {
    expect(facade).toBe(owner);
    const annotations = S.resolveAnnotations(owner);
    expect(annotations?.identifier).toBe(`@beep/git/Git/${name}`);
    expect(annotations?.schemaId).toBe(Symbol.for(`@beep/git/Git/${name}`));
  });
});
