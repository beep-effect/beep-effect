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
import { TsconfigSyncPlan } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan";
import { runCapturedStreams } from "@beep/repo-cli-kit/process/StepExec";
import { workspaceDependencyGraph } from "@beep/repo-cli-kit/RepoWorkspaces";
import { FsUtilsLive, jsonStringifyPretty, TSMorphServiceLive } from "@beep/repo-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
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

const repoRoot = Effect.flatMap(Path.Path, (path) => path.fromFileUrl(new URL("../../../../..", import.meta.url)));

const notesPlan = Effect.flatMap(repoRoot, (root) =>
  makeModelFirstContextOperationPlan({ repoRoot: root, context: "notes", module: "Note" })
);

const isNotesPath = Str.includes("/packages/notes/");

// The throwaway context lives in the checkout's git-ignored `tmp/`, not at the
// repo root and not registered as workspaces, so the harness supplies only what
// that location takes away. The generated package files are used as written.
//
// - `tsconfig.base.json` and `vitest.shared.ts`: the generated tsconfigs and
//   Vitest configs extend `../../../<file>`, the repo root in a real context.
// - `packages/foundation/modeling/{identity,contract-kit}`: the real manifests
//   and a tsconfig extending the real project, so the generated project
//   references resolve as they do in place (the sync skips linked workspaces).
// - `node_modules/@beep/notes-*`: the workspace links `bun install` makes.
// - `node_modules/@beep/identity` and the Vitest alias to it: the identity
//   composers registration would add, `$NotesContractId` and `$NotesModelId`.
// - `package.json`: the workspace list the tsconfig sync reads.
const writeHarness = Effect.fnUntraced(function* (proofRoot: string, root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const toRepo = path.relative(proofRoot, root);
  const writes: ReadonlyArray<readonly [string, string]> = [
    [
      "package.json",
      yield* jsonStringifyPretty({
        name: "model-first-proof",
        private: true,
        workspaces: [
          "packages/notes/contract",
          "packages/notes/model",
          "packages/notes/host",
          "packages/foundation/modeling/identity",
          "packages/foundation/modeling/contract-kit",
        ],
      }),
    ],
    ["tsconfig.base.json", yield* jsonStringifyPretty({ extends: path.join(toRepo, "tsconfig.base.json") })],
    [
      "vitest.shared.ts",
      `import shared from "${path.join(toRepo, "vitest.shared.ts")}";

const identity = new URL("./node_modules/@beep/identity/packages.ts", import.meta.url).pathname;
const alias = shared.resolve?.alias;

export default {
  ...shared,
  resolve: {
    ...shared.resolve,
    alias: [{ find: "@beep/identity/packages", replacement: identity }, ...(Array.isArray(alias) ? alias : [])],
  },
};
`,
    ],
    [
      "node_modules/@beep/identity/package.json",
      yield* jsonStringifyPretty({
        name: "@beep/identity",
        type: "module",
        exports: { "./packages": "./packages.ts" },
      }),
    ],
    [
      "node_modules/@beep/identity/packages.ts",
      `import { $I } from "@beep/identity-source/packages";

export * from "@beep/identity-source/packages";

const composers = $I.compose("notes-contract", "notes-model", "notes-host");

export const $NotesContractId = composers.$NotesContractId;
export const $NotesModelId = composers.$NotesModelId;
export const $NotesHostId = composers.$NotesHostId;
`,
    ],
  ];
  for (const [file, content] of writes) {
    yield* fs.makeDirectory(path.dirname(path.join(proofRoot, file)), { recursive: true });
    yield* fs.writeFileString(path.join(proofRoot, file), content);
  }
  const links: ReadonlyArray<readonly [string, string]> = [
    ["node_modules/@beep/identity-source", path.join(root, "packages/foundation/modeling/identity")],
    ["node_modules/@beep/notes-contract", path.join(proofRoot, "packages/notes/contract")],
    ["node_modules/@beep/notes-model", path.join(proofRoot, "packages/notes/model")],
    ["node_modules/@beep/notes-host", path.join(proofRoot, "packages/notes/host")],
  ];
  for (const dependency of ["packages/foundation/modeling/identity", "packages/foundation/modeling/contract-kit"]) {
    const proxy = path.join(proofRoot, dependency);
    const manifest = yield* fs.readFileString(path.join(root, dependency, "package.json"));
    const project = yield* jsonStringifyPretty({ extends: path.join(root, dependency, "tsconfig.json") });
    yield* fs.makeDirectory(proxy, { recursive: true });
    yield* fs.writeFileString(path.join(proxy, "package.json"), manifest);
    yield* fs.writeFileString(path.join(proxy, "tsconfig.json"), project);
  }
  for (const [link, target] of links) {
    yield* fs.makeDirectory(path.dirname(path.join(proofRoot, link)), { recursive: true });
    yield* fs.symlink(target, path.join(proofRoot, link));
  }
});

