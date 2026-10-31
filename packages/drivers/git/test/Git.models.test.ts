import * as Root from "@beep/git";
import * as Facade from "@beep/git/Git";
import * as Models from "@beep/git/Git.models";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const cases = A.make(
  { name: "LsTreeEntry", root: Root.LsTreeEntry, facade: Facade.LsTreeEntry, owner: Models.LsTreeEntry },
  {
    name: "NameStatusEntry",
    root: Root.NameStatusEntry,
    facade: Facade.NameStatusEntry,
    owner: Models.NameStatusEntry,
  },
  { name: "CommitInfo", root: Root.CommitInfo, facade: Facade.CommitInfo, owner: Models.CommitInfo },
  { name: "CommitLogEntry", root: Root.CommitLogEntry, facade: Facade.CommitLogEntry, owner: Models.CommitLogEntry },
  {
    name: "StatusRenderOptions",
    root: Root.StatusRenderOptions,
    facade: Facade.StatusRenderOptions,
    owner: Models.StatusRenderOptions,
  },
  { name: "StatusEntry", root: Root.StatusEntry, facade: Facade.StatusEntry, owner: Models.StatusEntry },
  {
    name: "SubmoduleStatusEntry",
    root: Root.SubmoduleStatusEntry,
    facade: Facade.SubmoduleStatusEntry,
    owner: Models.SubmoduleStatusEntry,
  },
  { name: "LsRemoteEntry", root: Root.LsRemoteEntry, facade: Facade.LsRemoteEntry, owner: Models.LsRemoteEntry },
  { name: "StashEntry", root: Root.StashEntry, facade: Facade.StashEntry, owner: Models.StashEntry },
  { name: "BranchEntry", root: Root.BranchEntry, facade: Facade.BranchEntry, owner: Models.BranchEntry },
  { name: "RefEntry", root: Root.RefEntry, facade: Facade.RefEntry, owner: Models.RefEntry },
  {
    name: "ConfigListEntry",
    root: Root.ConfigListEntry,
    facade: Facade.ConfigListEntry,
    owner: Models.ConfigListEntry,
  },
  { name: "WorktreeEntry", root: Root.WorktreeEntry, facade: Facade.WorktreeEntry, owner: Models.WorktreeEntry },
  { name: "LsFilesEntry", root: Root.LsFilesEntry, facade: Facade.LsFilesEntry, owner: Models.LsFilesEntry }
);

describe.each(cases)("$name model import compatibility", ({ name, root, facade, owner }) => {
  it("retains one constructor and its original Git identity at both public facades", () => {
    expect(root).toBe(owner);
    expect(facade).toBe(owner);
    const annotations = S.resolveAnnotations(owner);
    expect(annotations?.identifier).toBe(`@beep/git/Git/${name}`);
    expect(annotations?.schemaId).toBe(Symbol.for(`@beep/git/Git/${name}`));
  });
});
