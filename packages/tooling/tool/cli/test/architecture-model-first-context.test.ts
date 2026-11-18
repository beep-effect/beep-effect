import {
  applyCanonicalSliceOperationPlan,
  architectureCommand,
  checkCanonicalSliceOperationPlan,
  decodeCanonicalSliceOperationPlanJson,
  encodeCanonicalSliceOperationPlanJson,
  makeModelFirstContextOperationPlan,
  renderPackageJsonOperation,
  shapeOfOperationPlan,
  WriteFileOperation,
  WritePackageJsonOperation,
} from "@beep/repo-cli/commands/Architecture";
import { runCapturedStreams } from "@beep/repo-cli-kit/process/StepExec";
import { FsUtilsLive, jsonStringifyPretty, TSMorphServiceLive } from "@beep/repo-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const isWriteFileOperation = S.is(WriteFileOperation);
const isWritePackageJsonOperation = S.is(WritePackageJsonOperation);

const ManifestExports = S.Struct({
  exports: S.Record(S.String, S.NullOr(S.String)),
  publishConfig: S.Struct({ exports: S.Record(S.String, S.NullOr(S.String)) }),
  scripts: S.Record(S.String, S.String),
});
const decodeManifestExports = S.decodeUnknownEffect(S.fromJsonString(ManifestExports));

const platform = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);
const TestLayer = Layer.mergeAll(
  platform,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provideMerge(platform)),
  TSMorphServiceLive.pipe(Layer.provideMerge(platform))
);

const loggedText = Effect.map(TestConsole.logLines, (lines) => A.join(A.filter(lines, P.isString), "\n"));
const runArchitectureCommand = Command.runWith(architectureCommand, { version: "0.0.0" });

// The design's file list (goals/model-first-standard/research/01-scaffolder-design.md, item 6).
const expectedSourceFiles = [
  "packages/notes/contract/src/Note/Note.id.ts",
  "packages/notes/contract/src/Note/CreateNote.command.ts",
  "packages/notes/contract/src/Note/NoteSummary.read.ts",
  "packages/notes/contract/src/Notes.catalog.ts",
  "packages/notes/contract/src/NotesApi.contract.ts",
  "packages/notes/contract/test/Contract.imports.test.ts",
  "packages/notes/model/src/Note/Note.aggregate.ts",
  "packages/notes/model/src/Note/NoteSummary.view.ts",
  "packages/notes/model/src/Note/NoteSummary.handler.ts",
  "packages/notes/model/src/Notes.model.ts",
  "packages/notes/model/src/Notes.handlers.ts",
  "packages/notes/model/src/Notes.ports.ts",
  "packages/notes/model/src/NotesApi.api.ts",
  "packages/notes/model/test/Notes.story.test.ts",
  "packages/notes/model/test/NotesApi.parity.test.ts",
  "packages/notes/host/src/Adapters.ts",
  "packages/notes/host/src/Host.ts",
];

const expectedExports = {
  contract: [
    "./Note/Note.id",
    "./Note/CreateNote.command",
    "./Note/NoteSummary.read",
    "./Notes.catalog",
    "./NotesApi.contract",
  ],
  model: [
    "./Note/Note.aggregate",
    "./Note/NoteSummary.view",
    "./Note/NoteSummary.handler",
    "./Notes.model",
    "./Notes.handlers",
    "./Notes.ports",
    "./NotesApi.api",
  ],
  host: ["./Adapters", "./Host"],
};

const sorted = (values: ReadonlyArray<string>) => A.sort(values, Order.String);

const isSourceOrTest = (path: string) => pipe(path, Str.includes("/src/")) || pipe(path, Str.includes("/test/"));

const notesPlan = makeModelFirstContextOperationPlan({ context: "notes", module: "Note" });

