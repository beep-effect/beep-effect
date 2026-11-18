import * as Catalog from "@beep/contract-kit/Catalog";
import * as Parity from "@beep/contract-kit/Parity";
import {
  ArchitectureSliceRolePlan,
  applyCanonicalSliceOperationPlan,
  architectureCommand,
  CanonicalSliceOperationPlan,
  checkCanonicalSliceOperationPlan,
  decodeCanonicalSliceOperationPlanJson,
  encodeCanonicalSliceOperationPlanJson,
  ensureCurrentModelFirstReferences,
  makeArchitectureOperationPlan,
  makeModelFirstContextOperationPlan,
  modelFirstPackagePathsOf,
  renderPackageJsonOperation,
  shapeOfOperationPlan,
  WriteFileOperation,
  WritePackageJsonOperation,
} from "@beep/repo-cli/commands/Architecture";
import { modelFirstOperationsFor } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstContext";
import {
  duplicateBindingsOf,
  ModelFirstContextRequest,
  modelFirstContextNamesFor,
} from "@beep/repo-cli/commands/Architecture/internal/ModelFirstTemplates";
import { registerScaffoldedWorkspaceEntries } from "@beep/repo-cli/commands/CreatePackage";
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
import * as O from "effect/Option";
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
const decodeRootWorkspaces = S.decodeUnknownEffect(S.fromJsonString(S.Struct({ workspaces: S.Array(S.String) })));

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

// As if @beep/contract-kit had moved after the plan was saved.
const staleOf = (plan: CanonicalSliceOperationPlan): CanonicalSliceOperationPlan =>
  CanonicalSliceOperationPlan.make({
    ...plan,
    operations: A.map(plan.operations, (operation) =>
      isWriteFileOperation(operation)
        ? WriteFileOperation.make({
            ...operation,
            content: Str.replaceAll(
              "foundation/modeling/contract-kit",
              "foundation/capability/contract-kit"
            )(operation.content),
          })
        : operation
    ),
  });

const checkoutIdentity = "packages/foundation/modeling/identity";

// Each checkout workspace gets a project: TS-morph scopes the identity
// registry edit to the project owning the file, and the tsconfig sync gives a
// project reference only to a workspace with an owner config.
const writeWorkspaceProject = Effect.fnUntraced(function* (identityDirectory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const project = yield* jsonStringifyPretty({ include: ["src"], compilerOptions: { rootDir: "src" } });
  yield* fs.writeFileString(path.join(identityDirectory, "tsconfig.json"), project);
});
const checkoutKit = "packages/foundation/modeling/contract-kit";