const run = (cwd: string, command: string, args: ReadonlyArray<string>) =>
  runCapturedStreams({ command, args, cwd, extendEnv: true, env: { FORCE_COLOR: "0", NO_COLOR: "1" } });

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

  layer(TestLayer, { timeout: "300 seconds" })((it) => {
    it.effect(
      "apply then check is idempotent after the tsconfig sync, and the packages' own scripts pass",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* repoRoot;
        // Inside the checkout (so packages resolve the root node_modules) and git-ignored (`tmp/`).
        const tmpRoot = path.join(root, "packages/tooling/tool/cli/tmp");
        yield* fs.makeDirectory(tmpRoot, { recursive: true });
        const proofRoot = yield* fs.makeTempDirectoryScoped({ directory: tmpRoot, prefix: "model-first-" });

        const plan = yield* notesPlan;
        const applied = yield* applyCanonicalSliceOperationPlan(proofRoot, plan);
        expect(applied.writtenPaths.length).toBe(plan.operations.length);
        yield* writeHarness(proofRoot, root);

        // The sync the real apply runs, planned by its own code over the generated packages.
        const workspaces = yield* TsconfigSyncPlan.buildWorkspaceDescriptors(proofRoot);
        const { adjacency } = yield* workspaceDependencyGraph(proofRoot);
        const references = yield* TsconfigSyncPlan.planPackageReferenceSync(
          proofRoot,
          workspaces,
          adjacency,
          undefined,
          false
        );
        const overlays = yield* TsconfigSyncPlan.planPackageCheckReferenceSync(workspaces, undefined, HashMap.empty());
        const docgen = yield* TsconfigSyncPlan.planPackageDocgenSync(proofRoot, workspaces, undefined);
        expect(A.filter(workspaces, (workspace) => isNotesPath(workspace.absoluteDir)).length).toBe(3);
        const notesChanges = pipe(
          [...references, ...overlays, ...docgen],
          A.map((change) => change.filePath),
          A.filter(isNotesPath)
        );
        expect(notesChanges).toEqual([]);

        const check = yield* checkCanonicalSliceOperationPlan(proofRoot, plan);
        expect(check.differingPaths).toEqual([]);
        expect(check.idempotent).toBe(true);

        // Each package's own `check` (build, then its tsconfig.test.json) in dependency order.
        for (const role of ["contract", "model", "host"] as const) {
          const checked = yield* run(path.join(proofRoot, "packages/notes", role), "bun", ["run", "beep:check"]);
          expect(Str.trim(Str.replace(/^\$ .*$/gmu, "")(`${checked.stdout}${checked.stderr}`))).toBe("");
          expect(checked.exitCode).toBe(0);
        }

        const lint = yield* run(root, "bunx", [
          "biome",
          "check",
          "--vcs-use-ignore-file=false",
          path.join(proofRoot, "packages/notes"),
        ]);
        expect(lint.exitCode).toBe(0);

        // Each package's own `test` script through its generated vitest.config.ts.
        const contractTests = yield* run(path.join(proofRoot, "packages/notes/contract"), "bun", ["run", "beep:test"]);
        expect(contractTests.exitCode).toBe(0);
        expect(`${contractTests.stdout}${contractTests.stderr}`).toContain("1 passed (1)");
        const modelTests = yield* run(path.join(proofRoot, "packages/notes/model"), "bun", ["run", "beep:test"]);
        expect(modelTests.exitCode).toBe(0);
        expect(`${modelTests.stdout}${modelTests.stderr}`).toContain("2 passed (2)");
        expect(`${modelTests.stdout}${modelTests.stderr}`).toContain("4 passed (4)");
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
        const refusal = yield* Effect.flip(
          makeModelFirstContextOperationPlan({ repoRoot: "/repo", context: "Notes", module: "Note" })
        );
        expect(refusal.message).toContain("kebab-case slug");
      })
    );
  });
});
