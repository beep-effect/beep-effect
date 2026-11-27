import {
  diffSchemaIndexFiles,
  extractSchemaIndex,
  hintSchemaIdiomsFile,
  jsDocSummary,
  normalizeTypeText,
  readSchemaIndexSlice,
  renderSchemaIndexFiles,
  SCHEMA_INDEX_DIRECTORY,
  SchemaIndexEntry,
  SchemaIndexFile,
  writeSchemaIndexFiles,
} from "@beep/repo-cli/commands/SchemaIdioms";
import { findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as SemVer from "effect/SemVer";
import * as Str from "effect/String";
import { NodeTestLayer } from "./support/CommandTest.ts";
import type { SchemaIndexDrift } from "@beep/repo-cli/commands/SchemaIdioms";

const STUB_MANIFEST = A.join(
  [
    "{",
    '  "name": "effect",',
    '  "version": "0.0.0-stub",',
    '  "exports": { "./*": { "types": "./dist/*.d.ts" } }',
    "}",
    "",
  ],
  "\n"
);

const STUB_DECLARATIONS: ReadonlyArray<readonly [string, string]> = [
  [
    "Schema",
    A.join(
      [
        'import type { Check } from "./SchemaAST.js";',
        "export interface Codec<T, E = T, RD = never, RE = never> {",
        "  readonly Type: T;",
        "  readonly Encoded: E;",
        "  readonly DecodingServices: RD;",
        "  readonly EncodingServices: RE;",
        "}",
        "export declare const String: Codec<string>;",
        "export declare const NumberFromString: Codec<number, string>;",
        "export declare function isMinLength(n: number): Check<string>;",
        "export declare function Struct<F>(fields: F): Codec<F>;",
        "export declare const annotations: { readonly a: 1 };",
        "export declare class Klass {}",
        "export type OnlyAType = string;",
        "",
      ],
      "\n"
    ),
  ],
  ["SchemaAST", "export interface Check<in I> {\n  readonly run: (input: I) => boolean;\n}\n"],
  ["SchemaGetter", "export declare const trim: () => string;\nexport declare const Model: number;\n"],
  ["SchemaTransformation", "export declare const durationFromMillis: number;\n"],
];

const STUB_SOURCES: ReadonlyArray<readonly [string, string]> = [
  [
    "Schema",
    A.join(
      [
        'import * as Other from "./Other.ts";',
        "/** Hidden constant. */",
        "const hidden = 1;",
        "/**",
        " * Decodes a {@link String} value. Further detail.",
        " *",
        " * @category schemas",
        " */",
        "export const String = hidden;",
        "/**",
        " * **Example** (Read it)",
        " *",
        " * Parses a number from a string",
        " *",
        " * @category",
        " */",
        "export const NumberFromString = Other;",
        "/** First overload. @category checks */",
        "export function isMinLength(): void;",
        "/** Second overload. */",
        "export function isMinLength(n?: number): void {}",
        "/** @since 1.0.0 */",
        "export class Klass {}",
        "/** Anonymous default. */",
        "export default function () {}",
        "",
      ],
      "\n"
    ),
  ],
  ["SchemaGetter", "/**\n * Trims a string.\n *\n * @category transforming\n */\nexport const trim = 1;\n"],
  ["SchemaTransformation", "export const durationFromMillis = 1;\n"],
];

const writeStub = Effect.fn(function* (root: string, withSources: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const effectRoot = path.join(root, "node_modules", "effect");
  yield* fs.makeDirectory(path.join(effectRoot, "dist"), { recursive: true });
  yield* fs.makeDirectory(path.join(effectRoot, "src"), { recursive: true });
  yield* fs.writeFileString(path.join(effectRoot, "package.json"), STUB_MANIFEST);
  yield* Effect.forEach(
    STUB_DECLARATIONS,
    ([module, text]) => fs.writeFileString(path.join(effectRoot, "dist", `${module}.d.ts`), text),
    { concurrency: 1, discard: true }
  );
  yield* Effect.forEach(
    withSources ? STUB_SOURCES : [],
    ([module, text]) => fs.writeFileString(path.join(effectRoot, "src", `${module}.ts`), text),
    { concurrency: 1, discard: true }
  );
});

const entryView = (entry: SchemaIndexEntry): string =>
  SchemaIndexEntry.match(entry, {
    codec: (codec) => `codec ${codec.name} ${codec.decoded} <- ${codec.encoded}`,
    check: (check) => `check ${check.name} on ${check.input}`,
    combinator: (combinator) => `combinator ${combinator.name}`,
  });

const failureMessage = <A, R>(effect: Effect.Effect<A, { readonly message: string }, R>) =>
  Effect.map(Effect.flip(effect), (error) => error.message);

const driftView = (drift: SchemaIndexDrift): string => `${drift.file} ${drift.change}`;

describe("schema index text helpers", () => {
  it("shortens imported qualifiers and whitespace", () => {
    expect(normalizeTypeText('import("/x/node_modules/effect/dist/DateTime").Utc')).toBe("DateTime.Utc");
    expect(normalizeTypeText('import("effect/Duration.js").Duration')).toBe("Duration.Duration");
    expect(normalizeTypeText("  {\n  readonly a: string;\n}  ")).toBe("{ readonly a: string; }");
  });

  it("reads the first sentence of the first prose paragraph", () => {
    assertSome(
      jsDocSummary("Decodes a {@link Duration}. More text.\n\n**Details**\n\nIgnored."),
      "Decodes a Duration."
    );
    assertSome(jsDocSummary("**Example** (Title)\n\nUses {@linkcode Schema | the schema} here"), "Uses Schema here");
    assertNone(jsDocSummary("**Details**\n\n"));
  });
});

it.layer(NodeTestLayer, { timeout: "120 seconds" })((it) => {
  it.effect("indexes the installed effect with the type checker and matches the committed index", () =>
    Effect.gen(function* () {
      const repoRoot = yield* findRepoRoot();
      const index = yield* extractSchemaIndex(repoRoot);
      const views = A.map(index.entries, entryView);
      expect(SemVer.format(index.effectVersion)).toMatch(/^\d+\.\d+\.\d+/);
      expect(views).toContain("codec DurationFromMillis Duration.Duration <- number");
      expect(views).toContain("codec String string <- string");
      expect(views).toContain("check isMinLength on { readonly length: number; }");
      expect(views).toContain("combinator Struct");
      expect(A.some(index.getters, (getter) => getter.module === "SchemaTransformation")).toBe(true);
      const drift = yield* diffSchemaIndexFiles(repoRoot, renderSchemaIndexFiles(index));
      expect(A.map(drift, driftView)).toEqual([]);
    })
  );

  it.effect("indexes a stub effect and reads its source docs", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* writeStub(root, true);
      const index = yield* extractSchemaIndex(root);
      expect(SemVer.format(index.effectVersion)).toBe("0.0.0-stub");
      expect(A.map(index.entries, entryView)).toEqual([
        "combinator Klass",
        "codec NumberFromString number <- string",
        "codec String string <- string",
        "combinator Struct",
        "combinator annotations",
        "check isMinLength on string",
      ]);
      const byName = (name: string) => O.getOrThrow(A.findFirst(index.entries, (entry) => entry.name === name));
      assertSome(byName("String").summary, "Decodes a String value.");
      assertSome(byName("String").category, "schemas");
      assertSome(byName("NumberFromString").summary, "Parses a number from a string");
      assertNone(byName("NumberFromString").category);
      assertSome(byName("isMinLength").summary, "First overload.");
      assertSome(byName("isMinLength").category, "checks");
      assertNone(byName("Klass").summary);
      assertNone(byName("Struct").summary);
      expect(
        A.map(index.getters, (getter) => [
          getter.module,
          getter.name,
          O.getOrNull(getter.summary),
          O.getOrNull(getter.category),
        ])
      ).toEqual([
        ["SchemaGetter", "Model", null, null],
        ["SchemaGetter", "trim", "Trims a string.", "transforming"],
        ["SchemaTransformation", "durationFromMillis", null, null],
      ]);
    })
  );

  it.effect("names what is missing when effect cannot be read", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const empty = yield* fs.makeTempDirectoryScoped();
      const noVersion = yield* failureMessage(extractSchemaIndex(empty));
      expect(noVersion).toMatch(/^could not read the effect version: /);
      const manifestOnly = yield* fs.makeTempDirectoryScoped();
      yield* fs.makeDirectory(path.join(manifestOnly, "node_modules", "effect"), { recursive: true });
      yield* fs.writeFileString(path.join(manifestOnly, "node_modules", "effect", "package.json"), STUB_MANIFEST);
      const unresolved = yield* failureMessage(extractSchemaIndex(manifestOnly));
      expect(unresolved).toBe("could not resolve effect/Schema from the repository root; is effect installed?");
      const noSources = yield* fs.makeTempDirectoryScoped();
      yield* writeStub(noSources, false);
      const unreadSources = yield* failureMessage(extractSchemaIndex(noSources));
      expect(unreadSources).toMatch(/^could not read effect\/src\/Schema\.ts: /);
    })
  );

  it.effect("writes missing and changed slices, removes extra ones, then reports none", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const directory = path.join(root, SCHEMA_INDEX_DIRECTORY);
      const files = [
        SchemaIndexFile.make({ file: "a.md", entries: 1, content: "# a\n" }),
        SchemaIndexFile.make({ file: "b.md", entries: 1, content: "# b\n" }),
        SchemaIndexFile.make({ file: "c.md", entries: 1, content: "# c\n" }),
      ];
      const absent = yield* diffSchemaIndexFiles(root, files);
      expect(A.map(absent, driftView)).toEqual(["a.md missing", "b.md missing", "c.md missing"]);
      yield* fs.makeDirectory(directory, { recursive: true });
      yield* fs.writeFileString(path.join(directory, "b.md"), "# old b\n");
      yield* fs.writeFileString(path.join(directory, "c.md"), "# c\n");
      yield* fs.writeFileString(path.join(directory, "z.md"), "# stale\n");
      yield* fs.writeFileString(path.join(directory, "notes.txt"), "kept\n");
      const written = yield* writeSchemaIndexFiles(root, files);
      expect(A.map(written, driftView)).toEqual(["a.md missing", "b.md changed", "z.md extra"]);
      const rewritten = yield* fs.readFileString(path.join(directory, "b.md"));
      const extraLeft = yield* fs.exists(path.join(directory, "z.md"));
      const otherKept = yield* fs.exists(path.join(directory, "notes.txt"));
      const after = yield* diffSchemaIndexFiles(root, files);
      expect([rewritten, extraLeft, otherKept, after]).toEqual(["# b\n", false, true, []]);
    })
  );

  it.effect("reads a lookup slice and names the regenerate command when it is missing", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      const missing = yield* failureMessage(readSchemaIndexSlice(root, "number"));
      expect(
        Str.startsWith(
          `could not read ${SCHEMA_INDEX_DIRECTORY}/wire-number.md; run bun run beep schema-idioms index --write: `
        )(missing)
      ).toBe(true);
      yield* writeSchemaIndexFiles(root, [
        SchemaIndexFile.make({ file: "wire-number.md", entries: 0, content: "# n\n" }),
      ]);
      const slice = yield* readSchemaIndexSlice(root, "number");
      expect(slice).toBe("# n\n");
    })
  );

  it.effect("hints a file on disk and fails on a missing one", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const file = path.join(root, "Wire.ts");
      yield* fs.writeFileString(
        file,
        'import * as S from "effect/Schema";\nexport const W = S.Struct({ port: S.Int });\n'
      );
      const message = yield* hintSchemaIdiomsFile(file);
      expect(O.getOrThrow(message)).toContain("L2 port: the name reads as a port");
      yield* fs.writeFileString(
        file,
        'import * as S from "effect/Schema";\nexport const W = S.Struct({ port: S.Port });\n'
      );
      const none = yield* hintSchemaIdiomsFile(file);
      assertNone(none);
      const missing = yield* failureMessage(hintSchemaIdiomsFile(path.join(root, "Missing.ts")));
      expect(missing).toMatch(/^could not read .*Missing\.ts: /);
    })
  );
});
