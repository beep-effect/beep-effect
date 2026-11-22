// Receipt of a deep property sweep (BEEP_FC_NUM_RUNS > 0 only; see `propertySweepSelection` in
// vitest.shared.ts): which property files this Vitest run executed and how many tests of each ran,
// under `<package>/.beep/property-sweep/`. The unfiltered property lane compares it with the files
// it expected (`CiPropertySweep` in @beep/repo-cli), so a file that did not run is a failure.
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import type { Reporter, TestModule } from "vitest/node";

const Receipt = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("property-sweep/v1"),
    files: S.Array(S.Struct({ file: S.String, executed: S.Int })),
  })
);

const executedTests = (module: TestModule): number =>
  A.length(
    A.filter(A.fromIterable(module.children.allTests()), (test) => {
      const { state } = test.result();
      return state === "passed" || state === "failed";
    })
  );

const writeReceipt = Effect.fnUntraced(function* (modules: ReadonlyArray<TestModule>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(process.cwd(), ".beep", "property-sweep");
  const text = yield* S.encodeEffect(Receipt)({
    schemaVersion: "property-sweep/v1",
    files: A.map(modules, (module) => ({ file: module.relativeModuleId, executed: executedTests(module) })),
  });
  yield* fs.makeDirectory(directory, { recursive: true });
  yield* fs.writeFileString(path.join(directory, `${process.pid}.json`), text);
});

/** Vitest reporter of the deep property sweep: writes the receipt when the run ends. */
export default class PropertySweepReporter implements Reporter {
  onTestRunEnd(modules: ReadonlyArray<TestModule>): Promise<void> {
    return Effect.runPromise(writeReceipt(modules).pipe(Effect.provide(NodeServices.layer)));
  }
}
