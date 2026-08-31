import {
  summarizeTurboDryRunOutput,
  summarizeTurboQueryAffectedOutput,
  writeJSDocDocumentationInventory,
} from "@beep/repo-cli/test/Quality";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as jsonc from "jsonc-parser";
import { describe, expect, it } from "vitest";

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const PlatformLayer = Layer.mergeAll(
  FileSystemLayer,
  NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(FileSystemLayer))
);
const encodeJson = UnknownFromJsonString.encodeUnknownSync;
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

const parseJsoncText = (text: string): unknown => {
  const errors: Array<jsonc.ParseError> = [];
  const parsed = jsonc.parse(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  expect(errors).toEqual([]);
  return parsed;
};

const acquireFixtureRepo = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* fs.makeTempDirectory();
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

const withFixtureRepo = Effect.fnUntraced(function* <A, E, R>(use: (repoRoot: string) => Effect.Effect<A, E, R>) {
  return yield* Effect.acquireUseRelease(
    acquireFixtureRepo(),
    use,
    Effect.fnUntraced(function* (repoRoot) {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.remove(repoRoot, { recursive: true });
    })
  ).pipe(provideScopedLayer(PlatformLayer));
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

const withLabsFixtureRepo = Effect.fnUntraced(function* <A, E, R>(use: (repoRoot: string) => Effect.Effect<A, E, R>) {
  return yield* Effect.acquireUseRelease(
    acquireLabsFixtureRepo(),
    use,
    Effect.fnUntraced(function* (repoRoot) {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.remove(repoRoot, { recursive: true });
    })
  ).pipe(provideScopedLayer(PlatformLayer));
});

describe("quality artifact generators", () => {
  it("writes the JSDoc inventory to explicit artifact paths", () =>
    Effect.runPromise(
      withFixtureRepo(
        Effect.fnUntraced(function* (repoRoot) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const outputJsonPath = path.join(repoRoot, "out", "jsdoc.inventory.jsonc");
          const outputMarkdownPath = path.join(repoRoot, "out", "jsdoc.inventory.md");

          const result = yield* writeJSDocDocumentationInventory({
            rootDir: repoRoot,
            outputJsonPath,
            outputMarkdownPath,
            generatedAt: fixedGeneratedAt,
          });
          const inventory = parseJsoncText(yield* fs.readFileString(outputJsonPath)) as {
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
          expect(inventory.packages.map((pkg) => pkg.packageName)).toEqual(["@beep/demo"]);
          expect(inventory.packages[0]?.counts.schemaAnnotationFindings).toBe(0);
          expect(markdown).toContain("# JSDoc Documentation Compliance Inventory");
        })
      )
    ));

  it("excludes lab workspaces from the JSDoc inventory while both writers still emit", () =>
    Effect.runPromise(
      withLabsFixtureRepo(
        Effect.fnUntraced(function* (repoRoot) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const outputJsonPath = path.join(repoRoot, "out", "jsdoc.inventory.jsonc");
          const outputMarkdownPath = path.join(repoRoot, "out", "jsdoc.inventory.md");

          const result = yield* writeJSDocDocumentationInventory({
            rootDir: repoRoot,
            outputJsonPath,
            outputMarkdownPath,
            generatedAt: fixedGeneratedAt,
          });
          const inventory = parseJsoncText(yield* fs.readFileString(outputJsonPath)) as {
            readonly packages: ReadonlyArray<{ readonly packageName: string }>;
          };
          const markdown = yield* fs.readFileString(outputMarkdownPath);

          expect(result.outputJsonPath).toBe(outputJsonPath);
          expect(result.outputMarkdownPath).toBe(outputMarkdownPath);
          expect(inventory.packages.map((pkg) => pkg.packageName)).toEqual(["@beep/demo"]);
          expect(markdown).toContain("# JSDoc Documentation Compliance Inventory");
          expect(markdown).not.toContain("@beep/lab-demo");
        })
      )
    ));

  it("summarizes Turbo affected query output with banner text", () =>
    Effect.runPromise(
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
        expect(summary.byTask).toEqual({ check: 1, lint: 2 });
        expect(summary.byReason).toEqual({ TaskFileChanged: 2, TaskGlobalDepsChanged: 1 });
      })
    ));

  it("summarizes Turbo dry-run output by task and cache status", () =>
    Effect.runPromise(
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
    ));
});