// A disposable checkout in the git-ignored tmp/ holding the named workspaces
// (by default the identity workspace and the contract kit's manifest: enough
// for the planner to resolve a context).
const makeCheckout = Effect.fnUntraced(function* (
  prefix: string,
  workspaces: ReadonlyArray<string> = [checkoutIdentity, checkoutKit]
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* repoRoot;
  const tmpRoot = path.join(root, "packages/tooling/tool/cli/tmp");
  yield* fs.makeDirectory(tmpRoot, { recursive: true });
  const checkout = yield* fs.makeTempDirectoryScoped({ directory: tmpRoot, prefix });
  const rootManifest = yield* jsonStringifyPretty({ name: "proof-checkout", private: true, workspaces });
  yield* fs.writeFileString(path.join(checkout, "package.json"), rootManifest);
  const files = A.flatMap(workspaces, (workspace) =>
    workspace === checkoutIdentity
      ? [`${workspace}/package.json`, `${workspace}/src/packages.ts`]
      : [`${workspace}/package.json`]
  );
  for (const file of files) {
    yield* fs.makeDirectory(path.dirname(path.join(checkout, file)), { recursive: true });
    yield* fs.copyFile(path.join(root, file), path.join(checkout, file));
  }
  for (const workspace of workspaces) {
    yield* writeWorkspaceProject(path.join(checkout, workspace));
  }
  return checkout;
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

        // The templates call only what @beep/contract-kit exports.
        const generatedText = A.join(
          A.map(A.filter(plan.operations, isWriteFileOperation), (op) => op.content),
          "\n"
        );
        const catalogCalls = pipe(
          A.fromIterable(pipe(generatedText, Str.matchAll(/Catalog\.(\w+)\(/g))),
          A.map((match) => match[1] ?? ""),
          A.dedupe
        );
        const parityImports = pipe(
          A.fromIterable(pipe(generatedText, Str.matchAll(/import \{ (\w+) \} from "@beep\/contract-kit\/Parity"/g))),
          A.map((match) => match[1] ?? ""),
          A.dedupe
        );
        expect(catalogCalls).toEqual(["make"]);
        expect(A.every(catalogCalls, (name) => A.some(R.keys(Catalog), (key) => key === name))).toBe(true);
        expect(parityImports).toEqual(["groupShape"]);
        expect(A.every(parityImports, (name) => A.some(R.keys(Parity), (key) => key === name))).toBe(true);
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

  layer(TestLayer, { timeout: "60 seconds" })((it) => {
    it.effect(
      "registers all three generated packages as workspaces with identity composers",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* repoRoot;
        const tmpRoot = path.join(root, "packages/tooling/tool/cli/tmp");
        yield* fs.makeDirectory(tmpRoot, { recursive: true });
        // A disposable checkout: a root manifest, the identity workspace and its
        // registry, and nothing the registration is meant to write.
        const checkout = yield* fs.makeTempDirectoryScoped({ directory: tmpRoot, prefix: "model-first-registration-" });
        const identity = "packages/foundation/modeling/identity";
        const rootManifest = yield* jsonStringifyPretty({
          name: "registration-proof",
          private: true,
          workspaces: [identity],
        });
        yield* fs.writeFileString(path.join(checkout, "package.json"), rootManifest);
        yield* fs.makeDirectory(path.join(checkout, identity, "src"), { recursive: true });
        for (const file of ["package.json", "src/packages.ts"]) {
          yield* fs.copyFile(path.join(root, identity, file), path.join(checkout, identity, file));
        }
        yield* writeWorkspaceProject(path.join(checkout, identity));

        const plan = yield* notesPlan;
        yield* applyCanonicalSliceOperationPlan(checkout, plan);
        const packagePaths = A.map(plan.roles, (role) => role.path);
        const registered = yield* registerScaffoldedWorkspaceEntries(checkout, packagePaths);

        expect(registered.addedWorkspaces).toEqual(packagePaths);
        expect(sorted(registered.registeredSlugs)).toEqual(["notes-contract", "notes-host", "notes-model"]);
        const manifest = yield* fs.readFileString(path.join(checkout, "package.json"));
        const workspaces = yield* decodeRootWorkspaces(manifest);
        expect(workspaces.workspaces).toEqual([identity, ...packagePaths]);
        const registry = yield* fs.readFileString(path.join(checkout, identity, "src/packages.ts"));
        for (const composer of ["$NotesContractId", "$NotesModelId", "$NotesHostId"]) {
          expect(pipe(registry, Str.includes(`export const ${composer}`))).toBe(true);
        }
        // Registration is idempotent: a second pass adds nothing.
        const again = yield* registerScaffoldedWorkspaceEntries(checkout, packagePaths);
        expect(again.addedWorkspaces).toEqual([]);
        expect(again.registeredSlugs).toEqual([]);
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

    const shapeCases: ReadonlyArray<
      readonly [name: string, args: ReadonlyArray<string>, shape: string, context: string, concept: string]
    > = [
      ["a bare plan is the legacy lab plan", [], "legacy", "architecture-lab", "WorkItem"],
      [
        "--shape legacy is legacy",
        ["--shape", "legacy", "--slice", "notes", "--concept", "Note"],
        "legacy",
        "notes",
        "Note",
      ],
      ["--stage alone implies legacy", ["--stage", "core"], "legacy", "architecture-lab", "WorkItem"],
      ["--domain-kind alone implies legacy", ["--domain-kind", "entities"], "legacy", "architecture-lab", "WorkItem"],
      [
        "--stage with an explicit slice and concept stays legacy",
        ["--slice", "notes", "--concept", "Note", "--stage", "core"],
        "legacy",
        "notes",
        "Note",
      ],
      [
        "an explicit --slice and --concept is model-first",
        ["--slice", "notes", "--concept", "Note"],
        "model-first",
        "notes",
        "Note",
      ],
      [
        "--shape model-first with --slice and --concept is model-first",
        ["--shape", "model-first", "--slice", "notes", "--concept", "Note"],
        "model-first",
        "notes",
        "Note",
      ],
    ];
    for (const [name, args, shape, context, concept] of shapeCases) {
      it.effect(
        `plan: ${name}`,
        Effect.fnUntraced(
          function* () {
            yield* runArchitectureCommand(["plan", ...args]);
            const output = yield* loggedText;
            const plan = yield* decodeCanonicalSliceOperationPlanJson(output);
            expect([shapeOfOperationPlan(plan), plan.target.boundedContext, plan.target.concept]).toEqual([
              shape,
              context,
              concept,
            ]);
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        )
      );
    }

    const refusalCases: ReadonlyArray<readonly [name: string, args: ReadonlyArray<string>, message: string]> = [
      [
        "--shape model-first without --slice and --concept",
        ["--shape", "model-first"],
        "missing --slice and --concept",
      ],
      ["--shape model-first without --concept", ["--shape", "model-first", "--slice", "notes"], "missing --concept"],
      [
        "--shape model-first --stage core",
        ["--shape", "model-first", "--slice", "notes", "--concept", "Note", "--stage", "core"],
        "--stage and --domain-kind apply to the legacy shape only",
      ],
    ];
    for (const [name, args, message] of refusalCases) {
      it.effect(
        `plan refuses ${name}`,
        Effect.fnUntraced(
          function* () {
            const refusal = yield* Effect.flip(runArchitectureCommand(["plan", ...args]));
            expect(String(refusal)).toContain(message);
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        )
      );
    }

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

    it.effect(
      "a saved plan applies only while its project references match the workspace graph",
      Effect.fnUntraced(function* () {
        // A fresh checkout, so no earlier scaffold of the context can be there.
        const checkout = yield* makeCheckout("model-first-fresh-");
        const plan = yield* makeModelFirstContextOperationPlan({
          repoRoot: checkout,
          context: "notes",
          module: "Note",
        });
        yield* ensureCurrentModelFirstReferences(checkout, plan);
        const refusal = yield* Effect.flip(ensureCurrentModelFirstReferences(checkout, staleOf(plan)));
        expect(refusal.message).toContain("packages/notes/contract/tsconfig.json");
        expect(refusal.message).toContain("Regenerate the plan");
        // Nothing of the plan exists in the checkout, so there is nothing to reconcile.
        expect(refusal.message).not.toContain("already exist");
      })
    );

    it.effect(
      "registration paths come from the manifests the plan writes; an edited role path is refused",
      Effect.fnUntraced(function* () {
        const plan = yield* notesPlan;
        const packagePaths = yield* modelFirstPackagePathsOf(plan);
        expect(packagePaths).toEqual(["packages/notes/contract", "packages/notes/model", "packages/notes/host"]);
        const edited = CanonicalSliceOperationPlan.make({
          ...plan,
          roles: A.map(plan.roles, (rolePlan) =>
            rolePlan.role === "model"
              ? ArchitectureSliceRolePlan.make({ ...rolePlan, path: "packages/notes/host" })
              : rolePlan
          ),
        });
        const refusal = yield* Effect.flip(modelFirstPackagePathsOf(edited));
        expect(refusal.message).toContain("model: packages/notes/host");
      })
    );

    it.effect(
      "rejects a context named after a directory workspace discovery skips",
      Effect.fnUntraced(function* () {
        const refusal = yield* Effect.flip(
          makeModelFirstContextOperationPlan({ repoRoot: "/repo", context: "build", module: "Task" })
        );
        expect(refusal.message).toContain("workspace discovery skips a directory named build");
      })
    );

    it.effect(
      "references a dependency's tsconfig.build.json when it has one, as the tsconfig sync does",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const checkout = yield* makeCheckout("model-first-build-config-");
        const project = yield* jsonStringifyPretty({ extends: "./tsconfig.json" });
        yield* fs.writeFileString(path.join(checkout, checkoutKit, "tsconfig.build.json"), project);
        const plan = yield* makeModelFirstContextOperationPlan({
          repoRoot: checkout,
          context: "notes",
          module: "Note",
        });
        const contractConfig = pipe(
          plan.operations,
          A.filter(isWriteFileOperation),
          A.findFirst((operation) => operation.path === "packages/notes/contract/tsconfig.json"),
          O.map((operation) => operation.content),
          O.getOrElse(() => "")
        );
        expect(contractConfig).toContain("../../foundation/modeling/contract-kit/tsconfig.build.json");
        expect(contractConfig).toContain("../../foundation/modeling/identity/tsconfig.json");
      })
    );

    it.effect(
      "rejects a Module name that is not PascalCase",
      Effect.fnUntraced(function* () {
        const refusal = yield* Effect.flip(
          makeModelFirstContextOperationPlan({ repoRoot: "/repo", context: "notes", module: "note" })
        );
        expect(refusal.message).toContain("a Module is a PascalCase name");
      })
    );

    it.effect(
      "rejects a checkout without the @beep/identity workspace",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("model-first-no-identity-", [checkoutKit]);
        const refusal = yield* Effect.flip(
          makeModelFirstContextOperationPlan({ repoRoot: checkout, context: "notes", module: "Note" })
        );
        expect(refusal.message).toContain("The @beep/identity workspace is not in the repository");
      })
    );

    it.effect(
      "rejects a checkout missing a workspace the generated packages depend on",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("model-first-no-kit-", [checkoutIdentity]);
        const refusal = yield* Effect.flip(
          makeModelFirstContextOperationPlan({ repoRoot: checkout, context: "notes", module: "Note" })
        );
        expect(refusal.message).toContain('Workspace package "@beep/contract-kit" is not in the repository.');
      })
    );

    it.effect(
      "a legacy plan refuses a role its domain kind does not support and keeps one it does",
      Effect.fnUntraced(function* () {
        const root = yield* repoRoot;
        const refusal = yield* Effect.flip(
          makeArchitectureOperationPlan(
            root,
            { boundedContext: "research-lab", concept: "Priority", domainKind: "values" },
            O.some(["server"])
          )
        );
        expect(refusal.message).toContain("do not support role(s): server");
        const allowed = yield* makeArchitectureOperationPlan(
          root,
          { boundedContext: "research-lab", concept: "Priority", domainKind: "values" },
          O.some(["domain"])
        );
        expect(A.map(allowed.roles, (role) => role.role)).toEqual(["domain"]);
      })
    );

    it.effect(
      "check --file refuses a model-first plan whose references are stale, like apply",
      Effect.fnUntraced(
        function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* fs.makeTempDirectoryScoped({ prefix: "model-first-stale-" });
          const planPath = path.join(dir, "plan.json");
          const plan = yield* notesPlan;
          const json = yield* encodeCanonicalSliceOperationPlanJson(staleOf(plan));
          yield* fs.writeFileString(planPath, json);
          const refusal = yield* Effect.flip(runArchitectureCommand(["check", "--file", planPath]));
          expect(String(refusal)).toContain("no longer match the workspace graph");
        },
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "after an interrupted apply the stale-plan error lists the files to reconcile",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("model-first-interrupted-");
        const plan = yield* makeModelFirstContextOperationPlan({
          repoRoot: checkout,
          context: "notes",
          module: "Note",
        });
        yield* applyCanonicalSliceOperationPlan(checkout, plan);
        const refusal = yield* Effect.flip(ensureCurrentModelFirstReferences(checkout, staleOf(plan)));
        expect(refusal.message).toContain("already exist");
        expect(refusal.message).toContain("packages/notes/contract/tsconfig.json");
        expect(refusal.message).toContain("reconcile");
        expect(refusal.message).toContain("never overwrites a differing file");
      })
    );

    it.effect(
      "rejects a context whose generated workspace names another package owns",
      Effect.fnUntraced(function* () {
        const root = yield* repoRoot;
        const refusal = yield* Effect.flip(
          makeModelFirstContextOperationPlan({ repoRoot: root, context: "skill", module: "Skill" })
        );
        expect(refusal.message).toContain(
          "@beep/skill-contract (owned by packages/foundation/modeling/skill-contract)"
        );
      })
    );

    const clashCases: ReadonlyArray<readonly [context: string, module: string, clash: string]> = [
      ["notes", "Domain", "model/src/Domain/Domain.aggregate.ts: Domain"],
      ["notes", "Effect", "model/src/Effect/Effect.aggregate.ts: Effect"],
      ["notes", "Story", "model/test/Notes.story.test.ts: Story"],
      ["notes", "NotesModel", "model/src/Notes.model.ts: NotesModel"],
      ["create", "Model", "model/test/Create.story.test.ts: CreateModel"],
    ];
    for (const [context, module, clash] of clashCases) {
      it.effect(
        `rejects ${context}/${module}, which binds a name twice in a generated file`,
        Effect.fnUntraced(function* () {
          const refusal = yield* Effect.flip(
            makeModelFirstContextOperationPlan({ repoRoot: "/repo", context, module })
          );
          expect(refusal.message).toContain("would bind a name twice");
          expect(refusal.message).toContain(clash);
        })
      );
    }

    it("reads type-only, aliased and destructured bindings by namespace", () => {
      const source = A.join(
        [
          'import type * as T from "t";',
          'import type { U } from "u";',
          'import { type V, W as X } from "v";',
          "interface T {}",
          "type U = string;",
          "const { V } = values;",
          "export function X() {}",
        ],
        "\n"
      );
      expect(duplicateBindingsOf(source)).toEqual(["T", "U", "X"]);
    });

    it.effect(
      "a package with no project references gets none in its tsconfig and an empty list in its overlays",
      Effect.fnUntraced(function* () {
        const plan = yield* notesPlan;
        const names = modelFirstContextNamesFor(ModelFirstContextRequest.make({ context: "notes", module: "Note" }));
        const operations = modelFirstOperationsFor(names, { contract: [], model: [], host: [] });
        const contentOf = (path: string) =>
          pipe(
            operations,
            A.filter(isWriteFileOperation),
            A.findFirst((operation) => operation.path === path),
            O.map((operation) => operation.content),
            O.getOrElse(() => "")
          );
        expect(contentOf("packages/notes/host/tsconfig.json")).not.toContain("references");
        expect(contentOf("packages/notes/host/tsconfig.check.json")).toContain('"references": []');
        expect(A.length(operations)).toBe(A.length(plan.operations));
      })
    );

    it.effect(
      "notes/Note binds every name once in every generated file",
      Effect.fnUntraced(function* () {
        const plan = yield* notesPlan;
        const clashes = pipe(
          plan.operations,
          A.filter(isWriteFileOperation),
          A.filter((operation) => Str.endsWith(".ts")(operation.path)),
          A.flatMap((operation) => duplicateBindingsOf(operation.content))
        );
        expect(clashes).toEqual([]);
      })
    );

    it.effect(
      "refuses a context whose identity accessors another package already owns, and replays its own",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("model-first-accessors-");

        // Create notes2 the way create context does: apply, then register.
        const notes2 = yield* makeModelFirstContextOperationPlan({
          repoRoot: checkout,
          context: "notes2",
          module: "Note",
        });
        yield* applyCanonicalSliceOperationPlan(checkout, notes2);
        yield* registerScaffoldedWorkspaceEntries(
          checkout,
          A.map(notes2.roles, (role) => role.path)
        );

        const refusal = yield* Effect.flip(
          makeModelFirstContextOperationPlan({ repoRoot: checkout, context: "notes-2", module: "Note" })
        );
        expect(refusal.message).toContain("$Notes2ContractId (registered to @beep/notes2-contract)");
        expect(refusal.message).toContain("$Notes2ModelId (registered to @beep/notes2-model)");
        expect(refusal.message).toContain("$Notes2HostId (registered to @beep/notes2-host)");
        const replay = yield* makeModelFirstContextOperationPlan({
          repoRoot: checkout,
          context: "notes2",
          module: "Note",
        });
        expect(replay.operations).toEqual(notes2.operations);
      })
    );
  });
});
