import { lintCommand } from "@beep/repo-cli";
import {
  diffSchemaFirstParity,
  makeSchemaFirstEntryKey,
  schemaFirstParityEntriesFromSourceFile,
  toSchemaFirstBacklog,
} from "@beep/repo-cli/test/Lint";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import { Command } from "effect/cli";
import * as P from "effect/Predicate";
import * as TestConsole from "effect/testing/TestConsole";
import { Project } from "ts-morph";
import { expectReportedExit } from "./support/CommandTest.ts";
import type { SchemaFirstInventoryEntry } from "@beep/repo-cli/test/Lint";

const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const encodeJson = UnknownFromJsonString.encodeUnknownSync;
const fixtureFile = "packages/example/src/Example.ts";

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provide(NodeServices.layer))
);

const parityEntries = (sourceLines: ReadonlyArray<string>): ReadonlyArray<SchemaFirstInventoryEntry> =>
  schemaFirstParityEntriesFromSourceFile(
    new Project({ useInMemoryFileSystem: true }).createSourceFile(fixtureFile, A.join(sourceLines, "\n")),
    { file: fixtureFile, owner: "@beep/example" }
  );

const occurrences = (entries: ReadonlyArray<SchemaFirstInventoryEntry>): ReadonlyArray<string> =>
  A.map(entries, (entry) => `${entry.ruleId ?? ""} ${entry.occurrence ?? ""}`);

const defaultWrapperSource = [
  'import * as S from "effect/Schema";',
  'import { SchemaUtils } from "@beep/schema";',
  'import { withEmptyArrayDefaults as emptyTags } from "@beep/schema/SchemaUtils/withKeyDefaults";',
  'export class Widget extends S.Class<Widget>("Widget")({',
  "  title: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),",
  "  count: S.Finite.pipe(SchemaUtils.withKeyDefaults(0)),",
  "  tags: S.Array(S.String).pipe(emptyTags()),",
  "}) {}",
];

describe("SFV4-default-wrapper", () => {
  it("flags SchemaUtils default wrappers by export name through namespace and named imports", () => {
    expect(occurrences(parityEntries(defaultWrapperSource))).toEqual([
      "SFV4-default-wrapper Widget.title::withNoneDefault#1",
      "SFV4-default-wrapper Widget.count::withKeyDefaults#1",
      "SFV4-default-wrapper Widget.tags::withEmptyArrayDefaults#1",
    ]);
  });

  it("ignores upstream combinators, kept BoolKeyDefault constants, and same-named local helpers", () => {
    expect(
      parityEntries([
        'import * as S from "effect/Schema";',
        'import { Effect } from "effect";',
        'import { SchemaUtils } from "@beep/schema";',
        'import * as Local from "./local-defaults";',
        "const withNoneDefault = <A>(schema: A): A => schema;",
        "export const Widget = S.Struct({",
        "  title: S.String.pipe(S.withConstructorDefault(Effect.succeed(''))),",
        "  enabled: SchemaUtils.BoolKeyDefaultFalse,",
        "  local: withNoneDefault(S.String),",
        "  other: Local.withNoneDefault(S.String),",
        "});",
      ])
    ).toEqual([]);
  });

  it("numbers identical occurrences on one lexical path by document order", () => {
    expect(
      occurrences(
        parityEntries([
          'import * as S from "effect/Schema";',
          'import { SchemaUtils } from "@beep/schema";',
          "export const Widget = S.Struct({",
          "  value: S.Union([",
          "    S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),",
          "    S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),",
          "  ]),",
          "});",
        ])
      )
    ).toEqual([
      "SFV4-default-wrapper Widget.value::withNoneDefault#1",
      "SFV4-default-wrapper Widget.value::withNoneDefault#2",
    ]);
  });
});

describe("SFV4-opaque-wrapper", () => {
  it("flags Defect and OpaqueUnknown imported from @beep/schema but not native S.Defect", () => {
    expect(
      occurrences(
        parityEntries([
          'import * as S from "effect/Schema";',
          'import { Defect, OpaqueUnknown } from "@beep/schema";',
          'export class WidgetError extends S.TaggedErrorClass<WidgetError>()("WidgetError", {',
          "  cause: Defect(),",
          "  payload: OpaqueUnknown,",
          "  native: S.Defect(),",
          "}) {}",
        ])
      )
    ).toEqual([
      "SFV4-opaque-wrapper WidgetError.cause::Defect#1",
      "SFV4-opaque-wrapper WidgetError.payload::OpaqueUnknown#1",
    ]);
  });

  it("ignores a Defect binding that does not come from @beep/schema", () => {
    expect(
      parityEntries([
        'import { Defect } from "./local-defect";',
        'import * as S from "effect/Schema";',
        "export const WidgetFailure = S.Struct({ cause: Defect() });",
      ])
    ).toEqual([]);
  });
});

