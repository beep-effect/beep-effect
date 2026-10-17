import {
  CATALOG_USAGE_TEMPLATE_SOURCES,
  CatalogUsageError,
  CatalogUsageManifest,
  CatalogUsageRootManifest,
  CatalogUsageSnapshot,
  CatalogUsageSourceLive,
  CatalogUsageTemplateReference,
  catalogTemplateReferencesFromText,
  catalogUsageReport,
  runCatalogUsageCheck,
} from "@beep/repo-cli/test/Quality";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { ChildProcess } from "effect/process";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeCommandTestLayer } from "./support/CommandTest.ts";

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const [createPackageTemplateRoot] = CATALOG_USAGE_TEMPLATE_SOURCES;

const CatalogUsageTestLayer = CatalogUsageSourceLive.pipe(Layer.provideMerge(NodeCommandTestLayer));

const findingKeys = (snapshot: CatalogUsageSnapshot): ReadonlyArray<string> =>
  A.map(
    catalogUsageReport(snapshot).findings,
    (finding) => `${finding.subject}:${finding.catalog ?? ""}:${finding.key}`
  );

const runGit = Effect.fn("CatalogUsageTest.runGit")(function* (repoRoot: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: repoRoot,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  expect(yield* handle.exitCode).toBe(0);
});

const writeRepoFile = Effect.fn("CatalogUsageTest.writeRepoFile")(function* (
  repoRoot: string,
  relativePath: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(repoRoot, relativePath);
  yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
  yield* fs.writeFileString(absolutePath, content);
});

const writeJson = (repoRoot: string, relativePath: string, document: unknown) =>
  writeRepoFile(repoRoot, relativePath, `${encodeJson(document)}\n`);

const writeFixtureRepo = Effect.fn("CatalogUsageTest.writeFixtureRepo")(function* (
  repoRoot: string,
  root: Record<string, unknown>,
  lockfilePackages: Record<string, ReadonlyArray<string>>
) {
  yield* writeJson(repoRoot, "package.json", { private: true, workspaces: ["packages/*"], ...root });
  yield* writeJson(repoRoot, "packages/demo/package.json", {
    name: "@beep/demo",
    dependencies: { effect: "catalog:", "named-dep": "catalog:tools" },
  });
  yield* writeJson(repoRoot, "bun.lock", { lockfileVersion: 1, packages: lockfilePackages });
  yield* writeRepoFile(
    repoRoot,
    `${createPackageTemplateRoot}/CreatePackage.command.ts`,
    'export const devDependencies = { "template-only": "catalog:" };\n'
  );
  yield* runGit(repoRoot, ["init"]);
  yield* runGit(repoRoot, ["add", "."]);
});

const fixtureLockfile = {
  effect: ["effect@4.0.4", "", {}, "sha512-x"],
  "via-override": ["via-override@1.0.0", "", {}, "sha512-y"],
};

describe("catalog usage", () => {
  describe("report", () => {
    it("reports a planted unused catalog entry and an inert root override", () => {
      const snapshot = CatalogUsageSnapshot.make({
        root: CatalogUsageRootManifest.make({
          catalog: { effect: "4.0.4", "left-pad": "^1.3.0" },
          catalogs: { tools: { "unused-tool": "^1.0.0" } },
          overrides: { "inert-propagator": "2.10.0", "inert-scoped@1.0.0": { child: "1.0.0" } },
        }),
        manifests: [
          CatalogUsageManifest.make({ file: "packages/demo/package.json", dependencies: { effect: "catalog:" } }),
        ],
        lockfilePackages: ["effect"],
        templateReferences: [],
      });

      expect(findingKeys(snapshot)).toEqual([
        "catalog-entry:default:left-pad",
        "catalog-entry:tools:unused-tool",
        "root-override::inert-propagator",
        "root-override::inert-scoped@1.0.0",
      ]);
    });

    it("does not report entries used only through an override, a template or a named catalog", () => {
      const snapshot = CatalogUsageSnapshot.make({
        root: CatalogUsageRootManifest.make({
          catalog: { "via-override": "^1.0.0", "template-only": "^2.0.0", "default-alias": "^3.0.0" },
          catalogs: { tools: { "named-dep": "^1.0.0" } },
          overrides: { "via-override": "catalog:", "transitive-floor@2.0.0": { nested: "catalog:" } },
        }),
        manifests: [
          CatalogUsageManifest.make({
            file: "packages/demo/package.json",
            devDependencies: { "named-dep": "catalog:tools", "default-alias": "catalog:default" },
          }),
        ],
        lockfilePackages: ["via-override", "transitive-floor"],
        templateReferences: [
          CatalogUsageTemplateReference.make({ file: "gen.ts", packageName: "template-only", catalog: "default" }),
        ],
      });

      expect(findingKeys(snapshot)).toEqual([]);
    });

    it("does not credit a default catalog entry for a named-catalog reference", () => {
      const snapshot = CatalogUsageSnapshot.make({
        root: CatalogUsageRootManifest.make({ catalog: { "named-dep": "^1.0.0" } }),
        manifests: [
          CatalogUsageManifest.make({
            file: "packages/demo/package.json",
            dependencies: { "named-dep": "catalog:tools" },
          }),
        ],
        lockfilePackages: [],
        templateReferences: [],
      });

      expect(findingKeys(snapshot)).toEqual(["catalog-entry:default:named-dep"]);
    });
  });

  it("extracts quoted and bare template catalog dependencies", () => {
    const references = catalogTemplateReferencesFromText(
      "gen.ts",
      'const deps = { effect: "catalog:", "@types/node": \'catalog:\', tool: "catalog:tools", pinned: "^1.0.0" }'
    );

    expect(A.map(references, (reference) => `${reference.catalog}:${reference.packageName}`)).toEqual([
      "default:effect",
      "default:@types/node",
      "tools:tool",
    ]);
  });

  it.layer(CatalogUsageTestLayer, { concurrent: false, timeout: "30 seconds" })((it) => {
    it.effect("fails the live gate on a planted unused catalog entry", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "catalog-usage-test-" });
        yield* writeFixtureRepo(
          tmpDir,
          {
            catalog: { effect: "4.0.4", "template-only": "^1.0.0", "planted-unused": "^9.9.9" },
            catalogs: { tools: { "named-dep": "^1.0.0" } },
          },
          fixtureLockfile
        );

        const error = yield* runCatalogUsageCheck(tmpDir).pipe(Effect.flip);

        expect(error).toBeInstanceOf(CatalogUsageError);
        expect(yield* TestConsole.errorLines).toContain("  - catalog-entry default:planted-unused");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("passes the live gate when every entry has an override, template, lockfile or named consumer", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "catalog-usage-test-" });
        yield* writeFixtureRepo(
          tmpDir,
          {
            catalog: { effect: "4.0.4", "template-only": "^1.0.0", "via-override": "^1.0.0" },
            catalogs: { tools: { "named-dep": "^1.0.0" } },
            overrides: { "via-override": "catalog:" },
          },
          fixtureLockfile
        );

        const report = yield* runCatalogUsageCheck(tmpDir);

        expect(report).toMatchObject({ catalogEntries: 4, rootOverrides: 1, manifests: 2, findings: [] });
        expect(report.templateReferences).toBeGreaterThanOrEqual(1);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reports zero unused root catalog entries and overrides in this repository", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const repoRoot = path.resolve(import.meta.dirname, "../../../../..");

        const report = yield* runCatalogUsageCheck(repoRoot);

        expect(report.findings).toEqual([]);
        expect(report.catalogEntries).toBeGreaterThan(0);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
