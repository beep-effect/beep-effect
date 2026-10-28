import {
  EcosystemPolarityError,
  EcosystemPolarityOptions,
  runEcosystemPolarityCheck,
} from "@beep/repo-cli/commands/Lint/EcosystemPolarity";
import { SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertFalse, assertInstanceOf, assertTrue } from "@effect/vitest/utils";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeTestLayer, temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const writeJson = Effect.fn(function* (filePath: string, value: unknown) {
  yield* writeProjectFile(filePath, `${encodeJson(value)}\n`);
});

const writeMember = Effect.fn(function* (
  manifest: Readonly<Record<string, unknown>>,
  sourceFiles: Readonly<Record<string, string>> = {}
) {
  yield* writeJson("packages/ecosystem/member/package.json", {
    name: "@beep/member",
    private: true,
    beep: { family: "ecosystem" },
    ...manifest,
  });
  for (const [file, content] of R.toEntries(sourceFiles)) {
    yield* writeProjectFile(`packages/ecosystem/member/${file}`, content);
  }
});
const runFullCheck = runEcosystemPolarityCheck(EcosystemPolarityOptions.make({}));
const lines = (...text: ReadonlyArray<string>): string => `${A.join(text, "\n")}\n`;

/** A fresh repository root as the working directory: the `.git` marker is what `findRepoRoot` looks for. */
const temporaryRepository = Effect.gen(function* () {
  const directory = yield* temporaryWorkingDirectory;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join(directory, ".git"));
  return directory;
});

const sourceEdges = (summary: { readonly violations: ReadonlyArray<{ readonly detail: string }> }) =>
  A.map(summary.violations, (violation) => violation.detail);

