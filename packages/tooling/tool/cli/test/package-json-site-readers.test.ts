/**
 * The per-site package.json text readers adopted in 3-A4.
 *
 * Each site's file read hands its text to the reader exported here, so these
 * cases pin the site verdicts directly. Six sites read package.json as JSONC
 * before 3-A4 (QualityArtifactSupport, CatalogUsage manifests and root,
 * BunResolver, RootCatalog, PackageTestTypecheck); each now rejects comments
 * and trailing commas, while the same document as strict JSON still reads.
 *
 * The root workspace-pattern readers of ChangesetGraph and the Quality tasks
 * moved onto `@beep/repo-workspaces` `WorkspacePatterns` in 4-A2; their pins
 * live in that package's `WorkspacePatterns.test.ts`.
 */
import { readTestTypecheckManifest } from "@beep/repo-cli/commands/Lint";
import {
  readCatalogUsageManifest,
  readChangesetGraphWorkspaceManifest,
  readChangesetStatusWorkspacePackage,
  readPackageVerifyWorkspace,
  readQualityTaskManifest,
  readRootCatalogs,
  readWorkspacePackageText,
} from "@beep/repo-cli/test/Quality";
import { readPackageManagerField, readRootPackageJsonText } from "@beep/repo-cli/test/VersionSync";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

const jsonc =
  '{\n  // a comment\n  "name": "@beep/demo",\n  "packageManager": "bun@1.3.0",\n  "catalog": { "effect": "4.0.0" },\n  "dependencies": { "effect": "catalog:" },\n}\n';
const json =
  '{"name":"@beep/demo","packageManager":"bun@1.3.0","catalog":{"effect":"4.0.0"},"dependencies":{"effect":"catalog:"}}';
const path = "packages/demo/package.json";

describe("package.json site readers reject JSONC", () => {
  it.effect("QualityArtifactSupport", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(readWorkspacePackageText(jsonc, path, "/repo/packages/demo", "packages/demo"));
      assertTrue(Str.includes(`Failed to decode package manifest ${path}.`)(error.message));
      const info = yield* readWorkspacePackageText(json, path, "/repo/packages/demo", "packages/demo");
      strictEqual(info.name, "@beep/demo");
      deepStrictEqual(info.packageJson.dependencies, { effect: "catalog:" });
    })
  );

  it.effect("CatalogUsage manifests", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(readCatalogUsageManifest(jsonc, path));
      strictEqual(error._tag, "CatalogUsageError");
      const manifest = yield* readCatalogUsageManifest(json, path);
      deepStrictEqual(manifest.dependencies, { effect: "catalog:" });
      deepStrictEqual(manifest.devDependencies, {});
    })
  );

  it.effect("CatalogUsage root", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(readRootCatalogs(jsonc));
      strictEqual(error._tag, "CatalogUsageError");
      const root = yield* readRootCatalogs(json);
      deepStrictEqual(root.catalog, { effect: "4.0.0" });
      deepStrictEqual(root.catalogs, {});
    })
  );

  it.effect("BunResolver", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(readPackageManagerField(jsonc));
      strictEqual(error._tag, "VersionSyncError");
      strictEqual(yield* readPackageManagerField(json), "bun@1.3.0");
      strictEqual(yield* readPackageManagerField("{}"), "");
    })
  );

  it.effect("RootCatalog", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(readRootPackageJsonText(jsonc));
      strictEqual(error._tag, "VersionSyncError");
      const manifest = yield* readRootPackageJsonText(json);
      deepStrictEqual(manifest.catalog, { effect: "4.0.0" });
    })
  );

  it.effect("PackageTestTypecheck reads JSONC as no package", () =>
    Effect.gen(function* () {
      assertNone(yield* readTestTypecheckManifest(jsonc));
      const manifest = yield* readTestTypecheckManifest(json);
      assertSome(
        O.flatMapNullishOr(manifest, (document) => document.name),
        "@beep/demo"
      );
    })
  );
});

describe("package.json site readers on strict JSON", () => {
  it.effect("ChangesetGraph reads workspace members", () =>
    Effect.gen(function* () {
      const member = yield* readChangesetGraphWorkspaceManifest('{"name":"@beep/demo","private":true}', path);
      strictEqual(member.name, "@beep/demo");
      assertTrue(member.isPrivate);
    })
  );

  it.effect("ChangesetStatus requires a name", () =>
    Effect.gen(function* () {
      const workspace = yield* readChangesetStatusWorkspacePackage(
        '{"name":"@beep/demo","private":true}',
        "packages/demo"
      );
      strictEqual(workspace.publishEnabled, false);
      assertNone(workspace.version);
      const error = yield* Effect.flip(readChangesetStatusWorkspacePackage("{}", "packages/demo"));
      assertTrue(Str.includes("does not declare a package name")(error.message));
    })
  );

  it.effect("PackageVerify defaults absent scripts", () =>
    Effect.gen(function* () {
      const workspace = yield* readPackageVerifyWorkspace('{"name":"@beep/demo"}', path, "@beep/demo", "packages/demo");
      deepStrictEqual(workspace.scripts, {});
    })
  );

  it.effect("Tasks reads a member's name and scripts and rejects JSONC", () =>
    Effect.gen(function* () {
      const manifest = yield* readQualityTaskManifest('{"name":"@beep/demo","scripts":{"check":"tsc"}}', path);
      strictEqual(manifest.name, "@beep/demo");
      deepStrictEqual(manifest.scripts, { check: "tsc" });
      const error = yield* Effect.flip(readQualityTaskManifest(jsonc, "package.json"));
      strictEqual(error._tag, "QualityTaskConfigurationError");
    })
  );
});
