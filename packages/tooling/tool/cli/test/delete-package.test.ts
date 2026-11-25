import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import {
  BaselineOutputStamp,
  DeletePackageAcknowledgement,
  DeletePackageAcknowledgements,
  DeletePackageBaselineWriters,
  DeletePackagePolicy,
  DeletePackagePolicyEvaluation,
  DependentHit,
  DependentsReport,
  deletePackageCommand,
  dependentsOfAtRoot,
  inspectTargetAtRoot,
  planInverseForTarget,
  RegistrationTarget,
  removeShapeTestRow,
  rewritePendingChangesets,
} from "@beep/repo-cli/test/DeletePackage";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { PosixPath } from "@beep/schema/PosixPath";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, vi } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { expectReportedExit, gitFixture, NodeTestLayer, temporaryGitWorkingDirectory } from "./support/CommandTest.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { DeletePackageRefusal } from "@beep/repo-cli/test/DeletePackage";

const temporaryDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped();
});

const temporaryGitDirectory = Effect.tap(temporaryDirectory, gitFixture);

// A root `deploy` workspace beside `packages/tooling/deploy/x`, whose path ends in `deploy/x`: the
// shape that made `delete-package @beep/deploy` count every `packages/tooling/deploy/**` line.
const writeShadowedDeployFixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* fs.realPath(".");
  yield* fs.writeFileString(
    "package.json",
    '{ "name": "fixture", "private": true, "workspaces": ["deploy", "packages/tooling/deploy/x", "packages/consumer"] }\n'
  );
  yield* fs.writeFileString("bun.lock", "");
  yield* fs.makeDirectory("deploy", { recursive: true });
  yield* fs.makeDirectory(path.join("packages", "tooling", "deploy", "x"), { recursive: true });
  yield* fs.makeDirectory(path.join("packages", "consumer"), { recursive: true });
  yield* fs.writeFileString(path.join("deploy", "package.json"), '{ "name": "@beep/deploy", "private": true }\n');
  yield* fs.writeFileString(
    path.join("packages", "tooling", "deploy", "x", "package.json"),
    A.join(
      [
        "{",
        '  "name": "@beep/deploy-x",',
        '  "private": true,',
        '  "homepage": "https://github.com/beep-effect/beep-effect/tree/main/packages/tooling/deploy/x",',
        '  "repository": { "directory": "packages/tooling/deploy/x" }',
        "}",
        "",
      ],
      "\n"
    )
  );
  yield* fs.writeFileString(
    path.join("packages", "consumer", "package.json"),
    '{ "name": "@beep/consumer", "private": true }\n'
  );
  yield* fs.writeFileString(path.join("packages", "consumer", "README.md"), "Reads `deploy/src/index.ts`.\n");
  yield* fs.writeFileString(
    path.join("packages", "consumer", "notes.md"),
    "Deploys from `packages/tooling/deploy/x/src`.\n"
  );
  return repoRoot;
});

const rootDeployTarget = RegistrationTarget.make({
  packageName: "@beep/deploy",
  packagePath: PosixPath.make("deploy"),
  private: true,
});

// The tree after `delete-package @beep/deploy` applied: the root `deploy` workspace and its
// workspace literal are gone, the sibling `packages/tooling/deploy/x` remains, plus `files`.
const writeDeletedDeployLayout = Effect.fn("writeDeletedDeployLayout")(function* (
  files: ReadonlyArray<readonly [string, string]>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* fs.realPath(".");
  yield* fs.writeFileString(
    "package.json",
    '{ "name": "fixture", "private": true, "workspaces": ["packages/tooling/deploy/x", "packages/consumer"] }\n'
  );
  yield* fs.writeFileString("bun.lock", "");
  yield* fs.makeDirectory(path.join("packages", "tooling", "deploy", "x"), { recursive: true });
  yield* fs.makeDirectory(path.join("packages", "consumer"), { recursive: true });
  yield* fs.writeFileString(
    path.join("packages", "tooling", "deploy", "x", "package.json"),
    '{ "name": "@beep/deploy-x", "private": true, "repository": { "directory": "packages/tooling/deploy/x" } }\n'
  );
  yield* fs.writeFileString(
    path.join("packages", "consumer", "package.json"),
    '{ "name": "@beep/consumer", "private": true }\n'
  );
  yield* Effect.forEach(
    files,
    ([file, content]) =>
      Effect.andThen(fs.makeDirectory(path.dirname(file), { recursive: true }), fs.writeFileString(file, content)),
    { concurrency: 1 }
  );
  return repoRoot;
});

// The generated inventories keyed by file path (`membershipKey: target.packagePath`), each holding
// one entry for `file`.
const PATH_KEYED_INVENTORY_SURFACES = ["fallow-health-baseline", "fallow-dead-code-baseline", "schema-first-inventory"];

const pathKeyedInventories = (file: string): ReadonlyArray<readonly [string, string]> => [
  ["standards/fallow.health.regression-baseline.jsonc", `{ "files": { "${file}": { "cyclomatic": 3 } } }\n`],
  ["standards/fallow.dead-code.regression-baseline.jsonc", `{ "unused_exports": ["${file}:helper"] }\n`],
  ["standards/schema-first.inventory.jsonc", `{ "entries": [{ "file": "${file}", "symbol": "Stack" }] }\n`],
];

type ObservationRow = { readonly surfaceId: string; readonly status: string; readonly evidence: ReadonlyArray<string> };

const observationOf = (observations: ReadonlyArray<ObservationRow>, surfaceId: string) =>
  A.findFirst(observations, (item) => item.surfaceId === surfaceId);

const statusOf = (observations: ReadonlyArray<ObservationRow>, surfaceId: string) =>
  O.getOrUndefined(O.map(observationOf(observations, surfaceId), (item) => item.status));

const evidenceOf = (observations: ReadonlyArray<ObservationRow>, surfaceId: string) =>
  O.getOrElse(
    O.map(observationOf(observations, surfaceId), (item) => item.evidence),
    () => A.empty<string>()
  );

const target = RegistrationTarget.make({
  packageName: "@beep/courtlistener",
  packagePath: PosixPath.make("packages/drivers/courtlistener"),
  private: true,
});

const commandLayer = Layer.mergeAll(
  NodeTestLayer,
  FsUtilsLive.pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))),
  TSMorphServiceLive.pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)))
);
const runDeletePackage = Command.runWith(deletePackageCommand, { version: "0.0.0" });

