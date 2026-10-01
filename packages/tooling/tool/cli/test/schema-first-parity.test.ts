import { lintCommand } from "@beep/repo-cli";
import {
  diffSchemaFirstParity,
  makeSchemaFirstEntryKey,
  SchemaFirstInventoryDocument,
  SchemaFirstInventoryEntry,
  SchemaFirstLintOptions,
  SchemaFirstParityFindings,
  SchemaFirstRender,
  schemaFirstParityEntriesFromSourceFile,
  toSchemaFirstBacklog,
} from "@beep/repo-cli/test/Lint";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, flow, Layer, Path, pipe, Result } from "effect";
import { Command } from "effect/cli";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { Project, SyntaxKind } from "ts-morph";
import { expectReportedExit } from "./support/CommandTest.ts";
import type { SourceFile } from "ts-morph";

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

// A project where `@beep/schema` resolves to declarations at the real SchemaUtils source paths, so
// detection runs through the checker rather than the unresolved-import fallback.
const schemaUtilsProject = () => {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { baseUrl: ".", paths: { "@beep/schema": ["packages/foundation/modeling/schema/src/index.ts"] } },
  });
  const schemaSource = "packages/foundation/modeling/schema/src";
  project.createSourceFile(`${schemaSource}/index.ts`, 'export * as SchemaUtils from "./SchemaUtils/index.ts";');
  project.createSourceFile(
    `${schemaSource}/SchemaUtils/index.ts`,
    A.join(
      [
        'export * from "./optionalKeyWithDefaults.ts";',
        'export * from "./withEncodeDefault.ts";',
        'export * from "./withKeyDefaults.ts";',
      ],
      "\n"
    )
  );
  project.createSourceFile(
    `${schemaSource}/SchemaUtils/optionalKeyWithDefaults.ts`,
    "export const optionalKeyWithDefault = <A>(value: A) => <S>(schema: S): S => schema;"
  );
  project.createSourceFile(
    `${schemaSource}/SchemaUtils/withEncodeDefault.ts`,
    A.join(
      [
        "export const withEncodeDefault = <S, A>(schema: S, thunk: () => A): S => schema;",
        "export const boolWithDefault = (value: boolean) => withEncodeDefault(value, () => value);",
      ],
      "\n"
    )
  );
  project.createSourceFile(
    `${schemaSource}/SchemaUtils/withKeyDefaults.ts`,
    A.join(
      [
        "export const boolKeyWithDefault = (value: boolean) => value;",
        "export const BoolKeyDefaultFalse = boolKeyWithDefault(false);",
      ],
      "\n"
    )
  );
  return project;
};

// The schema-package-relative files that declare the first identifier named `name` in a source file.
const declarationPathsOf =
  (sourceFile: SourceFile) =>
  (name: string): ReadonlyArray<string> =>
    pipe(
      sourceFile.getDescendantsOfKind(SyntaxKind.Identifier),
      A.findFirst((identifier) => identifier.getText() === name),
      O.flatMap((identifier) => O.fromUndefinedOr(identifier.getSymbol())),
      O.map((symbol) =>
        A.map(symbol.getDeclarations(), (declaration) =>
          Str.replace(/^.*\/modeling\/schema\//u, "")(declaration.getSourceFile().getFilePath())
        )
      ),
      O.getOrElse(A.empty<string>)
    );

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
  'import { boolKeyWithDefault as emptyTags } from "@beep/schema/SchemaUtils/withKeyDefaults";',
  'export class Widget extends S.Class<Widget>("Widget")({',
  "  title: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withEncodeDefault),",
  "  count: S.Finite.pipe(SchemaUtils.optionalKeyWithDefault(0)),",
  '  label: S.String.pipe(SchemaUtils.optionalKeyWithDefault("none")),',
  "  tags: S.Array(S.String).pipe(emptyTags()),",
  "}) {}",
];