// Generated packages resolve each other and their identity composers through
// this harness; in a real apply, workspace and identity registration do it.
const harnessFiles = Effect.fnUntraced(function* (proofRoot: string, repoRoot: string, path: Path.Path) {
  const toRepo = path.relative(proofRoot, repoRoot);
  const identitySource = path.join(toRepo, "packages/foundation/modeling/identity/src/packages.ts");
  const aliases = {
    "@beep/identity/packages": ["./identity-packages.ts"],
    "@beep/notes-contract/*": ["./packages/notes/contract/src/*.ts"],
    "@beep/notes-model/*": ["./packages/notes/model/src/*.ts"],
    "@beep/notes-host/*": ["./packages/notes/host/src/*.ts"],
  };
  return {
    "identity-packages.ts": `import { $I } from "${identitySource}";

export * from "${identitySource}";

const composers = $I.compose("notes-contract", "notes-model", "notes-host");

export const $NotesContractId = composers.$NotesContractId;
export const $NotesModelId = composers.$NotesModelId;
export const $NotesHostId = composers.$NotesHostId;
`,
    "tsconfig.base.json": yield* jsonStringifyPretty({
      extends: path.join(toRepo, "tsconfig.base.json"),
      compilerOptions: { paths: aliases },
    }),
    "tsconfig.proof.json": yield* jsonStringifyPretty({
      extends: "./tsconfig.base.json",
      include: ["identity-packages.ts", "packages/notes/*/src", "packages/notes/*/test"],
      compilerOptions: {
        rootDir: toRepo,
        noEmit: true,
        composite: false,
        declaration: false,
        declarationMap: false,
        incremental: false,
        sourceMap: false,
        types: ["node", "bun-types"],
      },
    }),
    "vitest.proof.config.ts": `import { defineConfig } from "vitest/config";

const at = (path: string) => new URL(path, import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [
      { find: "@beep/identity/packages", replacement: at("./identity-packages.ts") },
      { find: /^@beep\\/notes-contract\\/(.*)$/, replacement: \`\${at("./packages/notes/contract/src/")}$1.ts\` },
      { find: /^@beep\\/notes-model\\/(.*)$/, replacement: \`\${at("./packages/notes/model/src/")}$1.ts\` },
      { find: /^@beep\\/notes-host\\/(.*)$/, replacement: \`\${at("./packages/notes/host/src/")}$1.ts\` },
    ],
  },
  test: {
    include: ["packages/notes/*/test/**/*.test.ts"],
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
`,
  };
});

const run = (cwd: string, args: ReadonlyArray<string>) =>
  runCapturedStreams({ command: "bunx", args, cwd, extendEnv: true, env: { FORCE_COLOR: "0", NO_COLOR: "1" } });

