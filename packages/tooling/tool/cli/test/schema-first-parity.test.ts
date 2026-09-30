import { lintCommand } from "@beep/repo-cli";
import {
  diffSchemaFirstParity,
  makeSchemaFirstEntryKey,
  SchemaFirstInventoryDocument,
  schemaFirstParityEntriesFromSourceFile,
  toSchemaFirstBacklog,
} from "@beep/repo-cli/test/Lint";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, flow, Layer, Path, Result } from "effect";
import { Command } from "effect/cli";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { Project } from "ts-morph";
import { expectReportedExit } from "./support/CommandTest.ts";
import type { SchemaFirstInventoryEntry } from "@beep/repo-cli/test/Lint";

const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const fixtureFile = "packages/example/src/Example.ts";

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provide(NodeServices.layer))
);

const parityEntriesIn = (project: Project, sourceLines: ReadonlyArray<string>) =>
  schemaFirstParityEntriesFromSourceFile(project.createSourceFile(fixtureFile, A.join(sourceLines, "\n")), {
    file: fixtureFile,
    owner: "@beep/example",
  });

const parityEntries = (sourceLines: ReadonlyArray<string>) =>
  parityEntriesIn(new Project({ useInMemoryFileSystem: true }), sourceLines);

// Anchors end in a content hash; tests compare the readable part and check the hash separately.
const readable = (entries: ReadonlyArray<SchemaFirstInventoryEntry>): ReadonlyArray<string> =>
  A.map(
    entries,
    (entry) => `${entry.ruleId ?? ""} ${Str.replace(/@[0-9a-f]{12}/u, "@<hash>")(entry.occurrence ?? "")}`
  );

const anchors = (entries: ReadonlyArray<SchemaFirstInventoryEntry>): ReadonlyArray<string> =>
  A.map(entries, (entry) => entry.occurrence ?? "");

const defaultWrapperSource = [
  'import * as S from "effect/Schema";',
  'import { SchemaUtils } from "@beep/schema";',
  'import { withEmptyArrayDefaults as emptyTags } from "@beep/schema/SchemaUtils/withKeyDefaults";',
  'export class Widget extends S.Class<Widget>("Widget")({',
  "  title: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),",
  "  count: S.Finite.pipe(SchemaUtils.withKeyDefaults(0)),",
  '  label: S.String.pipe(SchemaUtils.withKeyDefaults("none")),',
  "  tags: S.Array(S.String).pipe(emptyTags()),",
  "}) {}",
];

// The same class after a formatter pass: wrapped arguments, trailing commas, comments, quote style.
const reformattedDefaultWrapperSource = [
  "// Reformatted: every occurrence moves down and its call is re-wrapped.",
  "",
  'import * as S from "effect/Schema";',
  "import { SchemaUtils } from '@beep/schema';",
  'import { withEmptyArrayDefaults as emptyTags } from "@beep/schema/SchemaUtils/withKeyDefaults";',
  "export const unrelated = 1;",
  'export class Widget extends S.Class<Widget>("Widget")({',
  "  title: S.OptionFromOptionalKey(",
  "    S.String, // the displayed title",
  "  ).pipe(",
  "    SchemaUtils.withNoneDefault,",
  "  ),",
  "  count: S.Finite.pipe( SchemaUtils.withKeyDefaults( 0 ) ),",
  "  label: S.String.pipe(SchemaUtils.withKeyDefaults('none')),",
  "  tags: S.Array(S.String).pipe(",
  "    /* no tags by default */ emptyTags(),",
  "  ),",
  "}) {}",
];

const unionSource = (arms: ReadonlyArray<string>) => [
  'import * as S from "effect/Schema";',
  'import { SchemaUtils } from "@beep/schema";',
  "export const Widget = S.Struct({",
  "  value: S.Union([",
  ...A.map(arms, (arm) => `    S.OptionFromOptionalKey(${arm}).pipe(SchemaUtils.withNoneDefault),`),
  "  ]),",
  "});",
];