// The same class after a formatter pass: wrapped arguments, trailing commas, comments, quote style.
const reformattedDefaultWrapperSource = [
  "// Reformatted: every occurrence moves down and its call is re-wrapped.",
  "",
  'import * as S from "effect/Schema";',
  "import { SchemaUtils } from '@beep/schema';",
  'import { boolKeyWithDefault as emptyTags } from "@beep/schema/SchemaUtils/withKeyDefaults";',
  "export const unrelated = 1;",
  'export class Widget extends S.Class<Widget>("Widget")({',
  "  title: S.OptionFromOptionalKey(",
  "    S.String, // the displayed title",
  "  ).pipe(",
  "    SchemaUtils.withEncodeDefault,",
  "  ),",
  "  count: S.Finite.pipe( SchemaUtils.optionalKeyWithDefault( 0 ) ),",
  "  label: S.String.pipe(SchemaUtils.optionalKeyWithDefault('none')),",
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
  ...A.map(arms, (arm) => `    S.OptionFromOptionalKey(${arm}).pipe(SchemaUtils.withEncodeDefault),`),
  "  ]),",
  "});",
];

it.layer(NodeServices.layer, { timeout: "30 seconds" })("SFV4-default-wrapper", (it) => {
  it.effect("flags SchemaUtils default wrappers through namespace and named imports", () =>
    Effect.gen(function* () {
      expect(readable(yield* parityEntries(defaultWrapperSource))).toEqual([
        "SFV4-default-wrapper Widget.title::withEncodeDefault@<hash>",
        "SFV4-default-wrapper Widget.count::optionalKeyWithDefault@<hash>",
        "SFV4-default-wrapper Widget.label::optionalKeyWithDefault@<hash>",
        "SFV4-default-wrapper Widget.tags::boolKeyWithDefault@<hash>",
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
          "const withEncodeDefault = <A>(schema: A): A => schema;",
          "export const Widget = S.Struct({",
          "  title: S.String.pipe(S.withConstructorDefault(Effect.succeed(''))),",
          "  enabled: SchemaUtils.BoolKeyDefaultFalse,",
          "  local: withEncodeDefault(S.String),",
          "  other: Local.withEncodeDefault(S.String),",
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
            'import { boolKeyWithDefault as emptyTags } from "@beep/schema/SchemaUtils/withKeyDefaults";',
            "export const fromParameter = (SchemaUtils: Record<string, unknown>) => SchemaUtils.withEncodeDefault;",
            "export const fromLocal = () => {",
            "  const emptyTags = () => S.String;",
            "  return emptyTags();",
            "};",
            "export const kept = S.Array(S.String).pipe(emptyTags());",
          ])
        )
      ).toEqual(["SFV4-default-wrapper kept::boolKeyWithDefault@<hash>"]);
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
            '  byElement: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils["withEncodeDefault"]),',
            "  byParens: S.OptionFromOptionalKey(S.Finite).pipe((SchemaUtils).withEncodeDefault),",
            "});",
          ])
        )
      ).toEqual([
        "SFV4-default-wrapper Widget.byElement::withEncodeDefault@<hash>",
        "SFV4-default-wrapper Widget.byParens::withEncodeDefault@<hash>",
      ]);
    })
  );

  it.effect("follows a barrel re-export to the @beep/schema declaration", () =>
    Effect.gen(function* () {
      const project = new Project({ useInMemoryFileSystem: true });
      project.createSourceFile(
        "packages/foundation/modeling/schema/src/SchemaUtils/withEncodeDefault.ts",
        "export const withEncodeDefault = <A>(schema: A): A => schema;"
      );
      project.createSourceFile(
        "packages/example/src/schema.ts",
        'export { withEncodeDefault } from "../../foundation/modeling/schema/src/SchemaUtils/withEncodeDefault";'
      );
      expect(
        readable(
          yield* parityEntriesIn(project, [
            'import * as S from "effect/Schema";',
            'import { withEncodeDefault } from "./schema";',
            "export const title = S.OptionFromOptionalKey(S.String).pipe(withEncodeDefault);",
          ])
        )
      ).toEqual(["SFV4-default-wrapper title::withEncodeDefault@<hash>"]);
    })
  );
  it.effect("names the upstream form for every live SchemaUtils default wrapper, resolved to its declaration", () =>
    Effect.gen(function* () {
      const project = schemaUtilsProject();
      const entries = yield* parityEntriesIn(project, [
        'import * as S from "effect/Schema";',
        'import { SchemaUtils } from "@beep/schema";',
        "export const Widget = S.Struct({",
        '  keyed: S.String.pipe(SchemaUtils.optionalKeyWithDefault("none")),',
        '  encoded: SchemaUtils.withEncodeDefault(S.String, () => "none"),',
        "  flag: SchemaUtils.boolWithDefault(false),",
        "  keyFlag: SchemaUtils.boolKeyWithDefault(true),",
        "  kept: SchemaUtils.BoolKeyDefaultFalse,",
        "});",
      ]);

      // Detection must come from the checker: every wrapper resolves to its SchemaUtils declaration.
      expect(
        A.map(
          ["optionalKeyWithDefault", "withEncodeDefault", "boolWithDefault", "boolKeyWithDefault"],
          declarationPathsOf(project.getSourceFileOrThrow(fixtureFile))
        )
      ).toEqual([
        ["src/SchemaUtils/optionalKeyWithDefaults.ts"],
        ["src/SchemaUtils/withEncodeDefault.ts"],
        ["src/SchemaUtils/withEncodeDefault.ts"],
        ["src/SchemaUtils/withKeyDefaults.ts"],
      ]);
      expect(readable(entries)).toEqual([
        "SFV4-default-wrapper Widget.keyed::optionalKeyWithDefault@<hash>",
        "SFV4-default-wrapper Widget.encoded::withEncodeDefault@<hash>",
        "SFV4-default-wrapper Widget.flag::boolWithDefault@<hash>",
        "SFV4-default-wrapper Widget.keyFlag::boolKeyWithDefault@<hash>",
      ]);
      expect(A.map(entries, (entry) => entry.reason)).toEqual([
        "SchemaUtils.optionalKeyWithDefault wraps an upstream schema default; use S.withDecodingDefaultTypeKey(Effect.succeed(value)) directly so the default stays on Effect's own combinators.",
        "SchemaUtils.withEncodeDefault wraps an upstream schema default; use S.withDecodingDefaultTypeKey(Effect.sync(thunk)) directly so the default stays on Effect's own combinators.",
        "SchemaUtils.boolWithDefault wraps an upstream schema default; use S.Boolean.pipe(S.withDecodingDefaultTypeKey(Effect.succeed(value))) directly so the default stays on Effect's own combinators.",
        "SchemaUtils.boolKeyWithDefault wraps an upstream schema default; use S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(value)), S.withDecodingDefaultTypeKey(Effect.succeed(value))) directly so the default stays on Effect's own combinators.",
      ]);
    })
  );

  it.effect("reaches SchemaUtils through a namespace import of the @beep/schema root", () =>
    Effect.gen(function* () {
      expect(
        readable(
          yield* parityEntries([
            'import * as S from "effect/Schema";',
            'import * as BeepSchema from "@beep/schema";',
            'import * as Opaque from "@beep/schema/Opaque";',
            "export const Widget = S.Struct({",
            "  byMember: S.OptionFromOptionalKey(S.String).pipe(BeepSchema.SchemaUtils.withEncodeDefault),",
            '  byElement: S.OptionFromOptionalKey(S.Finite).pipe(BeepSchema["SchemaUtils"].withEncodeDefault),',
            "  otherMember: S.OptionFromOptionalKey(S.String).pipe(BeepSchema.Other.withEncodeDefault),",
            "  computedMember: S.OptionFromOptionalKey(S.String).pipe(BeepSchema[key].withEncodeDefault),",
            "  notRoot: S.OptionFromOptionalKey(S.String).pipe(Opaque.SchemaUtils.withEncodeDefault),",
            "});",
          ])
        )
      ).toEqual([
        "SFV4-default-wrapper Widget.byMember::withEncodeDefault@<hash>",
        "SFV4-default-wrapper Widget.byElement::withEncodeDefault@<hash>",
      ]);
    })
  );

  it.effect("anchors a wrapper outside any named declaration at <module>", () =>
    Effect.gen(function* () {
      expect(
        readable(
          yield* parityEntries([
            'import * as S from "effect/Schema";',
            'import { SchemaUtils } from "@beep/schema";',
            "void S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withEncodeDefault);",
          ])
        )
      ).toEqual(["SFV4-default-wrapper <module>::withEncodeDefault@<hash>"]);
    })
  );
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("SFV4-codec-static", (it) => {
  it.effect("flags withCodecStatics and codec facades attached through withStatics, not other statics", () =>
    Effect.gen(function* () {
      expect(
        readable(
          yield* parityEntries([
            'import * as S from "effect/Schema";',
            'import { SchemaUtils } from "@beep/schema";',
            'export const Count = S.FiniteFromString.pipe(SchemaUtils.withCodecStatics(["is"]));',
            "export const Label = S.String.pipe(",
            "  SchemaUtils.withStatics((schema) => ({",
            "    decodeOption: S.decodeUnknownOption(schema),",
            '    empty: "",',
            "    shout: (value: string) => value.toUpperCase(),",
            "  }))",
            ");",
          ])
        )
      ).toEqual(["SFV4-codec-static Count::withCodecStatics@<hash>", "SFV4-codec-static Label::decodeOption@<hash>"]);
    })
  );

  it.effect("reads block-bodied callbacks, the effect Schema named import, and a named withStatics import", () =>
    Effect.gen(function* () {
      expect(
        readable(
          yield* parityEntries([
            'import { Schema } from "effect";',
            'import { withStatics } from "@beep/schema/SchemaUtils/withStatics";',
            "export const Flag = Schema.Boolean.pipe(",
            "  withStatics((schema) => {",
            "    const same = Schema.toEquivalence(schema);",
            "    return { same, guard: Schema.is(schema), keep: 1 };",
            "  })",
            ");",
          ])
        )
      ).toEqual(["SFV4-codec-static Flag::same@<hash>", "SFV4-codec-static Flag::guard@<hash>"]);
    })
  );

  it.effect("flags arrow-wrapped, curried and method codec facades", () =>
    Effect.gen(function* () {
      expect(
        readable(
          yield* parityEntries([
            'import * as S from "effect/Schema";',
            'import { SchemaUtils } from "@beep/schema";',
            "export const Version = S.String.pipe(",
            "  SchemaUtils.withStatics((schema) => ({",
            "    decodeOption: (input: unknown) => S.decodeUnknownOption(schema)(input),",
            "    parse(input: unknown) {",
            "      return S.decodeUnknownSync(schema)(input);",
            "    },",
            "    describe: (input: string) => `v${input}`,",
            "  }))",
            ");",
          ])
        )
      ).toEqual(["SFV4-codec-static Version::decodeOption@<hash>", "SFV4-codec-static Version::parse@<hash>"]);
    })
  );

  it.effect("ignores withStatics that does not come from @beep/schema and codec calls off other namespaces", () =>
    Effect.gen(function* () {
      expect(
        yield* parityEntries([
          'import * as S from "effect/Schema";',
          'import * as Local from "./local-statics";',
          'import { SchemaUtils } from "@beep/schema";',
          "const withStatics = <A>(value: A) => value;",
          "export const Local1 = S.String.pipe(Local.withStatics((schema) => ({ is: S.is(schema) })));",
          "export const Local2 = withStatics({ is: S.is(S.String) });",
          "export const Other = S.String.pipe(SchemaUtils.withStatics((schema) => ({ is: Local.is(schema) })));",
        ])
      ).toEqual([]);
    })
  );

  it.effect("resolves withStatics through the checker to the SchemaUtils declaration", () =>
    Effect.gen(function* () {
      const project = schemaUtilsProject();
      project.createSourceFile(
        "packages/foundation/modeling/schema/src/SchemaUtils/withStatics.ts",
        "export const withStatics = <S, M>(methods: (schema: S) => M) => (schema: S): S & M => Object.assign(schema as object, methods(schema)) as S & M;"
      );
      project
        .getSourceFileOrThrow("packages/foundation/modeling/schema/src/SchemaUtils/index.ts")
        .addExportDeclaration({ moduleSpecifier: "./withStatics.ts" });
      expect(
        readable(
          yield* parityEntriesIn(project, [
            'import * as S from "effect/Schema";',
            'import { SchemaUtils } from "@beep/schema";',
            "export const Named = S.String.pipe(SchemaUtils.withStatics((schema) => ({ encode: S.encodeUnknownSync(schema) })));",
          ])
        )
      ).toEqual(["SFV4-codec-static Named::encode@<hash>"]);
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

  it.effect("groups the backlog into rows sorted by file then rule, with sorted anchors", () =>
    Effect.sync(() => {
      const entry = (file: string, ruleId: "SFV4-default-wrapper" | "SFV4-opaque-wrapper", occurrence: string) =>
        SchemaFirstInventoryEntry.make({
          file,
          symbol: "Widget",
          kind: "schema-policy-advisory",
          status: "advisory",
          ruleId,
          occurrence,
          owner: "@beep/example",
          reason: "parity occurrence",
        });

      const rows = toSchemaFirstBacklog([
        entry("packages/b/src/B.ts", "SFV4-default-wrapper", "Widget::withEncodeDefault@bbbbbbbbbbbb"),
        entry("packages/a/src/A.ts", "SFV4-opaque-wrapper", "Widget::Defect@aaaaaaaaaaaa"),
        entry("packages/a/src/A.ts", "SFV4-default-wrapper", "Widget::withEncodeDefault@cccccccccccc"),
        entry("packages/a/src/A.ts", "SFV4-default-wrapper", "Widget::boolWithDefault@111111111111"),
      ]);

      expect(A.map(rows, (row) => [row.file, row.ruleId, row.occurrences])).toEqual([
        [
          "packages/a/src/A.ts",
          "SFV4-default-wrapper",
          ["Widget::boolWithDefault@111111111111", "Widget::withEncodeDefault@cccccccccccc"],
        ],
        ["packages/a/src/A.ts", "SFV4-opaque-wrapper", ["Widget::Defect@aaaaaaaaaaaa"]],
        ["packages/b/src/B.ts", "SFV4-default-wrapper", ["Widget::withEncodeDefault@bbbbbbbbbbbb"]],
      ]);
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
        "  note: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withEncodeDefault),",
        "}) {}",
      ]);

      const growth = diffSchemaFirstParity(grown, toSchemaFirstBacklog(base));
      expect(readable(growth.introduced)).toEqual(["SFV4-default-wrapper Extra.note::withEncodeDefault@<hash>"]);
      expect(growth.resolved).toEqual([]);

      const shrink = diffSchemaFirstParity(base, toSchemaFirstBacklog(grown));
      expect(shrink.introduced).toEqual([]);
      expect(A.map(shrink.rules, (rule) => [rule.ruleId, rule.live, rule.baseline, rule.resolved])).toEqual([
        ["SFV4-default-wrapper", 4, 5, 1],
        ["SFV4-opaque-wrapper", 0, 0, 0],
        ["SFV4-codec-static", 0, 0, 0],
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
  "  note: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withEncodeDefault),",
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
            )(line) && Str.includes('"symbol":"Widget.title","occurrence":"Widget.title::withEncodeDefault@')(line)
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
      expect(A.some(grown.errorLines, Str.includes(":: Extra.note::withEncodeDefault@"))).toBe(true);
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

const unanchoredEntry = SchemaFirstInventoryEntry.make({
  file: fixtureFile,
  symbol: "Widget",
  kind: "schema-policy-advisory",
  status: "candidate",
  owner: "@beep/example",
  reason: "Legacy entry without a rule, line, or anchor.",
});

it.layer(TestConsole.layer, { timeout: "30 seconds" })("schema-first parity rendering", (it) => {
  it.effect("keys an anchored entry without a rule id under an empty rule", () =>
    Effect.sync(() => {
      expect(
        makeSchemaFirstEntryKey(
          SchemaFirstInventoryEntry.make({ ...unanchoredEntry, occurrence: "Widget::withEncodeDefault@0123456789ab" })
        )
      ).toBe(`${fixtureFile}::::Widget::withEncodeDefault@0123456789ab`);
    })
  );

  it.effect("renders an introduced entry without a rule, line, or anchor with neutral fallbacks", () =>
    Effect.gen(function* () {
      const input = yield* SchemaFirstRender.parityRatchetInput(
        SchemaFirstParityFindings.make({
          introduced: [unanchoredEntry],
          resolved: [],
          rules: [],
          liveCount: 1,
          baselineCount: 0,
        }),
        SchemaFirstLintOptions.make({})
      );
      const [regression] = input.regressions;

      expect(regression?.present).toBe(true);
      expect(regression?.lines).toContain(
        `- ${fixtureFile}:0 :: Widget [] Legacy entry without a rule, line, or anchor.`
      );
      expect(A.some(regression?.lines ?? [], Str.includes('"ruleId":"schema-first-inventory"'))).toBe(true);
    })
  );

  it.effect("lists stale inventory entries with a policy finding each", () =>
    Effect.gen(function* () {
      yield* SchemaFirstRender.logStaleEntries([unanchoredEntry]);
      const errorLines = consoleLines(yield* TestConsole.errorLines);

      expect(errorLines).toContain("[schema-first] stale inventory entries:");
      expect(errorLines).toContain(`- ${fixtureFile} :: Widget [schema-policy-advisory]`);
    })
  );
});
