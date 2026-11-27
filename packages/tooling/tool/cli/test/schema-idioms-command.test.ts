import { SCHEMA_INDEX_DIRECTORY, schemaIdiomsCommand } from "@beep/repo-cli/commands/SchemaIdioms";
import { findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { expectReportedExit, NodeTestLayer, temporaryWorkingDirectory } from "./support/CommandTest.ts";

const TestLayer = TestConsole.layer.pipe(Layer.provideMerge(NodeTestLayer));

const runSchemaIdioms = Command.runWith(schemaIdiomsCommand, { version: "0.0.0" });

const consoleMark = Effect.all(
  [Effect.map(TestConsole.logLines, A.length), Effect.map(TestConsole.errorLines, A.length)],
  { concurrency: 1 }
);

const printedSince = Effect.fn(function* ([logMark, errorMark]: readonly [number, number]) {
  const logs = yield* TestConsole.logLines;
  const errors = yield* TestConsole.errorLines;
  return A.join(A.map(A.appendAll(A.drop(logs, logMark), A.drop(errors, errorMark)), String), "\n");
});

const run = Effect.fn(function* (args: ReadonlyArray<string>) {
  const mark = yield* consoleMark;
  yield* runSchemaIdioms(args);
  return yield* printedSince(mark);
});

const runFailing = Effect.fn(function* (args: ReadonlyArray<string>) {
  const mark = yield* consoleMark;
  const exit = yield* Effect.exit(runSchemaIdioms(args));
  expectReportedExit(exit);
  return yield* printedSince(mark);
});

const fixtureRepository = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const root = yield* temporaryWorkingDirectory;
  yield* fs.writeFileString(path.join(root, "bun.lock"), "{}\n");
  yield* fs.makeDirectory(path.join(root, "node_modules"), { recursive: true });
  yield* fs.symlink(path.join(repoRoot, "node_modules", "effect"), path.join(root, "node_modules", "effect"));
  return root;
});

it.layer(TestLayer, { timeout: "180 seconds" })((it) => {
  it.effect("summarises, writes, checks and looks up the index of the installed effect", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fixtureRepository;
      const summary = yield* run(["index"]);
      expect(Str.split(summary, "\n")).toHaveLength(8);
      expect(summary).toMatch(/^wire-string\.md: \d+ entries$/m);
      const firstWrite = yield* run(["index", "--write"]);
      expect(firstWrite).toContain(`missing: ${SCHEMA_INDEX_DIRECTORY}/README.md`);
      expect(firstWrite).toContain("schema-idioms index: wrote 9 file(s).");
      const secondWrite = yield* run(["index", "--write"]);
      const check = yield* run(["index", "--check"]);
      expect([secondWrite, check]).toEqual(["schema-idioms index: already current.", "schema-idioms index: current."]);
      const lookup = yield* run(["lookup", "number"]);
      expect(lookup).toMatch(/^# effect\/Schema index: number on the wire/);
      expect(lookup).toContain("- S.DurationFromMillis");
      const directory = path.join(root, SCHEMA_INDEX_DIRECTORY);
      yield* fs.writeFileString(path.join(directory, "wire-date.md"), "# edited by hand\n");
      yield* fs.writeFileString(path.join(directory, "stale.md"), "# stale\n");
      const failedCheck = yield* runFailing(["index", "--check"]);
      expect(failedCheck).toBe(
        A.join(
          [
            `extra: ${SCHEMA_INDEX_DIRECTORY}/stale.md`,
            `changed: ${SCHEMA_INDEX_DIRECTORY}/wire-date.md`,
            "beep schema-idioms index --check: the committed index differs from the installed effect; run bun run beep schema-idioms index --write",
          ],
          "\n"
        )
      );
    }).pipe(Effect.scoped)
  );

  it.effect("refuses --write with --check, hints a file and prints usage for the bare group", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fixtureRepository;
      const refused = yield* runFailing(["index", "--write", "--check"]);
      expect(refused).toBe("beep schema-idioms index: pass --write or --check, not both.");
      yield* fs.writeFileString(
        "Wire.ts",
        'import * as S from "effect/Schema";\nexport const W = S.Struct({ port: S.Int });\n'
      );
      const hinted = yield* run(["hint", "Wire.ts"]);
      expect(hinted).toContain("L2 port: the name reads as a port");
      yield* fs.writeFileString(
        "Wire.ts",
        'import * as S from "effect/Schema";\nexport const W = S.Struct({ port: S.Port });\n'
      );
      const quiet = yield* run(["hint", "Wire.ts"]);
      expect(quiet).toBe("[schema-idiom] No hints.");
      const usage = yield* run([]);
      expect(usage).toContain("effect/Schema idiom commands:");
      expect(usage).toContain("- bun run beep schema-idioms hint <file>");
    }).pipe(Effect.scoped)
  );
});
