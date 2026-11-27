import * as ImportGraph from "@beep/test-utils/ImportGraph";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Str from "effect/String";

const srcTextInlinedByVite = ImportGraph.fromGlob(
  import.meta.glob<string>("../../src/**/*.ts", { query: "?raw", import: "default", eager: true }),
  { prefix: "../../src/" }
);

/** The `src` modules and bare package specifiers reached from one entry module at runtime. */
export const runtimeClosureOf = (entry: string): ImportGraph.ImportClosure =>
  Effect.runSync(ImportGraph.closure({ sources: srcTextInlinedByVite, entry }));

const siblingDependencySources = import.meta.glob<string>(
  "../../../{identity,jsonc,npm-spec,semver,spdx}/src/**/*.ts",
  {
    query: "?raw",
    import: "default",
    eager: true,
  }
);

/** The dependency source files (keyed `<package>/src/...`) with a runtime edge into one of `specifiers`. */
export const dependencyModulesImporting = (
  specifiers: ReadonlyArray<string>
): { readonly scanned: ReadonlyArray<string>; readonly offending: ReadonlyArray<string> } => {
  const scanned = A.map(R.keys(siblingDependencySources), (key) => Str.replace("../../../", "")(key));
  const offending = A.filterMap(R.toEntries(siblingDependencySources), ([key, source]) =>
    A.some(ImportGraph.runtimeImportsOf(source), (specifier) => A.contains(specifiers, specifier))
      ? Result.succeed(Str.replace("../../../", "")(key))
      : Result.failVoid
  );
  return { scanned, offending };
};
