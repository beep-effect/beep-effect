// The `.` entry never reaches the `./testing` cluster or the Node sync preset.
// The walk follows every specifier SourceBoundary reads, type-only imports
// included, over the package sources Vite's raw glob import inlines, so the
// suite needs no filesystem.
import { WorkspaceEnumerationDepthError } from "@beep/repo-workspaces";
import { SourceBoundary } from "@beep/repo-workspaces/testing";
import { WorkspaceEnumerationDepthError as SyncDepthError } from "@beep/repo-workspaces/WorkspacesSync";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { hostPath } from "./support/hostPath.ts";
import { sourceTexts } from "./support/sourceGraph.ts";

/** Every relative import of a module, resolved to its `src`-relative path. */
const importsOf = (module: string): ReadonlyArray<string> =>
  A.map(
    A.filter(SourceBoundary.importSpecifiers(O.getOrElse(R.get(sourceTexts, module), () => "")), Str.startsWith(".")),
    (specifier) => hostPath.posix.join(hostPath.posix.dirname(module), Str.replace(/\.js$/, ".ts")(specifier))
  );

/** Every module reachable from an entrypoint, transitively. */
const reachableFrom = (entry: string): ReadonlyArray<string> => {
  const seen = MutableHashSet.empty<string>();
  let frontier: ReadonlyArray<string> = [entry];
  while (A.isReadonlyArrayNonEmpty(frontier)) {
    for (const module of frontier) MutableHashSet.add(seen, module);
    frontier = A.filter(A.flatMap(frontier, importsOf), (module) => !MutableHashSet.has(seen, module));
  }
  return A.fromIterable(seen);
};

const TESTING_ONLY =
  /^(testing|SourceBoundary|LayerPolicy|WorkspaceLayering|PackedInstall|internal\/sourceText|internal\/packedInstallPlan|internal\/dependencyFields)\.ts$/;

describe("entrypoint boundary", () => {
  it("exports the synchronous enumeration depth error from the main entrypoint", () => {
    assert.strictEqual(WorkspaceEnumerationDepthError, SyncDepthError);
  });

  it("nothing reachable from `.` belongs to ./testing", () => {
    const offenders = A.filter(reachableFrom("index.ts"), (module) => TESTING_ONLY.test(module));
    assert.deepStrictEqual(offenders, [], "repo-shape checks belong behind ./testing");
  });

  it("nothing reachable from `.` is ./node-sync", () => {
    assert.deepStrictEqual(
      A.filter(reachableFrom("index.ts"), (module) => module === "node-sync.ts"),
      []
    );
  });

  it("positive control: ./testing DOES reach its modules", () => {
    const reachable = reachableFrom("testing.ts");
    assert.isAbove(reachable.length, 1, "the walker must actually resolve imports");
    for (const module of [
      "SourceBoundary",
      "internal/sourceText",
      "LayerPolicy",
      "WorkspaceLayering",
      "PackedInstall",
      "internal/packedInstallPlan",
      "internal/dependencyFields",
    ]) {
      assert.include(reachable, `${module}.ts`, module);
    }
  });

  it("the walker resolves the main entry's modules, or it proves nothing", () => {
    assert.include(reachableFrom("index.ts"), "WorkspaceDiscovery.ts");
  });
});