/** A dynamic `import(` or `require(` whose first argument is a template literal with a substitution. */
const TEMPLATE_SUBSTITUTION_IMPORT = /\b(?:import|require)\s*(?:\?\.)?\s*\(\s*`@beep\/[^`]*\$\{/u;

it.layer(NodeTestLayer, { timeout: "10 seconds" })((it) => {
  describe("ecosystem polarity lint", { concurrent: false }, () => {
    it.effect("finds static, type-only, re-export, side-effect, dynamic and require @beep source edges", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* writeMember(
          {},
          {
            "src/index.ts": lines(
              'import { a } from "@beep/imported";',
              'import type { T } from "@beep/types";',
              'import "@beep/side-effect";',
              'export * from "@beep/exported";',
              'export { b } from "@beep/named";',
              'export const dynamic = import("@beep/dynamic");',
              'export const required = require("@beep/required");',
              'export const optional = require?.("@beep/optional");',
              "export const plain = import(`@beep/plain`);",
              'export const concatenated = import("@beep/" + "joined");',
              'import { c } from "effect/Array";',
              "export const values: ReadonlyArray<T> = [a, c];"
            ),
          }
        );

        const summary = yield* runFullCheck;
        expect(summary.scannedSourceFiles).toBe(1);
        expect(sourceEdges(summary)).toEqual([
          "@beep/imported",
          "@beep/types",
          "@beep/side-effect",
          "@beep/exported",
          "@beep/named",
          "@beep/dynamic",
          "@beep/required",
          "@beep/optional",
          "@beep/plain",
        ]);
        expect(A.map(summary.violations, (violation) => violation.line)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(summary.violations[0]?.file).toBe("packages/ecosystem/member/src/index.ts");
        expect(summary.violations[0]?.kind).toBe("source-import");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("ignores specifiers inside comments, strings, templates and regexes", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* writeMember(
          {},
          {
            "src/index.ts": lines(
              '// import "@beep/in-line-comment"',
              '/* import("@beep/in-block-comment") */',
              "export const inString = 'import \"@beep/in-string\"';",
              'export const inTemplate = `import "@beep/in-template"`;',
              'export const inRegex = /import "@beep\\/in-regex"/u;'
            ),
          }
        );

        const summary = yield* runFullCheck;
        expect(summary.scannedSourceFiles).toBe(1);
        expect(summary.violations).toEqual([]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    // Shift 1 (W4-f, 4-A4 part): the ts-morph walk reported imports, then exports, then dynamic calls per file.
    it.effect("reports violations in file, line and column order, not grouped by import form", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* writeMember(
          {},
          {
            "src/b.ts": lines(
              'export const dynamic = import("@beep/z-dynamic");',
              'export * from "@beep/y-export";',
              'import "@beep/x-import";'
            ),
            "src/a.ts": lines('export const first = require("@beep/w-first"), second = import("@beep/v-second");'),
          }
        );

        const summary = yield* runFullCheck;
        expect(
          A.map(summary.violations, (violation) => `${violation.file}:${violation.line} ${violation.detail}`)
        ).toEqual([
          "packages/ecosystem/member/src/a.ts:1 @beep/w-first",
          "packages/ecosystem/member/src/a.ts:1 @beep/v-second",
          "packages/ecosystem/member/src/b.ts:1 @beep/z-dynamic",
          "packages/ecosystem/member/src/b.ts:2 @beep/y-export",
          "packages/ecosystem/member/src/b.ts:3 @beep/x-import",
        ]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    // Shift 2: the ts-morph walk scanned declaration files because they end in a source extension.
    it.effect("skips declaration files and does not count them as scanned sources", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* writeMember(
          {},
          {
            "src/index.ts": lines("export const ok = 1;"),
            "src/types.d.ts": lines('import type { T } from "@beep/declared";', "export type U = T;"),
            "src/ambient.d.mts": lines('import "@beep/declared-mts";'),
            "src/common.d.cts": lines('import "@beep/declared-cts";'),
          }
        );

        const summary = yield* runFullCheck;
        expect(summary.scannedSourceFiles).toBe(1);
        expect(summary.violations).toEqual([]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    // Shift 3: the ts-morph walk reported the line of the call expression.
    it.effect("reports the line of the string literal for a dynamic call that spans lines", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* writeMember(
          {},
          {
            "src/index.ts": lines(
              "export const multiline = import(",
              '  "@beep/multiline"',
              ");",
              "export const requiredLater = require(",
              "",
              '  "@beep/required-later"',
              ");"
            ),
          }
        );

        const summary = yield* runFullCheck;
        expect(A.map(summary.violations, (violation) => [violation.line, violation.detail])).toEqual([
          [2, "@beep/multiline"],
          [6, "@beep/required-later"],
        ]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    // Shift 4 (ruling 3, accepted): the ts-morph walk read a template literal with a substitution as its head.
    it.effect("does not read a template literal with a substitution as a specifier", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* writeMember(
          {},
          {
            "src/index.ts": lines(
              "declare const member: string;",
              "export const interpolated = import(`@beep/${member}`);",
              "export const interpolatedRequire = require(`@beep/${member}`);",
              "export const prefixed = import(`@beep/prefix-${member}`);",
              "export const plain = import(`@beep/plain`);"
            ),
          }
        );

        const summary = yield* runFullCheck;
        expect(A.map(summary.violations, (violation) => [violation.line, violation.detail])).toEqual([
          [5, "@beep/plain"],
        ]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    // Ruling 3's guard: the accepted gap stays safe only while no member source uses that form.
    it.effect("no ecosystem member source in this repository uses a template-substitution dynamic @beep import", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* path.fromFileUrl(new URL("../../../../../", import.meta.url));
        const ecosystemRoot = path.join(repoRoot, "packages/ecosystem");
        const members = yield* fs.readDirectory(ecosystemRoot);
        const sourceRoots = yield* Effect.filter(
          A.map(members, (member) => path.join(ecosystemRoot, member, "src")),
          (sourceRoot) =>
            fs.stat(sourceRoot).pipe(
              Effect.map((stat) => stat.type === "Directory"),
              Effect.orElseSucceed(() => false)
            )
        );
        assertTrue(A.isReadonlyArrayNonEmpty(sourceRoots));

        const offenders = yield* Effect.forEach(sourceRoots, (sourceRoot) =>
          Effect.gen(function* () {
            const scan = yield* SourceBoundary.scan({
              root: sourceRoot,
              rules: [],
              extensions: [".ts", ".tsx", ".mts", ".cts"],
            });
            assertTrue(A.isReadonlyArrayNonEmpty(scan.files));
            return yield* Effect.filter(scan.files, (file) =>
              fs
                .readFileString(path.join(sourceRoot, file))
                .pipe(Effect.map((text) => TEMPLATE_SUBSTITUTION_IMPORT.test(SourceBoundary.stripComments(text))))
            );
          })
        );
        expect(A.flatten(offenders)).toEqual([]);
      })
    );

    // Shift 5: the ts-morph walk entered node_modules and followed a symlink cycle until the kernel refused it.
    it.effect("skips node_modules under src and scans a symlink cycle's files once", () =>
      Effect.gen(function* () {
        const directory = yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* writeMember(
          {},
          {
            "src/index.ts": lines('import "@beep/own";'),
            "src/node_modules/dep/index.ts": lines('import "@beep/vendored";'),
          }
        );
        yield* fs.symlink(".", path.join(directory, "packages/ecosystem/member/src/loop"));

        const summary = yield* runFullCheck;
        expect(summary.scannedSourceFiles).toBe(1);
        expect(sourceEdges(summary)).toEqual(["@beep/own"]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("scans nothing when a member has no src directory or src is a file", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* writeJson("packages/ecosystem/alpha/package.json", { name: "@beep/alpha", private: true });
        yield* writeJson("packages/ecosystem/beta/package.json", { name: "@beep/beta", private: true });
        yield* writeProjectFile("packages/ecosystem/beta/src", 'import "@beep/in-a-file-named-src";\n');

        const summary = yield* runFullCheck;
        expect(summary.checkedMembers).toBe(2);
        expect(summary.scannedSourceFiles).toBe(0);
        expect(summary.violations).toEqual([]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("maps a failed source scan to EcosystemPolarityError naming the member's src", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        yield* writeMember({}, { "src/index.ts": lines('import "@beep/unreadable";') });
        const failingReads = FileSystem.FileSystem.of({
          ...fs,
          readFileString: Effect.fn("EcosystemPolarityTest.failingReadFileString")((target, encoding) =>
            Str.endsWith("src/index.ts")(target)
              ? Effect.fail(
                  PlatformError.systemError({
                    _tag: "PermissionDenied",
                    module: "FileSystem",
                    method: "readFileString",
                    pathOrDescriptor: target,
                  })
                )
              : fs.readFileString(target, encoding)
          ),
        });

        const result = yield* runFullCheck.pipe(
          Effect.provideService(FileSystem.FileSystem, failingReads),
          Effect.result
        );
        assertFailure(
          result,
          EcosystemPolarityError.new('Failed to scan ecosystem source directory "packages/ecosystem/member/src".')
        );
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("rejects runtime manifest edges and bundled dependency fields", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* writeMember({
          peerDependencies: {
            "@beep/internal": "workspace:^",
            effect: "4.0.0",
            portable: "npm:@beep/internal-alias@^1.0.0",
          },
          bundledDependencies: [],
        });

        const summary = yield* runFullCheck;
        expect(A.map(summary.violations, (violation) => violation.kind)).toEqual([
          "runtime-dependency",
          "runtime-dependency",
          "bundled-dependencies",
        ]);
        expect(sourceEdges(summary)).toEqual([
          "peerDependencies.@beep/internal",
          "peerDependencies.portable -> npm:@beep/internal-alias@^1.0.0",
          "bundledDependencies",
        ]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("ignores devDependencies, tests, and unrelated changed files", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* writeMember(
          { devDependencies: { "@beep/test-utils": "workspace:^" } },
          { "test/index.test.ts": 'import "@beep/test-utils";\n' }
        );

        const fullSummary = yield* runFullCheck;
        expect(fullSummary.checkedMembers).toBe(1);
        expect(fullSummary.violations).toEqual([]);

        const changedSummary = yield* runEcosystemPolarityCheck(
          EcosystemPolarityOptions.make({ includePaths: ["packages/demo/src/index.ts"] })
        );
        expect(changedSummary.checkedMembers).toBe(0);
        expect(changedSummary.violations).toEqual([]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("expands a member src or manifest change to the member's full check", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* writeMember({}, { "src/violation.ts": 'import "@beep/internal";\n', "src/changed.ts": "export {};\n" });

        for (const changedFile of [
          "packages/ecosystem/member/src/changed.ts",
          "packages/ecosystem/member/package.json",
        ]) {
          const summary = yield* runEcosystemPolarityCheck(
            EcosystemPolarityOptions.make({ includePaths: [changedFile] })
          );
          expect(summary.checkedMembers).toBe(1);
          expect(summary.violations).toHaveLength(1);
          expect(summary.violations[0]?.detail).toBe("@beep/internal");
        }
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    // W4-j: an optional key may be absent, never explicitly undefined.
    it.effect("rejects an explicit undefined includePaths option", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(S.decodeUnknownEffect(EcosystemPolarityOptions)({ includePaths: undefined }));
        assertInstanceOf(error, S.SchemaError);
        const absent = yield* S.decodeEffect(EcosystemPolarityOptions)({});
        assertFalse("includePaths" in absent);
      })
    );
  });
});