describe("parity occurrence identity", () => {
  it("keeps anchors and membership keys stable when lines shift", () => {
    const original = parityEntries(defaultWrapperSource);
    const shifted = parityEntries([
      "// A header comment and blank lines push every occurrence down.",
      "",
      "",
      "export const unrelated = 1;",
      ...defaultWrapperSource,
    ]);

    expect(occurrences(shifted)).toEqual(occurrences(original));
    expect(A.map(shifted, (entry) => entry.line)).not.toEqual(A.map(original, (entry) => entry.line));
    expect(A.map(shifted, makeSchemaFirstEntryKey)).toEqual(A.map(original, makeSchemaFirstEntryKey));

    const findings = diffSchemaFirstParity(shifted, toSchemaFirstBacklog(original));
    expect(findings.introduced).toEqual([]);
    expect(findings.resolved).toEqual([]);
  });

  it("introduces a new occurrence and resolves a removed one by membership", () => {
    const base = parityEntries(defaultWrapperSource);
    const grown = parityEntries([
      ...defaultWrapperSource,
      'export class Extra extends S.Class<Extra>("Extra")({',
      "  note: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),",
      "}) {}",
    ]);

    const growth = diffSchemaFirstParity(grown, toSchemaFirstBacklog(base));
    expect(occurrences(growth.introduced)).toEqual(["SFV4-default-wrapper Extra.note::withNoneDefault#1"]);
    expect(growth.resolved).toEqual([]);

    const shrink = diffSchemaFirstParity(base, toSchemaFirstBacklog(grown));
    expect(shrink.introduced).toEqual([]);
    expect(A.flatMap(shrink.resolved, (row) => row.occurrences)).toEqual(["Extra.note::withNoneDefault#1"]);
    expect(A.map(shrink.rules, (rule) => [rule.ruleId, rule.live, rule.baseline, rule.resolved])).toEqual([
      ["SFV4-default-wrapper", 3, 4, 1],
      ["SFV4-opaque-wrapper", 0, 0, 0],
    ]);
  });
});

// Each command test runs in its own temp working directory; closing the test scope restores
// the original directory before the temp directory is removed.
const enterTempWorkingDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped();
  const originalDirectory = process.cwd();
  yield* Effect.acquireRelease(
    Effect.sync(() => process.chdir(directory)),
    () => Effect.sync(() => process.chdir(originalDirectory))
  );
});

const writeFixture = Effect.fn("writeParityFixture")(function* (sourceLines: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.writeFileString(
    "package.json",
    `${encodeJson({ name: "@beep/test-root", private: true, type: "module", workspaces: ["packages/*"] })}\n`
  );
  yield* fs.writeFileString("tsconfig.json", `${encodeJson({ compilerOptions: { strictNullChecks: true } })}\n`);
  yield* fs.makeDirectory(path.dirname(fixtureFile), { recursive: true });
  yield* fs.writeFileString(fixtureFile, A.join(sourceLines, "\n"));
});

// Ratchet blocks print as one multi-line console entry; compare them line by line.
const consoleLines = (entries: ReadonlyArray<unknown>): ReadonlyArray<string> =>
  A.flatMap(A.filter(entries, P.isString), Str.split("\n"));

// Layer.fresh keeps each run's console capture apart from the outer test layer's memoized one.
const runSchemaFirst = Effect.fn("runSchemaFirst")(
  function* (args: ReadonlyArray<string>) {
    const exit = yield* Effect.exit(runLintCommand(["schema-first", ...args]));
    return {
      exit,
      logLines: consoleLines(yield* TestConsole.logLines),
      errorLines: consoleLines(yield* TestConsole.errorLines),
    };
  },
  provideScopedLayer(Layer.fresh(TestConsole.layer))
);

it.layer(testLayer, { timeout: "60 seconds" })("schema-first parity ratchet command", (it) => {
  it.effect("fails the check on an occurrence outside the committed backlog", () =>
    Effect.gen(function* () {
      yield* enterTempWorkingDirectory;
      yield* writeFixture(defaultWrapperSource);

      const run = yield* runSchemaFirst([]);

      expectReportedExit(run.exit);
      expect(run.logLines).toContain(
        "[schema-first] sfv4_default_wrapper_occurrences=3 baseline=0 introduced=3 resolved=0"
      );
      expect(run.errorLines).toContain(
        "[schema-first] parity ratchet: 3 new occurrence(s) outside the committed backlog:"
      );
      expect(
        A.some(
          run.errorLines,
          (line) =>
            Str.startsWith(
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-default-wrapper","severity":"error"'
            )(line) && Str.includes('"symbol":"Widget.title"')(line)
        )
      ).toBe(true);
    })
  );

  it.effect("ratchets on membership: shifted lines pass, growth fails, removal nudges a tighter backlog", () =>
    Effect.gen(function* () {
      yield* enterTempWorkingDirectory;
      const fs = yield* FileSystem.FileSystem;
      yield* writeFixture(defaultWrapperSource);

      const written = yield* runSchemaFirst(["--write"]);
      expect(written.errorLines).toEqual([]);
      const inventory = yield* fs.readFileString("standards/schema-first.inventory.jsonc");
      expect(inventory).toContain('"occurrences": [\n        "Widget.count::withKeyDefaults#1",');

      yield* writeFixture(["// shifted", "", "", ...defaultWrapperSource]);
      const shifted = yield* runSchemaFirst([]);
      expect(shifted.errorLines).toEqual([]);
      expect(shifted.logLines).toContain(
        "[schema-first] parity ratchet ok: current=3 baseline=3 introduced=0 resolved=0"
      );

      yield* writeFixture([
        ...defaultWrapperSource,
        'export class Extra extends S.Class<Extra>("Extra")({',
        "  note: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),",
        "}) {}",
      ]);
      const grown = yield* runSchemaFirst([]);
      expectReportedExit(grown.exit);
      expect(A.some(grown.errorLines, Str.includes(":: Extra.note [SFV4-default-wrapper]"))).toBe(true);

      yield* writeFixture(A.filter(defaultWrapperSource, (line) => !Str.startsWith("  count:")(line)));
      const shrunk = yield* runSchemaFirst([]);
      expect(shrunk.errorLines).toEqual([]);
      expect(shrunk.logLines).toContain(
        "[schema-first] tighten-baseline: 1 parity occurrence(s) resolved; run `bun run beep lint schema-first --write` to shrink the committed backlog."
      );
      expect(shrunk.logLines).toContain(`  - ${fixtureFile} :: Widget.count::withKeyDefaults#1 [SFV4-default-wrapper]`);
    })
  );
});
