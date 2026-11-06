import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { Jsonc } from "@beep/jsonc/Jsonc";
import {
  buildJSDocDocumentationInventory,
  JSDocDocumentationInventoryOptions,
  listSourceFiles,
  runTurboConfigProof,
  summarizeTurboDryRunOutput,
  summarizeTurboQueryAffectedOutput,
  TurboConfigProofOptions,
  TurboConfigProofSelectorMode,
  writeJSDocDocumentationInventory,
  zeroLegacyCorpusFiles,
} from "@beep/repo-cli/test/Quality";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { assertExitFailure, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { provideSpawner } from "./support/ScriptedProcess.ts";

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
// `Git` over the platform spawner: the inventories list the visible tree through the kit (W7b, SPEC D-19).
const PlatformLayer = Layer.provideMerge(
  Git.layer,
  Layer.mergeAll(
    BunCrypto.layer,
    FileSystemLayer,
    NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(FileSystemLayer))
  )
);
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const fixedGeneratedAt = "2026-01-01T00:00:00.000Z";

const tsdocPolicy = {
  tagDefinitions: [
    { tagName: "@effects", syntaxKind: "block" },
    { tagName: "@precondition", syntaxKind: "block" },
    { tagName: "@postcondition", syntaxKind: "block" },
    { tagName: "@invariant", syntaxKind: "block" },
  ],
  supportForTags: {
    "@effects": true,
    "@precondition": true,
    "@postcondition": true,
    "@invariant": true,
  },
};

const packageSource = `/**
 * Demo package documentation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";

/**
 * Demo field helper used by generator fixture tests.
 *
 * @param fields - Schema struct fields.
 * @returns The same schema struct fields.
 * @example
 * \`\`\`ts
 * import { defineFields } from "@beep/demo"
 * import * as S from "effect/Schema"
 *
 * console.log(defineFields({ id: S.String }))
 * \`\`\`
 * @category helpers
 * @since 0.0.0
 */
export const defineFields = <Fields extends S.Struct.Fields>(fields: Fields): Fields => fields;

/**
 * Demo value used by generator fixture tests.
 *
 * @example
 * \`\`\`ts
 * import { demoValue } from "@beep/demo"
 *
 * console.log(demoValue)
 * \`\`\`
 * @category constants
 * @since 0.0.0
 */
export const demoValue = "demo";
`;

const writeJsonFile = (filePath: string, value: unknown) =>
  FileSystem.FileSystem.pipe(Effect.flatMap((fs) => fs.writeFileString(filePath, `${encodeJson(value)}\n`)));

const parseJsoncText = (text: string): unknown => Result.getOrThrow(Jsonc.parseResult(text));

const acquireFixtureRepo = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* fs.makeTempDirectoryScoped();
  const packageRoot = path.join(repoRoot, "packages", "demo");

  yield* fs.makeDirectory(path.join(packageRoot, "src"), { recursive: true });
  yield* writeJsonFile(path.join(repoRoot, "package.json"), {
    name: "fixture-root",
    scripts: {
      "topo-sort": "printf '@beep/demo\\n'",
    },
    workspaces: ["packages/*"],
  });
  yield* writeJsonFile(path.join(repoRoot, "tsdoc.json"), tsdocPolicy);
  yield* writeJsonFile(path.join(packageRoot, "package.json"), {
    name: "@beep/demo",
    exports: {
      ".": "./src/index.ts",
    },
  });
  yield* fs.writeFileString(path.join(packageRoot, "src", "index.ts"), packageSource);

  return repoRoot;
});

const acquireLabsFixtureRepo = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* acquireFixtureRepo();
  const labRoot = path.join(repoRoot, "apps", "labs", "demo");

  yield* fs.makeDirectory(path.join(labRoot, "src"), { recursive: true });
  yield* writeJsonFile(path.join(repoRoot, "package.json"), {
    name: "fixture-root",
    scripts: {
      "topo-sort": "printf '@beep/demo\\n@beep/lab-demo\\n'",
    },
    workspaces: ["packages/*", "apps/labs/*"],
  });
  yield* writeJsonFile(path.join(labRoot, "package.json"), {
    name: "@beep/lab-demo",
    exports: {
      ".": "./src/index.ts",
    },
  });
  // Deliberately undocumented exported symbol: it would produce inventory
  // findings if labs were ever analyzed.
  yield* fs.writeFileString(
    path.join(labRoot, "src", "index.ts"),
    "export const labValue = (input: number): number => input + 1;\n"
  );

  return repoRoot;
});