describe("beep architecture: model-first context", () => {
  layer(TestLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "plans exactly the design's files with exact package exports",
      Effect.fnUntraced(function* () {
        const plan = yield* notesPlan;
        const paths = A.map(plan.operations, (operation) => operation.path);
        const sources = A.filter(paths, isSourceOrTest);

        expect(shapeOfOperationPlan(plan)).toBe("model-first");
        expect(sorted(sources)).toEqual(sorted(expectedSourceFiles));
        expect(A.map(plan.roles, (role) => [role.role, role.packageName, role.path, role.exports])).toEqual([
          ["contract", "@beep/notes-contract", "packages/notes/contract", expectedExports.contract],
          ["model", "@beep/notes-model", "packages/notes/model", expectedExports.model],
          ["host", "@beep/notes-host", "packages/notes/host", expectedExports.host],
        ]);
        expect(A.every(plan.operations, (operation) => operation.operationSource === "model-first-template")).toBe(
          true
        );

        const manifests = A.filter(plan.operations, isWritePackageJsonOperation);
        expect(A.map(manifests, (manifest) => manifest.path)).toEqual([
          "packages/notes/contract/package.json",
          "packages/notes/model/package.json",
          "packages/notes/host/package.json",
        ]);
        for (const manifest of manifests) {
          const rendered = yield* renderPackageJsonOperation(manifest);
          const decoded = yield* decodeManifestExports(rendered);
          const exported = [...manifest.exports, "./package.json"];
          expect(sorted(R.keys(decoded.exports))).toEqual(sorted(exported));
          expect(sorted(R.keys(decoded.publishConfig.exports))).toEqual(sorted(exported));
          expect(A.some(R.keys(decoded.exports), Str.includes("*"))).toBe(false);
          expect(decoded.scripts["beep:check:tests"]).toBe("tsrs -p tsconfig.test.json --noEmit");
        }
        expect(A.every(A.filter(plan.operations, isWriteFileOperation), (op) => op.content.length > 0)).toBe(true);
      })
    );
  });

  layer(TestLayer, { timeout: "240 seconds" })((it) => {
    it.effect(
      "generates sources that type-check, lint clean and pass their story and parity tests",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const cliRoot = yield* path.fromFileUrl(new URL("..", import.meta.url));
        const repoRoot = path.resolve(cliRoot, "../../../..");
        // Inside the checkout (so packages resolve the root node_modules) and git-ignored (`tmp/`).
        const tmpRoot = path.join(cliRoot, "tmp");
        yield* fs.makeDirectory(tmpRoot, { recursive: true });
        const proofRoot = yield* fs.makeTempDirectoryScoped({ directory: tmpRoot, prefix: "model-first-" });

        const plan = yield* notesPlan;
        const applied = yield* applyCanonicalSliceOperationPlan(proofRoot, plan);
        expect(applied.writtenPaths.length).toBe(plan.operations.length);
        const check = yield* checkCanonicalSliceOperationPlan(proofRoot, plan);
        expect(check.idempotent).toBe(true);

        const harness = yield* harnessFiles(proofRoot, repoRoot, path);
        for (const [file, content] of R.toEntries(harness)) {
          yield* fs.writeFileString(path.join(proofRoot, file), content);
        }

        const typeCheck = yield* run(proofRoot, ["tsrs", "-p", "tsconfig.proof.json"]);
        expect(`${typeCheck.stdout}${typeCheck.stderr}`).toBe("");
        expect(typeCheck.exitCode).toBe(0);

        const lint = yield* run(repoRoot, [
          "biome",
          "check",
          "--vcs-use-ignore-file=false",
          path.join(proofRoot, "packages"),
        ]);
        expect(lint.exitCode).toBe(0);

        const tests = yield* run(proofRoot, [
          "--bun",
          "vitest",
          "run",
          "--config",
          "vitest.proof.config.ts",
          "--root",
          ".",
        ]);
        expect(tests.exitCode).toBe(0);
        expect(`${tests.stdout}${tests.stderr}`).toContain("3 passed (3)");
        expect(`${tests.stdout}${tests.stderr}`).toContain("5 passed (5)");
      })
    );
  });

  layer(TestLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "create context --dry-run prints the model-first plan",
      Effect.fnUntraced(
        function* () {
          yield* runArchitectureCommand(["create", "context", "notes", "Note", "--dry-run"]);
          const output = yield* loggedText;
          const decoded = yield* decodeCanonicalSliceOperationPlanJson(output);
          expect(shapeOfOperationPlan(decoded)).toBe("model-first");
          expect(decoded.target.boundedContext).toBe("notes");
        },
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "plan defaults to the model-first shape and --shape legacy keeps the legacy plan",
      Effect.fnUntraced(
        function* () {
          yield* runArchitectureCommand(["plan", "--slice", "notes", "--concept", "Note"]);
          const output = yield* loggedText;
          const modelFirst = yield* decodeCanonicalSliceOperationPlanJson(output);
          expect(shapeOfOperationPlan(modelFirst)).toBe("model-first");
        },
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "apply refuses a plan of another shape than --shape names",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped({ prefix: "model-first-plan-" });
        const planPath = path.join(dir, "plan.json");
        const plan = yield* notesPlan;
        const json = yield* encodeCanonicalSliceOperationPlanJson(plan);
        yield* fs.writeFileString(planPath, json);
        const refusal = yield* Effect.flip(runArchitectureCommand(["apply", "--file", planPath, "--shape", "legacy"]));
        expect(String(refusal)).toContain("model-first slice, not a legacy one");
      })
    );

    it.effect(
      "rejects a context that is not a kebab-case slug",
      Effect.fnUntraced(function* () {
        const refusal = yield* Effect.flip(makeModelFirstContextOperationPlan({ context: "Notes", module: "Note" }));
        expect(refusal.message).toContain("kebab-case slug");
      })
    );
  });
});
