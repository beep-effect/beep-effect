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

describe.each(cases)("$name import compatibility", ({ name, facade, owner }) => {
  it("retains one constructor and its original Git identity", () => {
    expect(facade).toBe(owner);
    const annotations = S.resolveAnnotations(owner);
    expect(annotations?.identifier).toBe(`@beep/git/Git/${name}`);
    expect(annotations?.schemaId).toBe(Symbol.for(`@beep/git/Git/${name}`));
  });
});