it.layer(commandLayer, { concurrent: false, timeout: "30 seconds" })((it) => {
  describe("delete-package registration geometry", () => {
    it.effect("reports every synthetic PR #680 residue class without relying on ambient state", () =>
      Effect.flatMap(temporaryGitDirectory, (repoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;

          yield* fs.makeDirectory(path.join(repoRoot, "packages", "drivers", "courtlistener", "node_modules"), {
            recursive: true,
          });
          yield* fs.writeFileString(
            path.join(repoRoot, "packages", "drivers", "courtlistener", "node_modules", ".artifact"),
            "local\n"
          );
          yield* fs.makeDirectory(path.join(repoRoot, "packages", "foundation", "modeling", "identity", "src"), {
            recursive: true,
          });
          yield* fs.writeFileString(
            path.join(repoRoot, "packages", "foundation", "modeling", "identity", "src", "packages.ts"),
            'const composers = $I.compose("courtlistener")\nexport const $CourtlistenerId = composers.$CourtlistenerId\n'
          );
          yield* fs.makeDirectory(path.join(repoRoot, "standards"), { recursive: true });
          yield* fs.writeFileString(
            path.join(repoRoot, "standards", "test-typecheck.blindspot-baseline.jsonc"),
            '{ "package": "@beep/courtlistener" }\n'
          );
          yield* fs.makeDirectory(path.join(repoRoot, ".changeset"), { recursive: true });
          yield* fs.writeFileString(
            path.join(repoRoot, ".changeset", "orphan-courtlistener.md"),
            '---\n"@beep/courtlistener": patch\n---\n\nStale pending bump.\n'
          );
          yield* fs.writeFileString(
            path.join(repoRoot, ".changeset", "delete-courtlistener.md"),
            "---\n{}\n---\n\nNo release: remove `@beep/courtlistener` from the workspace.\n"
          );

          const observations = yield* inspectTargetAtRoot(repoRoot, target);
          const byId = (id: string) => A.findFirst(observations, (item) => item.surfaceId === id);

          expect(O.getOrThrow(byId("test-typecheck-baseline")).status).toBe("residue");
          const pendingChangesets = O.getOrThrow(byId("pending-changesets"));
          expect(pendingChangesets.status).toBe("residue");
          expect(pendingChangesets.evidence).toContain(".changeset/orphan-courtlistener.md");
          expect(pendingChangesets.evidence).not.toContain(".changeset/delete-courtlistener.md");
          expect(O.getOrThrow(byId("identity-segment")).status).toBe("residue");
          expect(O.getOrThrow(byId("runtime-artifacts")).status).toBe("residue");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("rejects tampered and mismatched deletion notes that reuse the canonical basename", () =>
      Effect.flatMap(temporaryGitDirectory, (repoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const deletionNote = path.join(repoRoot, ".changeset", "delete-courtlistener.md");
          yield* fs.makeDirectory(path.join(repoRoot, ".changeset"), { recursive: true });

          for (const content of [
            "---\n{}\n---\n\nNo release: remove `@beep/courtlistener` from the workspace. Tampered.\n",
            "---\n{}\n---\n\nNo release: remove `@beep/other` from the workspace.\n",
            '---\n"@beep/courtlistener": patch\n---\n\nNo release: remove `@beep/courtlistener` from the workspace.\n',
          ]) {
            yield* fs.writeFileString(deletionNote, content);
            const observations = yield* inspectTargetAtRoot(repoRoot, target);
            const pendingChangesets = O.getOrThrow(
              A.findFirst(observations, (item) => item.surfaceId === "pending-changesets")
            );
            expect(pendingChangesets.status).toBe("residue");
            expect(pendingChangesets.evidence).toContain(".changeset/delete-courtlistener.md");
          }
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("delete-package --check prints every synthetic residue class and exits nonzero", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.writeFileString("package.json", '{ "name": "fixture", "private": true, "workspaces": [] }\n');
          yield* fs.makeDirectory(path.join("packages", "drivers", "courtlistener", "node_modules"), {
            recursive: true,
          });
          yield* fs.writeFileString(
            path.join("packages", "drivers", "courtlistener", "node_modules", ".artifact"),
            "local\n"
          );
          yield* fs.makeDirectory(path.join("packages", "foundation", "modeling", "identity", "src"), {
            recursive: true,
          });
          yield* fs.writeFileString(
            path.join("packages", "foundation", "modeling", "identity", "src", "packages.ts"),
            'const composers = $I.compose("courtlistener")\nexport const $CourtlistenerId = composers.$CourtlistenerId\n'
          );
          yield* fs.makeDirectory("standards", { recursive: true });
          yield* fs.writeFileString(
            "standards/test-typecheck.blindspot-baseline.jsonc",
            '{ "package": "@beep/courtlistener" }\n'
          );
          yield* fs.makeDirectory(".changeset", { recursive: true });
          yield* fs.writeFileString(
            ".changeset/orphan-courtlistener.md",
            '---\n"@beep/courtlistener": patch\n---\n\nStale pending bump.\n'
          );

          const exit = yield* Effect.exit(runDeletePackage(["courtlistener", "--check"]));
          expectReportedExit(exit);
          const lines = yield* TestConsole.logLines;
          for (const surfaceId of [
            "test-typecheck-baseline",
            "pending-changesets",
            "identity-segment",
            "runtime-artifacts",
          ]) {
            expect(
              A.some(lines, (line) => P.isString(line) && Str.includes(`[check] ${surfaceId}: residue`)(line))
            ).toBe(true);
          }
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect("classifies identity-accessor importers outside the target tree as hard import dependents", () =>
      Effect.flatMap(temporaryGitDirectory, (repoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString(
            path.join(repoRoot, "package.json"),
            '{ "name": "fixture", "private": true, "workspaces": ["packages/consumer"] }\n'
          );
          yield* fs.writeFileString(path.join(repoRoot, "bun.lock"), "");
          yield* fs.makeDirectory(path.join(repoRoot, "packages", "consumer", "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(repoRoot, "packages", "consumer", "package.json"),
            '{ "name": "@beep/consumer", "private": true }\n'
          );
          yield* fs.writeFileString(
            path.join(repoRoot, "packages", "consumer", "src", "index.ts"),
            'import { $CourtlistenerId } from "@beep/identity/packages"\n\nexport const id = $CourtlistenerId\n'
          );

          const report = yield* dependentsOfAtRoot(repoRoot, target);
          expect(A.some(report.hits, (hit) => hit.kind === "import-prod" && hit.owner === "@beep/consumer")).toBe(true);
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect("classifies a nested resolved workspace as a hard path dependent of its ancestor", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = yield* fs.realPath(".");
          yield* fs.writeFileString(
            "package.json",
            '{ "name": "fixture", "private": true, "workspaces": ["packages/container", "packages/container/child"] }\n'
          );
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.makeDirectory(path.join("packages", "container", "child"), { recursive: true });
          yield* fs.writeFileString(
            path.join("packages", "container", "package.json"),
            '{ "name": "@beep/container", "private": true }\n'
          );
          yield* fs.writeFileString(
            path.join("packages", "container", "child", "package.json"),
            '{ "name": "@beep/container-child", "private": true }\n'
          );
          const ancestor = RegistrationTarget.make({
            packageName: "@beep/container",
            packagePath: PosixPath.make("packages/container"),
            private: true,
          });

          const report = yield* dependentsOfAtRoot(repoRoot, ancestor);
          expect(A.map(report.hits, (hit) => `${hit.kind}|${hit.owner}|${hit.file}`)).toContain(
            "file-path|@beep/container-child|packages/container/child/package.json"
          );
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect("ignores a sibling workspace path that only ends in the target's path", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const repoRoot = yield* writeShadowedDeployFixture;
          const rootDeploy = RegistrationTarget.make({
            packageName: "@beep/deploy",
            packagePath: PosixPath.make("deploy"),
            private: true,
          });

          const report = yield* dependentsOfAtRoot(repoRoot, rootDeploy);
          const files = A.map(report.hits, (hit) => hit.file);
          expect(files).toContain("packages/consumer/README.md");
          expect(files).not.toContain("packages/tooling/deploy/x/package.json");
          expect(files).not.toContain("packages/consumer/notes.md");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("still finds dependents of a nested target that contains a sibling workspace's path", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const repoRoot = yield* writeShadowedDeployFixture;
          const nested = RegistrationTarget.make({
            packageName: "@beep/deploy-x",
            packagePath: PosixPath.make("packages/tooling/deploy/x"),
            private: true,
          });

          const report = yield* dependentsOfAtRoot(repoRoot, nested);
          const files = A.map(report.hits, (hit) => hit.file);
          expect(files).toContain("packages/consumer/notes.md");
          expect(files).not.toContain("packages/consumer/README.md");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("keeps the doctor clean when only sibling workspace paths end in the deleted path", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const repoRoot = yield* writeDeletedDeployLayout([
            ["tsconfig.packages.json", '{ "references": [{ "path": "packages/tooling/deploy/x" }] }\n'],
            ["packages/consumer/notes.md", "Deploys from `packages/tooling/deploy/x/src`.\n"],
            ["goals/demo/history/notes.md", "Moved into `packages/tooling/deploy/x`.\n"],
          ]);

          const observations = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget);
          expect(statusOf(observations, "tsconfig-sync")).toBe("clean");
          expect(statusOf(observations, "authored-references")).toBe("clean");
          expect(statusOf(observations, "historical-records")).toBe("clean");
          expect(DeletePackagePolicyEvaluation.doctorIsClean(rootDeployTarget, observations)).toBe(true);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("keeps path-keyed inventories clean when only sibling workspace paths remain in them", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const repoRoot = yield* writeDeletedDeployLayout(
            pathKeyedInventories("packages/tooling/deploy/x/src/Stack.ts")
          );

          const observations = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget);
          expect(A.map(PATH_KEYED_INVENTORY_SURFACES, (surfaceId) => statusOf(observations, surfaceId))).toEqual([
            "clean",
            "clean",
            "clean",
          ]);
          expect(DeletePackagePolicyEvaluation.doctorIsClean(rootDeployTarget, observations)).toBe(true);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("still reports a path-keyed inventory entry for the deleted path itself", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const repoRoot = yield* writeDeletedDeployLayout(pathKeyedInventories("deploy/src/Stack.ts"));

          const observations = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget);
          expect(A.map(PATH_KEYED_INVENTORY_SURFACES, (surfaceId) => statusOf(observations, surfaceId))).toEqual([
            "residue",
            "residue",
            "residue",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("still reports a real reference to the deleted path beside sibling workspace paths", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const repoRoot = yield* writeDeletedDeployLayout([
            [
              "tsconfig.packages.json",
              '{ "references": [{ "path": "packages/tooling/deploy/x" }, { "path": "deploy" }] }\n',
            ],
            ["packages/consumer/notes.md", "Reads `packages/tooling/deploy/x/src` and `deploy/src/index.ts`.\n"],
            ["goals/demo/history/notes.md", "Moved out of `deploy/src/Stack.ts`.\n"],
          ]);

          const observations = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget);
          expect(statusOf(observations, "tsconfig-sync")).toBe("drift");
          expect(evidenceOf(observations, "authored-references")).toContain("packages/consumer/notes.md");
          expect(statusOf(observations, "historical-records")).toBe("historical");
          expect(DeletePackagePolicyEvaluation.doctorIsClean(rootDeployTarget, observations)).toBe(false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reads dated records as history and keeps the doctor clean", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const records: ReadonlyArray<readonly [string, string]> = [
            [".changeset/older-note.md", "---\n{}\n---\n\nMoves out of `deploy/src/Stack.ts`.\n"],
            ["docs/history/commit-message-map.json", '{ "0": "feat: add `@beep/deploy`" }\n'],
            ["docs/reports/2026-01-01-cache-review.md", "Reviewed `@beep/deploy`.\n"],
            ["docs/reports/retirement/request.json", '{ "package": "@beep/deploy" }\n'],
            ["explorations/INBOX.md", "- 2026-01-01: split `@beep/deploy`.\n"],
            ["explorations/demo/DECISIONS.md", "Keep `@beep/deploy`.\n"],
            ["explorations/demo/composed.yaml", 'package: "@beep/deploy"\n'],
            ["explorations/demo/ops/manifest.json", '{ "package": "@beep/deploy" }\n'],
            ["explorations/demo/research/package-census.json", '["@beep/deploy"]\n'],
            ["goals/demo/.briefs/lane.md", "Move `@beep/deploy`.\n"],
            ["goals/demo/.notes.md", "Move `@beep/deploy`.\n"],
            ["goals/demo/decisions/2026-01-01-move.md", "Retire `@beep/deploy`.\n"],
            ["goals/demo/history/notes.md", "Moved out of `deploy/src/Stack.ts`.\n"],
            ["goals/demo/research/graph.tsv", "@beep/deploy\tbuild\n"],
            ["research/2026-01-01/claims.md", "Uses `@beep/deploy`.\n"],
            ["standards/architecture/DECISIONS.md", "2026-01-01: add `@beep/deploy`.\n"],
            ["standards/changesets.retired-packages.json", '{ "packages": [{ "name": "@beep/deploy" }] }\n'],
          ];
          const repoRoot = yield* writeDeletedDeployLayout(records);

          const observations = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget);
          expect(evidenceOf(observations, "authored-references")).toStrictEqual([]);
          expect(statusOf(observations, "authored-references")).toBe("clean");
          expect(statusOf(observations, "historical-records")).toBe("historical");
          expect(evidenceOf(observations, "historical-records")).toStrictEqual(A.map(records, ([file]) => file));
          expect(DeletePackagePolicyEvaluation.doctorIsClean(rootDeployTarget, observations)).toBe(true);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("still reports live files beside the dated records as residue", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const line = "Reads `@beep/deploy`.\n";
          const importLine = 'import "@beep/deploy";\n';
          const manifest = '{ "dependencies": { "@beep/deploy": "workspace:*" } }\n';
          const paths = '{ "compilerOptions": { "paths": { "@beep/deploy": ["./x.ts"] } } }\n';
          const live: ReadonlyArray<readonly [string, string]> = [
            [".changeset/README.md", "Releases `deploy/package.json`.\n"],
            [".changeset/config.json", '{ "ignore": ["@beep/deploy"] }\n'],
            ["docs/history/README.md", line],
            ["docs/reports.md", line],
            ["docs/reports/package.json", manifest],
            ["docs/reports/probe.ts", importLine],
            ["docs/runbooks/deploy.md", line],
            ["explorations-index.md", line],
            ["explorations/AGENTS.md", line],
            ["explorations/README.md", line],
            ["explorations/_template/BRIEF.md", line],
            ["explorations/_template/ops/manifest.json", '{ "package": "@beep/deploy" }\n'],
            ["explorations/demo/.github/workflows/ci.yml", "run: bun deploy/src/Stack.ts\n"],
            ["explorations/demo/ops/package.json", manifest],
            ["explorations/demo/ops/run.mts", importLine],
            ["explorations/demo/ops/run.ts", importLine],
            ["explorations/demo/ops/tsconfig.run.json", paths],
            ["packages/consumer/docs/reports/notes.md", line],
            ["packages/consumer/explorations/demo/notes.md", line],
            ["packages/consumer/research/notes.md", line],
            ["packages/consumer/src/index.ts", importLine],
            ["scratchpad/goals/notes.md", line],
            ["standards/architecture/16-demo.md", line],
            ["standards/architecture/GLOSSARY.md", line],
            ["standards/changesets.policy.json", '{ "package": "@beep/deploy" }\n'],
          ];
          const repoRoot = yield* writeDeletedDeployLayout([
            ...live,
            ["docs/reports/2026-01-01-cache-review.md", line],
          ]);

          const observations = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget);
          expect(statusOf(observations, "authored-references")).toBe("residue");
          expect(evidenceOf(observations, "authored-references")).toStrictEqual(A.map(live, ([file]) => file));
          expect(evidenceOf(observations, "historical-records")).toStrictEqual([
            "docs/reports/2026-01-01-cache-review.md",
          ]);
          expect(DeletePackagePolicyEvaluation.doctorIsClean(rootDeployTarget, observations)).toBe(false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("keeps every file a tool loads live inside a record tree", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const names = [
            ".claude/settings.json",
            ".lefthook.yaml",
            ".mcp.json",
            ".mise.toml",
            "AGENTS.md",
            "CLAUDE.md",
            "Chart.yaml",
            "GEMINI.md",
            "Pulumi.dev.yaml",
            "Pulumi.yaml",
            "SKILL.md",
            "app.config.json",
            "biome.json",
            "biome.jsonc",
            "bunfig.toml",
            "components.json",
            "compose.override.yaml",
            "compose.yaml",
            "deno.json",
            "docgen.json",
            "docker-compose.prod.yml",
            "docker-compose.yml",
            "jsconfig.json",
            "knip.json",
            "kustomization.yaml",
            "lefthook.yml",
            "lerna.json",
            "nx.json",
            "package.json",
            "pnpm-workspace.yaml",
            "renovate.json",
            "syncpack.json",
            "tauri.conf.json",
            "tsconfig.run.json",
            "turbo.json",
            "vercel.json",
            "wrangler.json",
          ];
          const live = A.flatMap(["docs/reports/demo", "explorations/demo/ops"], (directory) =>
            A.map(names, (name) => `${directory}/${name}`)
          );
          const repoRoot = yield* writeDeletedDeployLayout([
            ...A.map(live, (file) => [file, '"deploy/src/Stack.ts"\n'] as const),
            ["explorations/demo/ops/composed.yaml", '"deploy/src/Stack.ts"\n'],
            ["explorations/demo/ops/packages.json", '"deploy/src/Stack.ts"\n'],
          ]);

          const observations = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget);
          expect(evidenceOf(observations, "authored-references")).toStrictEqual(live);
          expect(evidenceOf(observations, "historical-records")).toStrictEqual([
            "explorations/demo/ops/composed.yaml",
            "explorations/demo/ops/packages.json",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reads every import form in packet code as a hard import, not a packet claim", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const imports: ReadonlyArray<readonly [string, string]> = [
            ["goals/demo/ops/call.ts", 'export const load = () => import("@beep/deploy/Stack");\n'],
            ["goals/demo/ops/common.cts", 'import deploy = require("@beep/deploy");\nexport = deploy;\n'],
            ["goals/demo/ops/module.mts", 'export * from "@beep/deploy";\n'],
            ["goals/demo/ops/type.ts", 'export type Stack = import("@beep/deploy").Stack;\n'],
            ["goals/demo/ops/typeof.ts", 'export type Deploy = typeof import("@beep/deploy/Stack");\n'],
          ];
          const repoRoot = yield* writeDeletedDeployLayout([
            ...imports,
            // Each names the package, so each is parsed, but none imports it.
            ["goals/demo/ops/label.ts", 'export type Label = "@beep/deploy";\n'],
            [
              "goals/demo/ops/local.ts",
              "// @beep/deploy\nimport L = O.I;\nimport M = require(L);\ntype T = import(L).T;\n",
            ],
            ["goals/demo/ops/sibling.ts", '// @beep/deploy\nexport type Sibling = import("@beep/deploy-x").Stack;\n'],
          ]);

          const report = yield* dependentsOfAtRoot(repoRoot, rootDeployTarget);
          const importFiles = A.map(
            A.filter(report.hits, (hit) => hit.kind === "import-prod"),
            (hit) => hit.file
          );
          expect(importFiles).toStrictEqual(A.map(imports, ([file]) => file));
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("classifies packet history and ledger references as historical, not live packet claims", () =>
      Effect.flatMap(temporaryGitDirectory, (repoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString(
            path.join(repoRoot, "package.json"),
            '{ "name": "fixture", "private": true, "workspaces": [] }\n'
          );
          yield* fs.writeFileString(path.join(repoRoot, "bun.lock"), "");
          yield* fs.makeDirectory(path.join(repoRoot, "goals", "lab-x", "history"), { recursive: true });
          yield* fs.makeDirectory(path.join(repoRoot, "goals", "lab-x", "research"), { recursive: true });
          yield* fs.writeFileString(
            path.join(repoRoot, "goals", "lab-x", "PLAN.md"),
            "# Plan\n\nShip @beep/courtlistener next.\n"
          );
          yield* fs.writeFileString(
            path.join(repoRoot, "goals", "lab-x", "history", "p4-evidence.md"),
            "# Evidence\n\nDeleted @beep/courtlistener during the slice.\n"
          );
          yield* fs.writeFileString(
            path.join(repoRoot, "goals", "lab-x", "research", "OPPORTUNITIES.md"),
            "# Ledger\n\nReceipt: @beep/courtlistener delete cost too much.\n"
          );

          const report = yield* dependentsOfAtRoot(repoRoot, target);
          const kindOf = (file: string) =>
            pipe(
              A.findFirst(report.hits, (hit) => Str.equivalence(hit.file, file)),
              O.map((hit) => hit.kind)
            );
          assertSome(kindOf("goals/lab-x/PLAN.md"), "packet");
          assertSome(kindOf("goals/lab-x/history/p4-evidence.md"), "historical-doc");
          assertSome(kindOf("goals/lab-x/research/OPPORTUNITIES.md"), "historical-doc");
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect("ignores machine-local .beep artifacts in the authored-reference probe", () =>
      Effect.flatMap(temporaryGitDirectory, (repoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.makeDirectory(path.join(repoRoot, ".beep", "yeet", "runs", "20260817"), { recursive: true });
          yield* fs.writeFileString(
            path.join(repoRoot, ".beep", "yeet", "runs", "20260817", "pr-body.md"),
            "Deletes @beep/courtlistener from the workspace.\n"
          );

          const clean = yield* inspectTargetAtRoot(repoRoot, target);
          const authoredClean = O.getOrThrow(A.findFirst(clean, (item) => item.surfaceId === "authored-references"));
          expect(authoredClean.status).toBe("clean");

          yield* fs.makeDirectory(path.join(repoRoot, "infra"), { recursive: true });
          yield* fs.writeFileString(
            path.join(repoRoot, "infra", "deploy.yml"),
            "packages:\n  - '@beep/courtlistener'\n"
          );
          const dirty = yield* inspectTargetAtRoot(repoRoot, target);
          const authoredDirty = O.getOrThrow(A.findFirst(dirty, (item) => item.surfaceId === "authored-references"));
          expect(authoredDirty.status).toBe("residue");
          expect(authoredDirty.evidence).toContain("infra/deploy.yml");
          expect(A.some(authoredDirty.evidence, Str.startsWith(".beep/"))).toBe(false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("probes the target's catalog shards, not the retired single-file catalogs", () =>
      Effect.flatMap(temporaryGitDirectory, (repoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const statusOf = Effect.fn(function* (surfaceId: string) {
            const observations = yield* inspectTargetAtRoot(repoRoot, target);
            return O.getOrThrow(A.findFirst(observations, (item) => item.surfaceId === surfaceId));
          });
          yield* fs.makeDirectory(path.join(repoRoot, "standards", "schema-catalog", "@beep"), { recursive: true });
          yield* fs.makeDirectory(path.join(repoRoot, "standards", "instrumentation-catalog", "@beep"), {
            recursive: true,
          });
          yield* fs.writeFileString(
            path.join(repoRoot, "standards", "schema-catalog.generated.jsonc"),
            '{ "file": "packages/drivers/courtlistener/src/Client.ts", "owner": "@beep/courtlistener" }\n'
          );
          yield* fs.writeFileString(
            path.join(repoRoot, "standards", "instrumentation-catalog.generated.jsonc"),
            '{ "owner": "@beep/courtlistener" }\n'
          );
          expect((yield* statusOf("schema-catalog")).status).toBe("clean");
          expect((yield* statusOf("instrumentation-catalog")).status).toBe("clean");

          yield* fs.writeFileString(
            path.join(repoRoot, "standards", "schema-catalog", "@beep", "courtlistener.generated.jsonc"),
            '{ "file": "packages/drivers/courtlistener/src/Client.ts", "owner": "@beep/courtlistener" }\n'
          );
          yield* fs.writeFileString(
            path.join(repoRoot, "standards", "instrumentation-catalog", "@beep", "courtlistener.generated.jsonc"),
            '{ "package": "@beep/courtlistener" }\n'
          );
          const schemaCatalog = yield* statusOf("schema-catalog");
          const instrumentationCatalog = yield* statusOf("instrumentation-catalog");
          expect(schemaCatalog.status).toBe("residue");
          expect(schemaCatalog.evidence).toStrictEqual([
            "standards/schema-catalog/@beep/courtlistener.generated.jsonc",
          ]);
          expect(instrumentationCatalog.status).toBe("residue");
          expect(instrumentationCatalog.evidence).toStrictEqual([
            "standards/instrumentation-catalog/@beep/courtlistener.generated.jsonc",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("treats an absent private flag as publish-enabled during deletion", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.writeFileString(
            "package.json",
            '{ "name": "fixture", "private": true, "workspaces": ["packages/drivers/courtlistener"] }\n'
          );
          yield* fs.makeDirectory(path.join("packages", "drivers", "courtlistener"), { recursive: true });
          yield* fs.writeFileString(
            path.join("packages", "drivers", "courtlistener", "package.json"),
            '{ "name": "@beep/courtlistener", "version": "0.0.0" }\n'
          );
          const exit = yield* Effect.exit(runDeletePackage(["courtlistener", "--dry-run"]));
          expectReportedExit(exit);
          const errors = yield* TestConsole.errorLines;
          expect(A.some(errors, (line) => P.isString(line) && Str.includes("published")(line))).toBe(true);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses deleting a live package whose README carries a promotion record", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.writeFileString(
            "package.json",
            '{ "name": "fixture", "private": true, "workspaces": ["packages/drivers/courtlistener"] }\n'
          );
          yield* fs.makeDirectory(path.join("packages", "drivers", "courtlistener"), { recursive: true });
          yield* fs.writeFileString(
            path.join("packages", "drivers", "courtlistener", "package.json"),
            '{ "name": "@beep/courtlistener", "private": true }\n'
          );
          yield* fs.writeFileString(
            path.join("packages", "drivers", "courtlistener", "README.md"),
            "# Courtlistener\n\n## Promotion Record\n\n- promoted export: none\n"
          );

          const exit = yield* Effect.exit(runDeletePackage(["courtlistener", "--dry-run"]));
          expectReportedExit(exit);
          const errors = yield* TestConsole.errorLines;
          expect(A.some(errors, (line) => P.isString(line) && Str.includes("promotion-record")(line))).toBe(true);
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect("refuses a repository-root workspace target before planning recursive removal", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.writeFileString(
            "package.json",
            '{ "name": "@beep/root-target", "private": true, "workspaces": ["root-link"] }\n'
          );
          yield* fs.symlink(".", "root-link");

          const exit = yield* Effect.exit(runDeletePackage(["root-target", "--dry-run"]));
          expectReportedExit(exit);
          const errors = yield* TestConsole.errorLines;
          expect(A.some(errors, (line) => P.isString(line) && Str.includes("repository root")(line))).toBe(true);
          const lines = yield* TestConsole.logLines;
          expect(A.some(lines, (line) => P.isString(line) && Str.includes("Inverse plan")(line))).toBe(false);
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect("refuses a workspace target that contains another resolved workspace", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.writeFileString(
            "package.json",
            '{ "name": "fixture", "private": true, "workspaces": ["packages/container", "packages/container/child"] }\n'
          );
          yield* fs.makeDirectory(path.join("packages", "container", "child"), { recursive: true });
          yield* fs.writeFileString(
            path.join("packages", "container", "package.json"),
            '{ "name": "@beep/container", "private": true }\n'
          );
          yield* fs.writeFileString(
            path.join("packages", "container", "child", "package.json"),
            '{ "name": "@beep/container-child", "private": true }\n'
          );

          const exit = yield* Effect.exit(runDeletePackage(["container", "--dry-run"]));
          expectReportedExit(exit);
          const errors = yield* TestConsole.errorLines;
          expect(
            A.some(
              errors,
              (line) => P.isString(line) && Str.includes("contains registered workspace packages/container/child")(line)
            )
          ).toBe(true);
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect("revalidates the owned tree before applying a leaf deletion", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.writeFileString(
            "package.json",
            '{ "name": "fixture", "private": true, "workspaces": ["packages/drivers/courtlistener"] }\n'
          );
          yield* fs.writeFileString(
            "tsconfig.json",
            '{ "compilerOptions": { "paths": { "@beep/courtlistener": ["./packages/drivers/courtlistener/src/index.ts"] } } }\n'
          );
          yield* fs.writeFileString(
            "tsconfig.packages.json",
            '{ "references": [{ "path": "packages/drivers/courtlistener" }] }\n'
          );
          yield* fs.writeFileString(
            "syncpack.config.ts",
            A.join(
              [
                'import type { RcFile } from "syncpack";',
                "",
                "const config = {",
                "  source: [",
                '    "package.json",',
                '    "packages/drivers/courtlistener/package.json",',
                "  ],",
                "  customTypes: {},",
                "  versionGroups: [],",
                "} satisfies RcFile;",
                "",
                "export default config;",
                "",
              ],
              "\n"
            )
          );

          const packageDir = path.join("packages", "drivers", "courtlistener");
          yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            '{ "name": "@beep/courtlistener", "private": true }\n'
          );
          yield* fs.writeFileString(path.join(packageDir, "src", "index.ts"), "export const alive = true;\n");

          const identityDir = path.join("packages", "foundation", "modeling", "identity", "src");
          yield* fs.makeDirectory(identityDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(identityDir, "packages.ts"),
            A.join(
              [
                'const composers = $I.compose("courtlistener");',
                'export const $CourtlistenerId: Identity.IdentityComposer<"@beep/courtlistener"> = /*#__PURE__*/ $I.create("courtlistener");',
                "",
              ],
              "\n"
            )
          );

          const exit = yield* Effect.exit(
            runDeletePackage(["courtlistener", "--allow-stale-packets", "--skip-lockfile", "--skip-baselines"])
          );
          assertTrue(Exit.isSuccess(exit), Exit.isFailure(exit) ? Cause.pretty(exit.cause) : undefined);

          const exists1 = yield* fs.exists(packageDir);
          expect(exists1).toBe(false);
          const readFileString2 = yield* fs.readFileString("package.json");
          expect(readFileString2).not.toContain("packages/drivers/courtlistener");
          const lines = yield* TestConsole.logLines;
          expect(
            A.some(lines, (line) => P.isString(line) && Str.includes("removed with zero declared residue")(line))
          ).toBe(true);
        })
      ).pipe(
        flow(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ CI: "false" })),
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it("emits a schema-versioned inverse plan containing every destructive surface before apply", () => {
      const plan = planInverseForTarget(target);
      expect(plan.version).toBe("registration-plan/v1");
      expect(A.map(plan.operations, (operation) => operation.surfaceId)).toEqual(
        expect.arrayContaining([
          "owned-tree",
          "workspace-literal",
          "identity-segment",
          "pending-changesets",
          "runtime-artifacts",
          "tsconfig-sync",
          "lockfile",
          "coverage-baseline",
        ])
      );
      // The data-resource surface is conditional on decoded lab facts; a
      // non-lab target must never declare it.
      expect(A.map(plan.operations, (operation) => operation.surfaceId)).not.toContain("lab-postgres-schema");
      expect(A.every(plan.operations, (operation) => operation.detail.length > 0)).toBe(true);
    });
  });

  describe("delete-package baseline writers", () => {
    const stamp = (mtimeMillis: number, size: number) => BaselineOutputStamp.make({ mtimeMillis, size });
    const outcome = DeletePackageBaselineWriters.baselineStepOutcome;

    it("classifies writer exits: zero is ok, exit >= 2 always fails", () => {
      expect(outcome(0, "zero-only", O.none(), O.none())).toBe("ok");
      expect(outcome(0, "tolerate-finding-exit", O.none(), O.some(stamp(1, 1)))).toBe("ok");
      expect(outcome(2, "tolerate-finding-exit", O.none(), O.some(stamp(1, 1)))).toBe("failed");
      expect(outcome(3, "zero-only", O.none(), O.none())).toBe("failed");
    });

    it("never tolerates a finding exit under zero-only", () => {
      expect(outcome(1, "zero-only", O.none(), O.some(stamp(1, 1)))).toBe("failed");
    });

    it("tolerates exit 1 only when the verified output was provably written", () => {
      expect(outcome(1, "tolerate-finding-exit", O.none(), O.some(stamp(1_000, 10)))).toBe("tolerated");
      expect(outcome(1, "tolerate-finding-exit", O.some(stamp(1_000, 10)), O.some(stamp(2_000, 10)))).toBe("tolerated");
      expect(outcome(1, "tolerate-finding-exit", O.some(stamp(1_000, 10)), O.some(stamp(1_000, 12)))).toBe("tolerated");
      expect(outcome(1, "tolerate-finding-exit", O.some(stamp(1_000, 10)), O.some(stamp(1_000, 10)))).toBe("failed");
      expect(outcome(1, "tolerate-finding-exit", O.some(stamp(1_000, 10)), O.none())).toBe("failed");
      expect(outcome(1, "tolerate-finding-exit", O.none(), O.none())).toBe("failed");
    });

    it("keeps the fallow health baseline as the only tolerant step in the writer table", () => {
      const tolerant = A.filter(
        DeletePackageBaselineWriters.steps,
        (step) => step.exitPolicy === "tolerate-finding-exit"
      );
      const tolerantStep = O.getOrThrow(A.head(tolerant));
      expect(A.length(tolerant)).toBe(1);
      expect(tolerantStep.label).toBe("fallow health baseline");
      expect(O.getOrThrow(tolerantStep.verifiedOutput)).toBe("standards/fallow.health.regression-baseline.jsonc");
      for (const step of DeletePackageBaselineWriters.steps) {
        if (!Str.equivalence(step.label, "fallow health baseline")) {
          expect(step.exitPolicy).toBe("zero-only");
          step.verifiedOutput.pipe(assertNone);
        }
      }
    });
  });

  const emptyReport = (forTarget: RegistrationTarget): DependentsReport =>
    DependentsReport.make({
      target: forTarget,
      directWorkspaceDependents: [],
      transitiveWorkspaceDependents: [],
      hits: [],
    });

  const dependentReport = (forTarget: RegistrationTarget, kind: DependentHit["kind"]): DependentsReport =>
    DependentsReport.make({
      target: forTarget,
      directWorkspaceDependents: ["@beep/consumer"],
      transitiveWorkspaceDependents: ["@beep/consumer", "@beep/app"],
      hits: [
        DependentHit.make({
          kind,
          owner: "@beep/consumer",
          file: PosixPath.make("packages/consumer/src/index.ts"),
          line: O.some(1),
          direct: true,
        }),
      ],
    });

  const policy = (overrides: Partial<DeletePackagePolicy> = {}): DeletePackagePolicy =>
    DeletePackagePolicy.make({
      allowPublished: false,
      allowStalePackets: true,
      cascade: false,
      pruneCatalog: false,
      rewritePackets: false,
      skipBaselines: false,
      inCi: false,
      retiredNameCollision: false,
      livePromotionRecord: false,
      cascadeClosureAllowed: true,
      catalogUniquenessProven: true,
      dropData: false,
      allowNonLocalData: false,
      dataResourceDeclared: false,
      dataConnectionNonLocal: false,
      dataOwnershipProven: false,
      ...overrides,
    });

  describe("delete-package hit locations", () => {
    it("renders a line as file:line, a root script as package.json#name, and neither as the bare file", () => {
      const at = (fields: { readonly file: string; readonly line?: number; readonly script?: string }) =>
        DeletePackagePolicyEvaluation.hitLocation(
          DependentHit.make({
            kind: fields.script === undefined ? "file-path" : "script",
            owner: "@beep/root",
            file: PosixPath.make(fields.file),
            line: O.fromUndefinedOr(fields.line),
            direct: true,
            script: O.fromUndefinedOr(fields.script),
          })
        );

      expect(at({ file: "packages/consumer/README.md", line: 3 })).toBe("packages/consumer/README.md:3");
      expect(at({ file: "package.json", script: "postinstall" })).toBe("package.json#postinstall");
      // Root policy-file, manifest and nested-workspace hits carry neither a line nor a script name.
      expect(at({ file: "turbo.json" })).toBe("turbo.json");
    });
  });

  describe("delete-package hard-refuse table", () => {
    const published = RegistrationTarget.make({ ...target, private: false });
    const protectedTarget = RegistrationTarget.make({
      packageName: "@beep/schema",
      packagePath: PosixPath.make("packages/foundation/modeling/schema"),
      private: true,
    });
    const cases: ReadonlyArray<
      readonly [string, RegistrationTarget, DependentsReport, DeletePackagePolicy, DeletePackageRefusal["kind"]]
    > = [
      ["production dependent", target, dependentReport(target, "manifest-prod"), policy(), "dependent"],
      ["test-only dependent", target, dependentReport(target, "import-test"), policy(), "dependent"],
      ["identity composer importer", target, dependentReport(target, "import-prod"), policy(), "dependent"],
      ["published package", published, emptyReport(published), policy(), "published"],
      ["live promotion record", target, emptyReport(target), policy({ livePromotionRecord: true }), "promotion-record"],
      ["protected slug", protectedTarget, emptyReport(protectedTarget), policy(), "protected-slug"],
      [
        "retired name collision",
        target,
        emptyReport(target),
        policy({ retiredNameCollision: true }),
        "retired-name-collision",
      ],
      [
        "cascade boundary",
        target,
        emptyReport(target),
        policy({ cascade: true, cascadeClosureAllowed: false }),
        "cascade-boundary",
      ],
      [
        "skip baselines in CI",
        target,
        emptyReport(target),
        policy({ skipBaselines: true, inCi: true }),
        "ci-skip-baselines",
      ],
      [
        "catalog prune without uniqueness",
        target,
        emptyReport(target),
        policy({ pruneCatalog: true, catalogUniquenessProven: false }),
        "catalog-uniqueness",
      ],
    ];

    it.each(cases)(
      "refuses %s and retains printable cascade evidence",
      (_label, caseTarget, report, casePolicy, expectedKind) => {
        const refusals = DeletePackagePolicyEvaluation.refusalReasons(caseTarget, report, casePolicy);
        expect(A.some(refusals, (refusal) => refusal.kind === expectedKind && refusal.severity === "hard")).toBe(true);
        const cascade = DeletePackagePolicyEvaluation.dependentsCascadeLines(report);
        expect(cascade[0]).toContain("direct:");
        expect(cascade[1]).toContain("transitive:");
      }
    );
  });

  describe("delete-package baseline writer stage", () => {
    const fakeSpawner = (exit: number) => ScriptedSpawner.make(() => ({ exit }));

    const coverageBaselineFixture = `{
  "schema_version": 2,
  "generated_at": "2026-08-17T00:00:00.000Z",
  "git_sha": "0123456789abcdef0123456789abcdef01234567",
  "command": "bun run coverage:baseline:write",
  "epsilon": 0.001,
  "minimum": { "lines": 70, "statements": 70, "branches": 50, "functions": 60 },
  "exemptions": {},
  "follow_ups": {},
  "packages": {
    "@beep/courtlistener": {
      "path": "packages/drivers/courtlistener",
      "lines": 100, "statements": 100, "branches": 100, "functions": 100,
      "uncovered": { "lines": 0, "statements": 0, "branches": 0, "functions": 0 },
      "files": {
        "packages/drivers/courtlistener/src/index.ts": {
          "lines": 100, "statements": 100, "branches": 100, "functions": 100,
          "uncovered": { "lines": 0, "statements": 0, "branches": 0, "functions": 0 }
        }
      }
    }
  }
}
`;

    it.effect("subtracts the coverage baseline then runs every shell step in table order", () => {
      const spawner = fakeSpawner(0);
      return Effect.flatMap(temporaryDirectory, (repoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.makeDirectory(path.join(repoRoot, "standards"), { recursive: true });
          yield* fs.writeFileString(
            path.join(repoRoot, "standards", "coverage.regression-baseline.jsonc"),
            coverageBaselineFixture
          );

          yield* DeletePackageBaselineWriters.run(repoRoot, "@beep/courtlistener");

          const baseline = yield* fs.readFileString(
            path.join(repoRoot, "standards", "coverage.regression-baseline.jsonc")
          );
          expect(Str.includes("@beep/courtlistener")(baseline)).toBe(false);
          expect(A.map(spawner.spawns, (spawn) => A.join([spawn.command, ...spawn.args], " "))).toStrictEqual([
            "bun run beep fallow boundaries --write",
            "bun run fallow:health:baseline:write",
            "bun run fallow:dead-code:baseline:write",
            "bun run beep lint schema-first --write",
            "bun run beep lint package-test-typecheck --write-baseline",
            "bun run beep lint schema-catalog --write",
            "bun run beep observability catalog --write",
            "bun run beep lint package-scripts --write",
          ]);
        })
      ).pipe(
        flow(provideSpawner(spawner), Effect.provideServiceEffect(Console.Console, TestConsole.make)),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      );
    });

    it.effect("fails the stage on the first zero-only step that exits nonzero", () => {
      const spawner = fakeSpawner(1);
      return Effect.flatMap(temporaryDirectory, (repoRoot) =>
        Effect.gen(function* () {
          const exit = yield* Effect.exit(DeletePackageBaselineWriters.run(repoRoot, "@beep/courtlistener"));
          exit.pipe(Exit.isFailure, assertTrue);
          if (Exit.isFailure(exit)) {
            expect(Str.includes("fallow boundaries failed with exit code 1")(Cause.pretty(exit.cause))).toBe(true);
          }
          expect(A.length(spawner.spawns)).toBe(1);
        })
      ).pipe(
        flow(provideSpawner(spawner), Effect.provideServiceEffect(Console.Console, TestConsole.make)),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      );
    });
  });

  describe("delete-package packet-claim refusal", () => {
    const claimReport = (kind: DependentHit["kind"], file: string): DependentsReport =>
      DependentsReport.make({
        target,
        directWorkspaceDependents: [],
        transitiveWorkspaceDependents: [],
        hits: [DependentHit.make({ kind, owner: "goals", file: PosixPath.make(file), line: O.some(1), direct: false })],
      });

    it("soft-refuses a live packet claim when stale packets are not allowed", () => {
      const refusals = DeletePackagePolicyEvaluation.refusalReasons(
        target,
        claimReport("packet", "goals/lab-x/PLAN.md"),
        policy({ allowStalePackets: false })
      );
      expect(A.some(refusals, (refusal) => refusal.kind === "packet-claim" && refusal.severity === "soft")).toBe(true);
    });

    it("does not refuse on historical-doc hits from packet history or ledgers", () => {
      const refusals = DeletePackagePolicyEvaluation.refusalReasons(
        target,
        claimReport("historical-doc", "goals/lab-x/history/p4-evidence.md"),
        policy({ allowStalePackets: false })
      );
      expect(refusals).toStrictEqual([]);
    });
  });

  describe("delete-package pending changeset prune", () => {
    const pruneChangesets = Effect.fn(function* (
      packageName: string,
      changesets: ReadonlyArray<readonly [file: string, content: string]>
    ) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* temporaryDirectory;
      const changesetDir = path.join(repoRoot, ".changeset");
      yield* fs.makeDirectory(changesetDir, { recursive: true });
      for (const [file, content] of changesets) {
        yield* fs.writeFileString(path.join(changesetDir, file), content);
      }
      yield* rewritePendingChangesets(repoRoot, packageName, "private-exempt");
      return (file: string) => fs.readFileString(path.join(changesetDir, file)).pipe(Effect.option);
    });

    it.effect("keeps a sibling whose name extends the deleted package name", () =>
      Effect.gen(function* () {
        const read = yield* pruneChangesets("@beep/schema", [
          ["multi.md", '---\n"@beep/schema": patch\n"@beep/schema-extras": minor\n---\n\nTouches @beep/schema.\n'],
        ]);
        const read3 = yield* read("multi.md");
        assertSome(read3, '---\n"@beep/schema-extras": minor\n---\n\nTouches @beep/schema.\n');
      })
    );

    it.effect("matches single-quoted and unquoted frontmatter keys exactly", () =>
      Effect.gen(function* () {
        const readQuoted = yield* pruneChangesets("@beep/schema", [
          ["quoted.md", "---\n'@beep/schema': minor\n'@beep/schema-extras': patch\n---\n\nSingle-quoted keys.\n"],
        ]);
        const readQuoted4 = yield* readQuoted("quoted.md");
        assertSome(readQuoted4, "---\n'@beep/schema-extras': patch\n---\n\nSingle-quoted keys.\n");

        const readUnquoted = yield* pruneChangesets("probe", [
          ["unquoted.md", "---\nprobe: patch\nprobe-extra: minor\n---\n\nUnquoted keys.\n"],
        ]);
        const readUnquoted5 = yield* readUnquoted("unquoted.md");
        assertSome(readUnquoted5, "---\nprobe-extra: minor\n---\n\nUnquoted keys.\n");
      })
    );

    it.effect("removes the key through the YAML edit layer: escaped keys, CRLF blocks and key comments", () =>
      Effect.gen(function* () {
        const read = yield* pruneChangesets("@beep/a", [
          ["escaped.md", '---\n"\\x40beep/a": patch\n"@beep/b": minor\n---\n\nEscaped key.\n'],
          ["crlf.md", '---\r\n"@beep/a": patch\r\n"@beep/b": minor\r\n"@beep/c": minor\r\n---\r\n\r\nCRLF.\r\n'],
          ["comment.md", '---\n# bump both\n"@beep/a": patch\n"@beep/b": minor # keep\n---\n\n---\n"@beep/a": prose\n'],
        ]);
        const read6 = yield* read("escaped.md");
        assertSome(read6, '---\n"@beep/b": minor\n---\n\nEscaped key.\n');
        const read7 = yield* read("crlf.md");
        assertSome(read7, '---\r\n"@beep/b": minor\r\n"@beep/c": minor\r\n---\r\n\r\nCRLF.\r\n');
        const read8 = yield* read("comment.md");
        assertSome(read8, '---\n"@beep/b": minor # keep\n---\n\n---\n"@beep/a": prose\n');
      })
    );

    it.effect("re-serializes the whole block: sibling spacing, trailing blank lines and the fence line ending", () =>
      Effect.gen(function* () {
        const read = yield* pruneChangesets("@beep/a", [
          ["spacing.md", "---\n\"@beep/a\": patch\n'@beep/b':   minor\n---\n\nSibling spacing.\n"],
          ["blank.md", '---\n"@beep/a": patch\n"@beep/b": minor\n\n---\n\nTrailing blank.\n'],
          ["mixed.md", '---\n"@beep/a": patch\r\n"@beep/b": minor\n---\n\nMixed.\n'],
        ]);
        const read9 = yield* read("spacing.md");
        assertSome(read9, "---\n'@beep/b': minor\n---\n\nSibling spacing.\n");
        const read10 = yield* read("blank.md");
        assertSome(read10, '---\n"@beep/b": minor\n---\n\nTrailing blank.\n');
        const read11 = yield* read("mixed.md");
        assertSome(read11, '---\n"@beep/b": minor\n---\n\nMixed.\n');
      })
    );

    it.effect("removes a single-package changeset and leaves a sibling-only changeset untouched", () =>
      Effect.gen(function* () {
        const sibling = '---\n"@beep/schema-extras": minor\n---\n\nSibling only.\n';
        const read = yield* pruneChangesets("@beep/schema", [
          ["single.md", '---\n"@beep/schema": patch\n---\n\nOnly schema.\n'],
          ["sibling.md", sibling],
        ]);
        const read12 = yield* read("single.md");
        assertNone(read12);
        const read13 = yield* read("sibling.md");
        assertSome(read13, sibling);
      })
    );
  });

  const seedLiveCourtlistener = Effect.fn(function* (retiredName: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const packageDir = path.join("packages", "drivers", "courtlistener");
    yield* fs.writeFileString("bun.lock", "");
    yield* fs.writeFileString(
      "package.json",
      '{ "name": "fixture", "private": true, "workspaces": ["packages/drivers/courtlistener"] }\n'
    );
    yield* fs.makeDirectory(packageDir, { recursive: true });
    yield* fs.writeFileString(
      path.join(packageDir, "package.json"),
      '{ "name": "@beep/courtlistener", "private": true }\n'
    );
    yield* fs.makeDirectory("standards", { recursive: true });
    yield* fs.writeFileString(
      "standards/changesets.retired-packages.json",
      `{\n  "packages": [\n    { "name": "${retiredName}", "rationale": "Retired fixture name." }\n  ]\n}\n`
    );
  });

  describe("delete-package exact name matching", () => {
    it.effect("does not flag a retired-name collision for a prefix-sharing retired name", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* seedLiveCourtlistener("@beep/courtlistener-mcp");
          const exit = yield* Effect.exit(runDeletePackage(["courtlistener", "--dry-run"]));
          assertTrue(Exit.isSuccess(exit), Exit.isFailure(exit) ? Cause.pretty(exit.cause) : undefined);
          const errorLines14 = yield* TestConsole.errorLines;
          expect(errorLines14).toStrictEqual([]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("still flags a retired-name collision for the exact live name", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* seedLiveCourtlistener("@beep/courtlistener");
          const exit = yield* Effect.exit(runDeletePackage(["courtlistener", "--dry-run"]));
          expectReportedExit(exit);
          const errorLines15 = yield* TestConsole.errorLines;
          expect(errorLines15).toStrictEqual([
            "[delete-package] REFUSE [retired-name-collision/hard] @beep/courtlistener is both live and retired; reconcile name provenance before deletion.",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("removes only the exact accessor rows from the identity shape test", () =>
      Effect.flatMap(temporaryDirectory, (repoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const testDir = path.join(repoRoot, "packages", "foundation", "modeling", "identity", "test");
          const shapeTest = path.join(testDir, "shape-stable.test.ts");
          yield* fs.makeDirectory(testDir, { recursive: true });
          yield* fs.writeFileString(
            shapeTest,
            A.join(
              [
                "const currentPackagesRuntimeNamedImports = [",
                '  "$CourtlistenerId",',
                '  "$CourtlistenerIdentityId",',
                '  "$DataId",',
                "] as const;",
                "",
                "const expectedPackageComposerIdentities = {",
                '  $CourtlistenerId: "@beep/courtlistener",',
                '  $CourtlistenerIdentityId: "@beep/courtlistener-identity",',
                "} as const;",
                "",
                'for (const accessorName of ["$CourtlistenerIdentityId", "$DataId"]) {',
                "  expect(accessorName).toBeTruthy();",
                "}",
                "",
              ],
              "\n"
            )
          );

          yield* removeShapeTestRow(repoRoot, "@beep/courtlistener");
          const readFileString16 = yield* fs.readFileString(shapeTest);
          expect(readFileString16).toBe(
            A.join(
              [
                "const currentPackagesRuntimeNamedImports = [",
                '  "$CourtlistenerIdentityId",',
                '  "$DataId",',
                "] as const;",
                "",
                "const expectedPackageComposerIdentities = {",
                '  $CourtlistenerIdentityId: "@beep/courtlistener-identity",',
                "} as const;",
                "",
                'for (const accessorName of ["$CourtlistenerIdentityId", "$DataId"]) {',
                "  expect(accessorName).toBeTruthy();",
                "}",
                "",
              ],
              "\n"
            )
          );
        })
      )
    );
  });

  describe("delete-package registration-geometry tokens", () => {
    const SHAPE_TEST = "packages/foundation/modeling/identity/test/shape-stable.test.ts";
    const preflightRefusal = (hits: number) =>
      `[delete-package] REFUSE [dependent/hard] ${hits} unacknowledged production/test/script/path dependent hit(s); only file-path and script hits can be acknowledged.`;

    const writeShapeTest = Effect.fn(function* (lines: ReadonlyArray<string>) {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory("packages/foundation/modeling/identity/test", { recursive: true });
      yield* fs.writeFileString(SHAPE_TEST, A.join(lines, "\n"));
    });

    // A sibling whose name, path and accessor all extend the target's.
    const seedPrefixSibling = Effect.fn(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString(
        "package.json",
        '{ "name": "fixture", "private": true, "workspaces": ["packages/drivers/courtlistener", "packages/drivers/courtlistener-identity"] }\n'
      );
      yield* fs.makeDirectory("packages/drivers/courtlistener-identity/src", { recursive: true });
      yield* fs.writeFileString(
        "packages/drivers/courtlistener-identity/package.json",
        '{ "name": "@beep/courtlistener-identity", "private": true }\n'
      );
      yield* fs.writeFileString(
        "packages/drivers/courtlistener-identity/src/index.ts",
        'import { $CourtlistenerIdentityId } from "@beep/identity/packages";\n\nexport const id = $CourtlistenerIdentityId;\n'
      );
    });

    const dryRunErrors = Effect.gen(function* () {
      const exit = yield* Effect.exit(runDeletePackage(["courtlistener", "--dry-run"]));
      return { exit, errors: yield* TestConsole.errorLines };
    });

    it.effect("does not block on the target's own shape-test rows, which the deletion removes", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* seedLiveCourtlistener("@beep/retired-fixture");
          yield* writeShapeTest([
            "const currentPackagesRuntimeNamedImports = [",
            '  "$CourtlistenerId",',
            "] as const;",
            "",
            "const expectedPackageComposerIdentities = {",
            '  $CourtlistenerId: "@beep/courtlistener",',
            "} as const;",
            "",
          ]);
          const { exit, errors } = yield* dryRunErrors;
          assertTrue(Exit.isSuccess(exit), Exit.isFailure(exit) ? Cause.pretty(exit.cause) : undefined);
          expect(errors).toStrictEqual([]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("still blocks on a shape-test line that is not one of the target's rows", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* seedLiveCourtlistener("@beep/retired-fixture");
          yield* writeShapeTest([
            "const accessorCases = [",
            '  { accessor: "$CourtlistenerId", base: "courtlistener", identity: "@beep/courtlistener" },',
            "];",
            "",
          ]);
          const { exit, errors } = yield* dryRunErrors;
          expectReportedExit(exit);
          // One line naming both the package and the accessor: a file-path and an import-test hit.
          expect(errors).toStrictEqual([preflightRefusal(2)]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses when the shape test names the removed accessor outside its rows", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* seedLiveCourtlistener("@beep/retired-fixture");
          yield* writeShapeTest([
            "const currentPackagesRuntimeNamedImports = [",
            '  "$CourtlistenerId",',
            "] as const;",
            "",
            "const expectedPackageComposerIdentities = {",
            '  $CourtlistenerId: "@beep/courtlistener",',
            "} as const;",
            "",
            "const composed = [",
            '  IdentityPackages.$CourtlistenerId.create("Server"),',
            "];",
            "",
          ]);
          const { exit, errors } = yield* dryRunErrors;
          expectReportedExit(exit);
          expect(errors).toStrictEqual([preflightRefusal(1)]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses when another identity-package file uses the removed accessor", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* seedLiveCourtlistener("@beep/retired-fixture");
          yield* fs.makeDirectory("packages/foundation/modeling/identity/test", { recursive: true });
          yield* fs.writeFileString(
            "packages/foundation/modeling/identity/test/Identity.test.ts",
            'import * as IdentityPackages from "@beep/identity/packages";\n\nexport const id = IdentityPackages.$CourtlistenerId.make("Probe");\n'
          );
          const { exit, errors } = yield* dryRunErrors;
          expectReportedExit(exit);
          expect(errors).toStrictEqual([preflightRefusal(1)]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    // The doctor re-checks the shape test even when a deletion skipped the preflight.
    it.effect("reports a leftover shape-test accessor as identity-segment residue", () =>
      Effect.flatMap(temporaryGitDirectory, (repoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.makeDirectory(path.join(repoRoot, "packages/foundation/modeling/identity/test"), {
            recursive: true,
          });
          yield* fs.writeFileString(
            path.join(repoRoot, SHAPE_TEST),
            'const composed = [\n  IdentityPackages.$CourtlistenerId.create("Server"),\n];\n'
          );

          const observations = yield* inspectTargetAtRoot(repoRoot, target);
          const identity = O.getOrThrow(A.findFirst(observations, (item) => item.surfaceId === "identity-segment"));
          expect(identity.status).toBe("residue");
          expect(identity.evidence).toStrictEqual([SHAPE_TEST]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("does not block on a prefix-sharing sibling package", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* seedLiveCourtlistener("@beep/retired-fixture");
          yield* seedPrefixSibling();
          const { exit, errors } = yield* dryRunErrors;
          assertTrue(Exit.isSuccess(exit), Exit.isFailure(exit) ? Cause.pretty(exit.cause) : undefined);
          expect(errors).toStrictEqual([]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("deletes a package next to a prefix-sharing sibling and passes the post-apply doctor", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* seedLiveCourtlistener("@beep/retired-fixture");
          yield* seedPrefixSibling();
          yield* fs.writeFileString(
            "tsconfig.json",
            '{ "compilerOptions": { "paths": { "@beep/courtlistener": ["./packages/drivers/courtlistener/src/index.ts"], "@beep/courtlistener-identity": ["./packages/drivers/courtlistener-identity/src/index.ts"] } } }\n'
          );
          yield* fs.writeFileString(
            "tsconfig.packages.json",
            '{ "references": [{ "path": "packages/drivers/courtlistener" }, { "path": "packages/drivers/courtlistener-identity" }] }\n'
          );
          yield* fs.writeFileString(
            "syncpack.config.ts",
            A.join(
              [
                'import type { RcFile } from "syncpack";',
                "",
                "const config = {",
                "  source: [",
                '    "package.json",',
                '    "packages/drivers/courtlistener/package.json",',
                '    "packages/drivers/courtlistener-identity/package.json",',
                "  ],",
                "  customTypes: {},",
                "  versionGroups: [],",
                "} satisfies RcFile;",
                "",
                "export default config;",
                "",
              ],
              "\n"
            )
          );
          yield* fs.makeDirectory("packages/foundation/modeling/identity/src", { recursive: true });
          yield* fs.writeFileString(
            "packages/foundation/modeling/identity/src/packages.ts",
            A.join(
              [
                'const composers = $I.compose("courtlistener", "courtlistener-identity");',
                'export const $CourtlistenerId: Identity.IdentityComposer<"@beep/courtlistener"> = /*#__PURE__*/ $I.create("courtlistener");',
                'export const $CourtlistenerIdentityId: Identity.IdentityComposer<"@beep/courtlistener-identity"> = /*#__PURE__*/ $I.create("courtlistener-identity");',
                "",
              ],
              "\n"
            )
          );
          yield* writeShapeTest([
            "const currentPackagesRuntimeNamedImports = [",
            '  "$CourtlistenerId",',
            '  "$CourtlistenerIdentityId",',
            "] as const;",
            "",
            "const expectedPackageComposerIdentities = {",
            '  $CourtlistenerId: "@beep/courtlistener",',
            '  $CourtlistenerIdentityId: "@beep/courtlistener-identity",',
            "} as const;",
            "",
          ]);

          const exit = yield* Effect.exit(
            runDeletePackage(["courtlistener", "--allow-stale-packets", "--skip-lockfile", "--skip-baselines"])
          );
          assertTrue(Exit.isSuccess(exit), Exit.isFailure(exit) ? Cause.pretty(exit.cause) : undefined);
          const errorLines17 = yield* TestConsole.errorLines;
          expect(errorLines17).toStrictEqual([]);
          const logLines18 = yield* TestConsole.logLines;
          expect(
            A.some(logLines18, (line) => P.isString(line) && Str.includes("removed with zero declared residue")(line))
          ).toBe(true);
          const exists19 = yield* fs.exists("packages/drivers/courtlistener");
          expect(exists19).toBe(false);
          const exists20 = yield* fs.exists("packages/drivers/courtlistener-identity/package.json");
          expect(exists20).toBe(true);
          const readFileString21 = yield* fs.readFileString("packages/foundation/modeling/identity/src/packages.ts");
          expect(readFileString21).toBe(
            A.join(
              [
                'const composers = $I.compose("courtlistener-identity");',
                'export const $CourtlistenerIdentityId: Identity.IdentityComposer<"@beep/courtlistener-identity"> = /*#__PURE__*/ $I.create("courtlistener-identity");',
                "",
              ],
              "\n"
            )
          );
          const readFileString22 = yield* fs.readFileString(SHAPE_TEST);
          expect(readFileString22).toBe(
            A.join(
              [
                "const currentPackagesRuntimeNamedImports = [",
                '  "$CourtlistenerIdentityId",',
                "] as const;",
                "",
                "const expectedPackageComposerIdentities = {",
                '  $CourtlistenerIdentityId: "@beep/courtlistener-identity",',
                "} as const;",
                "",
              ],
              "\n"
            )
          );
        })
      ).pipe(
        flow(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ CI: "false" })),
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        )
      )
    );
  });

  describe("delete-package git-visible enumeration", () => {
    const README_LINE = "Reads `deploy/src/index.ts`.";

    // A live root `deploy` workspace beside a consumer whose README names its path, as a git work tree.
    const writeLiveDeployFixture = Effect.fn("writeLiveDeployFixture")(function* (
      files: ReadonlyArray<readonly [string, string]>
    ) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* fs.realPath(".");
      yield* fs.writeFileString(
        "package.json",
        '{ "name": "fixture", "private": true, "workspaces": ["deploy", "packages/consumer"], "scripts": { "build:deploy": "bun run --cwd deploy build" } }\n'
      );
      yield* fs.writeFileString("bun.lock", "");
      yield* fs.makeDirectory("deploy", { recursive: true });
      yield* fs.writeFileString(path.join("deploy", "package.json"), '{ "name": "@beep/deploy", "private": true }\n');
      yield* fs.makeDirectory(path.join("packages", "consumer"), { recursive: true });
      yield* fs.writeFileString(
        path.join("packages", "consumer", "package.json"),
        '{ "name": "@beep/consumer", "private": true }\n'
      );
      yield* fs.writeFileString(path.join("packages", "consumer", "README.md"), `${README_LINE}\n`);
      yield* Effect.forEach(
        files,
        ([file, content]) =>
          Effect.andThen(fs.makeDirectory(path.dirname(file), { recursive: true }), fs.writeFileString(file, content)),
        { concurrency: 1 }
      );
      yield* gitFixture(repoRoot);
      return repoRoot;
    });

    const hitFiles = (report: DependentsReport): ReadonlyArray<string> => A.map(report.hits, (hit) => hit.file);

    it.effect("never reads a gitignored file as a dependent or as authored-reference evidence", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const repoRoot = yield* writeLiveDeployFixture([
            [".gitignore", "**/docs\n"],
            ["packages/consumer/docs/modules/X.md", `${README_LINE}\n`],
          ]);

          const report = yield* dependentsOfAtRoot(repoRoot, rootDeployTarget);
          expect(hitFiles(report)).toContain("packages/consumer/README.md");
          expect(hitFiles(report)).not.toContain("packages/consumer/docs/modules/X.md");
          const observations = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget);
          expect(evidenceOf(observations, "authored-references")).toContain("packages/consumer/README.md");
          expect(evidenceOf(observations, "authored-references")).not.toContain("packages/consumer/docs/modules/X.md");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("still reads an untracked file git does not ignore", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const repoRoot = yield* writeLiveDeployFixture([]);
          yield* fs.writeFileString("packages/consumer/new.md", `${README_LINE}\n`);

          const report = yield* dependentsOfAtRoot(repoRoot, rootDeployTarget);
          expect(hitFiles(report)).toContain("packages/consumer/new.md");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("skips a tracked file that is gone from disk but still in the index", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const repoRoot = yield* writeLiveDeployFixture([["packages/consumer/old.md", `${README_LINE}\n`]]);
          yield* fs.remove("packages/consumer/old.md");

          const report = yield* dependentsOfAtRoot(repoRoot, rootDeployTarget);
          expect(hitFiles(report)).not.toContain("packages/consumer/old.md");
          const observations = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget);
          expect(evidenceOf(observations, "authored-references")).not.toContain("packages/consumer/old.md");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("still walks the gitignored .beep/ci tree for runtime artifacts", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const repoRoot = yield* writeLiveDeployFixture([
            [".gitignore", ".beep/\n"],
            [".beep/ci/inventory.jsonc", '{ "package": "@beep/deploy" }\n'],
          ]);

          const observations = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget);
          expect(statusOf(observations, "runtime-artifacts")).toBe("residue");
          expect(evidenceOf(observations, "runtime-artifacts")).toContain(".beep/ci/inventory.jsonc");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("fails with a typed error naming a root that is not a git work tree", () =>
      Effect.flatMap(temporaryDirectory, (repoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.writeFileString(
            path.join(repoRoot, "package.json"),
            '{ "name": "fixture", "private": true, "workspaces": [] }\n'
          );
          yield* fs.writeFileString(path.join(repoRoot, "bun.lock"), "");

          const dependentsError = yield* Effect.flip(dependentsOfAtRoot(repoRoot, rootDeployTarget));
          const doctorError = yield* Effect.flip(inspectTargetAtRoot(repoRoot, rootDeployTarget));
          for (const error of [dependentsError, doctorError]) {
            expect(error._tag).toBe("RegistrationGeometryError");
            expect(error.message).toContain(`Cannot list git-visible files at ${repoRoot}`);
          }
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    const ACK_FILE = "goals/demo/history/delete-deploy.acknowledgements.jsonc";
    const README_REASON = "The README describes the build, reviewed.";
    const SCRIPT_REASON = "The build alias is removed by hand, reviewed.";

    const ackEntry = (file: string, text: string, reason: string, occurrences = 1): string =>
      `{ "path": "${file}", "text": "${text}", "reason": "${reason}", "occurrences": ${occurrences} }`;

    const README_ENTRY = ackEntry("packages/consumer/README.md", README_LINE, README_REASON);
    const scriptEntry = (script: string, command: string, reason: string): string =>
      `{ "path": "package.json", "script": "${script}", "text": "${command}", "reason": "${reason}" }`;

    const BUILD_COMMAND = "bun run --cwd deploy build";
    const SCRIPT_ENTRY = scriptEntry("build:deploy", BUILD_COMMAND, SCRIPT_REASON);

    const writeRootScripts = Effect.fn("writeRootScripts")(function* (scripts: string) {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString(
        "package.json",
        `{ "name": "fixture", "private": true, "workspaces": ["deploy", "packages/consumer"], "scripts": ${scripts} }\n`
      );
    });

    const ackFile = (target: string, entries: ReadonlyArray<string>): string =>
      A.join(
        [
          "// Reviewed delete-package hits.",
          "{",
          '  "schemaVersion": "delete-package-acknowledgements/v1",',
          `  "target": "${target}",`,
          `  "entries": [${A.join(entries, ", ")}],`,
          "}",
          "",
        ],
        "\n"
      );

    const dryRun = Effect.gen(function* () {
      const exit = yield* Effect.exit(runDeletePackage(["deploy", "--dry-run", "--acknowledge", ACK_FILE]));
      const logs = yield* TestConsole.logLines;
      const errors = yield* TestConsole.errorLines;
      return { exit, logs, errors };
    });

    const linesIncluding = (lines: ReadonlyArray<unknown>, text: string): boolean =>
      A.some(lines, (line) => P.isString(line) && Str.includes(text)(line));

    it.effect("accepts acknowledged file-path and script hits and prints each with its reason", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* writeLiveDeployFixture([[ACK_FILE, ackFile("@beep/deploy", [README_ENTRY, SCRIPT_ENTRY])]]);

          const { exit, logs, errors } = yield* dryRun;
          assertTrue(Exit.isSuccess(exit), Exit.isFailure(exit) ? Cause.pretty(exit.cause) : undefined);
          expect(errors).toStrictEqual([]);
          expect(logs).toContain("[delete-package] ACK 2 acknowledged dependent hit(s):");
          expect(logs).toContain(`  - file-path: @beep/consumer packages/consumer/README.md:1 (${README_REASON})`);
          expect(logs).toContain(`  - script: @beep/root package.json#build:deploy (${SCRIPT_REASON})`);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses a stale entry that matches no current hit", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* writeLiveDeployFixture([
            [
              ACK_FILE,
              ackFile("@beep/deploy", [
                README_ENTRY,
                SCRIPT_ENTRY,
                ackEntry("packages/consumer/notes.md", "Gone line.", "Removed earlier."),
              ]),
            ],
          ]);

          const { exit, errors } = yield* dryRun;
          expectReportedExit(exit);
          expect(errors).toStrictEqual([
            "[delete-package] REFUSE [acknowledgement/hard] packages/consumer/notes.md line `Gone line.` matches no current dependent hit; remove the stale acknowledgement.",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses an entry whose matched count differs from its occurrences", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeLiveDeployFixture([[ACK_FILE, ackFile("@beep/deploy", [README_ENTRY, SCRIPT_ENTRY])]]);
          yield* fs.writeFileString("packages/consumer/README.md", `${README_LINE}\n\n${README_LINE}\n`);

          const refused = yield* dryRun;
          expectReportedExit(refused.exit);
          expect(refused.errors).toStrictEqual([
            "[delete-package] REFUSE [acknowledgement/hard] packages/consumer/README.md line `Reads `deploy/src/index.ts`.` matches 2 hit(s); the acknowledgement declares 1.",
          ]);

          yield* fs.writeFileString(
            ACK_FILE,
            ackFile("@beep/deploy", [
              ackEntry("packages/consumer/README.md", README_LINE, README_REASON, 2),
              SCRIPT_ENTRY,
            ])
          );
          const accepted = yield* Effect.exit(runDeletePackage(["deploy", "--dry-run", "--acknowledge", ACK_FILE]));
          assertTrue(Exit.isSuccess(accepted), Exit.isFailure(accepted) ? Cause.pretty(accepted.cause) : undefined);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses a new unacknowledged hit beside acknowledged ones", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* writeLiveDeployFixture([
            [ACK_FILE, ackFile("@beep/deploy", [README_ENTRY, SCRIPT_ENTRY])],
            ["packages/consumer/notes.md", "Also reads `deploy/src/Stack.ts`.\n"],
          ]);

          const { exit, logs, errors } = yield* dryRun;
          expectReportedExit(exit);
          expect(logs).toContain("[delete-package] ACK 2 acknowledged dependent hit(s):");
          expect(errors).toStrictEqual([
            "[delete-package] REFUSE [dependent/hard] 1 unacknowledged production/test/script/path dependent hit(s); only file-path and script hits can be acknowledged.",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses an entry that names an import-prod hit", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* writeLiveDeployFixture([
            ["packages/consumer/src/index.ts", 'import { start } from "@beep/deploy";\n\nexport const run = start;\n'],
            [
              ACK_FILE,
              ackFile("@beep/deploy", [
                README_ENTRY,
                SCRIPT_ENTRY,
                `{ "path": "packages/consumer/src/index.ts", "text": "import { start } from \\"@beep/deploy\\";", "reason": "An import, wrongly acknowledged." }`,
              ]),
            ],
          ]);

          const { exit, errors } = yield* dryRun;
          expectReportedExit(exit);
          expect(errors).toStrictEqual([
            "[delete-package] REFUSE [dependent/hard] 1 unacknowledged production/test/script/path dependent hit(s); only file-path and script hits can be acknowledged.",
            '[delete-package] REFUSE [acknowledgement/hard] packages/consumer/src/index.ts line `import { start } from "@beep/deploy";` names the import-prod hit at packages/consumer/src/index.ts:1; manifest and import edges are never acknowledged.',
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("matches an entry by text after its line moves and refuses once the text changes", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeLiveDeployFixture([[ACK_FILE, ackFile("@beep/deploy", [README_ENTRY, SCRIPT_ENTRY])]]);
          yield* fs.writeFileString("packages/consumer/README.md", `# Consumer\n\n${README_LINE}\n`);

          const moved = yield* dryRun;
          assertTrue(
            Exit.isSuccess(moved.exit),
            Exit.isFailure(moved.exit) ? Cause.pretty(moved.exit.cause) : undefined
          );
          expect(moved.logs).toContain(
            `  - file-path: @beep/consumer packages/consumer/README.md:3 (${README_REASON})`
          );

          yield* fs.writeFileString("packages/consumer/README.md", "Reads `deploy/src/main.ts`.\n");
          const changed = yield* Effect.exit(runDeletePackage(["deploy", "--dry-run", "--acknowledge", ACK_FILE]));
          expectReportedExit(changed);
          const errors = yield* TestConsole.errorLines;
          expect(linesIncluding(errors, "matches no current dependent hit")).toBe(true);
          expect(linesIncluding(errors, "1 unacknowledged production/test/script/path dependent hit(s)")).toBe(true);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses an acknowledgement file that names another target", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* writeLiveDeployFixture([[ACK_FILE, ackFile("@beep/other", [README_ENTRY, SCRIPT_ENTRY])]]);

          const { exit, logs, errors } = yield* dryRun;
          expectReportedExit(exit);
          expect(linesIncluding(logs, "[delete-package] ACK")).toBe(false);
          expect(errors).toStrictEqual([
            "[delete-package] REFUSE [dependent/hard] 2 unacknowledged production/test/script/path dependent hit(s); only file-path and script hits can be acknowledged.",
            "[delete-package] REFUSE [acknowledgement/hard] The acknowledgement file names @beep/other, not the resolved target @beep/deploy.",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("fails when the acknowledgement file cannot be read", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* writeLiveDeployFixture([]);
          const exit = yield* Effect.exit(runDeletePackage(["deploy", "--dry-run", "--acknowledge", ACK_FILE]));
          exit.pipe(Exit.isFailure, assertTrue);
          if (Exit.isFailure(exit)) {
            expect(Cause.pretty(exit.cause)).toContain(`Failed to read acknowledgement file ${ACK_FILE}.`);
          }
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    const acknowledgedPolicy = (entries: ReadonlyArray<DeletePackageAcknowledgement>) =>
      DeletePackagePolicyEvaluation.acknowledgedOccurrencesFor(
        policy({
          acknowledgements: DeletePackageAcknowledgements.makeOption({ target: "@beep/deploy", entries }),
        })
      );

    it.effect("keeps the post-apply doctor clean for acknowledged lines and residue for the rest", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const repoRoot = yield* writeDeletedDeployLayout([["packages/consumer/README.md", `${README_LINE}\n`]]);
          const acknowledgedOccurrences = acknowledgedPolicy([
            DeletePackageAcknowledgement.make({
              path: "packages/consumer/README.md",
              text: README_LINE,
              reason: README_REASON,
            }),
          ]);

          const unacknowledged = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget);
          expect(statusOf(unacknowledged, "authored-references")).toBe("residue");
          const acknowledged = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget, acknowledgedOccurrences);
          expect(statusOf(acknowledged, "authored-references")).toBe("clean");
          expect(DeletePackagePolicyEvaluation.doctorIsClean(rootDeployTarget, acknowledged)).toBe(true);

          yield* fs.writeFileString("packages/consumer/notes.md", "Builds `deploy/src/Stack.ts`.\n");
          const residue = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget, acknowledgedOccurrences);
          expect(statusOf(residue, "authored-references")).toBe("residue");
          expect(evidenceOf(residue, "authored-references")).toStrictEqual(["packages/consumer/notes.md"]);
          expect(DeletePackagePolicyEvaluation.doctorIsClean(rootDeployTarget, residue)).toBe(false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
    const readmeAcknowledgement = (occurrences: number) =>
      DeletePackageAcknowledgement.make({
        path: "packages/consumer/README.md",
        text: README_LINE,
        reason: README_REASON,
        occurrences,
      });

    it.effect("counts identical acknowledged lines in the doctor against the entry's occurrences", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const repoRoot = yield* writeDeletedDeployLayout([
            ["packages/consumer/README.md", `${README_LINE}\n\n${README_LINE}\n`],
          ]);

          const once = yield* inspectTargetAtRoot(
            repoRoot,
            rootDeployTarget,
            acknowledgedPolicy([readmeAcknowledgement(1)])
          );
          expect(statusOf(once, "authored-references")).toBe("residue");
          const twice = yield* inspectTargetAtRoot(
            repoRoot,
            rootDeployTarget,
            acknowledgedPolicy([readmeAcknowledgement(2)])
          );
          expect(statusOf(twice, "authored-references")).toBe("clean");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("keeps an acknowledged root script clean in the doctor and reports another script", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const manifest = (scripts: string) =>
            `{ "name": "fixture", "private": true, "workspaces": ["packages/tooling/deploy/x", "packages/consumer"], "scripts": ${scripts} }\n`;
          const repoRoot = yield* writeDeletedDeployLayout([
            ["package.json", manifest(`{\n    "build:deploy": "${BUILD_COMMAND}"\n  }`)],
          ]);
          const acknowledgedOccurrences = acknowledgedPolicy([
            DeletePackageAcknowledgement.make({
              path: "package.json",
              script: O.some("build:deploy"),
              text: BUILD_COMMAND,
              reason: SCRIPT_REASON,
            }),
          ]);

          const unacknowledged = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget);
          expect(evidenceOf(unacknowledged, "authored-references")).toStrictEqual(["package.json"]);
          const acknowledged = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget, acknowledgedOccurrences);
          expect(statusOf(acknowledged, "authored-references")).toBe("clean");

          const fs = yield* FileSystem.FileSystem;
          yield* fs.writeFileString(
            "package.json",
            manifest(`{\n    "build:deploy": "${BUILD_COMMAND}",\n    "rebuild:deploy": "${BUILD_COMMAND}"\n  }`)
          );
          const residue = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget, acknowledgedOccurrences);
          expect(evidenceOf(residue, "authored-references")).toStrictEqual(["package.json"]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("keeps every root script naming the target when only one is acknowledged", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* writeLiveDeployFixture([[ACK_FILE, ackFile("@beep/deploy", [README_ENTRY, SCRIPT_ENTRY])]]);
          yield* writeRootScripts(`{ "build:deploy": "${BUILD_COMMAND}", "test:deploy": "bun run --cwd deploy test" }`);

          const { exit, logs, errors } = yield* dryRun;
          expectReportedExit(exit);
          expect(logs).toContain("[delete-package] ACK 2 acknowledged dependent hit(s):");
          expect(logs).toContain("  - script: @beep/root package.json#test:deploy");
          expect(errors).toStrictEqual([
            "[delete-package] REFUSE [dependent/hard] 1 unacknowledged production/test/script/path dependent hit(s); only file-path and script hits can be acknowledged.",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("needs one acknowledgement per root script when two scripts share a command", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeLiveDeployFixture([[ACK_FILE, ackFile("@beep/deploy", [README_ENTRY, SCRIPT_ENTRY])]]);
          yield* writeRootScripts(`{ "build:deploy": "${BUILD_COMMAND}", "rebuild:deploy": "${BUILD_COMMAND}" }`);

          const oneEntry = yield* dryRun;
          expectReportedExit(oneEntry.exit);
          expect(oneEntry.errors).toStrictEqual([
            "[delete-package] REFUSE [dependent/hard] 1 unacknowledged production/test/script/path dependent hit(s); only file-path and script hits can be acknowledged.",
          ]);

          yield* fs.writeFileString(
            ACK_FILE,
            ackFile("@beep/deploy", [README_ENTRY, ackEntry("package.json", BUILD_COMMAND, SCRIPT_REASON, 2)])
          );
          const byCommand = yield* Effect.exit(runDeletePackage(["deploy", "--dry-run", "--acknowledge", ACK_FILE]));
          expectReportedExit(byCommand);
          const byCommandErrors = yield* TestConsole.errorLines;
          expect(
            linesIncluding(
              byCommandErrors,
              "package.json line `bun run --cwd deploy build` names the root script at package.json#build:deploy by its command alone; add its `script` name."
            )
          ).toBe(true);

          yield* fs.writeFileString(
            ACK_FILE,
            ackFile("@beep/deploy", [
              README_ENTRY,
              SCRIPT_ENTRY,
              scriptEntry("rebuild:deploy", BUILD_COMMAND, SCRIPT_REASON),
            ])
          );
          const perScript = yield* Effect.exit(runDeletePackage(["deploy", "--dry-run", "--acknowledge", ACK_FILE]));
          assertTrue(Exit.isSuccess(perScript), Exit.isFailure(perScript) ? Cause.pretty(perScript.cause) : undefined);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses an entry listed twice", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          yield* writeLiveDeployFixture([
            [ACK_FILE, ackFile("@beep/deploy", [README_ENTRY, SCRIPT_ENTRY, README_ENTRY])],
          ]);

          const { exit, errors } = yield* dryRun;
          expectReportedExit(exit);
          expect(errors).toStrictEqual([
            "[delete-package] REFUSE [acknowledgement/hard] packages/consumer/README.md line `Reads `deploy/src/index.ts`.` is listed more than once; merge it into one entry.",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    const dryRunWith = Effect.fn("dryRunWith")(function* (file: string) {
      const exit = yield* Effect.exit(runDeletePackage(["deploy", "--dry-run", "--acknowledge", file]));
      const logs = yield* TestConsole.logLines;
      const errors = yield* TestConsole.errorLines;
      return { exit, logs, errors };
    });

    it.effect("accepts an acknowledgement file committed under a hard-scanned root", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const scannedAck = "packages/consumer/delete-deploy.acknowledgements.jsonc";
          yield* writeLiveDeployFixture([[scannedAck, ackFile("@beep/deploy", [README_ENTRY, SCRIPT_ENTRY])]]);

          const { exit, logs, errors } = yield* dryRunWith(scannedAck);
          assertTrue(Exit.isSuccess(exit), Exit.isFailure(exit) ? Cause.pretty(exit.cause) : undefined);
          expect(errors).toStrictEqual([]);
          expect(linesIncluding(logs, scannedAck)).toBe(false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("skips only the acknowledgement file, never its neighbours", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const standardsAck = "standards/delete-deploy.acknowledgements.jsonc";
          yield* writeLiveDeployFixture([
            [standardsAck, ackFile("@beep/deploy", [README_ENTRY, SCRIPT_ENTRY])],
            ["standards/notes.md", "Retires `deploy/src/index.ts`.\n"],
            ["packages/consumer/notes.md", "Also reads `deploy/src/Stack.ts`.\n"],
          ]);

          const { exit, logs, errors } = yield* dryRunWith(standardsAck);
          expectReportedExit(exit);
          expect(linesIncluding(logs, standardsAck)).toBe(false);
          expect(logs).toContain("  - baseline: @beep/root standards/notes.md:1");
          expect(logs).toContain("  - file-path: @beep/consumer packages/consumer/notes.md:1");
          expect(errors).toStrictEqual([
            "[delete-package] REFUSE [dependent/hard] 1 unacknowledged production/test/script/path dependent hit(s); only file-path and script hits can be acknowledged.",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("keeps the post-apply doctor clean with the acknowledgement file committed", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const standardsAck = "standards/delete-deploy.acknowledgements.jsonc";
          const repoRoot = yield* writeDeletedDeployLayout([
            ["packages/consumer/README.md", `${README_LINE}\n`],
            [standardsAck, ackFile("@beep/deploy", [README_ENTRY])],
          ]);
          const acknowledgedOccurrences = acknowledgedPolicy([readmeAcknowledgement(1)]);

          const scanned = yield* inspectTargetAtRoot(repoRoot, rootDeployTarget, acknowledgedOccurrences);
          expect(evidenceOf(scanned, "authored-references")).toStrictEqual([standardsAck]);
          const skipped = yield* inspectTargetAtRoot(
            repoRoot,
            rootDeployTarget,
            acknowledgedOccurrences,
            O.some(standardsAck)
          );
          expect(statusOf(skipped, "authored-references")).toBe("clean");
          expect(DeletePackagePolicyEvaluation.doctorIsClean(rootDeployTarget, skipped)).toBe(true);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("keeps fixture git off an inherited GIT_DIR and GIT_OBJECT_DIRECTORY", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.realPath(".");
          const fixture = path.join(root, "fixture");
          const planted = path.join(root, "planted.git");
          const plantedObjects = path.join(root, "planted-objects");
          yield* fs.makeDirectory(fixture);
          yield* fs.writeFileString(path.join(fixture, "staged.txt"), "staged\n");
          // `vi.stubEnv` plants the variable in this isolated suite's inherited environment and
          // `vi.unstubAllEnvs` restores it.
          yield* Effect.acquireUseRelease(
            Effect.sync(() => {
              vi.stubEnv("GIT_DIR", planted);
              vi.stubEnv("GIT_OBJECT_DIRECTORY", plantedObjects);
            }),
            () => gitFixture(fixture),
            () => Effect.sync(() => vi.unstubAllEnvs())
          );
          const fixtureRepository = yield* fs.exists(path.join(fixture, ".git"));
          const plantedRepository = yield* fs.exists(planted);
          const plantedObjectStore = yield* fs.exists(plantedObjects);
          // `git add -A` stored `staged.txt` as a loose blob, so the fixture's own store holds it.
          const fixtureObjects = yield* fs.readDirectory(path.join(fixture, ".git", "objects"), { recursive: true });
          const looseObjects = A.filter(fixtureObjects, (entry) => /^[0-9a-f]{2}\/[0-9a-f]{38}$/.test(entry));
          expect(fixtureRepository).toBe(true);
          expect(plantedRepository).toBe(false);
          expect(plantedObjectStore).toBe(false);
          expect(A.isReadonlyArrayNonEmpty(looseObjects)).toBe(true);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  describe("delete-package hits without a line stay distinct", () => {
    const hitRows = (report: DependentsReport): ReadonlyArray<string> =>
      A.map(report.hits, (hit) => `${hit.kind}|${hit.owner}|${hit.file}`);

    const writeManifestFixture = Effect.fn("writeManifestFixture")(function* (
      workspaces: ReadonlyArray<string>,
      files: ReadonlyArray<readonly [string, string]>
    ) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* fs.realPath(".");
      yield* fs.writeFileString(
        "package.json",
        `{ "name": "fixture", "private": true, "workspaces": [${A.join(
          A.map(workspaces, (workspace) => `"${workspace}"`),
          ", "
        )}] }\n`
      );
      yield* fs.writeFileString("bun.lock", "");
      yield* Effect.forEach(
        files,
        ([file, content]) =>
          Effect.andThen(fs.makeDirectory(path.dirname(file), { recursive: true }), fs.writeFileString(file, content)),
        { concurrency: 1 }
      );
      yield* gitFixture(repoRoot);
      return repoRoot;
    });

    const deployManifest: readonly [string, string] = [
      "deploy/package.json",
      '{ "name": "@beep/deploy", "private": true }\n',
    ];

    it.effect("reports a whole-file hit for each root policy file", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const repoRoot = yield* writeManifestFixture(
            ["deploy"],
            [deployManifest, ["turbo.json", '{ "inputs": ["deploy/**"] }\n'], ["lefthook.yml", "glob: deploy/**\n"]]
          );
          const report = yield* dependentsOfAtRoot(repoRoot, rootDeployTarget);
          expect(hitRows(report)).toStrictEqual([
            "file-path|@beep/root|lefthook.yml",
            "file-path|@beep/root|turbo.json",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reports a manifest hit for each owner and each dependency bucket", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const repoRoot = yield* writeManifestFixture(
            ["deploy", "packages/a", "packages/b"],
            [
              deployManifest,
              [
                "packages/a/package.json",
                '{ "name": "@beep/a", "private": true, "dependencies": { "@beep/deploy": "workspace:*" }, "devDependencies": { "@beep/deploy": "workspace:*" } }\n',
              ],
              [
                "packages/b/package.json",
                '{ "name": "@beep/b", "private": true, "dependencies": { "@beep/deploy": "workspace:*" } }\n',
              ],
            ]
          );
          const report = yield* dependentsOfAtRoot(repoRoot, rootDeployTarget);
          expect(A.filter(hitRows(report), Str.startsWith("manifest-"))).toStrictEqual([
            "manifest-dev|@beep/a|packages/a/package.json",
            "manifest-prod|@beep/a|packages/a/package.json",
            "manifest-prod|@beep/b|packages/b/package.json",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reports a path hit for each descendant workspace", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const repoRoot = yield* writeManifestFixture(
            ["deploy", "deploy/one", "deploy/two"],
            [
              deployManifest,
              ["deploy/one/package.json", '{ "name": "@beep/deploy-one", "private": true }\n'],
              ["deploy/two/package.json", '{ "name": "@beep/deploy-two", "private": true }\n'],
            ]
          );
          const report = yield* dependentsOfAtRoot(repoRoot, rootDeployTarget);
          expect(hitRows(report)).toStrictEqual([
            "file-path|@beep/deploy-one|deploy/one/package.json",
            "file-path|@beep/deploy-two|deploy/two/package.json",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reports a script hit for each root script, even with one command", () =>
      Effect.andThen(
        temporaryGitWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const repoRoot = yield* writeManifestFixture(["deploy"], [deployManifest]);
          yield* fs.writeFileString(
            "package.json",
            '{ "name": "fixture", "private": true, "workspaces": ["deploy"], "scripts": { "a": "bun run --cwd deploy build", "b": "bun run --cwd deploy build" } }\n'
          );
          const report = yield* dependentsOfAtRoot(repoRoot, rootDeployTarget);
          expect(A.map(report.hits, (hit) => `${hit.kind}|${O.getOrElse(hit.script, () => "")}`)).toStrictEqual([
            "script|a",
            "script|b",
          ]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  describe("delete-package acknowledgement decoding", () => {
    const decodeAcknowledgements = S.decodeUnknownEffect(DeletePackageAcknowledgements);
    const document = (entry: Record<string, unknown>) => ({
      schemaVersion: "delete-package-acknowledgements/v1",
      target: "@beep/deploy",
      entries: [entry],
    });
    const entry = { path: "packages/consumer/README.md", text: "Reads it.", reason: "Reviewed." };

    it.effect("defaults occurrences to one", () =>
      Effect.gen(function* () {
        const decoded = yield* decodeAcknowledgements(document(entry));
        expect(A.map(decoded.entries, (item) => item.occurrences)).toStrictEqual([1]);
      })
    );

    const invalidEntries: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ["an empty reason", { ...entry, reason: "" }],
      ["an absolute path", { ...entry, path: "/etc/passwd" }],
      ["a parent-directory path", { ...entry, path: "packages/../../outside.md" }],
      ["a zero occurrence count", { ...entry, occurrences: 0 }],
      ["a script entry outside package.json", { ...entry, script: "build" }],
    ];

    it.effect.each(invalidEntries)("rejects %s", ([, invalid]) =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(decodeAcknowledgements(document(invalid)));
        exit.pipe(Exit.isFailure, assertTrue);
      })
    );
  });
});