it.layer(NodeServices.layer, { timeout: "30 seconds" })("SFV4-default-wrapper", (it) => {
  it.effect("flags SchemaUtils default wrappers through namespace and named imports", () =>
    Effect.gen(function* () {
      expect(readable(yield* parityEntries(defaultWrapperSource))).toEqual([
        "SFV4-default-wrapper Widget.title::withNoneDefault@<hash>",
        "SFV4-default-wrapper Widget.count::withKeyDefaults@<hash>",
        "SFV4-default-wrapper Widget.label::withKeyDefaults@<hash>",
        "SFV4-default-wrapper Widget.tags::withEmptyArrayDefaults@<hash>",
      ]);
    })
  );

  it.effect("ignores upstream combinators, kept BoolKeyDefault constants, and same-named locals", () =>
    Effect.gen(function* () {
      expect(
        yield* parityEntries([
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
    })
  );

  it.effect("resolves bindings: a shadowing parameter or local is not the imported wrapper", () =>
    Effect.gen(function* () {
      expect(
        readable(
          yield* parityEntries([
            'import * as S from "effect/Schema";',
            'import { SchemaUtils } from "@beep/schema";',
            'import { withEmptyArrayDefaults as emptyTags } from "@beep/schema/SchemaUtils/withKeyDefaults";',
            "export const fromParameter = (SchemaUtils: Record<string, unknown>) => SchemaUtils.withNoneDefault;",
            "export const fromLocal = () => {",
            "  const emptyTags = () => S.String;",
            "  return emptyTags();",
            "};",
            "export const kept = S.Array(S.String).pipe(emptyTags());",
          ])
        )
      ).toEqual(["SFV4-default-wrapper kept::withEmptyArrayDefaults@<hash>"]);
    })
  );

  it.effect("flags element-access and parenthesized receivers", () =>
    Effect.gen(function* () {
      expect(
        readable(
          yield* parityEntries([
            'import * as S from "effect/Schema";',
            'import { SchemaUtils } from "@beep/schema";',
            "export const Widget = S.Struct({",
            '  byElement: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils["withNoneDefault"]),',
            "  byParens: S.OptionFromOptionalKey(S.Finite).pipe((SchemaUtils).withNoneDefault),",
            "});",
          ])
        )
      ).toEqual([
        "SFV4-default-wrapper Widget.byElement::withNoneDefault@<hash>",
        "SFV4-default-wrapper Widget.byParens::withNoneDefault@<hash>",
      ]);
    })
  );

  it.effect("follows a barrel re-export to the @beep/schema declaration", () =>
    Effect.gen(function* () {
      const project = new Project({ useInMemoryFileSystem: true });
      project.createSourceFile(
        "packages/foundation/modeling/schema/src/SchemaUtils/withConstructorDefaults.ts",
        "export const withNoneDefault = <A>(schema: A): A => schema;"
      );
      project.createSourceFile(
        "packages/example/src/schema.ts",
        'export { withNoneDefault } from "../../foundation/modeling/schema/src/SchemaUtils/withConstructorDefaults";'
      );
      expect(
        readable(
          yield* parityEntriesIn(project, [
            'import * as S from "effect/Schema";',
            'import { withNoneDefault } from "./schema";',
            "export const title = S.OptionFromOptionalKey(S.String).pipe(withNoneDefault);",
          ])
        )
      ).toEqual(["SFV4-default-wrapper title::withNoneDefault@<hash>"]);
    })
  );
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("SFV4-opaque-wrapper", (it) => {
  it.effect("flags Defect and OpaqueUnknown imported from @beep/schema but not native S.Defect", () =>
    Effect.gen(function* () {
      expect(
        readable(
          yield* parityEntries([
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
        "SFV4-opaque-wrapper WidgetError.cause::Defect@<hash>",
        "SFV4-opaque-wrapper WidgetError.payload::OpaqueUnknown@<hash>",
      ]);
    })
  );

  it.effect("treats a namespace import of the Opaque module like the SchemaUtils namespace", () =>
    Effect.gen(function* () {
      expect(
        readable(
          yield* parityEntries([
            'import * as S from "effect/Schema";',
            'import * as Opaque from "@beep/schema/Opaque";',
            "export const WidgetFailure = S.Struct({ cause: Opaque.Defect({ includeStack: true }) });",
          ])
        )
      ).toEqual(["SFV4-opaque-wrapper WidgetFailure.cause::Defect@<hash>"]);
    })
  );

  it.effect("ignores a Defect binding that does not come from @beep/schema", () =>
    Effect.gen(function* () {
      expect(
        yield* parityEntries([
          'import { Defect } from "./local-defect";',
          'import * as S from "effect/Schema";',
          "export const WidgetFailure = S.Struct({ cause: Defect() });",
        ])
      ).toEqual([]);
    })
  );
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("parity occurrence identity", (it) => {
  it.effect("keeps every anchor and membership key across line shifts and reformatting", () =>
    Effect.gen(function* () {
      const original = yield* parityEntries(defaultWrapperSource);
      const reformatted = yield* parityEntries(reformattedDefaultWrapperSource);

      expect(anchors(reformatted)).toEqual(anchors(original));
      expect(A.map(reformatted, (entry) => entry.line)).not.toEqual(A.map(original, (entry) => entry.line));
      expect(A.map(reformatted, makeSchemaFirstEntryKey)).toEqual(A.map(original, makeSchemaFirstEntryKey));

      const findings = diffSchemaFirstParity(reformatted, toSchemaFirstBacklog(original));
      expect(findings.introduced).toEqual([]);
      expect(findings.resolved).toEqual([]);
    })
  );

  it.effect("removing the earlier of two wrappers on one path resolves it and keeps the survivor", () =>
    Effect.gen(function* () {
      const twins = yield* parityEntries(unionSource(["S.String", "S.Finite"]));
      const survivor = yield* parityEntries(unionSource(["S.Finite"]));
      const [removed, kept] = anchors(twins);

      expect(A.length(A.dedupe(anchors(twins)))).toBe(2);
      expect(anchors(survivor)).toEqual([kept]);

      const findings = diffSchemaFirstParity(survivor, toSchemaFirstBacklog(twins));
      expect(findings.introduced).toEqual([]);
      expect(A.flatMap(findings.resolved, (row) => row.occurrences)).toEqual([removed]);
    })
  );

  it.effect("inserting a wrapper above an existing one flags only the new call", () =>
    Effect.gen(function* () {
      const before = yield* parityEntries(unionSource(["S.Finite"]));
      const after = yield* parityEntries(unionSource(["S.Boolean", "S.Finite"]));

      const findings = diffSchemaFirstParity(after, toSchemaFirstBacklog(before));
      expect(A.map(findings.introduced, (entry) => entry.line)).toEqual([5]);
      expect(anchors(findings.introduced)).not.toEqual(anchors(before));
      expect(findings.resolved).toEqual([]);
    })
  );

  it.effect("falls back to #n only for byte-identical calls on one path", () =>
    Effect.gen(function* () {
      const [first, second] = anchors(yield* parityEntries(unionSource(["S.String", "S.String"])));

      expect(second).toBe(`${first}#2`);
    })
  );

  it.effect("reports growth as introduced and removal as resolved per rule", () =>
    Effect.gen(function* () {
      const base = yield* parityEntries(defaultWrapperSource);
      const grown = yield* parityEntries([
        ...defaultWrapperSource,
        'export class Extra extends S.Class<Extra>("Extra")({',
        "  note: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),",
        "}) {}",
      ]);

      const growth = diffSchemaFirstParity(grown, toSchemaFirstBacklog(base));
      expect(readable(growth.introduced)).toEqual(["SFV4-default-wrapper Extra.note::withNoneDefault@<hash>"]);
      expect(growth.resolved).toEqual([]);

      const shrink = diffSchemaFirstParity(base, toSchemaFirstBacklog(grown));
      expect(shrink.introduced).toEqual([]);
      expect(A.map(shrink.rules, (rule) => [rule.ruleId, rule.live, rule.baseline, rule.resolved])).toEqual([
        ["SFV4-default-wrapper", 4, 5, 1],
        ["SFV4-opaque-wrapper", 0, 0, 0],
      ]);
    })
  );
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

const decodeInventory = S.decodeUnknownEffect(S.fromJsonString(SchemaFirstInventoryDocument));

const backlogAnchors = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const inventory = yield* decodeInventory(yield* fs.readFileString("standards/schema-first.inventory.jsonc"));
  return A.flatMap(inventory.backlog, (row) => row.occurrences);
});

const grownDefaultWrapperSource = [
  ...defaultWrapperSource,
  'export class Extra extends S.Class<Extra>("Extra")({',
  "  note: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),",
  "}) {}",
];

it.layer(testLayer, { timeout: "60 seconds" })("schema-first parity ratchet command", (it) => {
  it.effect("fails the check on an occurrence outside the committed backlog, keyed by its anchor", () =>
    Effect.gen(function* () {
      yield* enterTempWorkingDirectory;
      yield* writeFixture(defaultWrapperSource);

      const run = yield* runSchemaFirst([]);

      expectReportedExit(run.exit);
      expect(run.logLines).toContain(
        "[schema-first] sfv4_default_wrapper_occurrences=4 baseline=0 introduced=4 resolved=0"
      );
      expect(run.errorLines).toContain(
        "[schema-first] parity ratchet: 4 new occurrence(s) outside the committed backlog:"
      );
      expect(
        A.some(
          run.errorLines,
          (line) =>
            Str.startsWith(
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-default-wrapper","severity":"error"'
            )(line) && Str.includes('"symbol":"Widget.title","occurrence":"Widget.title::withNoneDefault@')(line)
        )
      ).toBe(true);
    })
  );

  it.effect("--write only shrinks the backlog; --admit-parity-backlog is the only way to grow it", () =>
    Effect.gen(function* () {
      yield* enterTempWorkingDirectory;
      yield* writeFixture(defaultWrapperSource);

      const refused = yield* runSchemaFirst(["--write"]);
      expectReportedExit(refused.exit);
      expect(yield* backlogAnchors).toEqual([]);

      const admitted = yield* runSchemaFirst(["--write", "--admit-parity-backlog"]);
      expect(admitted.errorLines).toEqual([]);
      expect(admitted.logLines).toContain(
        "[schema-first] parity backlog admitted: occurrences=4 previous_baseline=0 admitted=4"
      );
      const captured = yield* backlogAnchors;
      expect(A.length(captured)).toBe(4);

      yield* writeFixture(reformattedDefaultWrapperSource);
      const reformatted = yield* runSchemaFirst([]);
      expect(reformatted.errorLines).toEqual([]);
      expect(reformatted.logLines).toContain(
        "[schema-first] parity ratchet ok: current=4 baseline=4 introduced=0 resolved=0"
      );

      yield* writeFixture(grownDefaultWrapperSource);
      const grown = yield* runSchemaFirst(["--write"]);
      expectReportedExit(grown.exit);
      expect(A.some(grown.errorLines, Str.includes(":: Extra.note::withNoneDefault@"))).toBe(true);
      expect(yield* backlogAnchors).toEqual(captured);

      yield* writeFixture(A.filter(defaultWrapperSource, (line) => !Str.startsWith("  count:")(line)));
      const shrunk = yield* runSchemaFirst([]);
      expect(shrunk.errorLines).toEqual([]);
      expect(shrunk.logLines).toContain(
        "[schema-first] tighten-baseline: 1 parity occurrence(s) resolved; run `bun run beep lint schema-first --write` to shrink the committed backlog."
      );

      const tightened = yield* runSchemaFirst(["--write"]);
      expect(tightened.errorLines).toEqual([]);
      expect(tightened.logLines).toContain(
        "[schema-first] parity backlog written: occurrences=3 previous_baseline=4 dropped=1"
      );
      expect(A.length(yield* backlogAnchors)).toBe(3);
    })
  );
});