it.layer(PlatformLayer, { concurrent: false, timeout: "30 seconds" })("quality artifact generators", (it) => {
  it.effect("skips broken symlinks while containing targets and terminating cycles", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const parent = yield* fs.makeTempDirectoryScoped({ prefix: "beep-quality-source-files-" });
      const root = path.join(parent, "src");
      const external = path.join(parent, "external");
      const source = path.join(root, "index.ts");
      yield* fs.makeDirectory(root);
      yield* fs.makeDirectory(external);
      yield* fs.writeFileString(source, "export const value = true;\n");
      yield* fs.writeFileString(path.join(external, "escape.ts"), "export const escaped = true;\n");
      yield* fs.symlink("missing-target", path.join(root, "missing-comma-in-flow"));
      yield* fs.symlink("missing-target.ts", path.join(root, "broken.ts"));
      yield* fs.symlink(source, path.join(root, "alias.ts"));
      yield* fs.symlink(root, path.join(root, "loop"));
      yield* fs.symlink(external, path.join(root, "escape"));
      yield* fs.symlink(path.join(external, "escape.ts"), path.join(root, "escape.ts"));

      const listSourceFiles1 = yield* listSourceFiles(root, path);
      expect(listSourceFiles1).toEqual([source, source]);
    })
  );

  for (const reason of S.Literals(["PermissionDenied", "Unknown"]).literals) {
    it.effect(`preserves ${reason} stat failures`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-quality-stat-error-" });
        const source = path.join(root, "index.ts");
        yield* fs.writeFileString(source, "export const value = true;\n");
        const failure = PlatformError.systemError({
          _tag: reason,
          module: "FileSystem",
          method: "stat",
          pathOrDescriptor: source,
          description: "injected stat failure",
        });
        const failingFs = FileSystem.FileSystem.of({
          ...fs,
          stat: Effect.fn("FileSystem.FileSystem.stat")((target) =>
            target === source ? Effect.fail(failure) : fs.stat(target)
          ),
        });
        const error = yield* listSourceFiles(root, path).pipe(
          Effect.provideService(FileSystem.FileSystem, failingFs),
          Effect.flip
        );

        expect(error._tag).toBe("QualityArtifactGeneratorError");
        expect(error.message).toBe(`Failed to stat ${source}.`);
        expect(error.filePath).toBe(source);
        expect(error.cause).toBe(failure);
      })
    );
  }

  // The old bracket acquired the whole fixture before registering cleanup.
  // Inject into the real setup seam, then observe removal outside that shorter scope.
  for (const [labs, interrupted] of A.cartesian([false, true], [false, true])) {
    it.effect(
      `removes the ${labs ? "labs" : "package"} root when setup ${interrupted ? "is interrupted" : "fails"}`,
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const allocated = yield* Ref.make("");
        const attemptedDirectories = yield* Ref.make(A.empty<string>());
        const injectedDirectories = yield* Ref.make(A.empty<string>());
        const targetDirectory = labs ? "apps/labs/demo/src" : "packages/demo/src";
        const isTargetDirectory = Str.endsWith(`/${targetDirectory}`);
        const failure = PlatformError.systemError({
          _tag: "PermissionDenied",
          module: "FileSystem",
          method: "makeDirectory",
          pathOrDescriptor: "fixture setup",
          description: "injected setup failure",
        });
        const failingFs = FileSystem.FileSystem.of({
          ...fs,
          makeTempDirectoryScoped: Effect.fn("FixtureSetup.makeTempDirectoryScoped")(
            (options: Parameters<FileSystem.FileSystem["makeTempDirectoryScoped"]>[0]) =>
              fs.makeTempDirectoryScoped(options).pipe(Effect.tap((root) => Ref.set(allocated, root)))
          ),
          makeDirectory: Effect.fnUntraced(function* (
            directory: string,
            options: Parameters<FileSystem.FileSystem["makeDirectory"]>[1]
          ) {
            const root = yield* Ref.get(allocated);
            const relativeDirectory = path.relative(root, directory);
            yield* Ref.update(attemptedDirectories, A.append(relativeDirectory));
            if (isTargetDirectory(directory)) {
              expect(directory).toBe(path.join(root, targetDirectory));
              if (labs) {
                // Labs setup must reach its own mkdir after package setup has completed.
                const readFileString2 = yield* fs.readFileString(
                  path.join(root, "packages", "demo", "src", "index.ts")
                );
                expect(readFileString2).toBe(packageSource);
              }
              yield* Ref.update(injectedDirectories, A.append(relativeDirectory));
              return yield* interrupted ? Effect.interrupt : Effect.fail(failure);
            }
            return yield* fs.makeDirectory(directory, options);
          }),
        });
        const exit = yield* (labs ? acquireLabsFixtureRepo() : acquireFixtureRepo()).pipe(
          Effect.provideService(FileSystem.FileSystem, failingFs),
          Effect.scoped,
          Effect.exit
        );
        if (interrupted) {
          if (!Exit.isFailure(exit)) throw new Error("Expected a failure exit");
          exit.cause.pipe(Cause.hasInterrupts, assertTrue);
          exit.cause.pipe(Cause.hasInterruptsOnly, assertTrue);
        } else {
          assertExitFailure(exit, Cause.fail(failure));
        }
        const root = yield* Ref.get(allocated);
        expect(root).not.toBe("");
        const got = yield* Ref.get(attemptedDirectories);
        expect(got).toEqual(labs ? ["packages/demo/src", "apps/labs/demo/src"] : ["packages/demo/src"]);
        const got3 = yield* Ref.get(injectedDirectories);
        expect(got3).toEqual([targetDirectory]);
        const exists4 = yield* fs.exists(root);
        expect(exists4).toBe(false);
      })
    );
  }

  describe("inline schema annotations", () => {
    it.effect(
      "classifies schema classes by heritage rather than member examples or initializers",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* acquireFixtureRepo();
        yield* fs.writeFileString(
          path.join(repoRoot, "packages", "demo", "src", "index.ts"),
          `import * as Context from "effect/Context";
import * as S from "effect/Schema";
export class DemoService extends Context.Service<DemoService>()("DemoService") {
  /**
   * Builds a service layer with schema-backed metadata.
   *
   * **Example** (Construct metadata)
   *
   * \`\`\`ts
   * import * as S from "effect/Schema";
   * class Meta extends S.Class<Meta>("Meta")({ tag: S.String }) {}
   * console.log(Meta.make({ tag: "demo" }).tag);
   * \`\`\`
   */
  static readonly layerMemory = "fixture";
}
export class PlainClass {
  static readonly metadata = S.Class("Meta")({ tag: S.String });
}
export class SchemaClass extends S.Class<SchemaClass>("SchemaClass")({}) {}
export class SchemaError extends S.TaggedError<SchemaError>()("SchemaError", {}) {}
export class ModelClass extends Model.Class<ModelClass>("ModelClass")({}) {}
export class DomainEntity extends PartEntity.Entity<DomainEntity>("DomainEntity")({}) {}
`
        );
        const inventory = yield* buildJSDocDocumentationInventory(
          JSDocDocumentationInventoryOptions.make({ rootDir: repoRoot, generatedAt: fixedGeneratedAt })
        );
        const gaps = A.flatMap(inventory.packages, (pkg) =>
          A.map(pkg.exports, (entry) => ({
            name: entry.symbolName,
            rules: A.map(entry.schemaAnnotationGaps, (gap) => gap.rule),
          }))
        );
        expect(gaps).toEqual([
          { name: "DemoService", rules: [] },
          { name: "PlainClass", rules: [] },
          { name: "SchemaClass", rules: ["missing-schema-annotation"] },
          { name: "SchemaError", rules: ["missing-schema-annotation"] },
          { name: "ModelClass", rules: ["missing-schema-annotation"] },
          { name: "DomainEntity", rules: ["missing-schema-annotation"] },
        ]);
      })
    );

    it.effect(
      "recognizes annotations without accepting field metadata or empty annotations",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* acquireFixtureRepo();
        yield* fs.writeFileString(
          path.join(repoRoot, "packages", "demo", "src", "index.ts"),
          `import * as S from "effect/Schema";
export class AnnotatedError extends S.TaggedError<AnnotatedError>()("AnnotatedError", {}, { identifier: "AnnotatedError", description: "A failure." }) {}
export class AnnotatedClass extends S.Class<AnnotatedClass>("AnnotatedClass")({}, { description: "A model." }) {}
export class EmptyError extends S.TaggedError<EmptyError>()("EmptyError", {}, {}) {}
export class FieldOnly extends S.TaggedError<FieldOnly>()("FieldOnly", { description: S.String }) {}
`
        );
        const inventory = yield* buildJSDocDocumentationInventory(
          JSDocDocumentationInventoryOptions.make({ rootDir: repoRoot, generatedAt: fixedGeneratedAt })
        );
        const gaps = A.flatMap(inventory.packages, (pkg) =>
          A.map(pkg.exports, (entry) => ({
            name: entry.symbolName,
            rules: A.map(entry.schemaAnnotationGaps, (gap) => gap.rule),
          }))
        );
        expect(gaps).toEqual([
          { name: "AnnotatedError", rules: [] },
          { name: "AnnotatedClass", rules: [] },
          { name: "EmptyError", rules: ["missing-schema-annotation"] },
          { name: "FieldOnly", rules: ["missing-schema-annotation"] },
        ]);
      })
    );
  });

  it.effect(
    "writes the JSDoc inventory to explicit artifact paths",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* acquireFixtureRepo();
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const outputJsonPath = path.join(repoRoot, "out", "jsdoc.inventory.jsonc");
      const outputMarkdownPath = path.join(repoRoot, "out", "jsdoc.inventory.md");

      const result = yield* writeJSDocDocumentationInventory(
        JSDocDocumentationInventoryOptions.make({
          rootDir: repoRoot,
          outputJsonPath,
          outputMarkdownPath,
          generatedAt: fixedGeneratedAt,
        })
      );
      const readFileString5 = yield* fs.readFileString(outputJsonPath);
      const inventory = parseJsoncText(readFileString5) as {
        readonly generatedAt: string;
        readonly packages: ReadonlyArray<{
          readonly packageName: string;
          readonly counts: { readonly schemaAnnotationFindings: number };
        }>;
      };
      const markdown = yield* fs.readFileString(outputMarkdownPath);

      expect(result.outputJsonPath).toBe(outputJsonPath);
      expect(result.outputMarkdownPath).toBe(outputMarkdownPath);
      expect(inventory.generatedAt).toBe(fixedGeneratedAt);
      expect(A.map(inventory.packages, (pkg) => pkg.packageName)).toEqual(["@beep/demo"]);
      expect(inventory.packages[0]?.counts.schemaAnnotationFindings).toBe(0);
      expect(markdown).toContain("# JSDoc Documentation Compliance Inventory");
    })
  );

  it.effect(
    "mirrors the JSDoc inventory into the CI output paths from the same scan",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* acquireFixtureRepo();
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const outputJsonPath = path.join(repoRoot, "standards", "jsdoc.inventory.jsonc");
      const outputMarkdownPath = path.join(repoRoot, "standards", "jsdoc.inventory.md");
      const ciOutputJsonPath = path.join(repoRoot, ".beep", "ci", "jsdoc.inventory.jsonc");
      const ciOutputMarkdownPath = path.join(repoRoot, ".beep", "ci", "jsdoc.inventory.md");

      const result = yield* writeJSDocDocumentationInventory(
        JSDocDocumentationInventoryOptions.make({
          rootDir: repoRoot,
          outputJsonPath,
          outputMarkdownPath,
          ciOutputJsonPath,
          ciOutputMarkdownPath,
          generatedAt: fixedGeneratedAt,
        })
      );

      expect(result.outputJsonPath).toBe(outputJsonPath);
      expect(result.outputMarkdownPath).toBe(outputMarkdownPath);
      const readFileString6 = yield* fs.readFileString(ciOutputJsonPath);
      const expectation = expect(readFileString6);
      const readFileString1 = yield* fs.readFileString(outputJsonPath);
      expectation.toBe(readFileString1);
      const readFileString7 = yield* fs.readFileString(ciOutputMarkdownPath);
      const expectation1 = expect(readFileString7);
      const readFileString3 = yield* fs.readFileString(outputMarkdownPath);
      expectation1.toBe(readFileString3);
    })
  );

  it.effect(
    "inventories untracked sources but not gitignored ones, matching the Turbo input set",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* acquireFixtureRepo();
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const sourceRoot = path.join(repoRoot, "packages", "demo", "src");
      yield* fs.writeFileString(path.join(repoRoot, ".gitignore"), "packages/demo/src/Ignored.ts\n");
      yield* fs.writeFileString(path.join(sourceRoot, "Untracked.ts"), "export const untracked = 1;\n");
      yield* fs.writeFileString(path.join(sourceRoot, "Ignored.ts"), "export const ignored = 1;\n");
      // Nothing is committed or staged: Turbo hashes every non-ignored file, so the
      // scan must count them too or `git add` alone would reuse a stale cached inventory.
      const init = yield* runRepoCommandCapture("git", ["init", "--quiet", "--template=", "."], repoRoot, {
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
      });
      expect(init.exitCode).toBe(0);

      const inventory = yield* buildJSDocDocumentationInventory(
        JSDocDocumentationInventoryOptions.make({ rootDir: repoRoot, generatedAt: fixedGeneratedAt })
      );
      const files = A.flatMap(inventory.packages, (pkg) => A.map(pkg.modules, (entry) => entry.filePath));
      expect(files).toEqual(["src/Untracked.ts", "src/index.ts"]);
      // The ratchet's zero-legacy corpus follows the same rule.
      const zeroLegacyCorpusFiles8 = yield* zeroLegacyCorpusFiles(repoRoot, false);
      expect(zeroLegacyCorpusFiles8).toEqual(["packages/demo/src/Untracked.ts", "packages/demo/src/index.ts"]);
    })
  );

  it.effect(
    "excludes lab workspaces from the JSDoc inventory while both writers still emit",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* acquireLabsFixtureRepo();
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const outputJsonPath = path.join(repoRoot, "out", "jsdoc.inventory.jsonc");
      const outputMarkdownPath = path.join(repoRoot, "out", "jsdoc.inventory.md");

      const result = yield* writeJSDocDocumentationInventory(
        JSDocDocumentationInventoryOptions.make({
          rootDir: repoRoot,
          outputJsonPath,
          outputMarkdownPath,
          generatedAt: fixedGeneratedAt,
        })
      );
      const readFileString9 = yield* fs.readFileString(outputJsonPath);
      const inventory = parseJsoncText(readFileString9) as {
        readonly packages: ReadonlyArray<{ readonly packageName: string }>;
      };
      const markdown = yield* fs.readFileString(outputMarkdownPath);

      expect(result.outputJsonPath).toBe(outputJsonPath);
      expect(result.outputMarkdownPath).toBe(outputMarkdownPath);
      expect(A.map(inventory.packages, (pkg) => pkg.packageName)).toEqual(["@beep/demo"]);
      expect(markdown).toContain("# JSDoc Documentation Compliance Inventory");
      expect(markdown).not.toContain("@beep/lab-demo");
    })
  );

  it.effect("summarizes Turbo affected query output with banner text", () =>
    Effect.gen(function* () {
      const summary = yield* summarizeTurboQueryAffectedOutput(`• turbo 2.9.16
{
  "data": {
    "affectedTasks": {
      "items": [
        {
          "name": "lint",
          "package": { "name": "@beep/demo" },
          "reason": { "__typename": "TaskFileChanged" }
        },
        {
          "name": "check",
          "package": { "name": "@beep/demo" },
          "reason": { "__typename": "TaskGlobalDepsChanged" }
        },
        {
          "name": "lint",
          "package": { "name": "@beep/other" },
          "reason": { "__typename": "TaskFileChanged" }
        }
      ]
    }
  }
}
`);

      expect(summary.total).toBe(3);
      expect(summary.packages).toBe(2);
      expect(summary.byTask).toEqual({ check: 1, lint: 2 });
      expect(summary.byReason).toEqual({ TaskFileChanged: 2, TaskGlobalDepsChanged: 1 });
    })
  );

  it.effect("binds the requested source range to the query and every dry run for both selectors", () =>
    Effect.forEach(
      [TurboConfigProofSelectorMode.Enum.affected, TurboConfigProofSelectorMode.Enum["filter-range"]],
      (selector) =>
        Effect.gen(function* () {
          const spawner = ScriptedSpawner.make((_command, args) => ({
            stdout: A.contains(args, "query")
              ? '{"data":{"affectedTasks":{"items":[]}}}'
              : '{"packages":[],"tasks":[]}',
          }));
          const base = "refs/tags/requested-proof-base";
          const head = "refs/heads/requested-proof-head";
          const report = yield* runTurboConfigProof(
            "/repo",
            TurboConfigProofOptions.make({ base, head, selector, tasks: ["lint", "check"] })
          ).pipe(provideSpawner(spawner));

          const requestedRange = expect.objectContaining({
            env: expect.objectContaining({ TURBO_SCM_BASE: base, TURBO_SCM_HEAD: head }),
            extendEnv: true,
          });
          expect(spawner.spawns).toEqual([requestedRange, requestedRange, requestedRange]);
          expect(spawner.spawns[0]?.args).toContain(base);
          expect(spawner.spawns[0]?.args).toContain(head);
          expect(report.base).toBe(base);
          expect(report.head).toBe(head);
          expect(A.map(report.dryRuns, (dryRun) => dryRun.task)).toEqual(["lint", "check"]);
        }),
      { concurrency: 1 }
    )
  );

  it.effect("rejects absent or malformed affected-query task arrays", () =>
    Effect.forEach(
      [
        "",
        "{}",
        '{"data":null}',
        '{"data":{"affectedTasks":{"items":{}}}}',
        '{"data":{"affectedTasks":{"items":[null]}}}',
      ],
      (output) =>
        summarizeTurboQueryAffectedOutput(output).pipe(
          Effect.flip,
          Effect.map((error) => expect(error._tag).toBe("TurboConfigProofError"))
        ),
      { concurrency: 1 }
    )
  );

  it.effect("rejects absent or malformed dry-run task arrays", () =>
    Effect.forEach(
      ["", "{}", '{"tasks":"missing"}', '{"tasks":[null]}', '{"tasks":[],"packages":{}}'],
      (output) =>
        summarizeTurboDryRunOutput(output).pipe(
          Effect.flip,
          Effect.map((error) => expect(error._tag).toBe("TurboConfigProofError"))
        ),
      { concurrency: 1 }
    )
  );

  it.effect("does not retain synthetic native payload values in parser failures", () => {
    const sentinel = "synthetic-native-payload-must-not-be-retained";
    return Effect.forEach(
      [
        summarizeTurboDryRunOutput(`{"${sentinel}":`),
        summarizeTurboDryRunOutput(encodeJson({ tasks: sentinel })),
        summarizeTurboQueryAffectedOutput(encodeJson({ data: { affectedTasks: { items: sentinel } } })),
      ],
      (parse) =>
        parse.pipe(
          Effect.flip,
          Effect.map((error) => expect(encodeJson(error)).not.toContain(sentinel))
        ),
      { concurrency: 1 }
    );
  });

  it.effect("preserves explicitly empty native selections", () =>
    Effect.gen(function* () {
      const query = yield* summarizeTurboQueryAffectedOutput('{"data":{"affectedTasks":{"items":[]}}}');
      const dry = yield* summarizeTurboDryRunOutput('{"tasks":[]}');
      expect(query.total).toBe(0);
      expect(query.packages).toBe(0);
      expect(dry.total).toBe(0);
      expect(dry.packages).toBe(0);
    })
  );

  it.effect("summarizes Turbo dry-run output by task and cache status", () =>
    Effect.gen(function* () {
      const summary = yield* summarizeTurboDryRunOutput(`• turbo 2.9.16
{
  "packages": ["@beep/demo", "@beep/other"],
  "tasks": [
    {
      "task": "lint",
      "package": "@beep/demo",
      "cache": { "status": "HIT" }
    },
    {
      "task": "lint",
      "package": "@beep/other",
      "cache": { "status": "MISS" }
    },
    {
      "taskId": "@beep/demo#check",
      "package": "@beep/demo",
      "cacheStatus": "MISS"
    }
  ]
}
`);

      expect(summary.total).toBe(3);
      expect(summary.packages).toBe(2);
      expect(summary.byTask).toEqual({ check: 1, lint: 2 });
      expect(summary.byStatus).toEqual({ HIT: 1, MISS: 2 });
    })
  );
});
